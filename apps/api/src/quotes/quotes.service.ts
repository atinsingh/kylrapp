import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, desc, eq, inArray } from 'drizzle-orm';
import type { EnterQuoteRequest, QuoteKind, QuoteRequestRequest } from '@klyr/contracts';
import { HST, termCost } from '@klyr/core';
import { DB, type Db } from '../db/db.module.js';
import { auditLog, dealParties, deals, dealTasks, organizations, quoteRequests, quotes, users } from '../db/schema.js';
import { MAILER, type Mailer } from '../identity/mailer.js';
import { NotifyService } from '../notify/notify.service.js';

const SIGN = 'Klyr Realty Inc., Brokerage';
const money = (n: number) => '$' + n.toLocaleString('en-CA');
const ORG_KIND: Record<QuoteKind, 'law_firm' | 'lender' | 'inspector' | 'insurer'> = { lawyer: 'law_firm', lender: 'lender', inspector: 'inspector', insurer: 'insurer' };
const LABEL: Record<QuoteKind, string> = { lawyer: 'lawyer', lender: 'mortgage', inspector: 'home inspection', insurer: 'home insurance' };
type Provider = { email?: string; phone?: string; about?: string; referral?: boolean };
type Req = typeof quoteRequests.$inferSelect;

/**
 * The provider marketplace. Quotes are ranked only by what the client pays (lenders by 5-year cost), and any
 * referral fee to Klyr is shown on the quote and acknowledged in writing before the client chooses it
 * (TRESA / RECO). Lawyers can't pay one.
 */
@Injectable()
export class QuotesService {
  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(NotifyService) private readonly notify: NotifyService,
    @Inject(MAILER) private readonly mail: Mailer,
  ) {}

  async providers(kind: QuoteKind) {
    const rows = await this.db.select().from(organizations).where(eq(organizations.kind, ORG_KIND[kind])).orderBy(organizations.name);
    return rows.map(o => { const d = (o.details ?? {}) as Provider; return { id: o.id, name: o.name, kind, registration: o.registration, about: d.about ?? null, paysReferral: kind !== 'lawyer' && !!d.referral }; });
  }

  // ── Client ───────────────────────────────────────────────────────────────

  async request(userId: string, req: QuoteRequestRequest) {
    const deal = await this.clientDeal(userId);
    const ok = await this.db.select({ id: organizations.id }).from(organizations).where(and(inArray(organizations.id, req.providerIds), eq(organizations.kind, ORG_KIND[req.kind])));
    if (ok.length !== new Set(req.providerIds).size) throw new BadRequestException({ code: 'bad_provider', message: `Choose ${LABEL[req.kind]} providers from the list.` });
    const open = await this.db.select({ id: quoteRequests.id }).from(quoteRequests).where(and(eq(quoteRequests.dealId, deal.id), eq(quoteRequests.kind, req.kind), eq(quoteRequests.status, 'open')));
    if (open.length) throw new ConflictException({ code: 'request_open', message: `You already have ${LABEL[req.kind]} quotes on the way.` });
    const { kind, providerIds, note, ...details } = req;
    const [r] = await this.db.insert(quoteRequests).values({ dealId: deal.id, kind, providerIds: [...new Set(providerIds)], details, note: note ?? null }).returning();
    await this.db.insert(auditLog).values({ actorId: userId, action: 'quote_request', entity: 'quote_request', entityId: r!.id, data: { kind, providers: providerIds.length } });
    await this.notify.toUser(deal.agentId, 'agent', { title: `Quotes requested: ${LABEL[kind]}`, body: `${providerIds.length} provider(s)`, data: { screen: 'quotes' } });
    return this.mine(userId);
  }

  async mine(userId: string) {
    const deal = await this.clientDeal(userId, false);
    if (!deal) return [];
    const reqs = await this.db.select().from(quoteRequests).where(eq(quoteRequests.dealId, deal.id)).orderBy(desc(quoteRequests.createdAt));
    return this.present(reqs);
  }

  async choose(userId: string, quoteId: string, referralAcknowledged: boolean) {
    const deal = await this.clientDeal(userId);
    const [q] = await this.db.select().from(quotes).where(and(eq(quotes.id, quoteId), eq(quotes.dealId, deal.id)));
    if (!q || !q.requestId) throw new NotFoundException();
    const [r] = await this.db.select().from(quoteRequests).where(eq(quoteRequests.id, q.requestId));
    if (r!.status !== 'open') throw new ConflictException({ code: 'not_open', message: 'You’ve already chosen for this.' });
    if (q.validUntil && q.validUntil.getTime() < Date.now()) throw new ConflictException({ code: 'quote_expired', message: 'This quote has expired. Ask your agent for a fresh one.' });
    if (q.referralFee > 0 && !referralAcknowledged) throw new ConflictException({ code: 'disclosure_required', message: 'Confirm you’ve read the referral fee disclosure first.' });
    const [org] = await this.db.select().from(organizations).where(eq(organizations.id, q.providerOrgId));
    const d = (org!.details ?? {}) as Provider;
    const at = new Date();
    await this.db.update(quotes).set({ acceptedAt: at }).where(eq(quotes.id, q.id));
    await this.db.update(quoteRequests).set({ status: 'chosen', chosenQuoteId: q.id }).where(eq(quoteRequests.id, r!.id));
    await this.db.insert(auditLog).values({ actorId: userId, action: 'quote_chosen', entity: 'quote', entityId: q.id, data: { kind: q.kind, provider: org!.name, clientCost: q.clientCost, referralFee: q.referralFee, referralAcknowledged } });
    // A firm or conditional purchase fills the matching closing-checklist step.
    const task = q.kind === 'lawyer' ? { key: 'lawyer' as const, details: { name: org!.name, firm: org!.name, email: d.email ?? '', ...(d.phone ? { phone: d.phone } : {}) } }
      : q.kind === 'lender' ? { key: 'mortgage' as const, details: { lender: org!.name } }
      : q.kind === 'insurer' ? { key: 'insurance' as const, details: { insurer: org!.name } } : null;
    if (task && deal.side === 'buy' && ['conditional', 'firm'].includes(deal.stage)) {
      await this.db.insert(dealTasks).values({ dealId: deal.id, key: task.key, details: task.details, doneBy: userId })
        .onConflictDoUpdate({ target: [dealTasks.dealId, dealTasks.key], set: { details: task.details, doneBy: userId, doneAt: at } });
    }
    const [u] = await this.db.select({ email: users.email, name: users.legalName }).from(users).where(eq(users.id, userId));
    await this.mail.send({
      to: u!.email, subject: `You chose ${org!.name}`,
      text: `You chose ${org!.name} for your ${LABEL[q.kind as QuoteKind]}: ${money(q.clientCost)}${q.kind === 'lender' ? ' over 5 years (interest and fees)' : ''}.\n`
        + (q.referralFee > 0 ? `\nReferral fee disclosure: ${org!.name} pays Klyr Realty Inc., Brokerage ${money(q.referralFee)} if you go ahead. It doesn’t change your price, and it played no part in how quotes were ranked. You confirmed you read this on ${at.toISOString().slice(0, 10)}.\n` : '\nKlyr receives nothing from this provider.\n')
        + `\nThey’ll contact you directly${d.phone ? ` (${d.phone})` : ''}.\n\n${SIGN}`,
    });
    if (d.email) await this.mail.send({ to: d.email, subject: `Klyr client chose your quote`, text: `${u!.name} chose your ${LABEL[q.kind as QuoteKind]} quote of ${money(q.clientCost)}. Please contact them at ${u!.email}.\n\n${SIGN}` });
    await this.notify.toUser(deal.agentId, 'agent', { title: `Client chose a ${LABEL[q.kind as QuoteKind]} provider`, body: org!.name, data: { screen: 'quotes' } });
    return this.mine(userId);
  }

  async cancel(userId: string, requestId: string) {
    const deal = await this.clientDeal(userId);
    const r = await this.db.update(quoteRequests).set({ status: 'cancelled' }).where(and(eq(quoteRequests.id, requestId), eq(quoteRequests.dealId, deal.id), eq(quoteRequests.status, 'open'))).returning();
    if (!r.length) throw new NotFoundException();
    return this.mine(userId);
  }

  // ── Agent ────────────────────────────────────────────────────────────────

  async forAgent(agentId: string) {
    const rows = await this.db.select({ r: quoteRequests, client: users.legalName, email: users.email }).from(quoteRequests)
      .innerJoin(deals, eq(deals.id, quoteRequests.dealId))
      .innerJoin(dealParties, and(eq(dealParties.dealId, deals.id), eq(dealParties.role, 'client')))
      .innerJoin(users, eq(users.id, dealParties.userId))
      .where(eq(deals.agentId, agentId)).orderBy(desc(quoteRequests.createdAt)).limit(100);
    const out = await this.present(rows.map(x => x.r));
    return out.map((r, i) => ({ ...r, clientName: rows[i]!.client, clientEmail: rows[i]!.email }));
  }

  /** The agent enters a quote received from the provider. Lawyers can't pay referral fees. */
  async enter(agentId: string, requestId: string, req: EnterQuoteRequest) {
    const [row] = await this.db.select({ r: quoteRequests, deal: deals }).from(quoteRequests).innerJoin(deals, eq(deals.id, quoteRequests.dealId))
      .where(and(eq(quoteRequests.id, requestId), eq(deals.agentId, agentId)));
    if (!row) throw new NotFoundException();
    const r = row.r;
    if (r.status !== 'open') throw new ConflictException({ code: 'not_open', message: 'The client has already chosen.' });
    if (req.kind !== r.kind) throw new BadRequestException({ code: 'wrong_kind', message: `This request is for ${LABEL[r.kind]} quotes.` });
    if (!r.providerIds.includes(req.providerId)) throw new BadRequestException({ code: 'bad_provider', message: 'The client didn’t ask this provider.' });
    if (req.kind === 'lawyer' && req.referralFee > 0) throw new BadRequestException({ code: 'lawyer_referral', message: 'Lawyers can’t pay referral fees to a brokerage (Law Society rules).' });
    const [org] = await this.db.select().from(organizations).where(eq(organizations.id, req.providerId));
    if (req.referralFee > 0 && !((org!.details ?? {}) as Provider).referral) throw new BadRequestException({ code: 'no_referral_agreement', message: `Klyr has no referral agreement with ${org!.name}.` });
    const { cost, details } = this.price(r, req);
    const values = {
      requestId: r.id, dealId: r.dealId, providerOrgId: req.providerId, kind: r.kind, clientCost: cost, rate: req.kind === 'lender' ? String(req.rate) : null,
      referralFee: req.referralFee, source: 'manual' as const, details, validUntil: new Date(Date.now() + req.validDays * 86_400_000),
    };
    const [existing] = await this.db.select({ id: quotes.id }).from(quotes).where(and(eq(quotes.requestId, r.id), eq(quotes.providerOrgId, req.providerId)));
    if (existing) await this.db.update(quotes).set(values).where(eq(quotes.id, existing.id));
    else await this.db.insert(quotes).values(values);
    await this.db.insert(auditLog).values({ actorId: agentId, action: 'quote_entered', entity: 'quote_request', entityId: r.id, data: { provider: org!.name, clientCost: cost, referralFee: req.referralFee } });
    const [client] = await this.db.select({ id: users.id, email: users.email }).from(dealParties).innerJoin(users, eq(users.id, dealParties.userId))
      .where(and(eq(dealParties.dealId, r.dealId), eq(dealParties.role, 'client')));
    if (client) await this.notify.toUser(client.id, 'consumer', { title: `New ${LABEL[r.kind]} quote`, body: org!.name, data: { screen: 'quotes' } });
    return (await this.forAgent(agentId)).find(x => x.id === r.id)!;
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  /** What the client pays, the only number quotes are ranked by. */
  private price(r: Req, q: EnterQuoteRequest) {
    const d = r.details as { loan?: number; amortYears?: number };
    switch (q.kind) {
      case 'lender': {
        const c = termCost(d.loan!, q.rate, { years: d.amortYears, fees: q.fees });
        return { cost: c.total, details: { rate: q.rate, monthly: c.monthly, interest: c.interest, fees: q.fees, prepaymentPct: q.prepaymentPct, approvalDays: q.approvalDays, balanceAfter: c.balanceAfter } };
      }
      case 'lawyer': return { cost: Math.round(q.fee * HST) + q.disbursements + q.titleInsurance, details: { fee: q.fee, hst: Math.round(q.fee * (HST - 1)), disbursements: q.disbursements, titleInsurance: q.titleInsurance } };
      case 'inspector': return { cost: Math.round(q.price * HST), details: { price: q.price, hst: Math.round(q.price * (HST - 1)), reportHours: q.reportHours } };
      case 'insurer': return { cost: q.annualPremium, details: { annualPremium: q.annualPremium, deductible: q.deductible } };
    }
  }

  private async present(reqs: Req[]) {
    if (!reqs.length) return [];
    const qs = await this.db.select().from(quotes).where(inArray(quotes.requestId, reqs.map(r => r.id)));
    const orgIds = [...new Set(reqs.flatMap(r => r.providerIds))];
    const orgs = await this.db.select().from(organizations).where(inArray(organizations.id, orgIds));
    const org = (id: string) => { const o = orgs.find(x => x.id === id)!; const d = (o.details ?? {}) as Provider; return { id: o.id, name: o.name, registration: o.registration, about: d.about ?? null, phone: d.phone ?? null }; };
    return reqs.map(r => {
      const mine = qs.filter(q => q.requestId === r.id).sort((a, b) => a.clientCost - b.clientCost);
      const best = mine[0]?.clientCost ?? 0;
      return {
        id: r.id, kind: r.kind, status: r.status, details: r.details as Record<string, number>, note: r.note, createdAt: r.createdAt.toISOString(), chosenQuoteId: r.chosenQuoteId,
        providers: r.providerIds.map(id => ({ ...org(id), quoted: mine.some(q => q.providerOrgId === id) })),
        quotes: mine.map((q, i) => ({
          id: q.id, rank: i + 1, provider: org(q.providerOrgId), clientCost: q.clientCost, vsBest: q.clientCost - best, referralFee: q.referralFee,
          details: q.details as Record<string, number>, validUntil: q.validUntil?.toISOString() ?? null, chosen: !!q.acceptedAt,
          expired: !!q.validUntil && q.validUntil.getTime() < Date.now(),
        })),
      };
    });
  }

  private async clientDeal(userId: string, required = true) {
    const [r] = await this.db.select({ deal: deals }).from(deals)
      .innerJoin(dealParties, and(eq(dealParties.dealId, deals.id), eq(dealParties.userId, userId), eq(dealParties.role, 'client')))
      .where(inArray(deals.stage, ['searching', 'touring', 'offer', 'conditional', 'firm', 'closing', 'preparing', 'listed']))
      .orderBy(desc(deals.createdAt)).limit(1);
    if (!r && required) throw new ConflictException({ code: 'agreement_required', message: 'Sign your agreement with Klyr first, so an agent can collect quotes for you.' });
    return r?.deal ?? null as never;
  }
}
