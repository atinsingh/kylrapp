import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, asc, desc, eq, gt, inArray, sql } from 'drizzle-orm';
import type { BookShowingRequest } from '@klyr/contracts';
import { DB, type Db } from '../db/db.module.js';
import {
  agents, auditLog, dealParties, deals, documents, idVerifications, listingMedia, listings, moveProfiles, organizations, showings, signatures, users,
} from '../db/schema.js';
import { config } from '../config.js';
import { FILE_STORE, type FileStore } from '../storage/file-store.js';
import { NotifyService } from '../notify/notify.service.js';
import { visitNotes } from '../notify/visit-notes.js';

const DAY = 86_400_000;
/** Form 300 terms Klyr offers. Placeholders until legal review (Launch Checklist action 3). */
export const FORM_300 = { version: '2026-10-27', termDays: 90, cashBackPct: 60, holdoverDays: 60, cancelNoticeDays: 30 } as const;
const VISIT_MIN_LEAD_MS = 60 * 60_000, VISIT_MAX_AHEAD_DAYS = 14;

const torontoDate = (d: Date) => d.toLocaleDateString('en-CA', { timeZone: 'America/Toronto' });
const longDate = (iso: string) => new Date(iso + 'T12:00:00').toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' });

const ADDRESS = sql<string>`case when ${listings.unit} is null then ${listings.address} else ${listings.address} || ' #' || ${listings.unit} end`;

@Injectable()
export class DealsService {
  constructor(@Inject(DB) private readonly db: Db, @Inject(FILE_STORE) private readonly files: FileStore, @Inject(NotifyService) private readonly notify: NotifyService) {}

  // ── Buying status ────────────────────────────────────────────────────────
  /** What stands between this buyer and a first visit. */
  async buying(userId: string) {
    const [deal, id, agent] = await Promise.all([this.buyDeal(userId), this.latestIdCheck(userId), this.agentFor(userId)]);
    const agreement = deal ? await this.signedAgreement(deal.id) : null;
    return {
      agreement: agreement
        ? { signed: true as const, documentId: agreement.id, signedAt: agreement.createdAt.toISOString(), endsOn: (agreement.terms as { endsOn: string }).endsOn }
        : { signed: false as const },
      idCheck: id ? { status: id.status, verifiedAt: id.verifiedAt.toISOString() } : { status: 'not_started' as const },
      agent,
      canBookVisits: !!agreement && id?.status === 'verified',
    };
  }

  // ── Form 300 ─────────────────────────────────────────────────────────────
  /** Plain-language terms the buyer sees before signing; the same object is what gets signed. */
  async agreementTerms(userId: string) {
    const [user] = await this.db.select().from(users).where(eq(users.id, userId));
    if (!user) throw new NotFoundException();
    const profiles = await this.db.select({ data: moveProfiles.data }).from(moveProfiles).where(and(eq(moveProfiles.userId, userId), inArray(moveProfiles.plan, ['buyer', 'bundle'])));
    const areas = profiles.flatMap(p => ((p.data as { areas?: unknown }).areas as string[] | undefined) ?? []).filter(a => typeof a === 'string');
    const start = torontoDate(new Date()), end = torontoDate(new Date(Date.now() + FORM_300.termDays * DAY));
    const area = areas.length ? areas.join(', ') : 'Ontario';
    return {
      form: '300', title: 'OREA Form 300 · Buyer Representation Agreement', version: FORM_300.version,
      buyer: user.legalName ?? user.email, brokerage: 'Klyr Realty Inc., Brokerage',
      startsOn: start, endsOn: end, area, cashBackPct: FORM_300.cashBackPct,
      clauses: [
        ['Term', `${FORM_300.termDays} days, ${longDate(start)} to ${longDate(end)}. Cancel with ${FORM_300.cancelNoticeDays} days’ written notice.`],
        ['Area and type', `Houses, towns and condos in ${area}.`],
        ['What Klyr is paid', 'The commission the seller offers the buyer’s brokerage. If a seller offers less than 1.5%, you pay the gap only if you agree to it on that offer.'],
        ['Cash back', `Klyr pays you ${FORM_300.cashBackPct}% of the commission it receives. The amount is the same whichever lender, lawyer or inspector you use.`],
        ['Holdover', `${FORM_300.holdoverDays} days. If you buy a home Klyr introduced within ${FORM_300.holdoverDays} days after this ends, Klyr may still be owed.`],
        ['Representation', 'Klyr represents you as a client. For a Klyr listing, you will be asked for written consent first.'],
      ] as [string, string][],
    };
  }

  /** Signs Form 300. The caller has passed step-up; the typed name must match the account's legal name. */
  async signAgreement(userId: string, typedName: string, client: { ip?: string; userAgent?: string }) {
    const terms = await this.agreementTerms(userId);
    this.assertTypedName(typedName, terms.buyer);
    const deal = (await this.buyDeal(userId)) ?? (await this.openBuyDeal(userId));
    if (await this.signedAgreement(deal.id)) throw new ConflictException({ code: 'already_signed', message: 'Your buyer agreement is already signed.' });

    return this.signRecord({ dealId: deal.id, userId, form: '300', title: terms.title, record: terms, typedName, client });
  }

  /**
   * Stores a signed record (the form's terms plus who signed, when and from where) with its SHA-256,
   * and the signature and audit rows. Used for Form 300 and offers alike.
   */
  async signRecord(a: { dealId: string; userId: string; form: string; title: string; record: object; typedName: string; client: { ip?: string; userAgent?: string } }) {
    const signedAt = new Date();
    const record = { ...a.record, dealId: a.dealId, signer: { userId: a.userId, typedName: a.typedName.trim(), signedAt: signedAt.toISOString(), ip: a.client.ip ?? null, userAgent: a.client.userAgent ?? null } };
    const body = Buffer.from(JSON.stringify(record, null, 2));
    const [doc] = await this.db.insert(documents).values({
      dealId: a.dealId, ownerId: a.userId, oreaForm: a.form, title: a.title, status: 'signed', s3Key: 'pending', sha256: '0'.repeat(64),
    }).returning();
    const stored = await this.files.put('docs', `deals/${a.dealId}/form-${a.form}-${doc!.id}.json`, body);
    await this.db.update(documents).set({ s3Key: stored.key, sha256: stored.sha256 }).where(eq(documents.id, doc!.id));
    await this.db.insert(signatures).values({ documentId: doc!.id, userId: a.userId, signedAt, ip: a.client.ip ?? null });
    await this.db.insert(auditLog).values({ actorId: a.userId, action: 'sign', entity: 'document', entityId: doc!.id, data: { form: a.form, sha256: stored.sha256 } });
    return { documentId: doc!.id, sha256: stored.sha256, signedAt: signedAt.toISOString() };
  }

  /** The legal name a signer must type, compared loosely (case, spacing, Unicode form). */
  assertTypedName(typedName: string, legalName: string) {
    const norm = (s: string) => s.normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase();
    if (norm(typedName) !== norm(legalName)) {
      throw new BadRequestException({ code: 'name_mismatch', message: `Type your full legal name exactly as on your account: ${legalName}` });
    }
  }

  async documents(userId: string) {
    return this.db.select({ id: documents.id, title: documents.title, oreaForm: documents.oreaForm, status: documents.status, sha256: documents.sha256, createdAt: documents.createdAt })
      .from(documents).where(eq(documents.ownerId, userId)).orderBy(desc(documents.createdAt));
  }

  async document(userId: string, id: string) {
    const [doc] = await this.db.select().from(documents).where(and(eq(documents.id, id), eq(documents.ownerId, userId)));
    if (!doc) throw new NotFoundException();
    const body = await this.files.get('docs', doc.s3Key);
    return { id: doc.id, title: doc.title, status: doc.status, sha256: doc.sha256, createdAt: doc.createdAt, record: JSON.parse(body.toString('utf8')) };
  }

  // ── Showings ─────────────────────────────────────────────────────────────
  async bookShowing(userId: string, req: BookShowingRequest) {
    const status = await this.buying(userId);
    if (!status.agreement.signed) throw new ConflictException({ code: 'agreement_required', message: 'Sign your buyer agreement before your first visit.' });
    if (status.idCheck.status !== 'verified') {
      throw new ConflictException({ code: 'id_required', message: status.idCheck.status === 'needs_review' ? 'Your ID check is with our compliance officer. We’ll let you know when you can book.' : 'Verify your ID before your first visit.' });
    }
    const at = new Date(req.at), now = Date.now();
    if (at.getTime() < now + VISIT_MIN_LEAD_MS || at.getTime() > now + VISIT_MAX_AHEAD_DAYS * DAY) {
      throw new BadRequestException({ code: 'bad_time', message: `Pick a time between one hour and ${VISIT_MAX_AHEAD_DAYS} days from now.` });
    }
    const [listing] = await this.db.select({ id: listings.id, address: ADDRESS }).from(listings)
      .where(and(eq(listings.id, req.listingId), eq(listings.status, 'active'), eq(listings.internetDisplay, true)));
    if (!listing) throw new NotFoundException();
    const deal = (await this.buyDeal(userId))!;
    const [open] = await this.db.select({ id: showings.id }).from(showings)
      .where(and(eq(showings.dealId, deal.id), eq(showings.listingId, req.listingId), inArray(showings.status, ['requested', 'confirmed']), gt(showings.at, new Date())));
    if (open) throw new ConflictException({ code: 'already_booked', message: 'You already have a visit booked for this home.' });
    const [row] = await this.db.insert(showings).values({ dealId: deal.id, listingId: req.listingId, at, note: req.note ?? null }).returning();
    await this.db.insert(auditLog).values({ actorId: userId, action: 'book_showing', entity: 'showing', entityId: row!.id, data: { listingId: req.listingId, at: req.at } });
    if (deal.agentId) await this.notify.toUser(deal.agentId, 'agent', visitNotes.requested(listing.address, at, row!.id));
    return row!;
  }

  async showings(userId: string) {
    const deal = await this.buyDeal(userId);
    if (!deal) return [];
    const rows = await this.db.select({
      id: showings.id, at: showings.at, status: showings.status, note: showings.note, agentNote: showings.agentNote, listingId: listings.id,
      address: ADDRESS,
      city: listings.city, listingBrokerage: listings.listingBrokerage,
    }).from(showings).innerJoin(listings, eq(listings.id, showings.listingId))
      .where(eq(showings.dealId, deal.id)).orderBy(asc(showings.at));
    const photos = rows.length ? await this.db.select({ listingId: listingMedia.listingId, url: listingMedia.url, alt: listingMedia.altText })
      .from(listingMedia).where(and(inArray(listingMedia.listingId, rows.map(r => r.listingId)), eq(listingMedia.position, 0))) : [];
    return rows.map(r => {
      const p = photos.find(x => x.listingId === r.listingId);
      return { ...r, at: r.at.toISOString(), photo: p ? { url: p.url.startsWith('/') ? config.mediaBaseUrl + p.url : p.url, alt: p.alt ?? '' } : null };
    });
  }

  async cancelShowing(userId: string, id: string) {
    const deal = await this.buyDeal(userId);
    if (!deal) throw new NotFoundException();
    const r = await this.db.update(showings).set({ status: 'cancelled', cancelledAt: new Date() })
      .where(and(eq(showings.id, id), eq(showings.dealId, deal.id), inArray(showings.status, ['requested', 'confirmed']), gt(showings.at, new Date())))
      .returning({ id: showings.id, at: showings.at, listingId: showings.listingId });
    if (!r.length) throw new NotFoundException();
    await this.db.insert(auditLog).values({ actorId: userId, action: 'cancel_showing', entity: 'showing', entityId: id });
    const [home] = await this.db.select({ address: ADDRESS }).from(listings).where(eq(listings.id, r[0]!.listingId));
    if (deal.agentId && home) await this.notify.toUser(deal.agentId, 'agent', visitNotes.cancelled(home.address, r[0]!.at, id));
    return { ok: true };
  }

  // ── Helpers ──────────────────────────────────────────────────────────────
  /** The buyer's open buy deal, if any. */
  async buyDeal(userId: string) {
    const [row] = await this.db.select({ deal: deals }).from(deals)
      .innerJoin(dealParties, and(eq(dealParties.dealId, deals.id), eq(dealParties.userId, userId), eq(dealParties.role, 'client')))
      .where(and(eq(deals.side, 'buy'), inArray(deals.stage, ['searching', 'touring', 'offer', 'conditional', 'firm', 'closing'])))
      .orderBy(desc(deals.createdAt)).limit(1);
    return row?.deal ?? null;
  }

  private async openBuyDeal(userId: string) {
    const agent = await this.nextAgent();
    if (!agent) throw new ConflictException({ code: 'no_agent', message: 'No agent is available right now.' });
    const [deal] = await this.db.insert(deals).values({ side: 'buy', agentId: agent.id, stage: 'touring', plan: { cashBackPct: FORM_300.cashBackPct } }).returning();
    await this.db.insert(dealParties).values({ dealId: deal!.id, userId, role: 'client' });
    return deal!;
  }

  /** A signed Form 300 on this deal that hasn't ended. */
  private async signedAgreement(dealId: string) {
    const [doc] = await this.db.select().from(documents)
      .where(and(eq(documents.dealId, dealId), eq(documents.oreaForm, '300'), eq(documents.status, 'signed')))
      .orderBy(desc(documents.createdAt)).limit(1);
    if (!doc) return null;
    const record = JSON.parse((await this.files.get('docs', doc.s3Key)).toString('utf8')) as { endsOn: string };
    if (record.endsOn < torontoDate(new Date())) return null;
    return { ...doc, terms: record };
  }

  private async latestIdCheck(userId: string) {
    const [row] = await this.db.select().from(idVerifications).where(eq(idVerifications.userId, userId)).orderBy(desc(idVerifications.verifiedAt)).limit(1);
    return row ?? null;
  }

  /** The agent on the buyer's deal, or who they would get. */
  private async agentFor(userId: string) {
    const deal = await this.buyDeal(userId);
    const q = this.db.select({ name: agents.registeredName, title: agents.title, brokerage: organizations.name })
      .from(agents).innerJoin(organizations, eq(organizations.id, agents.brokerageId));
    const id = deal?.agentId ?? (await this.nextAgent())?.id;
    if (!id) return null;
    const [a] = await q.where(eq(agents.userId, id));
    return a ?? null;
  }

  /** Spread new buyers evenly: fewest open buy deals, then the longest-serving agent. */
  private async nextAgent() {
    const open = sql<number>`(select count(*) from ${deals} d where d.agent_id = ${agents.userId} and d.side = 'buy' and d.stage not in ('closed', 'released'))`;
    const [a] = await this.db.select({ id: agents.userId }).from(agents).innerJoin(users, eq(users.id, agents.userId))
      .orderBy(asc(open), asc(users.createdAt)).limit(1);
    return a ?? null;
  }
}

