import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, asc, desc, eq, inArray, isNull, lt, ne, or, sql } from 'drizzle-orm';
import { OFFER_RULES, OREA_FORMS, type OfferResultRequest, type OfferTerms, type ReviewOfferRequest, type SignBackResponse } from '@klyr/contracts';
import { bankingDayDeadline, buyerEstimate, nextBankingDate, type PropertyType, TORONTO, torontoToday, torontoWhen } from '@klyr/core';
import { config } from '../config.js';
import { DB, type Db } from '../db/db.module.js';
import { auditLog, conditions, dealParties, deals, deposits, listingMedia, listings, offers, users } from '../db/schema.js';
import { DealsService } from '../deals/deals.service.js';
import { MAILER, type Mailer } from '../identity/mailer.js';
import { AssumptionsService, engineOptions } from '../listings/assumptions.service.js';
import { NotifyService } from '../notify/notify.service.js';

const HOUR = 3_600_000, DAY = 86_400_000;
const ADDRESS = sql<string>`case when ${listings.unit} is null then ${listings.address} else ${listings.address} || ' #' || ${listings.unit} end`;
const LIVE = ['sent', 'registered', 'signed_back'] as const;
const money = (n: number) => '$' + n.toLocaleString('en-CA');
const when = (d: Date) => torontoWhen(d);
const longDate = (ymd: string) => new Date(ymd + 'T12:00:00Z').toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
const ymdPlus = (days: number) => { const [y, m, d] = torontoToday(); return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10); };

type Terms = Omit<OfferTerms, 'listingId' | 'price' | 'deposit' | 'irrevocableAt'>;
type OfferRow = typeof offers.$inferSelect;
type Home = { id: string; address: string; city: string; price: number; type: PropertyType; listingBrokerage: string; coop: number; annualTax: number; condoFee: number | null; active: boolean };

const CONDITION_TEXT: Record<'financing' | 'inspection' | 'status_certificate', (days: number) => string> = {
  financing: d => `This offer is conditional on the buyer arranging a new first mortgage satisfactory to the buyer, in the buyer's sole discretion. Unless the buyer gives written notice that this condition is fulfilled by 11:59 p.m. on the ${ordinal(d)} banking day after acceptance, this offer is null and void and the deposit is returned in full without deduction.`,
  inspection: d => `This offer is conditional on an inspection of the property by a home inspector at the buyer's expense, and on the buyer's satisfaction with the results, in the buyer's sole discretion. Unless the buyer gives written notice that this condition is fulfilled by 11:59 p.m. on the ${ordinal(d)} banking day after acceptance, this offer is null and void and the deposit is returned in full without deduction. The seller allows access for the inspection.`,
  status_certificate: d => `This offer is conditional on the buyer's lawyer reviewing the status certificate and attachments and finding them satisfactory, in the lawyer's sole discretion. Unless the buyer gives written notice that this condition is fulfilled by 11:59 p.m. on the ${ordinal(d)} banking day after receiving the status certificate, this offer is null and void and the deposit is returned in full without deduction.`,
};
function ordinal(n: number) { const s = ['th', 'st', 'nd', 'rd'], v = n % 100; return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]!); }

/**
 * Offers from the buyer's side, under Klyr Realty's Form 300. Every step is audited; signing needs a
 * fresh check (step-up) and stores the signed record with its SHA-256, like Form 300.
 */
@Injectable()
export class OffersService {
  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(DealsService) private readonly deals: DealsService,
    @Inject(AssumptionsService) private readonly assumptions: AssumptionsService,
    @Inject(NotifyService) private readonly notify: NotifyService,
    @Inject(MAILER) private readonly mail: Mailer,
  ) {}

  // ── Buyer ────────────────────────────────────────────────────────────────

  async list(userId: string) {
    const deal = await this.deals.buyDeal(userId);
    if (!deal) return [];
    await this.expireDue();
    const rows = await this.db.select().from(offers).where(eq(offers.dealId, deal.id)).orderBy(desc(offers.createdAt));
    return this.present(userId, rows);
  }

  async get(userId: string, id: string) {
    const list = await this.list(userId);
    const o = list.find(x => x.id === id);
    if (!o) throw new NotFoundException();
    return o;
  }

  /** Builder defaults for a home: the buyer's draft if there is one, else asking price and the usual terms. */
  async start(userId: string, listingId: string) {
    const deal = await this.deals.buyDeal(userId);
    const home = await this.home(listingId);
    if (deal) {
      const [draft] = await this.db.select().from(offers)
        .where(and(eq(offers.dealId, deal.id), eq(offers.listingId, listingId), inArray(offers.status, ['draft', 'returned']), ne(offers.kind, 'sign_back')))
        .orderBy(desc(offers.updatedAt)).limit(1);
      if (draft) return { draft: (await this.present(userId, [draft]))[0]!, defaults: null };
    }
    const condo = home.type === 'Condo';
    const irrevocable = new Date(Date.now() + DAY); // tomorrow, 11:59 pm Toronto
    const [y, m, d] = torontoToday(irrevocable);
    return {
      draft: null,
      defaults: {
        listingId, price: home.price, deposit: Math.round((home.price * OFFER_RULES.defaultDepositPct) / 100 / 1000) * 1000,
        financingDays: OFFER_RULES.defaultConditionDays, inspectionDays: condo ? null : OFFER_RULES.defaultConditionDays,
        statusCertificateDays: condo ? OFFER_RULES.defaultConditionDays : null,
        irrevocableAt: new Date(Date.UTC(y, m - 1, d, 0, 0)).toISOString().slice(0, 10) + 'T23:59:00' + torontoOffset(irrevocable),
        closingDate: nextBankingDate(ymdPlus(60)), inclusions: 'Existing appliances, electric light fixtures and window coverings', exclusions: '', noteToAgent: '',
      },
    };
  }

  /** Creates or updates the buyer's draft for a home. */
  async saveDraft(userId: string, t: OfferTerms) {
    const status = await this.deals.buying(userId);
    if (!status.canBookVisits) throw new ConflictException({ code: 'not_ready', message: 'Sign your buyer agreement and verify your ID before making an offer.' });
    const deal = (await this.deals.buyDeal(userId))!;
    const home = await this.home(t.listingId);
    if (!home.active) throw new ConflictException({ code: 'not_available', message: 'This home is no longer for sale.' });
    const terms = this.check(t, home);
    const live = await this.db.select({ id: offers.id }).from(offers)
      .where(and(eq(offers.dealId, deal.id), eq(offers.listingId, t.listingId), inArray(offers.status, [...LIVE, 'accepted'])));
    if (live.length) throw new ConflictException({ code: 'offer_open', message: 'You already have an offer on this home. Withdraw it before making another.' });

    const values = { price: t.price, deposit: t.deposit, irrevocableAt: new Date(t.irrevocableAt), terms, updatedAt: new Date() };
    const [draft] = await this.db.select({ id: offers.id }).from(offers)
      .where(and(eq(offers.dealId, deal.id), eq(offers.listingId, t.listingId), inArray(offers.status, ['draft', 'returned']), ne(offers.kind, 'sign_back')));
    const [row] = draft
      ? await this.db.update(offers).set(values).where(eq(offers.id, draft.id)).returning()
      : await this.db.insert(offers).values({ ...values, dealId: deal.id, listingId: t.listingId, kind: 'regular', status: 'draft' }).returning();
    return (await this.present(userId, [row!]))[0]!;
  }

  /** The buyer signs (after step-up). The offer goes to their agent to review before it reaches the seller. */
  async sign(userId: string, id: string, typedName: string, client: { ip?: string; userAgent?: string }) {
    const { row, deal } = await this.ownOffer(userId, id);
    if (row.status !== 'draft' && row.status !== 'returned') throw new ConflictException({ code: 'not_draft', message: 'This offer has already been signed.' });
    const [buyer] = await this.db.select({ legalName: users.legalName }).from(users).where(eq(users.id, userId));
    this.deals.assertTypedName(typedName, buyer!.legalName ?? '');
    const home = await this.home(row.listingId);
    if (!home.active) throw new ConflictException({ code: 'not_available', message: 'This home is no longer for sale.' });
    const terms = this.check({ ...(row.terms as Terms), listingId: row.listingId, price: row.price, deposit: row.deposit, irrevocableAt: row.irrevocableAt.toISOString() }, home);

    const form = home.type === 'Condo' ? '101' : '100';
    const record = this.record(form, home, row, terms, buyer!.legalName ?? '');
    const signed = await this.deals.signRecord({ dealId: deal.id, userId, form, title: `${record.title} · ${home.address}`, record, typedName, client });
    await this.db.update(offers).set({ status: 'sent', sentAt: new Date(), documentId: signed.documentId, agentNote: null, updatedAt: new Date() }).where(eq(offers.id, id));
    if (deal.stage === 'searching' || deal.stage === 'touring') await this.db.update(deals).set({ stage: 'offer' }).where(eq(deals.id, deal.id));
    await this.db.insert(auditLog).values({ actorId: userId, action: 'offer_sign', entity: 'offer', entityId: id, data: { price: row.price, documentId: signed.documentId } });

    const agent = await this.agentOf(deal.agentId);
    await this.notify.toUser(deal.agentId, 'agent', { title: 'Offer to review', body: `${home.address} · ${money(row.price)} · open until ${when(row.irrevocableAt)}`, data: { screen: 'offers', offerId: id } });
    if (agent) await this.mail.send({ to: agent.email, subject: `Offer to review · ${home.address}`, text: `${buyer!.legalName} signed an offer of ${money(row.price)} on ${home.address}, ${home.city}.\nIrrevocable until ${when(row.irrevocableAt)}.\n\nReview it in Klyr Pro, then register it with ${home.listingBrokerage}.` });
    return this.get(userId, id);
  }

  /** Withdraw before the seller decides. */
  async withdraw(userId: string, id: string) {
    const { row, deal } = await this.ownOffer(userId, id);
    if (!['draft', 'returned', 'sent', 'registered'].includes(row.status) || row.kind === 'sign_back') {
      throw new ConflictException({ code: 'not_open', message: 'This offer can no longer be withdrawn.' });
    }
    await this.db.update(offers).set({ status: 'withdrawn', decidedAt: new Date(), updatedAt: new Date() }).where(eq(offers.id, id));
    await this.db.insert(auditLog).values({ actorId: userId, action: 'offer_withdraw', entity: 'offer', entityId: id });
    if (row.status === 'sent' || row.status === 'registered') {
      const home = await this.home(row.listingId);
      await this.notify.toUser(deal.agentId, 'agent', { title: 'Offer withdrawn by your client', body: `${home.address} · ${money(row.price)}`, data: { screen: 'offers', offerId: id } });
    }
    return { ok: true };
  }

  /** Accept (a signature, after step-up) or decline the seller's sign-back. */
  async respond(userId: string, signBackId: string, r: SignBackResponse, client: { ip?: string; userAgent?: string }) {
    await this.expireDue();
    const { row, deal } = await this.ownOffer(userId, signBackId);
    if (row.kind !== 'sign_back' || row.status !== 'signed_back') throw new ConflictException({ code: 'not_open', message: 'This sign-back is no longer open.' });
    const home = await this.home(row.listingId);
    if (r.decision === 'decline') {
      await this.db.update(offers).set({ status: 'rejected', decidedAt: new Date(), updatedAt: new Date() }).where(eq(offers.id, row.id));
      await this.db.insert(auditLog).values({ actorId: userId, action: 'sign_back_decline', entity: 'offer', entityId: row.id, data: { note: r.note ?? null } });
      await this.notify.toUser(deal.agentId, 'agent', { title: 'Sign-back declined by your client', body: `${home.address} · ${money(row.price)}`, data: { screen: 'offers', offerId: row.parentId ?? row.id } });
      return this.get(userId, row.parentId ?? row.id);
    }
    const [buyer] = await this.db.select({ legalName: users.legalName }).from(users).where(eq(users.id, userId));
    this.deals.assertTypedName(r.typedName, buyer!.legalName ?? '');
    const form = home.type === 'Condo' ? '101' : '100';
    const record = { ...this.record(form, home, row, row.terms as Terms, buyer!.legalName ?? ''), title: `Acceptance of sign-back · ${OREA_FORMS[form]}` };
    const signed = await this.deals.signRecord({ dealId: deal.id, userId, form, title: `Sign-back accepted · ${home.address}`, record, typedName: r.typedName, client });
    await this.db.update(offers).set({ documentId: signed.documentId }).where(eq(offers.id, row.id));
    await this.accept(row, userId);
    await this.notify.toUser(deal.agentId, 'agent', { title: 'Your client accepted the sign-back', body: `${home.address} · ${money(row.price)}. Deposit due within 24 hours.`, data: { screen: 'offers', offerId: row.parentId ?? row.id } });
    return this.get(userId, row.parentId ?? row.id);
  }

  /** The accepted deal: price, deposit and condition deadlines. */
  async deal(userId: string) {
    const deal = await this.deals.buyDeal(userId);
    if (!deal) return null;
    const [accepted] = await this.db.select().from(offers).where(and(eq(offers.dealId, deal.id), eq(offers.status, 'accepted'))).orderBy(desc(offers.decidedAt)).limit(1);
    if (!accepted) return null;
    const home = await this.home(accepted.listingId);
    const [dep] = await this.db.select().from(deposits).where(eq(deposits.dealId, deal.id)).orderBy(desc(deposits.dueAt)).limit(1);
    const conds = await this.db.select().from(conditions).where(eq(conditions.dealId, deal.id)).orderBy(asc(conditions.dueAt));
    const est = buyerEstimate({ price: accepted.price, city: home.city, type: home.type, coop: home.coop, tax: home.annualTax, fee: home.condoFee ?? undefined }, { ...engineOptions(await this.assumptions.get(userId)), price: accepted.price });
    const terms = accepted.terms as Terms;
    return {
      dealId: deal.id, stage: deal.stage, offerId: accepted.parentId ?? accepted.id,
      listingId: home.id, address: home.address, city: home.city, listingBrokerage: home.listingBrokerage,
      price: accepted.price, acceptedAt: accepted.decidedAt!.toISOString(), closingDate: terms.closingDate,
      deposit: dep ? { amount: dep.amount, holder: dep.holder, dueAt: dep.dueAt.toISOString(), receivedAt: dep.receivedAt?.toISOString() ?? null } : null,
      conditions: conds.map(c => ({ id: c.id, kind: c.kind, dueAt: c.dueAt.toISOString(), waivedAt: c.waivedAt?.toISOString() ?? null, fulfilledAt: c.fulfilledAt?.toISOString() ?? null })),
      allIn: est.allIn, cashBack: est.cashBack, landTransfer: est.ltt.total,
    };
  }

  // ── Agent (Klyr Pro) ─────────────────────────────────────────────────────

  async forAgent(agentId: string) {
    await this.expireDue();
    const rows = await this.db.select({ o: offers, clientId: users.id, clientName: users.legalName, clientEmail: users.email })
      .from(offers).innerJoin(deals, eq(deals.id, offers.dealId))
      .innerJoin(dealParties, and(eq(dealParties.dealId, deals.id), eq(dealParties.role, 'client')))
      .innerJoin(users, eq(users.id, dealParties.userId))
      .where(and(eq(deals.agentId, agentId), ne(offers.status, 'draft'), isNull(offers.parentId)))
      .orderBy(desc(offers.updatedAt));
    const byClient = new Map<string, OfferRow[]>();
    for (const r of rows) byClient.set(r.clientId, [...(byClient.get(r.clientId) ?? []), r.o]);
    const out = [];
    for (const [clientId, list] of byClient) {
      const presented = await this.present(clientId, list);
      for (const p of presented) {
        const r = rows.find(x => x.o.id === p.id)!;
        const accepted = p.status === 'accepted' || p.signBack?.status === 'accepted';
        const [dep] = accepted ? await this.db.select().from(deposits).where(eq(deposits.dealId, p.dealId)).orderBy(desc(deposits.dueAt)).limit(1) : [];
        out.push({
          ...p, clientId, clientName: r.clientName, clientEmail: r.clientEmail,
          depositStatus: dep ? { amount: dep.amount, holder: dep.holder, dueAt: dep.dueAt.toISOString(), receivedAt: dep.receivedAt?.toISOString() ?? null } : null,
        });
      }
    }
    return out.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  /** Register with the listing brokerage (Form 801 received), or return to the client for changes. */
  async review(agentId: string, id: string, r: ReviewOfferRequest) {
    const { row, buyer, home } = await this.agentOffer(agentId, id);
    if (row.status !== 'sent') throw new ConflictException({ code: 'not_sent', message: 'Only a newly signed offer can be reviewed.' });
    if (r.action === 'return') {
      await this.db.update(offers).set({ status: 'returned', agentNote: r.note, updatedAt: new Date() }).where(eq(offers.id, id));
      await this.db.insert(auditLog).values({ actorId: agentId, action: 'offer_return', entity: 'offer', entityId: id, data: { note: r.note } });
      await this.mail.send({ to: buyer.email, subject: `Your agent sent your offer back · ${home.address}`, text: `Your offer on ${home.address} wasn’t sent to the seller yet. Your agent says:\n\n${r.note}\n\nChange it and sign again in Klyr.\n\nKlyr Realty Inc., Brokerage` });
    } else {
      await this.db.update(offers).set({ status: 'registered', registeredAt: new Date(), agentNote: r.note ?? null, updatedAt: new Date() }).where(eq(offers.id, id));
      await this.db.insert(auditLog).values({ actorId: agentId, action: 'offer_register', entity: 'offer', entityId: id, data: { note: r.note ?? null } });
      await this.mail.send({ to: buyer.email, subject: `Your offer is with the seller · ${home.address}`, text: `Your offer of ${money(row.price)} on ${home.address} was registered with ${home.listingBrokerage}, which confirmed receipt (Form 801).\nIt is open until ${when(row.irrevocableAt)}.${r.note ? `\n\nYour agent says: ${r.note}` : ''}\n\nKlyr Realty Inc., Brokerage` });
    }
    return { id, status: r.action === 'return' ? 'returned' : 'registered' };
  }

  /** What the seller did: accepted, signed back with a new price, or not accepted. */
  async result(agentId: string, id: string, r: OfferResultRequest) {
    await this.expireDue();
    const { row, buyer, home } = await this.agentOffer(agentId, id);
    if (row.status !== 'registered') throw new ConflictException({ code: 'not_registered', message: 'Register the offer with the listing brokerage first.' });
    if (r.result === 'accepted') {
      await this.accept(row, agentId);
      return { id, status: 'accepted' };
    }
    if (r.result === 'rejected') {
      await this.db.update(offers).set({ status: 'rejected', decidedAt: new Date(), agentNote: r.note ?? row.agentNote, updatedAt: new Date() }).where(eq(offers.id, id));
      await this.db.insert(auditLog).values({ actorId: agentId, action: 'offer_rejected', entity: 'offer', entityId: id, data: { note: r.note ?? null } });
      await this.mail.send({ to: buyer.email, subject: `The seller didn’t accept your offer · ${home.address}`, text: `The seller of ${home.address} didn’t accept your offer of ${money(row.price)}. Your deposit was never cashed.${r.note ? `\n\nYour agent says: ${r.note}` : ''}\n\nYour offer details are saved, so your next offer starts from them.\n\nKlyr Realty Inc., Brokerage` });
      return { id, status: 'rejected' };
    }
    const until = new Date(r.irrevocableAt);
    if (until.getTime() < Date.now() + HOUR || until.getTime() > Date.now() + OFFER_RULES.maxIrrevocableDays * DAY) {
      throw new BadRequestException({ code: 'bad_irrevocable', message: 'The sign-back must stay open at least an hour, and not more than 7 days.' });
    }
    const [child] = await this.db.insert(offers).values({
      dealId: row.dealId, listingId: row.listingId, parentId: row.id, kind: 'sign_back', price: r.price, deposit: row.deposit,
      irrevocableAt: until, status: 'signed_back', terms: row.terms, agentNote: r.note ?? null,
    }).returning();
    await this.db.update(offers).set({ status: 'signed_back', decidedAt: new Date(), updatedAt: new Date() }).where(eq(offers.id, id));
    await this.db.insert(auditLog).values({ actorId: agentId, action: 'offer_signed_back', entity: 'offer', entityId: id, data: { signBackId: child!.id, price: r.price, irrevocableAt: r.irrevocableAt } });
    await this.mail.send({ to: buyer.email, subject: `The seller signed back · ${home.address}`, text: `The seller of ${home.address} signed your offer back at ${money(r.price)} (you offered ${money(row.price)}). Other terms are unchanged.\nIt is open until ${when(until)}.${r.note ? `\n\nYour agent says: ${r.note}` : ''}\n\nAccept or decline in Klyr.\n\nKlyr Realty Inc., Brokerage` });
    return { id, status: 'signed_back', signBackId: child!.id };
  }

  /** The listing brokerage's receipt for the deposit arrived. */
  async depositReceived(agentId: string, dealId: string) {
    const [deal] = await this.db.select().from(deals).where(and(eq(deals.id, dealId), eq(deals.agentId, agentId)));
    if (!deal) throw new NotFoundException();
    const r = await this.db.update(deposits).set({ receivedAt: new Date() }).where(and(eq(deposits.dealId, dealId), isNull(deposits.receivedAt))).returning();
    if (!r.length) throw new ConflictException({ code: 'no_deposit_due', message: 'No deposit is waiting on this deal.' });
    await this.db.insert(auditLog).values({ actorId: agentId, action: 'deposit_received', entity: 'deal', entityId: dealId, data: { amount: r[0]!.amount, holder: r[0]!.holder } });
    const [client] = await this.db.select({ email: users.email }).from(dealParties).innerJoin(users, eq(users.id, dealParties.userId)).where(and(eq(dealParties.dealId, dealId), eq(dealParties.role, 'client')));
    if (client) await this.mail.send({ to: client.email, subject: 'Your deposit was received', text: `${r[0]!.holder} confirmed it received your deposit of ${money(r[0]!.amount)}. It is held in their trust account until closing.\n\nKlyr Realty Inc., Brokerage` });
    return { ok: true };
  }

  // ── Shared ───────────────────────────────────────────────────────────────

  /**
   * Acceptance: the deal becomes conditional (or firm with no conditions), the deposit falls due in
   * 24 hours, and each condition gets its 11:59 pm banking-day deadline.
   */
  private async accept(row: OfferRow, actorId: string) {
    const at = new Date(), terms = row.terms as Terms;
    const home = await this.home(row.listingId);
    await this.db.update(offers).set({ status: 'accepted', decidedAt: at, updatedAt: at }).where(eq(offers.id, row.id));
    const conds = (['financing', 'inspection', 'status_certificate'] as const)
      .map(kind => ({ kind, days: terms[`${kind === 'status_certificate' ? 'statusCertificate' : kind}Days` as 'financingDays'] }))
      .filter((c): c is { kind: 'financing' | 'inspection' | 'status_certificate'; days: number } => !!c.days);
    if (conds.length) await this.db.insert(conditions).values(conds.map(c => ({ dealId: row.dealId, kind: c.kind, dueAt: bankingDayDeadline(at, c.days) })));
    const dueAt = new Date(at.getTime() + OFFER_RULES.depositDueHours * HOUR);
    if (row.deposit > 0) await this.db.insert(deposits).values({ dealId: row.dealId, amount: row.deposit, holder: home.listingBrokerage, dueAt });
    await this.db.update(deals).set({ stage: conds.length ? 'conditional' : 'firm', listingId: row.listingId, closingDate: terms.closingDate }).where(eq(deals.id, row.dealId));
    await this.db.insert(auditLog).values({ actorId, action: 'offer_accepted', entity: 'offer', entityId: row.id, data: { price: row.price, conditions: conds, depositDueAt: dueAt.toISOString() } });

    const [client] = await this.db.select({ email: users.email }).from(dealParties).innerJoin(users, eq(users.id, dealParties.userId)).where(and(eq(dealParties.dealId, row.dealId), eq(dealParties.role, 'client')));
    if (client) await this.mail.send({
      to: client.email, subject: `Accepted · ${home.address}`,
      text: `Your offer on ${home.address} is accepted at ${money(row.price)}.\n\n`
        + (row.deposit > 0 ? `Deposit: ${money(row.deposit)} to ${home.listingBrokerage} in trust, due by ${when(dueAt)}. Your agent sends you the trust account details. Confirm them by phone with the brokerage before you send anything.\n\n` : '')
        + (conds.length ? `Conditions:\n${conds.map(c => `· ${c.kind.replace('_', ' ')}: until ${when(bankingDayDeadline(at, c.days))}`).join('\n')}\n\n` : 'No conditions: the deal is firm.\n\n')
        + `Closing: ${longDate(terms.closingDate)}.\n\nKlyr Realty Inc., Brokerage`,
    });
  }

  /** Offers still open past their irrevocable time are void. */
  private async expireDue() {
    const now = new Date();
    await this.db.update(offers).set({ status: 'expired', updatedAt: now })
      .where(and(lt(offers.irrevocableAt, now), or(inArray(offers.status, ['sent', 'registered']), and(eq(offers.kind, 'sign_back'), eq(offers.status, 'signed_back')))));
  }

  private check(t: OfferTerms, home: Home): Terms {
    const now = Date.now(), until = Date.parse(t.irrevocableAt);
    if (t.price < home.price * 0.5 || t.price > home.price * 2) throw new BadRequestException({ code: 'bad_price', message: `Offer between ${money(Math.ceil(home.price * 0.5))} and ${money(home.price * 2)}.` });
    if (t.deposit > t.price * 0.5) throw new BadRequestException({ code: 'bad_deposit', message: 'The deposit can’t be more than half the price.' });
    if (until < now + OFFER_RULES.minIrrevocableHours * HOUR || until > now + OFFER_RULES.maxIrrevocableDays * DAY) {
      throw new BadRequestException({ code: 'bad_irrevocable', message: `Keep the offer open at least ${OFFER_RULES.minIrrevocableHours} hours from now, and not more than ${OFFER_RULES.maxIrrevocableDays} days.` });
    }
    if (t.closingDate < ymdPlus(OFFER_RULES.minClosingDays) || t.closingDate > ymdPlus(OFFER_RULES.maxClosingDays)) {
      throw new BadRequestException({ code: 'bad_closing', message: `Pick a closing date ${OFFER_RULES.minClosingDays} days to a year from today.` });
    }
    if (nextBankingDate(t.closingDate) !== t.closingDate) {
      throw new BadRequestException({ code: 'closing_not_banking_day', message: `The land registry is closed that day. The next open day is ${longDate(nextBankingDate(t.closingDate))}.` });
    }
    return {
      financingDays: t.financingDays, inspectionDays: t.inspectionDays,
      statusCertificateDays: home.type === 'Condo' ? t.statusCertificateDays : null,
      closingDate: t.closingDate, inclusions: t.inclusions, exclusions: t.exclusions ?? '', noteToAgent: t.noteToAgent ?? '',
    };
  }

  /** What the signer agrees to: a plain-language summary of Form 100/101 and Schedule A. */
  private record(form: '100' | '101', home: Home, row: OfferRow, terms: Terms, buyer: string) {
    const schedule = (['financing', 'inspection', 'status_certificate'] as const)
      .map(k => [k, terms[`${k === 'status_certificate' ? 'statusCertificate' : k}Days` as 'financingDays']] as const)
      .filter(([, d]) => !!d).map(([k, d]) => [k === 'status_certificate' ? 'Status certificate' : k[0]!.toUpperCase() + k.slice(1), CONDITION_TEXT[k](d!)] as [string, string]);
    return {
      form, title: OREA_FORMS[form], version: 'summary-2026-10',
      buyer, seller: 'The registered owner(s)', property: `${home.address}, ${home.city}, Ontario`,
      clauses: [
        ['Price', `${money(row.price)} in Canadian dollars.`],
        ['Deposit', row.deposit > 0 ? `${money(row.deposit)}, upon acceptance (within 24 hours), payable to ${home.listingBrokerage} in trust, to be credited toward the price on completion.` : 'No deposit.'],
        ['Irrevocable', `Open for the seller to accept until ${when(row.irrevocableAt)}, after which it is null and void and any deposit is returned in full.`],
        ['Completion', `Closing on ${longDate(terms.closingDate)}.`],
        ['Included', terms.inclusions || 'Nothing beyond the property.'],
        ...(terms.exclusions ? [['Excluded', terms.exclusions] as [string, string]] : []),
        ...schedule,
        ...(schedule.length ? [] : [['Conditions', 'None. Once accepted, the agreement is firm and binding.'] as [string, string]]),
      ] as [string, string][],
      note: 'This is Klyr’s plain-language summary of the OREA form’s main terms. The standard OREA clauses apply in full.',
    };
  }

  private async home(listingId: string): Promise<Home> {
    const [h] = await this.db.select({
      id: listings.id, address: ADDRESS, city: listings.city, price: listings.price, type: listings.propertyType, listingBrokerage: listings.listingBrokerage,
      coop: listings.coop, annualTax: listings.annualTax, condoFee: listings.condoFee, status: listings.status, internetDisplay: listings.internetDisplay,
    }).from(listings).where(eq(listings.id, listingId));
    if (!h) throw new NotFoundException();
    return { ...h, type: h.type as PropertyType, coop: Number(h.coop ?? 0.025), annualTax: h.annualTax ?? 0, active: h.status === 'active' && h.internetDisplay };
  }

  private async ownOffer(userId: string, id: string) {
    const deal = await this.deals.buyDeal(userId);
    if (!deal) throw new NotFoundException();
    const [row] = await this.db.select().from(offers).where(and(eq(offers.id, id), eq(offers.dealId, deal.id)));
    if (!row) throw new NotFoundException();
    return { row, deal };
  }

  private async agentOffer(agentId: string, id: string) {
    const [r] = await this.db.select({ o: offers, email: users.email, name: users.legalName }).from(offers)
      .innerJoin(deals, eq(deals.id, offers.dealId))
      .innerJoin(dealParties, and(eq(dealParties.dealId, deals.id), eq(dealParties.role, 'client')))
      .innerJoin(users, eq(users.id, dealParties.userId))
      .where(and(eq(offers.id, id), eq(deals.agentId, agentId)));
    if (!r) throw new NotFoundException();
    return { row: r.o, buyer: { email: r.email, name: r.name }, home: await this.home(r.o.listingId) };
  }

  private async agentOf(agentId: string) {
    const [a] = await this.db.select({ email: users.email }).from(users).where(eq(users.id, agentId));
    return a ?? null;
  }

  /** Offers as the apps show them: the home, the all-in at the offered price, and any sign-back. */
  private async present(userId: string, rows: OfferRow[]) {
    const mine = await this.assumptions.get(userId);
    const top = rows.filter(r => r.kind !== 'sign_back');
    const children = rows.length ? await this.db.select().from(offers).where(inArray(offers.parentId, rows.map(r => r.id))).orderBy(desc(offers.createdAt)) : [];
    const photos = top.length ? await this.db.select({ listingId: listingMedia.listingId, url: listingMedia.url, alt: listingMedia.altText }).from(listingMedia)
      .where(and(inArray(listingMedia.listingId, top.map(r => r.listingId)), eq(listingMedia.position, 0))) : [];
    const out = [];
    for (const r of top) {
      const home = await this.home(r.listingId);
      const est = buyerEstimate({ price: r.price, city: home.city, type: home.type, coop: home.coop, tax: home.annualTax, fee: home.condoFee ?? undefined }, { ...engineOptions(mine), price: r.price });
      const sb = children.find(c => c.parentId === r.id);
      const p = photos.find(x => x.listingId === r.listingId);
      const terms = r.terms as Terms;
      out.push({
        id: r.id, dealId: r.dealId, listingId: r.listingId, address: home.address, city: home.city, listingBrokerage: home.listingBrokerage, askingPrice: home.price,
        form: home.type === 'Condo' ? '101' as const : '100' as const,
        photo: p ? { url: p.url.startsWith('/') ? config.mediaBaseUrl + p.url : p.url, alt: p.alt ?? '' } : null,
        status: r.status, price: r.price, deposit: r.deposit, irrevocableAt: r.irrevocableAt.toISOString(), terms,
        agentNote: r.agentNote, documentId: r.documentId,
        sentAt: r.sentAt?.toISOString() ?? null, registeredAt: r.registeredAt?.toISOString() ?? null, decidedAt: r.decidedAt?.toISOString() ?? null,
        updatedAt: r.updatedAt.toISOString(),
        allIn: est.allIn, cashBack: est.cashBack, landTransfer: est.ltt.total,
        signBack: sb ? { id: sb.id, price: sb.price, irrevocableAt: sb.irrevocableAt.toISOString(), status: sb.status, agentNote: sb.agentNote, decidedAt: sb.decidedAt?.toISOString() ?? null } : null,
      });
    }
    return out;
  }
}

/** "-04:00" or "-05:00": Toronto's offset at an instant, for an ISO string in local time. */
function torontoOffset(at: Date) {
  const name = new Intl.DateTimeFormat('en-US', { timeZone: TORONTO, timeZoneName: 'longOffset' }).formatToParts(at).find(p => p.type === 'timeZoneName')?.value ?? 'GMT-05:00';
  return name.replace('GMT', '') || '+00:00';
}
