import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { SELL_TASKS, type PublishListingRequest, type SellPlanRequest, type SellStartRequest, type SellTaskRequest } from '@klyr/contracts';
import { sellerNet, SELLER_FLAT_FEE, SELLER_PERCENT_FEE, torontoToday } from '@klyr/core';
import { DB, type Db } from '../db/db.module.js';
import { agents, auditLog, dealParties, deals, dealTasks, documents, listingMedia, listings, organizations, sellProfiles, users } from '../db/schema.js';
import { DealsService } from '../deals/deals.service.js';
import { MAILER, type Mailer } from '../identity/mailer.js';
import { NotifyService } from '../notify/notify.service.js';

const SIGN = 'Klyr Realty Inc., Brokerage';
/** Form 200 summary terms. */
export const FORM_200 = { version: '2026-10-29', termDays: 90, holdoverDays: 60 } as const;
const money = (n: number) => '$' + n.toLocaleString('en-CA');
const ymd = (d: Date) => d.toISOString().slice(0, 10);
type Property = Omit<SellStartRequest, 'listPrice' | 'mortgageBalance'>;
type Profile = typeof sellProfiles.$inferSelect;
const OPEN = ['preparing', 'listed', 'offer', 'conditional', 'firm', 'closing'] as const;

/**
 * Selling with Klyr Realty: the seller's net, plan and co-op (their decision), the listing agreement
 * (Form 200), the prep checklist, and the agent publishing the home as a Klyr listing.
 */
@Injectable()
export class SellingService {
  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(DealsService) private readonly deals: DealsService,
    @Inject(NotifyService) private readonly notify: NotifyService,
    @Inject(MAILER) private readonly mail: Mailer,
  ) {}

  async start(userId: string, req: SellStartRequest) {
    if (await this.sellDeal(userId)) throw new ConflictException({ code: 'already_selling', message: 'You already have a home to sell with Klyr.' });
    const agent = await this.deals.nextAgent();
    if (!agent) throw new ConflictException({ code: 'no_agent', message: 'No agent is available right now.' });
    const { listPrice, mortgageBalance, ...property } = req;
    const [deal] = await this.db.insert(deals).values({ side: 'sell', agentId: agent.id, stage: 'preparing', plan: { kind: 'seller' } }).returning();
    await this.db.insert(dealParties).values({ dealId: deal!.id, userId, role: 'client' });
    await this.db.insert(sellProfiles).values({ dealId: deal!.id, property, listPrice, mortgageBalance });
    await this.db.insert(auditLog).values({ actorId: userId, action: 'sell_start', entity: 'deal', entityId: deal!.id, data: { city: req.city, listPrice } });
    return this.view(userId);
  }

  async view(userId: string) {
    const deal = await this.sellDeal(userId);
    return deal ? this.present(deal.id) : null;
  }

  /** Price, plan and co-op can change until the listing agreement is signed. */
  async setPlan(userId: string, req: SellPlanRequest) {
    const deal = await this.requireDeal(userId);
    if (await this.agreement(deal.id)) throw new ConflictException({ code: 'already_signed', message: 'Your listing agreement is signed. Ask your agent to change the price with an amendment.' });
    await this.db.update(sellProfiles).set({ plan: req.plan, coop: String(req.coop), listPrice: req.listPrice, mortgageBalance: req.mortgageBalance }).where(eq(sellProfiles.dealId, deal.id));
    return this.present(deal.id);
  }

  /** Form 200 summary, signed after a fresh check; FINTRAC needs the seller's ID first. */
  async sign(userId: string, typedName: string, client: { ip?: string; userAgent?: string }) {
    const deal = await this.requireDeal(userId);
    if (await this.agreement(deal.id)) throw new ConflictException({ code: 'already_signed', message: 'Your listing agreement is already signed.' });
    const status = await this.deals.buying(userId);
    if (status.idCheck.status !== 'verified') throw new ConflictException({ code: 'id_required', message: 'Verify your ID before signing a listing agreement.' });
    const [u] = await this.db.select({ legalName: users.legalName }).from(users).where(eq(users.id, userId));
    this.deals.assertTypedName(typedName, u!.legalName ?? '');
    const p = await this.profile(deal.id);
    const record = this.terms(p, u!.legalName ?? '');
    const signed = await this.deals.signRecord({ dealId: deal.id, userId, form: '200', title: `${record.title} · ${(p.property as Property).address}`, record, typedName, client });
    await this.db.insert(auditLog).values({ actorId: userId, action: 'listing_agreement_sign', entity: 'deal', entityId: deal.id, data: { documentId: signed.documentId } });
    await this.notify.toUser(deal.agentId, 'agent', { title: 'Listing agreement signed', body: (p.property as Property).address, data: { screen: 'deals' } });
    return this.present(deal.id);
  }

  async sellerTask(userId: string, req: SellTaskRequest) {
    const deal = await this.requireDeal(userId);
    if (req.key === 'photos' || req.key === 'inspection') throw new ConflictException({ code: 'agent_only', message: 'Your agent books photos and the inspection.' });
    if (deal.stage !== 'preparing') throw new ConflictException({ code: 'already_listed', message: 'Your home is already listed.' });
    await this.saveTask(deal.id, userId, req);
    if (req.key === 'payout') await this.db.update(sellProfiles).set({ mortgageBalance: req.balance }).where(eq(sellProfiles.dealId, deal.id));
    return this.present(deal.id);
  }

  // ── Agent ────────────────────────────────────────────────────────────────

  async forAgent(agentId: string) {
    const rows = await this.db.select({ id: deals.id, client: users.legalName, email: users.email }).from(deals)
      .innerJoin(dealParties, and(eq(dealParties.dealId, deals.id), eq(dealParties.role, 'client')))
      .innerJoin(users, eq(users.id, dealParties.userId))
      .where(and(eq(deals.agentId, agentId), eq(deals.side, 'sell'), inArray(deals.stage, [...OPEN]))).orderBy(desc(deals.createdAt));
    return Promise.all(rows.map(async r => ({ ...(await this.present(r.id)), clientName: r.client, clientEmail: r.email })));
  }

  async agentTask(agentId: string, dealId: string, req: SellTaskRequest) {
    const deal = await this.ownDeal(agentId, dealId);
    await this.saveTask(deal.id, agentId, req);
    return { ok: true };
  }

  /** Live as a Klyr listing: signed agreement, approved listing text, photos done. */
  async publish(agentId: string, dealId: string, req: PublishListingRequest) {
    const deal = await this.ownDeal(agentId, dealId);
    if (deal.stage !== 'preparing') throw new ConflictException({ code: 'already_listed', message: 'Already listed.' });
    if (!(await this.agreement(deal.id))) throw new ConflictException({ code: 'agreement_required', message: 'The seller signs the listing agreement first.' });
    const tasks = await this.db.select().from(dealTasks).where(eq(dealTasks.dealId, deal.id));
    const missing = (['approve', 'photos'] as const).filter(k => !tasks.some(t => t.key === k));
    if (missing.length) throw new ConflictException({ code: 'prep_incomplete', message: `Still to do: ${missing.map(k => (k === 'approve' ? 'seller approves the listing' : 'photos')).join(', ')}.` });
    const p = await this.profile(deal.id), prop = p.property as Property;
    const rules = tasks.find(t => t.key === 'rules')?.details as { offerDate?: string; showings?: string } | undefined;
    const approved = tasks.find(t => t.key === 'approve')!.details as { description: string; inclusions: string };
    const [brokerage] = await this.db.select({ name: organizations.name }).from(agents).innerJoin(organizations, eq(organizations.id, agents.brokerageId)).where(eq(agents.userId, agentId));
    const [l] = await this.db.insert(listings).values({
      mlsNumber: `KLYR-${Date.now().toString(36).toUpperCase()}`, source: 'klyr_exclusive', status: 'active', kind: 'sale',
      listingBrokerage: brokerage?.name ?? SIGN, address: prop.address, unit: prop.unit ?? null, city: prop.city, propertyType: prop.type,
      beds: prop.beds, baths: prop.baths, sqft: prop.sqft ?? null, yearBuilt: prop.yearBuilt ?? null, price: p.listPrice, coop: p.coop,
      annualTax: prop.annualTax ?? null, condoFee: prop.condoFee ?? null, offerDate: rules?.offerDate ?? null,
      geom: { x: req.lng, y: req.lat }, listedAt: ymd(new Date()), raw: { description: approved.description, inclusions: approved.inclusions, showings: rules?.showings ?? null },
    }).returning();
    if (req.photos.length) await this.db.insert(listingMedia).values(req.photos.map((url, i) => ({ listingId: l!.id, kind: 'photo' as const, url, altText: `${prop.address}, photo ${i + 1}`, position: i })));
    await this.db.update(sellProfiles).set({ listingId: l!.id, publishedAt: new Date() }).where(eq(sellProfiles.dealId, deal.id));
    await this.db.update(deals).set({ stage: 'listed', listingId: l!.id }).where(eq(deals.id, deal.id));
    await this.db.insert(auditLog).values({ actorId: agentId, action: 'listing_published', entity: 'deal', entityId: deal.id, data: { listingId: l!.id, price: p.listPrice } });
    const seller = await this.client(deal.id);
    if (seller) {
      await this.mail.send({ to: seller.email, subject: `You’re live · ${prop.address}`, text: `Your home at ${prop.address}, ${prop.city} is listed at ${money(p.listPrice)}.\nShowing requests and offers come to you in Klyr.\n\n${SIGN}` });
      await this.notify.toUser(seller.id, 'consumer', { title: 'Your home is listed', body: prop.address, data: { screen: 'sell' } });
    }
    return { listingId: l!.id };
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  private async present(dealId: string) {
    const [deal] = await this.db.select().from(deals).where(eq(deals.id, dealId));
    const p = await this.profile(dealId);
    const coop = Number(p.coop);
    const net = (plan: 'flat' | 'percent') => sellerNet({ price: p.listPrice, plan, coop, mortgageBalance: p.mortgageBalance });
    const doc = await this.agreement(dealId);
    const tasks = await this.db.select().from(dealTasks).where(eq(dealTasks.dealId, dealId));
    const [a] = await this.db.select({ name: agents.registeredName, title: agents.title }).from(agents).where(eq(agents.userId, deal!.agentId));
    return {
      dealId, stage: deal!.stage, property: p.property as Property, plan: p.plan, coop, listPrice: p.listPrice, mortgageBalance: p.mortgageBalance,
      net: net(p.plan), nets: { flat: net('flat').net, percent: net('percent').net },
      fees: { flat: SELLER_FLAT_FEE, percentPct: SELLER_PERCENT_FEE * 100 },
      agreement: doc ? { documentId: doc.id, signedAt: doc.createdAt.toISOString() } : null,
      tasks: SELL_TASKS.map(key => { const t = tasks.find(x => x.key === key); return { key, doneAt: t?.doneAt.toISOString() ?? null, details: (t?.details ?? {}) as Record<string, string> }; }),
      listingId: p.listingId, publishedAt: p.publishedAt?.toISOString() ?? null,
      agent: a ?? null,
    };
  }

  private terms(p: Profile, seller: string) {
    const prop = p.property as Property, coop = Number(p.coop);
    const start = new Date(), [y, m, d] = torontoToday(start);
    const end = new Date(Date.UTC(y, m - 1, d + FORM_200.termDays));
    return {
      form: '200', title: 'Listing Agreement', version: FORM_200.version, seller, brokerage: SIGN,
      property: `${prop.address}${prop.unit ? ' #' + prop.unit : ''}, ${prop.city}, Ontario`,
      clauses: [
        ['Term', `${FORM_200.termDays} days, until ${ymd(end)}.`],
        ['Price', `Listed at ${money(p.listPrice)}. You decide on every offer; Klyr never accepts one for you.`],
        ['Klyr’s fee', p.plan === 'flat' ? `${money(SELLER_FLAT_FEE)} + HST, Self-directed: you host showings and open houses.` : `${SELLER_PERCENT_FEE * 100}% of the sale price + HST, Assisted: your agent runs showings, open houses and offer night.`],
        ['Buyer’s brokerage', `${(coop * 100).toFixed(1)}% of the sale price + HST, offered to the brokerage that brings the buyer. You chose this amount.`],
        ['Holdover', `${FORM_200.holdoverDays} days: if someone introduced during the listing buys within ${FORM_200.holdoverDays} days after it ends, the fees are still owed.`],
        ['Multiple representation', 'If a Klyr buyer wants your home, Klyr asks for both sides’ written consent (Form 326) before any offer.'],
      ] as [string, string][],
      note: 'Klyr’s plain-language summary of OREA Form 200. The standard OREA terms apply in full.',
    };
  }

  private async saveTask(dealId: string, actorId: string, req: SellTaskRequest) {
    const { key, ...details } = req;
    await this.db.insert(dealTasks).values({ dealId, key, details, doneBy: actorId })
      .onConflictDoUpdate({ target: [dealTasks.dealId, dealTasks.key], set: { details, doneBy: actorId, doneAt: new Date() } });
    await this.db.insert(auditLog).values({ actorId, action: `sell_task_${key}`, entity: 'deal', entityId: dealId, data: details });
  }

  private async sellDeal(userId: string) {
    const [r] = await this.db.select({ deal: deals }).from(deals)
      .innerJoin(dealParties, and(eq(dealParties.dealId, deals.id), eq(dealParties.userId, userId), eq(dealParties.role, 'client')))
      .where(and(eq(deals.side, 'sell'), inArray(deals.stage, [...OPEN]))).orderBy(desc(deals.createdAt)).limit(1);
    return r?.deal ?? null;
  }
  private async requireDeal(userId: string) {
    const d = await this.sellDeal(userId);
    if (!d) throw new NotFoundException({ code: 'not_selling', message: 'Start by telling us about your home.' });
    return d;
  }
  private async ownDeal(agentId: string, dealId: string) {
    const [d] = await this.db.select().from(deals).where(and(eq(deals.id, dealId), eq(deals.agentId, agentId), eq(deals.side, 'sell')));
    if (!d) throw new NotFoundException();
    return d;
  }
  private async profile(dealId: string) {
    const [p] = await this.db.select().from(sellProfiles).where(eq(sellProfiles.dealId, dealId));
    if (!p) throw new NotFoundException();
    return p;
  }
  private async agreement(dealId: string) {
    const [doc] = await this.db.select().from(documents).where(and(eq(documents.dealId, dealId), eq(documents.oreaForm, '200'), eq(documents.status, 'signed'))).limit(1);
    return doc ?? null;
  }
  private async client(dealId: string) {
    const [c] = await this.db.select({ id: users.id, email: users.email }).from(dealParties).innerJoin(users, eq(users.id, dealParties.userId))
      .where(and(eq(dealParties.dealId, dealId), eq(dealParties.role, 'client')));
    return c ?? null;
  }
}
