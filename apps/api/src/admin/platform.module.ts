import { BadRequestException, Body, ConflictException, Controller, Get, HttpCode, Inject, Injectable, Module, NotFoundException, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { and, count, desc, eq, gt, inArray, isNotNull, isNull, max, notInArray, sql } from 'drizzle-orm';
import { PrivacyDecision, PrivacyRequestRequest, PublishAssumptionsRequest, RoleChangeRequest, SuspendListingRequest, type StaffRole } from '@klyr/contracts';
import { ZodPipe } from '../common/zod.pipe.js';
import { DB, type Db } from '../db/db.module.js';
import {
  agents, auditLog, buyerAssumptions, consents, dealParties, deals, documents, idVerifications, listings, moveProfiles, organizations, passkeys,
  privacyRequests, publishedSettings, pushDevices, quotes, savedSearches, sessions, tenantProfiles, totpCredentials, userRoles, users,
} from '../db/schema.js';
import { Auth, AuthGuard, type AuthContext } from '../identity/auth.guard.js';
import { MAILER, type Mailer } from '../identity/mailer.js';
import { Roles, RolesGuard } from '../identity/roles.guard.js';
import { publishedAssumptions } from '../listings/assumptions.service.js';

const SIGN = 'Klyr Realty Inc., Brokerage';
const DAY = 86_400_000;
const STAFF: StaffRole[] = ['agent', 'broker_of_record', 'compliance_officer', 'privacy_officer', 'ops', 'admin'];
const OPEN_STAGES = ['searching', 'touring', 'offer', 'conditional', 'firm', 'closing', 'preparing', 'listed'] as const;

// ── Listings feed ─────────────────────────────────────────────────────────

@Injectable()
export class ListingsFeedService {
  constructor(@Inject(DB) private readonly db: Db) {}

  async status() {
    const bySource = await this.db.select({ source: listings.source, kind: listings.kind, status: listings.status, n: count(), last: max(listings.listedAt) })
      .from(listings).groupBy(listings.source, listings.kind, listings.status);
    const hidden = await this.db.select({ n: count() }).from(listings).where(and(eq(listings.status, 'active'), eq(listings.internetDisplay, false)));
    const unattributed = await this.db.select({ n: count() }).from(listings).where(sql`trim(${listings.listingBrokerage}) = ''`);
    const klyr = await this.db.select({ id: listings.id, address: listings.address, unit: listings.unit, city: listings.city, kind: listings.kind, status: listings.status, price: listings.price, listedAt: listings.listedAt, mls: listings.mlsNumber })
      .from(listings).where(eq(listings.source, 'klyr_exclusive')).orderBy(desc(listings.listedAt)).limit(100);
    return {
      feed: { name: 'PropTx VOW (RESO Web API)', connected: false, note: 'Not connected: waiting on the PropTx data agreement. Listings are seed data and Klyr exclusives until then.' },
      counts: bySource.map(r => ({ ...r, n: Number(r.n) })),
      checks: [
        { name: 'No-display listings never shown to clients', ok: true, detail: `${Number(hidden[0]!.n)} active listing(s) flagged no-display; every client query filters them out.` },
        { name: 'Listing brokerage shown on every listing', ok: Number(unattributed[0]!.n) === 0, detail: `${Number(unattributed[0]!.n)} listing(s) without a brokerage name.` },
      ],
      klyr: klyr.map(l => ({ ...l, address: l.unit ? `${l.address} #${l.unit}` : l.address })),
    };
  }

  async suspend(adminId: string, id: string, reason: string) {
    const r = await this.db.update(listings).set({ status: 'suspended' }).where(and(eq(listings.id, id), eq(listings.status, 'active'))).returning({ id: listings.id });
    if (!r.length) throw new ConflictException({ code: 'not_active', message: 'Only an active listing can be suspended.' });
    await this.db.insert(auditLog).values({ actorId: adminId, action: 'listing_suspend', entity: 'listing', entityId: id, data: { reason } });
    return this.status();
  }

  async restore(adminId: string, id: string) {
    const r = await this.db.update(listings).set({ status: 'active' }).where(and(eq(listings.id, id), eq(listings.status, 'suspended'))).returning({ id: listings.id });
    if (!r.length) throw new ConflictException({ code: 'not_suspended', message: 'Only a suspended listing can be restored.' });
    await this.db.insert(auditLog).values({ actorId: adminId, action: 'listing_restore', entity: 'listing', entityId: id });
    return this.status();
  }
}

// ── Marketplace audit ─────────────────────────────────────────────────────

@Injectable()
export class MarketplaceAuditService {
  constructor(@Inject(DB) private readonly db: Db) {}

  async overview() {
    const orgs = await this.db.select().from(organizations).where(inArray(organizations.kind, ['law_firm', 'lender', 'inspector', 'insurer'])).orderBy(organizations.kind, organizations.name);
    const stats = await this.db.select({ org: quotes.providerOrgId, quoted: count(), chosen: sql<number>`count(${quotes.acceptedAt})`, fees: sql<number>`coalesce(sum(${quotes.referralFee}) filter (where ${quotes.acceptedAt} is not null), 0)` })
      .from(quotes).groupBy(quotes.providerOrgId);
    const chosen = await this.db.select({ q: quotes, provider: organizations.name, client: users.legalName }).from(quotes)
      .innerJoin(organizations, eq(organizations.id, quotes.providerOrgId))
      .innerJoin(dealParties, and(eq(dealParties.dealId, quotes.dealId), eq(dealParties.role, 'client')))
      .innerJoin(users, eq(users.id, dealParties.userId))
      .where(isNotNull(quotes.acceptedAt)).orderBy(desc(quotes.acceptedAt)).limit(100);
    const acks = chosen.length ? await this.db.select({ id: auditLog.entityId, data: auditLog.data }).from(auditLog)
      .where(and(eq(auditLog.action, 'quote_chosen'), inArray(auditLog.entityId, chosen.map(c => c.q.id)))) : [];
    const lawyerFees = await this.db.select({ n: count() }).from(quotes).where(and(eq(quotes.kind, 'lawyer'), gt(quotes.referralFee, 0)));
    return {
      providers: orgs.map(o => {
        const s = stats.find(x => x.org === o.id), d = (o.details ?? {}) as { referral?: boolean };
        return { id: o.id, name: o.name, kind: o.kind, registration: o.registration, referralAgreement: o.kind !== 'law_firm' && !!d.referral, quoted: Number(s?.quoted ?? 0), chosen: Number(s?.chosen ?? 0), referralFees: Number(s?.fees ?? 0) };
      }),
      chosen: chosen.map(c => ({
        id: c.q.id, kind: c.q.kind, provider: c.provider, client: c.client, clientCost: c.q.clientCost, referralFee: c.q.referralFee, acceptedAt: c.q.acceptedAt!.toISOString(),
        acknowledged: c.q.referralFee === 0 || !!(acks.find(a => a.id === c.q.id)?.data as { referralAcknowledged?: boolean } | undefined)?.referralAcknowledged,
      })),
      checks: [{ name: 'No referral fees from lawyers', ok: Number(lawyerFees[0]!.n) === 0, detail: `${Number(lawyerFees[0]!.n)} lawyer quote(s) with a referral fee.` }],
    };
  }
}

// ── Privacy ───────────────────────────────────────────────────────────────

@Injectable()
export class PrivacyService {
  constructor(@Inject(DB) private readonly db: Db, @Inject(MAILER) private readonly mail: Mailer) {}

  async create(userId: string, req: PrivacyRequestRequest) {
    const open = await this.db.select({ id: privacyRequests.id }).from(privacyRequests).where(and(eq(privacyRequests.userId, userId), eq(privacyRequests.kind, req.kind), eq(privacyRequests.status, 'open')));
    if (open.length) throw new ConflictException({ code: 'request_open', message: 'You already have this request open. We answer within 30 days.' });
    const [r] = await this.db.insert(privacyRequests).values({ userId, kind: req.kind, details: req.details ?? null, dueAt: new Date(Date.now() + 30 * DAY) }).returning();
    await this.db.insert(auditLog).values({ actorId: userId, action: `privacy_${req.kind}_request`, entity: 'privacy_request', entityId: r!.id });
    const [u] = await this.db.select({ email: users.email }).from(users).where(eq(users.id, userId));
    await this.mail.send({ to: u!.email, subject: 'We received your privacy request', text: `We received your ${req.kind} request. Klyr’s privacy officer answers within 30 days, by ${r!.dueAt.toISOString().slice(0, 10)}.\n\n${SIGN}` });
    return this.mine(userId);
  }

  async mine(userId: string) {
    const rows = await this.db.select().from(privacyRequests).where(eq(privacyRequests.userId, userId)).orderBy(desc(privacyRequests.createdAt));
    return rows.map(r => this.present(r));
  }

  /** What Klyr holds about a person, once their access request is completed. */
  async export(userId: string, requestId: string) {
    const [r] = await this.db.select().from(privacyRequests).where(and(eq(privacyRequests.id, requestId), eq(privacyRequests.userId, userId)));
    if (!r || r.kind !== 'access' || r.status !== 'completed') throw new NotFoundException();
    return this.collect(userId);
  }

  async queue() {
    const rows = await this.db.select({ r: privacyRequests, email: users.email, name: users.legalName }).from(privacyRequests)
      .innerJoin(users, eq(users.id, privacyRequests.userId)).orderBy(desc(eq(privacyRequests.status, 'open')), privacyRequests.dueAt).limit(200);
    return rows.map(x => ({ ...this.present(x.r), email: x.email, name: x.name, overdue: x.r.status === 'open' && x.r.dueAt.getTime() < Date.now() }));
  }

  async decide(officerId: string, id: string, d: PrivacyDecision) {
    const [r] = await this.db.select().from(privacyRequests).where(eq(privacyRequests.id, id));
    if (!r) throw new NotFoundException();
    if (r.status !== 'open') throw new ConflictException({ code: 'not_open', message: 'This request is already answered.' });
    const [u] = await this.db.select().from(users).where(eq(users.id, r.userId));
    if (r.kind === 'deletion' && d.result === 'completed') {
      const open = await this.db.select({ id: deals.id }).from(deals).innerJoin(dealParties, and(eq(dealParties.dealId, deals.id), eq(dealParties.userId, r.userId)))
        .where(inArray(deals.stage, [...OPEN_STAGES]));
      if (open.length) throw new ConflictException({ code: 'open_deal', message: 'This person has an open deal. Deletion waits until it closes or ends; answer with a denial that explains why.' });
      await this.anonymize(r.userId);
    }
    await this.db.update(privacyRequests).set({ status: d.result, response: d.response, decidedBy: officerId, decidedAt: new Date() }).where(eq(privacyRequests.id, id));
    await this.db.insert(auditLog).values({ actorId: officerId, action: `privacy_${r.kind}_${d.result}`, entity: 'privacy_request', entityId: id, data: { response: d.response } });
    const what = r.kind === 'access' ? (d.result === 'completed' ? 'Your copy is ready to download in Klyr under Security.' : '') : r.kind === 'deletion' && d.result === 'completed' ? 'Your account is closed. We keep only what the law requires: FINTRAC identity records for 5 years and trade records for 6 years.' : '';
    // `u` was read before any deletion, so this still reaches the person.
    const subject = r.kind === 'deletion' && d.result === 'completed' ? 'Your Klyr account is deleted' : `Your privacy request: ${d.result === 'completed' ? 'done' : 'answered'}`;
    await this.mail.send({ to: u!.email, subject, text: [d.response, what, SIGN].filter(Boolean).join('\n\n') });
    return this.queue();
  }

  /** Deletion: sign-in and contact details go; records the law requires (FINTRAC, RECO trade records, audit) stay. */
  private async anonymize(userId: string) {
    const now = new Date();
    await this.db.update(users).set({ email: `deleted-${userId}@deleted.klyr.invalid`, legalName: 'Deleted user', phone: null, prefs: {}, deletedAt: now }).where(eq(users.id, userId));
    await this.db.update(sessions).set({ revokedAt: now }).where(and(eq(sessions.userId, userId), isNull(sessions.revokedAt)));
    await this.db.delete(pushDevices).where(eq(pushDevices.userId, userId));
    await this.db.delete(savedSearches).where(eq(savedSearches.userId, userId));
    await this.db.delete(buyerAssumptions).where(eq(buyerAssumptions.userId, userId));
    await this.db.delete(tenantProfiles).where(eq(tenantProfiles.userId, userId));
    await this.db.delete(passkeys).where(eq(passkeys.userId, userId));
    await this.db.delete(totpCredentials).where(eq(totpCredentials.userId, userId));
  }

  private async collect(userId: string) {
    const [u] = await this.db.select({ id: users.id, email: users.email, legalName: users.legalName, phone: users.phone, createdAt: users.createdAt, prefs: users.prefs }).from(users).where(eq(users.id, userId));
    const dealRows = await this.db.select({ id: deals.id, side: deals.side, stage: deals.stage, createdAt: deals.createdAt }).from(deals)
      .innerJoin(dealParties, and(eq(dealParties.dealId, deals.id), eq(dealParties.userId, userId)));
    return {
      generatedAt: new Date().toISOString(), account: u,
      roles: (await this.db.select({ role: userRoles.role }).from(userRoles).where(eq(userRoles.userId, userId))).map(r => r.role),
      consents: await this.db.select().from(consents).where(eq(consents.userId, userId)),
      moveProfiles: await this.db.select().from(moveProfiles).where(eq(moveProfiles.userId, userId)),
      estimateAssumptions: await this.db.select().from(buyerAssumptions).where(eq(buyerAssumptions.userId, userId)),
      tenantProfile: await this.db.select().from(tenantProfiles).where(eq(tenantProfiles.userId, userId)),
      savedSearches: await this.db.select().from(savedSearches).where(eq(savedSearches.userId, userId)),
      idChecks: await this.db.select({ status: idVerifications.status, verifiedAt: idVerifications.verifiedAt }).from(idVerifications).where(eq(idVerifications.userId, userId)),
      deals: dealRows,
      documents: dealRows.length ? await this.db.select({ id: documents.id, title: documents.title, form: documents.oreaForm, status: documents.status, createdAt: documents.createdAt }).from(documents).where(inArray(documents.dealId, dealRows.map(d => d.id))) : [],
      activity: await this.db.select({ action: auditLog.action, entity: auditLog.entity, at: auditLog.at }).from(auditLog).where(eq(auditLog.actorId, userId)).orderBy(desc(auditLog.at)).limit(500),
    };
  }

  private present(r: typeof privacyRequests.$inferSelect) {
    return { id: r.id, kind: r.kind, details: r.details, status: r.status, dueAt: r.dueAt.toISOString(), response: r.response, decidedAt: r.decidedAt?.toISOString() ?? null, createdAt: r.createdAt.toISOString() };
  }
}

// ── Content and assumptions ───────────────────────────────────────────────

@Injectable()
export class SettingsService {
  constructor(@Inject(DB) private readonly db: Db) {}

  async assumptions() {
    const history = await this.db.select({ s: publishedSettings, by: users.legalName }).from(publishedSettings).innerJoin(users, eq(users.id, publishedSettings.publishedBy))
      .where(eq(publishedSettings.key, 'assumptions')).orderBy(desc(publishedSettings.publishedAt)).limit(50);
    const current = await publishedAssumptions(this.db);
    // Defaults are reviewed at least every 90 days, so the "as of" date clients see stays honest.
    const reviewBy = new Date(Date.parse(current.asOf) + 90 * DAY).toISOString().slice(0, 10);
    return { current: { ...current, reviewBy, overdue: reviewBy < new Date().toISOString().slice(0, 10) }, history: history.map(h => ({ id: h.s.id, value: h.s.value, note: h.s.note, by: h.by, at: h.s.publishedAt.toISOString() })) };
  }

  async publish(adminId: string, req: PublishAssumptionsRequest) {
    const { note, ...raw } = req;
    const value = { ...raw, rate: Math.round(raw.rate * 1e6) / 1e6, downPct: Math.round(raw.downPct * 1e4) / 1e4 };
    const [row] = await this.db.insert(publishedSettings).values({ key: 'assumptions', value, note, publishedBy: adminId }).returning();
    await this.db.insert(auditLog).values({ actorId: adminId, action: 'assumptions_publish', entity: 'published_setting', entityId: row!.id, data: { ...value, note } });
    return this.assumptions();
  }
}

// ── Users and roles ───────────────────────────────────────────────────────

@Injectable()
export class StaffService {
  constructor(@Inject(DB) private readonly db: Db) {}

  async staff() {
    const rows = await this.db.select({ id: users.id, email: users.email, name: users.legalName, role: userRoles.role }).from(userRoles)
      .innerJoin(users, eq(users.id, userRoles.userId)).where(and(inArray(userRoles.role, STAFF), isNull(users.deletedAt))).orderBy(users.legalName);
    const ids = [...new Set(rows.map(r => r.id))];
    if (!ids.length) return [];
    const totp = await this.db.select({ id: totpCredentials.userId }).from(totpCredentials).where(and(inArray(totpCredentials.userId, ids), isNotNull(totpCredentials.enabledAt)));
    const keys = await this.db.select({ id: passkeys.userId, n: count() }).from(passkeys).where(inArray(passkeys.userId, ids)).groupBy(passkeys.userId);
    const seen = await this.db.select({ id: sessions.userId, last: max(sessions.lastSeenAt) }).from(sessions).where(inArray(sessions.userId, ids)).groupBy(sessions.userId);
    const ag = await this.db.select().from(agents).where(inArray(agents.userId, ids));
    const open = await this.db.select({ id: deals.agentId, n: count() }).from(deals).where(and(inArray(deals.agentId, ids), inArray(deals.stage, [...OPEN_STAGES]))).groupBy(deals.agentId);
    return ids.map(id => {
      const r = rows.find(x => x.id === id)!, a = ag.find(x => x.userId === id);
      return {
        id, email: r.email, name: r.name, roles: rows.filter(x => x.id === id).map(x => x.role),
        mfa: { authenticator: totp.some(t => t.id === id), passkeys: Number(keys.find(k => k.id === id)?.n ?? 0) },
        lastSeenAt: seen.find(s => s.id === id)?.last?.toISOString() ?? null,
        agent: a ? { registeredName: a.registeredName, title: a.title, recoNumber: a.recoNumber, openDeals: Number(open.find(o => o.id === id)?.n ?? 0) } : null,
      };
    });
  }

  async change(adminId: string, req: RoleChangeRequest) {
    const [u] = await this.db.select().from(users).where(and(sql`lower(${users.email}) = ${req.email.toLowerCase()}`, isNull(users.deletedAt)));
    if (!u) throw new NotFoundException({ code: 'no_user', message: 'No account with that email. They sign up first, then you add the role.' });
    const [brokerage] = await this.db.select({ id: organizations.id }).from(organizations).where(eq(organizations.kind, 'brokerage')).limit(1);
    if (req.action === 'grant') {
      if (req.role === 'agent') {
        if (!req.registeredName || !req.title || !req.recoNumber) throw new BadRequestException({ code: 'reco_required', message: 'An agent needs their RECO-registered name, title and registration number.' });
        await this.db.insert(agents).values({ userId: u.id, brokerageId: brokerage!.id, registeredName: req.registeredName, title: req.title, recoNumber: req.recoNumber })
          .onConflictDoUpdate({ target: agents.userId, set: { registeredName: req.registeredName, title: req.title, recoNumber: req.recoNumber } });
      }
      await this.db.insert(userRoles).values({ userId: u.id, role: req.role, orgId: brokerage!.id }).onConflictDoNothing();
    } else {
      if (req.role === 'broker_of_record') {
        if (u.id === adminId) throw new ConflictException({ code: 'own_role', message: 'You can’t remove your own broker of record role.' });
        const left = await this.db.select({ n: count() }).from(userRoles).where(and(eq(userRoles.role, 'broker_of_record'), notInArray(userRoles.userId, [u.id])));
        if (!Number(left[0]!.n)) throw new ConflictException({ code: 'last_broker', message: 'The brokerage must always have a broker of record.' });
      }
      if (req.role === 'agent') {
        const open = await this.db.select({ n: count() }).from(deals).where(and(eq(deals.agentId, u.id), inArray(deals.stage, [...OPEN_STAGES])));
        if (Number(open[0]!.n)) throw new ConflictException({ code: 'open_deals', message: `This agent has ${Number(open[0]!.n)} open deal(s). Reassign them first.` });
      }
      await this.db.delete(userRoles).where(and(eq(userRoles.userId, u.id), eq(userRoles.role, req.role)));
    }
    await this.db.insert(auditLog).values({ actorId: adminId, action: `role_${req.action}`, entity: 'user', entityId: u.id, data: { role: req.role } });
    return this.staff();
  }

  async audit() {
    const rows = await this.db.select({ a: auditLog, email: users.email }).from(auditLog).leftJoin(users, sql`${users.id}::text = ${auditLog.actorId}::text`).orderBy(desc(auditLog.id)).limit(200);
    return rows.map(r => ({ id: r.a.id, action: r.a.action, entity: r.a.entity, entityId: r.a.entityId, actor: r.email, at: r.a.at.toISOString() }));
  }
}

// ── Controllers ───────────────────────────────────────────────────────────

@UseGuards(AuthGuard)
@Controller('me/privacy-requests')
class MyPrivacyController {
  constructor(@Inject(PrivacyService) private readonly privacy: PrivacyService) {}
  @Get() mine(@Auth() a: AuthContext) { return this.privacy.mine(a.userId); }
  @Post() @HttpCode(201) create(@Auth() a: AuthContext, @Body(new ZodPipe(PrivacyRequestRequest)) b: PrivacyRequestRequest) { return this.privacy.create(a.userId, b); }
  @Get(':id/export') export(@Auth() a: AuthContext, @Param('id', ParseUUIDPipe) id: string) { return this.privacy.export(a.userId, id); }
}

@UseGuards(AuthGuard, RolesGuard)
@Roles('broker_of_record', 'compliance_officer', 'ops')
@Controller('admin/listings-feed')
class ListingsFeedController {
  constructor(@Inject(ListingsFeedService) private readonly feed: ListingsFeedService) {}
  @Get() status() { return this.feed.status(); }
  @Post(':id/suspend') @HttpCode(200) suspend(@Auth() a: AuthContext, @Param('id', ParseUUIDPipe) id: string, @Body(new ZodPipe(SuspendListingRequest)) b: SuspendListingRequest) { return this.feed.suspend(a.userId, id, b.reason); }
  @Post(':id/restore') @HttpCode(200) restore(@Auth() a: AuthContext, @Param('id', ParseUUIDPipe) id: string) { return this.feed.restore(a.userId, id); }
}

@UseGuards(AuthGuard, RolesGuard)
@Roles('broker_of_record', 'compliance_officer')
@Controller('admin/marketplace')
class MarketplaceController {
  constructor(@Inject(MarketplaceAuditService) private readonly m: MarketplaceAuditService) {}
  @Get() overview() { return this.m.overview(); }
}

@UseGuards(AuthGuard, RolesGuard)
@Roles('privacy_officer')
@Controller('admin/privacy')
class PrivacyAdminController {
  constructor(@Inject(PrivacyService) private readonly privacy: PrivacyService) {}
  @Get() queue() { return this.privacy.queue(); }
  @Post(':id') @HttpCode(200) decide(@Auth() a: AuthContext, @Param('id', ParseUUIDPipe) id: string, @Body(new ZodPipe(PrivacyDecision)) b: PrivacyDecision) { return this.privacy.decide(a.userId, id, b); }
}

@UseGuards(AuthGuard, RolesGuard)
@Roles('broker_of_record', 'admin')
@Controller('admin/assumptions')
class AssumptionsAdminController {
  constructor(@Inject(SettingsService) private readonly settings: SettingsService) {}
  @Get() get() { return this.settings.assumptions(); }
  @Post() @HttpCode(201) publish(@Auth() a: AuthContext, @Body(new ZodPipe(PublishAssumptionsRequest)) b: PublishAssumptionsRequest) { return this.settings.publish(a.userId, b); }
}

@UseGuards(AuthGuard, RolesGuard)
@Roles('broker_of_record', 'admin')
@Controller('admin/users')
class StaffController {
  constructor(@Inject(StaffService) private readonly staffs: StaffService) {}
  @Get() list() { return this.staffs.staff(); }
  @Post('roles') @HttpCode(200) change(@Auth() a: AuthContext, @Body(new ZodPipe(RoleChangeRequest)) b: RoleChangeRequest) { return this.staffs.change(a.userId, b); }
  @Get('audit') audit() { return this.staffs.audit(); }
}

@Module({
  controllers: [MyPrivacyController, ListingsFeedController, MarketplaceController, PrivacyAdminController, AssumptionsAdminController, StaffController],
  providers: [ListingsFeedService, MarketplaceAuditService, PrivacyService, SettingsService, StaffService],
})
export class PlatformModule {}
