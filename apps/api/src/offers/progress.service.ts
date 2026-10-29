import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, asc, desc, eq, gt, inArray, isNull, lt, lte } from 'drizzle-orm';
import type { AmendmentRequest } from '@klyr/contracts';
import { buyerEstimate, calendarDate, nextBankingDate, torontoInstant, torontoToday, torontoWhen } from '@klyr/core';
import { DB, type Db } from '../db/db.module.js';
import { agents, amendments, auditLog, conditions, dealParties, deals, deposits, documents, offers, users } from '../db/schema.js';
import { DealsService } from '../deals/deals.service.js';
import { MAILER, type Mailer } from '../identity/mailer.js';
import { AssumptionsService, engineOptions } from '../listings/assumptions.service.js';
import { NotifyService } from '../notify/notify.service.js';
import { loadHome } from './offers.service.js';

const HOUR = 3_600_000;
const money = (n: number) => '$' + n.toLocaleString('en-CA');
const SIGN = 'Klyr Realty Inc., Brokerage';
type Kind = typeof conditions.$inferSelect['kind'];
const NAME: Record<Kind, string> = { financing: 'financing', inspection: 'inspection', status_certificate: 'status certificate', sale_of_buyer_home: 'sale of your home', other: 'other' };
type Client = { ip?: string; userAgent?: string };
type Changes = { closingDate?: string; extend?: { conditionId: string; kind: Kind; from: string; until: string }[] };

/** Before the deposit is due / a condition ends, the buyer and agent are reminded once. */
export const REMINDER = { depositHours: 6, conditionHours: 24 } as const;

/**
 * After acceptance: Form 123 notices (signed by the buyer, delivered by the agent), lapse at the deadline,
 * Form 122 mutual release and the deposit's return, the trust-account call-back, and reminders.
 */
@Injectable()
export class DealProgressService {
  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(DealsService) private readonly deals: DealsService,
    @Inject(AssumptionsService) private readonly assumptions: AssumptionsService,
    @Inject(NotifyService) private readonly notify: NotifyService,
    @Inject(MAILER) private readonly mail: Mailer,
  ) {}

  // ── Views ────────────────────────────────────────────────────────────────

  /** The buyer's deal: the accepted offer (or the one that went void), deposit, conditions, release. */
  async forBuyer(userId: string) {
    await this.lapseDue();
    const deal = await this.deals.buyDeal(userId);
    return deal ? this.view(deal.id, userId) : null;
  }

  /** Deals with an accepted or void offer, for the agent. */
  async forAgent(agentId: string) {
    await this.lapseDue();
    const rows = await this.db.selectDistinct({ dealId: offers.dealId, clientId: users.id, clientName: users.legalName, clientEmail: users.email })
      .from(offers).innerJoin(deals, eq(deals.id, offers.dealId))
      .innerJoin(dealParties, and(eq(dealParties.dealId, deals.id), eq(dealParties.role, 'client')))
      .innerJoin(users, eq(users.id, dealParties.userId))
      .where(and(eq(deals.agentId, agentId), inArray(offers.status, ['accepted', 'void'])));
    const out = [];
    for (const r of rows) {
      const v = await this.view(r.dealId, r.clientId);
      if (v) out.push({ ...v, clientName: r.clientName, clientEmail: r.clientEmail });
    }
    return out.sort((a, b) => b.acceptedAt.localeCompare(a.acceptedAt));
  }

  private async view(dealId: string, clientId: string) {
    const [deal] = await this.db.select().from(deals).where(eq(deals.id, dealId));
    const [o] = await this.db.select().from(offers).where(and(eq(offers.dealId, dealId), inArray(offers.status, ['accepted', 'void']))).orderBy(desc(offers.decidedAt)).limit(1);
    if (!deal || !o) return null;
    const home = await loadHome(this.db, o.listingId);
    const [dep] = await this.db.select().from(deposits).where(eq(deposits.dealId, dealId)).orderBy(desc(deposits.dueAt)).limit(1);
    const conds = await this.db.select().from(conditions).where(eq(conditions.dealId, dealId)).orderBy(asc(conditions.dueAt));
    const release = o.status === 'void' ? await this.releaseDoc(dealId, o.decidedAt!) : null;
    const amends = await this.db.select().from(amendments).where(eq(amendments.offerId, o.id)).orderBy(desc(amendments.createdAt));
    const est = buyerEstimate({ price: o.price, city: home.city, type: home.type, coop: home.coop, tax: home.annualTax, fee: home.condoFee ?? undefined },
      { ...engineOptions(await this.assumptions.get(clientId)), price: o.price });
    const iso = (d: Date | null) => d?.toISOString() ?? null;
    return {
      dealId, stage: deal.stage, status: o.status as 'accepted' | 'void', offerId: o.parentId ?? o.id,
      listingId: home.id, address: home.address, city: home.city, listingBrokerage: home.listingBrokerage,
      price: o.price, acceptedAt: o.decidedAt!.toISOString(), closingDate: (o.terms as { closingDate: string }).closingDate,
      deposit: dep ? {
        amount: dep.amount, holder: dep.holder, dueAt: dep.dueAt.toISOString(), receivedAt: iso(dep.receivedAt),
        trustVerifiedAt: iso(dep.trustVerifiedAt), trustVerifiedBy: dep.trustAccountVerifiedBy, returnedAt: iso(dep.returnedAt),
      } : null,
      conditions: conds.map(c => ({
        id: c.id, kind: c.kind, dueAt: c.dueAt.toISOString(), waivedAt: iso(c.waivedAt), fulfilledAt: iso(c.fulfilledAt),
        documentId: c.documentId, deliveredAt: iso(c.deliveredAt), lapsedAt: iso(c.lapsedAt),
      })),
      release: release ? { documentId: release.id, signedAt: release.createdAt.toISOString() } : null,
      amendments: amends.map(a => ({ id: a.id, status: a.status, changes: a.changes as Changes, documentId: a.documentId, agentNote: a.agentNote, createdAt: a.createdAt.toISOString(), decidedAt: iso(a.decidedAt) })),
      allIn: est.allIn, cashBack: est.cashBack, landTransfer: est.ltt.total,
    };
  }

  // ── Buyer ────────────────────────────────────────────────────────────────

  /** Waiver or notice of fulfillment (Form 123), signed after a fresh check. It counts once the agent delivers it. */
  async notice(userId: string, conditionId: string, action: 'waive' | 'fulfil', typedName: string, client: Client) {
    await this.lapseDue();
    const deal = await this.deals.buyDeal(userId);
    const [c] = deal ? await this.db.select().from(conditions).where(and(eq(conditions.id, conditionId), eq(conditions.dealId, deal.id))) : [];
    if (!deal || !c) throw new NotFoundException();
    if (c.lapsedAt || c.dueAt < new Date()) throw new ConflictException({ code: 'condition_lapsed', message: 'This condition’s deadline has passed.' });
    if (c.waivedAt || c.fulfilledAt) throw new ConflictException({ code: 'already_signed', message: 'You already signed a notice for this condition.' });
    const [o] = await this.db.select().from(offers).where(and(eq(offers.dealId, deal.id), eq(offers.status, 'accepted')));
    if (!o) throw new ConflictException({ code: 'agreement_void', message: 'This agreement has ended, so there is nothing left to waive.' });
    const [buyer] = await this.db.select({ legalName: users.legalName }).from(users).where(eq(users.id, userId));
    this.deals.assertTypedName(typedName, buyer!.legalName ?? '');
    const home = await loadHome(this.db, o.listingId);
    const title = action === 'waive' ? 'Waiver' : 'Notice of Fulfillment of Condition';
    const record = {
      form: '123', title, buyer: buyer!.legalName, property: `${home.address}, ${home.city}, Ontario`, condition: c.kind,
      clauses: [[title, action === 'waive'
        ? `The buyer waives the ${NAME[c.kind]} condition in the Agreement of Purchase and Sale accepted ${torontoWhen(o.decidedAt!)}.`
        : `The buyer gives notice that the ${NAME[c.kind]} condition in the Agreement of Purchase and Sale accepted ${torontoWhen(o.decidedAt!)} is fulfilled.`],
      ['Delivery', `Effective when delivered to the seller or the seller's brokerage (${home.listingBrokerage}) before ${torontoWhen(c.dueAt)}.`]],
      note: 'Klyr’s plain-language summary of OREA Form 123. The standard OREA terms apply in full.',
    };
    const signed = await this.deals.signRecord({ dealId: deal.id, userId, form: '123', title: `${title} · ${NAME[c.kind]} · ${home.address}`, record, typedName, client });
    const at = new Date();
    await this.db.update(conditions).set({ ...(action === 'waive' ? { waivedAt: at } : { fulfilledAt: at }), documentId: signed.documentId }).where(eq(conditions.id, c.id));
    await this.db.insert(auditLog).values({ actorId: userId, action: `condition_${action}`, entity: 'condition', entityId: c.id, data: { documentId: signed.documentId } });
    await this.notify.toUser(deal.agentId, 'agent', { title: 'Deliver your client’s notice', body: `${home.address} · ${NAME[c.kind]} · before ${torontoWhen(c.dueAt)}`, data: { screen: 'deals', dealId: deal.id } });
    const agent = await this.email(deal.agentId);
    if (agent) await this.mail.send({ to: agent, subject: `Deliver now · ${title} · ${home.address}`, text: `Your client signed a ${title.toLowerCase()} for the ${NAME[c.kind]} condition on ${home.address}.\nDeliver it to ${home.listingBrokerage} before ${torontoWhen(c.dueAt)}, then mark it delivered in Klyr Pro.` });
    return this.forBuyer(userId);
  }

  /** Mutual release (Form 122) after the deal went void: the deposit comes back in full. */
  async release(userId: string, typedName: string, client: Client) {
    const deal = await this.deals.buyDeal(userId);
    const [o] = deal ? await this.db.select().from(offers).where(and(eq(offers.dealId, deal.id), eq(offers.status, 'void'))).orderBy(desc(offers.decidedAt)).limit(1) : [];
    if (!deal || !o) throw new ConflictException({ code: 'nothing_to_release', message: 'There’s no ended deal to release.' });
    if (await this.releaseDoc(deal.id, o.decidedAt!)) throw new ConflictException({ code: 'already_signed', message: 'You already signed the release.' });
    const [buyer] = await this.db.select({ legalName: users.legalName }).from(users).where(eq(users.id, userId));
    this.deals.assertTypedName(typedName, buyer!.legalName ?? '');
    const home = await loadHome(this.db, o.listingId);
    const [dep] = await this.db.select().from(deposits).where(eq(deposits.dealId, deal.id)).orderBy(desc(deposits.dueAt)).limit(1);
    const record = {
      form: '122', title: 'Mutual Release', buyer: buyer!.legalName, property: `${home.address}, ${home.city}, Ontario`,
      clauses: [
        ['Release', `The buyer and seller release each other from the Agreement of Purchase and Sale accepted ${torontoWhen(o.decidedAt!)}, which became void when a condition was not met in time.`],
        ['Deposit', dep ? `${home.listingBrokerage} is directed to return the deposit of ${money(dep.amount)} to the buyer in full, without deduction.` : 'No deposit was paid.'],
        ['Commission', 'Neither brokerage claims commission on this agreement.'],
      ],
      note: 'Klyr’s plain-language summary of OREA Form 122. The seller signs their own copy through the listing brokerage.',
    };
    const signed = await this.deals.signRecord({ dealId: deal.id, userId, form: '122', title: `Mutual Release · ${home.address}`, record, typedName, client });
    await this.db.insert(auditLog).values({ actorId: userId, action: 'release_sign', entity: 'deal', entityId: deal.id, data: { documentId: signed.documentId } });
    await this.notify.toUser(deal.agentId, 'agent', { title: 'Your client signed the release', body: `${home.address} · get the seller’s signature and the deposit back`, data: { screen: 'deals', dealId: deal.id } });
    return this.forBuyer(userId);
  }

  /** Form 120, signed by the buyer: a new closing date and/or later condition deadlines. One open at a time. */
  async proposeAmendment(userId: string, req: AmendmentRequest, client: Client) {
    await this.lapseDue();
    const deal = await this.deals.buyDeal(userId);
    const [o] = deal ? await this.db.select().from(offers).where(and(eq(offers.dealId, deal.id), eq(offers.status, 'accepted'))) : [];
    if (!deal || !o) throw new ConflictException({ code: 'no_agreement', message: 'There’s no accepted agreement to change.' });
    const [open] = await this.db.select({ id: amendments.id }).from(amendments).where(and(eq(amendments.offerId, o.id), eq(amendments.status, 'signed')));
    if (open) throw new ConflictException({ code: 'amendment_open', message: 'You already have a change waiting for the seller. Withdraw it first.' });
    const terms = o.terms as { closingDate: string };
    const today = (() => { const [y, m, d] = torontoToday(); return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`; })();
    const changes: Changes = {};
    if (req.closingDate) {
      if (req.closingDate === terms.closingDate) throw new BadRequestException({ code: 'same_closing', message: 'That’s already your closing date.' });
      if (req.closingDate <= today) throw new BadRequestException({ code: 'bad_closing', message: 'Pick a closing date after today.' });
      if (nextBankingDate(req.closingDate) !== req.closingDate) throw new BadRequestException({ code: 'closing_not_banking_day', message: `The land registry is closed that day. The next open day is ${calendarDate(nextBankingDate(req.closingDate))}.` });
      changes.closingDate = req.closingDate;
    }
    if (req.extend.length) {
      const conds = await this.db.select().from(conditions).where(and(eq(conditions.dealId, deal.id), inArray(conditions.id, req.extend.map(e => e.conditionId))));
      changes.extend = req.extend.map(e => {
        const c = conds.find(x => x.id === e.conditionId);
        if (!c) throw new NotFoundException();
        if (c.deliveredAt || c.lapsedAt) throw new ConflictException({ code: 'condition_closed', message: `The ${NAME[c.kind]} condition is already settled.` });
        const [y, m, d] = e.until.split('-').map(Number) as [number, number, number];
        const until = torontoInstant(y, m, d, 23, 59);
        if (until <= c.dueAt) throw new BadRequestException({ code: 'not_later', message: `Pick a date after the current ${NAME[c.kind]} deadline.` });
        if (nextBankingDate(e.until) !== e.until) throw new BadRequestException({ code: 'not_banking_day', message: 'Pick a banking day for the new deadline.' });
        return { conditionId: c.id, kind: c.kind, from: c.dueAt.toISOString(), until: until.toISOString() };
      });
    }
    const [buyer] = await this.db.select({ legalName: users.legalName }).from(users).where(eq(users.id, userId));
    this.deals.assertTypedName(req.typedName, buyer!.legalName ?? '');
    const home = await loadHome(this.db, o.listingId);
    const clauses: [string, string][] = [
      ...(changes.closingDate ? [['Completion', `The completion date changes from ${calendarDate(terms.closingDate)} to ${calendarDate(changes.closingDate)}.`] as [string, string]] : []),
      ...(changes.extend ?? []).map(e => ['Condition', `The ${NAME[e.kind]} condition is extended from ${torontoWhen(e.from)} to ${torontoWhen(e.until)}.`] as [string, string]),
      ['Everything else', 'All other terms of the agreement stay the same.'],
    ];
    const record = { form: '120', title: 'Amendment to Agreement of Purchase and Sale', buyer: buyer!.legalName, property: `${home.address}, ${home.city}, Ontario`, clauses,
      note: 'Klyr’s plain-language summary of OREA Form 120. It changes the agreement only once the seller accepts it.' };
    const signed = await this.deals.signRecord({ dealId: deal.id, userId, form: '120', title: `Amendment · ${home.address}`, record, typedName: req.typedName, client });
    const [a] = await this.db.insert(amendments).values({ dealId: deal.id, offerId: o.id, changes, status: 'signed', documentId: signed.documentId }).returning();
    await this.db.insert(auditLog).values({ actorId: userId, action: 'amendment_sign', entity: 'amendment', entityId: a!.id, data: changes });
    await this.notify.toUser(deal.agentId, 'agent', { title: 'Amendment to present', body: home.address, data: { screen: 'deals', dealId: deal.id } });
    const agent = await this.email(deal.agentId);
    if (agent) await this.mail.send({ to: agent, subject: `Amendment to present · ${home.address}`, text: `Your client signed an amendment (Form 120):\n${clauses.slice(0, -1).map(c => `· ${c[1]}`).join('\n')}\n\nPresent it to ${home.listingBrokerage} and record the seller’s answer in Klyr Pro.` });
    return this.forBuyer(userId);
  }

  async withdrawAmendment(userId: string, id: string) {
    const deal = await this.deals.buyDeal(userId);
    const r = deal ? await this.db.update(amendments).set({ status: 'withdrawn', decidedAt: new Date() })
      .where(and(eq(amendments.id, id), eq(amendments.dealId, deal.id), eq(amendments.status, 'signed'))).returning() : [];
    if (!r.length) throw new ConflictException({ code: 'not_open', message: 'This change can no longer be withdrawn.' });
    await this.db.insert(auditLog).values({ actorId: userId, action: 'amendment_withdraw', entity: 'amendment', entityId: id });
    return this.forBuyer(userId);
  }

  // ── Agent ────────────────────────────────────────────────────────────────

  /** The seller accepted or refused the amendment. Accepted changes apply now, if the conditions are still open. */
  async amendmentResult(agentId: string, id: string, result: 'accepted' | 'rejected', note?: string) {
    await this.lapseDue();
    const [r] = await this.db.select({ a: amendments, deal: deals }).from(amendments).innerJoin(deals, eq(deals.id, amendments.dealId))
      .where(and(eq(amendments.id, id), eq(deals.agentId, agentId)));
    if (!r) throw new NotFoundException();
    if (r.a.status !== 'signed') throw new ConflictException({ code: 'not_open', message: 'This amendment was already decided or withdrawn.' });
    const changes = r.a.changes as Changes;
    if (result === 'accepted') {
      const [o] = await this.db.select().from(offers).where(and(eq(offers.id, r.a.offerId), eq(offers.status, 'accepted')));
      if (!o) throw new ConflictException({ code: 'agreement_void', message: 'The agreement ended before the seller accepted.' });
      for (const e of changes.extend ?? []) {
        const [c] = await this.db.select().from(conditions).where(eq(conditions.id, e.conditionId));
        if (!c || c.lapsedAt || c.deliveredAt) throw new ConflictException({ code: 'too_late', message: 'A condition in this amendment is already settled or lapsed.' });
      }
      for (const e of changes.extend ?? []) await this.db.update(conditions).set({ dueAt: new Date(e.until), reminderSentAt: null }).where(eq(conditions.id, e.conditionId));
      if (changes.closingDate) {
        await this.db.update(offers).set({ terms: { ...(o.terms as object), closingDate: changes.closingDate }, updatedAt: new Date() }).where(eq(offers.id, o.id));
        await this.db.update(deals).set({ closingDate: changes.closingDate }).where(eq(deals.id, r.deal.id));
      }
    }
    await this.db.update(amendments).set({ status: result, decidedAt: new Date(), agentNote: note ?? null }).where(eq(amendments.id, id));
    await this.db.insert(auditLog).values({ actorId: agentId, action: `amendment_${result}`, entity: 'amendment', entityId: id, data: { note: note ?? null } });
    const buyer = await this.client(r.deal.id);
    if (buyer) {
      const title = result === 'accepted' ? 'The seller agreed to your change' : 'The seller didn’t agree to your change';
      await this.mail.send({ to: buyer.email, subject: title, text: `${result === 'accepted' ? 'Your amendment is now part of the agreement.' : 'The agreement stays as it was.'}${note ? `\n\nYour agent says: ${note}` : ''}\n\n${SIGN}` });
      await this.notify.toUser(buyer.id, 'consumer', { title, body: 'Open your deal for the details', data: { screen: 'deal' } });
    }
    return { id, status: result };
  }


  /** The agent delivered the signed notice to the listing brokerage. All conditions delivered → firm. */
  async deliver(agentId: string, conditionId: string) {
    await this.lapseDue();
    const [r] = await this.db.select({ c: conditions, deal: deals }).from(conditions).innerJoin(deals, eq(deals.id, conditions.dealId))
      .where(and(eq(conditions.id, conditionId), eq(deals.agentId, agentId)));
    if (!r) throw new NotFoundException();
    if (r.c.lapsedAt) throw new ConflictException({ code: 'condition_lapsed', message: 'The deadline passed before delivery: the agreement is void.' });
    if (!r.c.waivedAt && !r.c.fulfilledAt) throw new ConflictException({ code: 'not_signed', message: 'Your client hasn’t signed a notice for this condition.' });
    if (r.c.deliveredAt) throw new ConflictException({ code: 'already_delivered', message: 'Already delivered.' });
    const [live] = await this.db.select({ id: offers.id }).from(offers).where(and(eq(offers.dealId, r.deal.id), eq(offers.status, 'accepted')));
    if (!live) throw new ConflictException({ code: 'agreement_void', message: 'This agreement has ended.' });
    await this.db.update(conditions).set({ deliveredAt: new Date() }).where(eq(conditions.id, conditionId));
    await this.db.insert(auditLog).values({ actorId: agentId, action: 'condition_delivered', entity: 'condition', entityId: conditionId });
    const open = await this.db.select({ id: conditions.id }).from(conditions).where(and(eq(conditions.dealId, r.deal.id), isNull(conditions.deliveredAt)));
    const firm = open.length === 0;
    if (firm) await this.db.update(deals).set({ stage: 'firm' }).where(eq(deals.id, r.deal.id));
    const buyer = await this.client(r.deal.id);
    if (buyer) {
      const text = firm ? 'Every condition is removed: your deal is firm. Next: your lawyer, mortgage instructions and home insurance.' : `Your ${NAME[r.c.kind]} notice was delivered to the seller’s brokerage. Other conditions are still open.`;
      await this.mail.send({ to: buyer.email, subject: firm ? 'Your deal is firm' : 'Condition removed', text: `${text}\n\n${SIGN}` });
      await this.notify.toUser(buyer.id, 'consumer', { title: firm ? 'Your deal is firm' : 'Condition removed', body: text, data: { screen: 'deal' } });
    }
    return { id: conditionId, firm };
  }

  /** The agent phoned the listing brokerage at a number they looked up and confirmed the trust account details. */
  async trustVerified(agentId: string, dealId: string, note: string) {
    const deal = await this.ownDeal(agentId, dealId);
    const [a] = await this.db.select({ name: agents.registeredName }).from(agents).where(eq(agents.userId, agentId));
    const r = await this.db.update(deposits).set({ trustVerifiedAt: new Date(), trustAccountVerifiedBy: `${a?.name ?? 'Agent'}: ${note}` })
      .where(and(eq(deposits.dealId, deal.id), isNull(deposits.receivedAt))).returning();
    if (!r.length) throw new ConflictException({ code: 'no_deposit_due', message: 'No deposit is waiting on this deal.' });
    await this.db.insert(auditLog).values({ actorId: agentId, action: 'trust_verified', entity: 'deal', entityId: dealId, data: { note } });
    const buyer = await this.client(dealId);
    if (buyer) await this.mail.send({ to: buyer.email, subject: 'Trust account details confirmed', text: `${a?.name ?? 'Your agent'} phoned ${r[0]!.holder} and confirmed the trust account details for your ${money(r[0]!.amount)} deposit.\nIf anyone sends you different banking details, don’t use them: call your agent.\n\n${SIGN}` });
    return { ok: true };
  }

  /** The deposit came back to the buyer after the release. */
  async depositReturned(agentId: string, dealId: string) {
    const deal = await this.ownDeal(agentId, dealId);
    const [o] = await this.db.select().from(offers).where(and(eq(offers.dealId, deal.id), eq(offers.status, 'void'))).orderBy(desc(offers.decidedAt)).limit(1);
    if (!o || !(await this.releaseDoc(deal.id, o.decidedAt!))) throw new ConflictException({ code: 'release_needed', message: 'Your client signs the mutual release first.' });
    const r = await this.db.update(deposits).set({ returnedAt: new Date() }).where(and(eq(deposits.dealId, deal.id), isNull(deposits.returnedAt))).returning();
    if (!r.length) throw new ConflictException({ code: 'nothing_to_return', message: 'No deposit is waiting to come back.' });
    await this.db.insert(auditLog).values({ actorId: agentId, action: 'deposit_returned', entity: 'deal', entityId: dealId, data: { amount: r[0]!.amount } });
    const buyer = await this.client(dealId);
    if (buyer) await this.mail.send({ to: buyer.email, subject: 'Your deposit is on its way back', text: `${r[0]!.holder} is returning your deposit of ${money(r[0]!.amount)} in full.\n\n${SIGN}` });
    return { ok: true };
  }

  // ── Deadlines (worker, and on every read) ────────────────────────────────

  lapseDue(now = new Date()) { return lapseDue({ db: this.db, notify: this.notify, mail: this.mail }, now); }
  remind(now = new Date()) { return remindDeadlines({ db: this.db, notify: this.notify, mail: this.mail }, now); }

  // ── Helpers ──────────────────────────────────────────────────────────────

  private async releaseDoc(dealId: string, since: Date) {
    const [doc] = await this.db.select().from(documents).where(and(eq(documents.dealId, dealId), eq(documents.oreaForm, '122'), gt(documents.createdAt, since))).limit(1);
    return doc ?? null;
  }

  private async ownDeal(agentId: string, dealId: string) {
    const [deal] = await this.db.select().from(deals).where(and(eq(deals.id, dealId), eq(deals.agentId, agentId)));
    if (!deal) throw new NotFoundException();
    return deal;
  }

  private client(dealId: string) { return clientOf(this.db, dealId); }

  private async email(userId: string) {
    const [u] = await this.db.select({ email: users.email }).from(users).where(eq(users.id, userId));
    return u?.email ?? null;
  }
}

type Ctx = { db: Db; notify: NotifyService; mail: Mailer };

async function clientOf(db: Db, dealId: string) {
  const [c] = await db.select({ id: users.id, email: users.email }).from(dealParties).innerJoin(users, eq(users.id, dealParties.userId))
    .where(and(eq(dealParties.dealId, dealId), eq(dealParties.role, 'client')));
  return c ?? null;
}

/**
 * A condition whose deadline passed without a delivered notice voids the agreement: the offer becomes
 * void, the buyer's representation carries on (back to touring), and a mutual release follows.
 */
export async function lapseDue(x: Ctx, now = new Date()): Promise<number> {
  const lapsed = await x.db.update(conditions).set({ lapsedAt: now })
    .where(and(lt(conditions.dueAt, now), isNull(conditions.deliveredAt), isNull(conditions.lapsedAt))).returning();
  const dealIds = [...new Set(lapsed.map(c => c.dealId))];
  for (const dealId of dealIds) {
    const voided = await x.db.update(offers).set({ status: 'void', updatedAt: now }).where(and(eq(offers.dealId, dealId), eq(offers.status, 'accepted'))).returning();
    if (!voided.length) continue;
    await x.db.update(deals).set({ stage: 'touring', listingId: null, closingDate: null }).where(eq(deals.id, dealId));
    const kinds = lapsed.filter(c => c.dealId === dealId).map(c => NAME[c.kind]).join(' and ');
    await x.db.insert(auditLog).values({ action: 'deal_void', entity: 'deal', entityId: dealId, data: { conditions: kinds, offerId: voided[0]!.id } });
    const home = await loadHome(x.db, voided[0]!.listingId);
    const buyer = await clientOf(x.db, dealId);
    const [deal] = await x.db.select({ agentId: deals.agentId }).from(deals).where(eq(deals.id, dealId));
    const text = `The ${kinds} condition on ${home.address} wasn’t waived or fulfilled in time, so the agreement is void. Sign the mutual release in Klyr to get your deposit back in full.`;
    if (buyer) {
      await x.mail.send({ to: buyer.email, subject: `Your agreement on ${home.address} has ended`, text: `${text}\n\n${SIGN}` });
      await x.notify.toUser(buyer.id, 'consumer', { title: 'Your agreement has ended', body: text, data: { screen: 'deal' } });
    }
    await x.notify.toUser(deal!.agentId, 'agent', { title: 'Deal void: condition lapsed', body: `${home.address} · ${kinds}`, data: { screen: 'deals', dealId } });
  }
  return lapsed.length;
}

/** One reminder before the deposit is due and before each condition ends. */
export async function remindDeadlines(x: Ctx, now = new Date()): Promise<number> {
  let sent = 0;
  const deps = await x.db.update(deposits).set({ reminderSentAt: now })
    .where(and(isNull(deposits.receivedAt), isNull(deposits.reminderSentAt), gt(deposits.dueAt, now), lte(deposits.dueAt, new Date(now.getTime() + REMINDER.depositHours * HOUR)))).returning();
  for (const d of deps) {
    const buyer = await clientOf(x.db, d.dealId);
    const [deal] = await x.db.select({ agentId: deals.agentId }).from(deals).where(eq(deals.id, d.dealId));
    const text = `Your ${money(d.amount)} deposit to ${d.holder} is due by ${torontoWhen(d.dueAt)}.`;
    if (buyer) { await x.mail.send({ to: buyer.email, subject: 'Deposit due soon', text: `${text} Confirm the trust account by phone before you send it.\n\n${SIGN}` }); await x.notify.toUser(buyer.id, 'consumer', { title: 'Deposit due soon', body: `Due by ${torontoWhen(d.dueAt)}`, data: { screen: 'deal' } }); }
    await x.notify.toUser(deal!.agentId, 'agent', { title: 'Client deposit due soon', body: `To ${d.holder} by ${torontoWhen(d.dueAt)}`, data: { screen: 'deals', dealId: d.dealId } });
    sent++;
  }
  const conds = await x.db.update(conditions).set({ reminderSentAt: now })
    .where(and(isNull(conditions.deliveredAt), isNull(conditions.lapsedAt), isNull(conditions.reminderSentAt), gt(conditions.dueAt, now), lte(conditions.dueAt, new Date(now.getTime() + REMINDER.conditionHours * HOUR)))).returning();
  for (const c of conds) {
    const buyer = await clientOf(x.db, c.dealId);
    const [deal] = await x.db.select({ agentId: deals.agentId }).from(deals).where(eq(deals.id, c.dealId));
    const signed = c.waivedAt || c.fulfilledAt;
    const text = signed
      ? `Your ${NAME[c.kind]} notice is signed; your agent delivers it before ${torontoWhen(c.dueAt)}.`
      : `Your ${NAME[c.kind]} condition ends ${torontoWhen(c.dueAt)}. Waive it or confirm it’s fulfilled before then, or the agreement ends and your deposit comes back.`;
    if (buyer) { await x.mail.send({ to: buyer.email, subject: `Condition ends soon: ${NAME[c.kind]}`, text: `${text}\n\n${SIGN}` }); await x.notify.toUser(buyer.id, 'consumer', { title: `Condition ends soon: ${NAME[c.kind]}`, body: text, data: { screen: 'deal' } }); }
    await x.notify.toUser(deal!.agentId, 'agent', { title: signed ? 'Deliver the notice today' : 'Condition ends within 24 hours', body: `${NAME[c.kind]} · ${torontoWhen(c.dueAt)}`, data: { screen: 'deals', dealId: c.dealId } });
    sent++;
  }
  return sent;
}

