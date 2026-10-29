import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, asc, desc, eq, gt, inArray, lte, ne } from 'drizzle-orm';
import type { BookViewingRequest, LeaseDecision, LeasePlanRequest, LeaseStartRequest, LmrInterestRequest, RentalApplyRequest, TenantProfileRequest, VisitFeedbackRequest } from '@klyr/contracts';
import { landlordNet, LANDLORD_FEE, lmrInterestSchedule, moveInCost, RENT_GUIDELINE, rentControlled, torontoToday } from '@klyr/core';
import { config } from '../config.js';
import { DB, type Db } from '../db/db.module.js';
import { agents, auditLog, dealParties, deals, documents, leaseApplications, leaseProfiles, listingMedia, listings, lmrInterest, organizations, representationConsents, showings, tenantProfiles, users } from '../db/schema.js';
import { DealsService, VISIT_MAX_AHEAD_DAYS, VISIT_MIN_LEAD_MS } from '../deals/deals.service.js';
import { MAILER, type Mailer } from '../identity/mailer.js';
import { NotifyService } from '../notify/notify.service.js';
import { visitNotes } from '../notify/visit-notes.js';
import { consentRecord } from '../offers/offers.service.js';

const SIGN = 'Klyr Realty Inc., Brokerage';
const money = (n: number) => '$' + n.toLocaleString('en-CA');
const today = () => { const [y, m, d] = torontoToday(); return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`; };
const plusDays = (days: number) => { const [y, m, d] = torontoToday(); return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10); };
/** Form 346 and Form 210 terms. */
export const LEASE_FORMS = { version: '2026-10-29', tenantDays: 60, listingDays: 60, holdoverDays: 30 } as const;
type Property = Omit<LeaseStartRequest, 'rent' | 'availableFrom'>;
type Client = { ip?: string; userAgent?: string };
type Ctx = { client: Client };
const OPEN_TENANT = ['searching', 'offer', 'firm'] as const;
const OPEN_LANDLORD = ['preparing', 'listed', 'firm'] as const;

/**
 * Renting and leasing out. Tenants: Form 346, one profile, Form 410 + 400 on a rental (last month's rent is
 * the only deposit). Landlords: first-year rent after fees, Form 210, applicants judged on the same terms.
 */
@Injectable()
export class RentingService {
  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(DealsService) private readonly deals: DealsService,
    @Inject(NotifyService) private readonly notify: NotifyService,
    @Inject(MAILER) private readonly mail: Mailer,
  ) {}

  // ── Tenant ───────────────────────────────────────────────────────────────

  async tenant(userId: string) {
    const deal = await this.tenantDeal(userId);
    const [p] = await this.db.select().from(tenantProfiles).where(eq(tenantProfiles.userId, userId));
    const doc = deal ? await this.signedDoc(deal.id, '346') : null;
    const apps = deal ? await this.db.select({ a: leaseApplications, address: listings.address, unit: listings.unit, city: listings.city, listingStatus: listings.status })
      .from(leaseApplications).innerJoin(listings, eq(listings.id, leaseApplications.listingId))
      .where(eq(leaseApplications.dealId, deal.id)).orderBy(desc(leaseApplications.createdAt)) : [];
    const viewings = deal ? await this.db.select({ s: showings, address: listings.address, unit: listings.unit, city: listings.city }).from(showings)
      .innerJoin(listings, eq(listings.id, showings.listingId)).where(eq(showings.dealId, deal.id)).orderBy(desc(showings.at)) : [];
    return {
      agreement: doc ? { documentId: doc.id, signedAt: doc.createdAt.toISOString() } : null,
      agent: deal ? await this.agentOf(deal.agentId) : null,
      profile: (p?.data ?? null) as TenantProfileRequest | null,
      applications: await Promise.all(apps.map(async r => ({ ...this.app(r.a), address: r.unit ? `${r.address} #${r.unit}` : r.address, city: r.city, interest: r.a.status === 'accepted' ? await this.interest(r.a) : [] }))),
      viewings: viewings.map(v => this.viewing(v.s, v.unit ? `${v.address} #${v.unit}` : v.address, v.city)),
    };
  }

  /** Form 346: Klyr represents the tenant at no cost to them. */
  async signTenantAgreement(userId: string, typedName: string, client: Client) {
    const [u] = await this.db.select({ legalName: users.legalName }).from(users).where(eq(users.id, userId));
    this.deals.assertTypedName(typedName, u!.legalName ?? '');
    let deal = await this.tenantDeal(userId);
    if (deal && (await this.signedDoc(deal.id, '346'))) throw new ConflictException({ code: 'already_signed', message: 'Your tenant agreement is already signed.' });
    if (!deal) {
      const agent = await this.deals.nextAgent();
      if (!agent) throw new ConflictException({ code: 'no_agent', message: 'No agent is available right now.' });
      const [created] = await this.db.insert(deals).values({ side: 'lease_tenant', agentId: agent.id, stage: 'searching', plan: { kind: 'tenant' } }).returning();
      deal = created!;
      await this.db.insert(dealParties).values({ dealId: deal.id, userId, role: 'client' });
    }
    const record = {
      form: '346', title: 'Tenant Representation Agreement', version: LEASE_FORMS.version, tenant: u!.legalName, brokerage: SIGN,
      clauses: [
        ['Term', `${LEASE_FORMS.tenantDays} days, until ${plusDays(LEASE_FORMS.tenantDays)}.`],
        ['Cost to you', '$0. Klyr is paid by the landlord, as offered on each rental.'],
        ['What Klyr does', 'Finds rentals, books viewings, prepares your application and offer to lease, and explains the Ontario Standard Lease.'],
        ['Multiple representation', 'If Klyr also represents a landlord you apply to, both of you consent in writing first (Form 326).'],
      ] as [string, string][],
      note: 'Klyr’s plain-language summary of OREA Form 346. The standard OREA terms apply in full.',
    };
    const signed = await this.deals.signRecord({ dealId: deal!.id, userId, form: '346', title: record.title, record, typedName, client });
    await this.db.insert(auditLog).values({ actorId: userId, action: 'tenant_agreement_sign', entity: 'deal', entityId: deal!.id, data: { documentId: signed.documentId } });
    return this.tenant(userId);
  }

  async saveProfile(userId: string, req: TenantProfileRequest) {
    await this.db.insert(tenantProfiles).values({ userId, data: req }).onConflictDoUpdate({ target: tenantProfiles.userId, set: { data: req, updatedAt: new Date() } });
    return this.tenant(userId);
  }

  async rentals(q: { city?: string; maxRent?: number }) {
    const where = [eq(listings.kind, 'lease'), eq(listings.status, 'active'), eq(listings.internetDisplay, true)];
    if (q.city) where.push(eq(listings.city, q.city));
    if (q.maxRent) where.push(lte(listings.price, q.maxRent));
    const rows = await this.db.select().from(listings).where(and(...where)).orderBy(desc(listings.listedAt), asc(listings.price)).limit(50);
    const photos = rows.length ? await this.db.select({ listingId: listingMedia.listingId, url: listingMedia.url, alt: listingMedia.altText }).from(listingMedia)
      .where(and(inArray(listingMedia.listingId, rows.map(r => r.id)), eq(listingMedia.position, 0))) : [];
    return rows.map(r => this.rentalCard(r, photos.find(p => p.listingId === r.id)));
  }

  async rental(userId: string, id: string) {
    const [r] = await this.db.select().from(listings).where(and(eq(listings.id, id), eq(listings.kind, 'lease'), eq(listings.internetDisplay, true)));
    if (!r) throw new NotFoundException();
    const media = await this.db.select({ url: listingMedia.url, alt: listingMedia.altText }).from(listingMedia).where(and(eq(listingMedia.listingId, id), eq(listingMedia.kind, 'photo'))).orderBy(asc(listingMedia.position));
    const deal = await this.tenantDeal(userId);
    const [mine] = deal ? await this.db.select().from(leaseApplications).where(and(eq(leaseApplications.listingId, id), eq(leaseApplications.dealId, deal.id))).orderBy(desc(leaseApplications.createdAt)).limit(1) : [];
    return {
      ...this.rentalCard(r, media[0]), photos: media.map(m => ({ url: this.url(m.url), alt: m.alt ?? '' })),
      consent: await this.consentFor(userId, r), application: mine ? this.app(mine) : null,
      viewings: deal ? (await this.db.select().from(showings).where(and(eq(showings.dealId, deal.id), eq(showings.listingId, id))).orderBy(desc(showings.at)))
        .map(v => this.viewing(v, r.unit ? `${r.address} #${r.unit}` : r.address, r.city)) : [],
    };
  }

  /** Form 326 when Klyr also represents this landlord. */
  async consent(userId: string, listingId: string, typedName: string, client: Client) {
    const deal = await this.requireTenant(userId);
    const [r] = await this.db.select().from(listings).where(and(eq(listings.id, listingId), eq(listings.kind, 'lease')));
    if (!r) throw new NotFoundException();
    const c = await this.consentFor(userId, r);
    if (!c) throw new ConflictException({ code: 'not_needed', message: 'Klyr doesn’t represent this landlord, so no consent is needed.' });
    if (c.buyerSignedAt) throw new ConflictException({ code: 'already_signed', message: 'You’ve already signed this consent.' });
    const [u] = await this.db.select({ legalName: users.legalName }).from(users).where(eq(users.id, userId));
    this.deals.assertTypedName(typedName, u!.legalName ?? '');
    const record = { ...consentRecord('buyer', u!.legalName ?? '', r), side: 'tenant' };
    const signed = await this.deals.signRecord({ dealId: deal.id, userId, form: '326', title: `${record.title} · ${r.address}`, record, typedName, client });
    const at = new Date();
    await this.db.insert(representationConsents).values({ listingId, buyerId: userId, buyerDocumentId: signed.documentId, buyerSignedAt: at })
      .onConflictDoUpdate({ target: [representationConsents.listingId, representationConsents.buyerId], set: { buyerDocumentId: signed.documentId, buyerSignedAt: at } });
    const landlord = await this.landlordOf(listingId);
    if (landlord) {
      await this.mail.send({ to: landlord.email, subject: `A Klyr tenant wants to apply · ${r.address}`, text: `A tenant who is also a Klyr client wants to apply for ${r.address}.\nBefore they can, you both consent in writing to Klyr representing both of you (Form 326).\n\nReview and sign in Klyr under Lease out.\n\n${SIGN}` });
      await this.notify.toUser(landlord.id, 'consumer', { title: 'Consent needed for an application', body: r.address, data: { screen: 'lease' } });
    }
    return this.rental(userId, listingId);
  }

  /** Form 410 and Form 400, signed together from the tenant's profile. */
  async apply(userId: string, listingId: string, req: RentalApplyRequest, client: Client) {
    const deal = await this.requireTenant(userId);
    const [r] = await this.db.select().from(listings).where(and(eq(listings.id, listingId), eq(listings.kind, 'lease')));
    if (!r || r.status !== 'active') throw new ConflictException({ code: 'not_available', message: 'This rental is no longer available.' });
    const [p] = await this.db.select().from(tenantProfiles).where(eq(tenantProfiles.userId, userId));
    if (!p) throw new ConflictException({ code: 'profile_required', message: 'Fill in your rental profile first.' });
    const c = await this.consentFor(userId, r);
    if (c && !(c.buyerSignedAt && c.sellerSignedAt)) throw new ConflictException({ code: 'multiple_representation', message: c.buyerSignedAt ? 'Waiting for the landlord to consent (Form 326).' : 'Klyr represents this landlord too. You both consent in writing first (Form 326).' });
    if (req.startDate < today()) throw new BadRequestException({ code: 'bad_start', message: 'The lease can’t start in the past.' });
    const open = await this.db.select({ id: leaseApplications.id }).from(leaseApplications)
      .where(and(eq(leaseApplications.listingId, listingId), eq(leaseApplications.dealId, deal.id), inArray(leaseApplications.status, ['submitted', 'accepted'])));
    if (open.length) throw new ConflictException({ code: 'already_applied', message: 'You’ve already applied for this rental.' });
    const [u] = await this.db.select({ legalName: users.legalName, email: users.email }).from(users).where(eq(users.id, userId));
    this.deals.assertTypedName(req.typedName, u!.legalName ?? '');
    const profile = p.data as TenantProfileRequest;
    const address = r.unit ? `${r.address} #${r.unit}` : r.address;
    const record = {
      form: '400', title: 'Agreement to Lease – Residential, with Rental Application (Form 410)', version: LEASE_FORMS.version, tenant: u!.legalName, landlordBrokerage: r.listingBrokerage,
      property: `${address}, ${r.city}, Ontario`,
      clauses: [
        ['Rent', `${money(req.rent)} a month, due on the 1st.`],
        ['Term', `${req.termMonths} months from ${req.startDate}. After that it continues month to month unless a new term is signed.`],
        ['Deposit', `Last month’s rent, ${money(req.rent)}, paid when the lease is signed. It’s the only deposit allowed in Ontario, and it earns interest each year at the rent increase guideline.`],
        ['Lease', 'The Ontario Standard Lease (form 2229E) is signed once this offer is accepted.'],
        ['Rent control', r.rentControlled === false ? 'This unit was first occupied after November 15, 2018: increases aren’t capped by the guideline. Still only once a year, with 90 days’ written notice.' : `Increases are capped by the guideline (${RENT_GUIDELINE.pct}% in ${RENT_GUIDELINE.year}), once a year, with 90 days’ written notice.`],
      ] as [string, string][],
      application: { ...profile, references: profile.references.map(x => ({ ...x })) },
      note: 'Klyr’s plain-language summary of OREA Forms 400 and 410. The standard OREA terms apply in full.',
    };
    const signed = await this.deals.signRecord({ dealId: deal.id, userId, form: '400', title: `Offer to lease · ${address}`, record, typedName: req.typedName, client });
    const [a] = await this.db.insert(leaseApplications).values({ listingId, dealId: deal.id, rent: req.rent, startDate: req.startDate, termMonths: req.termMonths, snapshot: profile, documentId: signed.documentId }).returning();
    if (deal.stage === 'searching') await this.db.update(deals).set({ stage: 'offer' }).where(eq(deals.id, deal.id));
    await this.db.insert(auditLog).values({ actorId: userId, action: 'lease_apply', entity: 'listing', entityId: listingId, data: { applicationId: a!.id, rent: req.rent } });
    await this.notify.toUser(deal.agentId, 'agent', { title: 'Your client applied for a rental', body: address, data: { screen: 'deals' } });
    const landlord = await this.landlordOf(listingId);
    if (landlord) {
      await this.mail.send({ to: landlord.email, subject: `New application · ${address}`, text: `You have an application for ${address}: ${money(req.rent)} a month from ${req.startDate}, ${req.termMonths} months.\nReview it in Klyr under Lease out, next to your other applicants.\n\n${SIGN}` });
      await this.notify.toUser(landlord.id, 'consumer', { title: 'New rental application', body: address, data: { screen: 'lease' } });
      await this.notify.toUser(landlord.agentId, 'agent', { title: 'New application on your rental', body: address, data: { screen: 'deals' } });
    }
    return this.rental(userId, listingId);
  }

  /** A viewing: the tenant's agent confirms it and checks in at the home with the phone's location, as for a purchase. */
  async bookViewing(userId: string, listingId: string, req: BookViewingRequest) {
    const deal = await this.requireTenant(userId);
    const at = new Date(req.at), now = Date.now();
    if (at.getTime() < now + VISIT_MIN_LEAD_MS || at.getTime() > now + VISIT_MAX_AHEAD_DAYS * 86_400_000) {
      throw new BadRequestException({ code: 'bad_time', message: `Pick a time between one hour and ${VISIT_MAX_AHEAD_DAYS} days from now.` });
    }
    const [r] = await this.db.select().from(listings).where(and(eq(listings.id, listingId), eq(listings.kind, 'lease'), eq(listings.status, 'active'), eq(listings.internetDisplay, true)));
    if (!r) throw new NotFoundException();
    const [open] = await this.db.select({ id: showings.id }).from(showings)
      .where(and(eq(showings.dealId, deal.id), eq(showings.listingId, listingId), inArray(showings.status, ['requested', 'confirmed']), gt(showings.at, new Date())));
    if (open) throw new ConflictException({ code: 'already_booked', message: 'You already have a viewing booked here.' });
    const [row] = await this.db.insert(showings).values({ dealId: deal.id, listingId, at, note: req.note ?? null }).returning();
    await this.db.insert(auditLog).values({ actorId: userId, action: 'book_viewing', entity: 'showing', entityId: row!.id, data: { listingId, at: req.at } });
    const address = r.unit ? `${r.address} #${r.unit}` : r.address;
    await this.notify.toUser(deal.agentId, 'agent', visitNotes.requested(address, at, row!.id));
    const landlord = await this.landlordOf(listingId);
    if (landlord) await this.notify.toUser(landlord.id, 'consumer', { title: 'Viewing requested', body: address, data: { screen: 'lease' } });
    return this.rental(userId, listingId);
  }

  async withdraw(userId: string, applicationId: string) {
    const deal = await this.requireTenant(userId);
    const r = await this.db.update(leaseApplications).set({ status: 'withdrawn', decidedAt: new Date() })
      .where(and(eq(leaseApplications.id, applicationId), eq(leaseApplications.dealId, deal.id), eq(leaseApplications.status, 'submitted'))).returning();
    if (!r.length) throw new ConflictException({ code: 'not_open', message: 'This application can no longer be withdrawn.' });
    await this.db.insert(auditLog).values({ actorId: userId, action: 'lease_withdraw', entity: 'lease_application', entityId: applicationId });
    return this.tenant(userId);
  }

  // ── Landlord ─────────────────────────────────────────────────────────────

  async landlord(userId: string) {
    const deal = await this.landlordDeal(userId);
    return deal ? this.presentLease(deal.id) : null;
  }

  async startLease(userId: string, req: LeaseStartRequest) {
    if (await this.landlordDeal(userId)) throw new ConflictException({ code: 'already_leasing', message: 'You already have a home to lease out with Klyr.' });
    const agent = await this.deals.nextAgent();
    if (!agent) throw new ConflictException({ code: 'no_agent', message: 'No agent is available right now.' });
    const { rent, availableFrom, ...property } = req;
    const [deal] = await this.db.insert(deals).values({ side: 'lease_landlord', agentId: agent.id, stage: 'preparing', plan: { kind: 'landlord' } }).returning();
    await this.db.insert(dealParties).values({ dealId: deal!.id, userId, role: 'client' });
    await this.db.insert(leaseProfiles).values({ dealId: deal!.id, property, rent, availableFrom });
    await this.db.insert(auditLog).values({ actorId: userId, action: 'lease_start', entity: 'deal', entityId: deal!.id, data: { city: req.city, rent } });
    return this.presentLease(deal!.id);
  }

  async leasePlan(userId: string, req: LeasePlanRequest) {
    const deal = await this.requireLandlord(userId);
    if (await this.signedDoc(deal.id, '210')) throw new ConflictException({ code: 'already_signed', message: 'Your listing agreement is signed. Ask your agent to change the rent.' });
    await this.db.update(leaseProfiles).set({ rent: req.rent, tenantSidePct: String(req.tenantSidePct), availableFrom: req.availableFrom }).where(eq(leaseProfiles.dealId, deal.id));
    return this.presentLease(deal.id);
  }

  /** Form 210, the listing agreement for a lease. */
  async signLeaseAgreement(userId: string, typedName: string, client: Client) {
    const deal = await this.requireLandlord(userId);
    if (await this.signedDoc(deal.id, '210')) throw new ConflictException({ code: 'already_signed', message: 'Your listing agreement is already signed.' });
    const [u] = await this.db.select({ legalName: users.legalName }).from(users).where(eq(users.id, userId));
    this.deals.assertTypedName(typedName, u!.legalName ?? '');
    const p = await this.leaseProfile(deal.id), prop = p.property as Property, pct = Number(p.tenantSidePct);
    const record = {
      form: '210', title: 'Listing Agreement – Lease', version: LEASE_FORMS.version, landlord: u!.legalName, brokerage: SIGN,
      property: `${prop.address}${prop.unit ? ' #' + prop.unit : ''}, ${prop.city}, Ontario`,
      clauses: [
        ['Term', `${LEASE_FORMS.listingDays} days, until ${plusDays(LEASE_FORMS.listingDays)}.`],
        ['Rent', `Listed at ${money(p.rent)} a month, available ${p.availableFrom}. You choose the tenant; Klyr never accepts an offer for you.`],
        ['Klyr’s fee', `${money(LANDLORD_FEE)} + HST, once a lease is signed.`],
        ['Tenant’s brokerage', pct ? `${pct === 1 ? 'One month’s' : 'Half a month’s'} rent + HST, to the brokerage that brings the tenant. You chose this amount.` : 'Nothing offered to a tenant’s brokerage. You chose this.'],
        ['Holdover', `${LEASE_FORMS.holdoverDays} days after the listing ends.`],
        ['Fair screening', 'Every applicant is judged on the same terms: income, employment, references and, with their consent, credit. The Human Rights Code bars choosing on family status, age, receipt of public assistance or other protected grounds.'],
      ] as [string, string][],
      note: 'Klyr’s plain-language summary of OREA Form 210. The standard OREA terms apply in full.',
    };
    const signed = await this.deals.signRecord({ dealId: deal.id, userId, form: '210', title: `${record.title} · ${prop.address}`, record, typedName, client });
    await this.db.insert(auditLog).values({ actorId: userId, action: 'lease_agreement_sign', entity: 'deal', entityId: deal.id, data: { documentId: signed.documentId } });
    await this.notify.toUser(deal.agentId, 'agent', { title: 'Lease listing agreement signed', body: prop.address, data: { screen: 'deals' } });
    return this.presentLease(deal.id);
  }

  async signLandlordConsent(userId: string, consentId: string, typedName: string, client: Client) {
    const deal = await this.requireLandlord(userId);
    const p = await this.leaseProfile(deal.id), prop = p.property as Property;
    const [c] = p.listingId ? await this.db.select().from(representationConsents).where(and(eq(representationConsents.id, consentId), eq(representationConsents.listingId, p.listingId))) : [];
    if (!c) throw new NotFoundException();
    if (c.sellerSignedAt) throw new ConflictException({ code: 'already_signed', message: 'You’ve already signed this consent.' });
    const [u] = await this.db.select({ legalName: users.legalName }).from(users).where(eq(users.id, userId));
    this.deals.assertTypedName(typedName, u!.legalName ?? '');
    const record = { ...consentRecord('seller', u!.legalName ?? '', prop), side: 'landlord' };
    const signed = await this.deals.signRecord({ dealId: deal.id, userId, form: '326', title: `${record.title} · ${prop.address}`, record, typedName, client });
    await this.db.update(representationConsents).set({ sellerDocumentId: signed.documentId, sellerSignedAt: new Date() }).where(eq(representationConsents.id, c.id));
    await this.db.insert(auditLog).values({ actorId: userId, action: 'consent_326_landlord', entity: 'listing', entityId: p.listingId!, data: { consentId: c.id } });
    const [t] = await this.db.select({ email: users.email }).from(users).where(eq(users.id, c.buyerId));
    if (t) {
      await this.mail.send({ to: t.email, subject: `You can apply · ${prop.address}`, text: `The landlord of ${prop.address} consented to multiple representation (Form 326). You can apply in Klyr now.\n\n${SIGN}` });
      await this.notify.toUser(c.buyerId, 'consumer', { title: 'You can apply now', body: prop.address, data: { screen: 'rent' } });
    }
    return this.presentLease(deal.id);
  }

  /** The landlord chooses. Accepting is a signature; every other open applicant hears back the same day. */
  async decide(userId: string, applicationId: string, req: LeaseDecision, client: Client) {
    const deal = await this.requireLandlord(userId);
    const p = await this.leaseProfile(deal.id), prop = p.property as Property;
    const [a] = p.listingId ? await this.db.select().from(leaseApplications).where(and(eq(leaseApplications.id, applicationId), eq(leaseApplications.listingId, p.listingId))) : [];
    if (!a) throw new NotFoundException();
    if (a.status !== 'submitted') throw new ConflictException({ code: 'not_open', message: 'This application is no longer open.' });
    const tenant = await this.client(a.dealId);
    if (req.result === 'declined') {
      await this.db.update(leaseApplications).set({ status: 'declined', decidedAt: new Date() }).where(eq(leaseApplications.id, a.id));
      await this.declined(tenant, prop.address);
      await this.db.insert(auditLog).values({ actorId: userId, action: 'lease_decline', entity: 'lease_application', entityId: a.id });
      return this.presentLease(deal.id);
    }
    const [u] = await this.db.select({ legalName: users.legalName }).from(users).where(eq(users.id, userId));
    this.deals.assertTypedName(req.typedName, u!.legalName ?? '');
    const record = {
      form: '400', title: 'Landlord’s acceptance · Agreement to Lease', version: LEASE_FORMS.version, landlord: u!.legalName,
      property: `${prop.address}${prop.unit ? ' #' + prop.unit : ''}, ${prop.city}, Ontario`,
      clauses: [
        ['Rent and term', `${money(a.rent)} a month for ${a.termMonths} months from ${a.startDate}.`],
        ['Deposit', `Last month’s rent, ${money(a.rent)}, when the lease is signed. You pay the tenant interest on it each year at the guideline.`],
        ['Lease', 'You and the tenant sign the Ontario Standard Lease (form 2229E) within 21 days of this acceptance.'],
      ] as [string, string][],
      note: 'Klyr’s plain-language summary of OREA Form 400. The standard OREA terms apply in full.',
    };
    const signed = await this.deals.signRecord({ dealId: deal.id, userId, form: '400', title: `Lease accepted · ${prop.address}`, record, typedName: req.typedName, client });
    const at = new Date();
    await this.db.update(leaseApplications).set({ status: 'accepted', decidedAt: at, landlordDocumentId: signed.documentId }).where(eq(leaseApplications.id, a.id));
    const others = await this.db.update(leaseApplications).set({ status: 'declined', decidedAt: at })
      .where(and(eq(leaseApplications.listingId, p.listingId!), eq(leaseApplications.status, 'submitted'), ne(leaseApplications.id, a.id))).returning({ dealId: leaseApplications.dealId });
    for (const o of others) await this.declined(await this.client(o.dealId), prop.address);
    await this.db.update(listings).set({ status: 'leased' }).where(eq(listings.id, p.listingId!));
    await this.db.update(deals).set({ stage: 'firm', listingId: p.listingId }).where(inArray(deals.id, [deal.id, a.dealId]));
    await this.db.insert(auditLog).values({ actorId: userId, action: 'lease_accept', entity: 'lease_application', entityId: a.id, data: { rent: a.rent, declined: others.length } });
    if (tenant) {
      await this.mail.send({ to: tenant.email, subject: `Approved · ${prop.address}`, text: `The landlord accepted your offer to lease ${prop.address}: ${money(a.rent)} a month from ${a.startDate}.\n\nNext: you both sign the Ontario Standard Lease (2229E), and you pay the first and last month’s rent (${money(moveInCost(a.rent).total)}). Your agent sends the lease. Arrange tenant insurance before move-in.\n\n${SIGN}` });
      await this.notify.toUser(tenant.id, 'consumer', { title: 'Your application was approved', body: prop.address, data: { screen: 'rent' } });
    }
    await this.notify.toUser(deal.agentId, 'agent', { title: 'Your landlord chose a tenant', body: prop.address, data: { screen: 'deals' } });
    return this.presentLease(deal.id);
  }

  /** Each anniversary the landlord pays the deposit interest, or keeps it to top the deposit up to a new rent. */
  async recordInterest(userId: string, req: LmrInterestRequest) {
    const deal = await this.requireLandlord(userId);
    const p = await this.leaseProfile(deal.id);
    const [a] = p.listingId ? await this.db.select().from(leaseApplications).where(and(eq(leaseApplications.listingId, p.listingId), eq(leaseApplications.status, 'accepted'))) : [];
    if (!a) throw new ConflictException({ code: 'no_lease', message: 'There’s no signed lease yet.' });
    const due = (await this.interest(a)).find(i => i.dueDate === req.dueDate);
    if (!due) throw new BadRequestException({ code: 'bad_date', message: 'That isn’t one of the lease anniversaries.' });
    if (due.recordedAt) throw new ConflictException({ code: 'already_recorded', message: 'Already recorded for that year.' });
    if (Date.parse(req.dueDate) - Date.now() > 30 * 86_400_000) throw new ConflictException({ code: 'too_early', message: 'Record it within 30 days of the anniversary.' });
    await this.db.insert(lmrInterest).values({ applicationId: a.id, dueDate: req.dueDate, amount: String(due.amount), method: req.method, recordedBy: userId });
    await this.db.insert(auditLog).values({ actorId: userId, action: 'lmr_interest', entity: 'lease_application', entityId: a.id, data: { ...req, amount: due.amount } });
    const tenant = await this.client(a.dealId);
    if (tenant) {
      const prop = p.property as Property;
      await this.mail.send({ to: tenant.email, subject: `Interest on your deposit · ${prop.address}`, text: `Your landlord recorded this year’s interest on your last month’s rent deposit: $${due.amount.toFixed(2)} (${due.pct}%), ${req.method === 'paid' ? 'paid to you' : 'kept to top up your deposit to your current rent'}.\n\n${SIGN}` });
      await this.notify.toUser(tenant.id, 'consumer', { title: 'Deposit interest recorded', body: prop.address, data: { screen: 'rent' } });
    }
    return this.presentLease(deal.id);
  }

  // ── Agent ────────────────────────────────────────────────────────────────

  async forAgent(agentId: string) {
    const rows = await this.db.select({ id: deals.id, client: users.legalName, email: users.email }).from(deals)
      .innerJoin(dealParties, and(eq(dealParties.dealId, deals.id), eq(dealParties.role, 'client')))
      .innerJoin(users, eq(users.id, dealParties.userId))
      .where(and(eq(deals.agentId, agentId), eq(deals.side, 'lease_landlord'), inArray(deals.stage, [...OPEN_LANDLORD]))).orderBy(desc(deals.createdAt));
    return Promise.all(rows.map(async r => ({ ...(await this.presentLease(r.id)), clientName: r.client, clientEmail: r.email })));
  }

  async publish(agentId: string, dealId: string, req: { lat: number; lng: number; photos: string[] }) {
    const [deal] = await this.db.select().from(deals).where(and(eq(deals.id, dealId), eq(deals.agentId, agentId), eq(deals.side, 'lease_landlord')));
    if (!deal) throw new NotFoundException();
    if (deal.stage !== 'preparing') throw new ConflictException({ code: 'already_listed', message: 'Already listed.' });
    if (!(await this.signedDoc(deal.id, '210'))) throw new ConflictException({ code: 'agreement_required', message: 'The landlord signs the listing agreement first.' });
    const p = await this.leaseProfile(deal.id), prop = p.property as Property;
    const [brokerage] = await this.db.select({ name: organizations.name }).from(agents).innerJoin(organizations, eq(organizations.id, agents.brokerageId)).where(eq(agents.userId, agentId));
    const [l] = await this.db.insert(listings).values({
      mlsNumber: `KLYR-L-${Date.now().toString(36).toUpperCase()}`, source: 'klyr_exclusive', status: 'active', kind: 'lease',
      listingBrokerage: brokerage?.name ?? SIGN, address: prop.address, unit: prop.unit ?? null, city: prop.city, propertyType: prop.type,
      beds: prop.beds, baths: prop.baths, sqft: prop.sqft ?? null, price: p.rent, rentControlled: rentControlled(prop.firstOccupied), parking: prop.parking || null,
      geom: { x: req.lng, y: req.lat }, listedAt: today(),
      raw: { description: prop.description, availableFrom: p.availableFrom, utilities: prop.utilities, furnished: prop.furnished, firstOccupied: prop.firstOccupied },
    }).returning();
    if (req.photos.length) await this.db.insert(listingMedia).values(req.photos.map((url, i) => ({ listingId: l!.id, kind: 'photo' as const, url, altText: `${prop.address}, photo ${i + 1}`, position: i })));
    await this.db.update(leaseProfiles).set({ listingId: l!.id, publishedAt: new Date() }).where(eq(leaseProfiles.dealId, deal.id));
    await this.db.update(deals).set({ stage: 'listed', listingId: l!.id }).where(eq(deals.id, deal.id));
    await this.db.insert(auditLog).values({ actorId: agentId, action: 'rental_published', entity: 'deal', entityId: deal.id, data: { listingId: l!.id, rent: p.rent } });
    const landlord = await this.client(deal.id);
    if (landlord) {
      await this.mail.send({ to: landlord.email, subject: `Your rental is live · ${prop.address}`, text: `${prop.address}, ${prop.city} is listed at ${money(p.rent)} a month.\nApplications come to you in Klyr, each with the same details so you can compare fairly.\n\n${SIGN}` });
      await this.notify.toUser(landlord.id, 'consumer', { title: 'Your rental is listed', body: prop.address, data: { screen: 'lease' } });
    }
    return { listingId: l!.id };
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  private async presentLease(dealId: string) {
    const [deal] = await this.db.select().from(deals).where(eq(deals.id, dealId));
    const p = await this.leaseProfile(dealId), prop = p.property as Property, pct = Number(p.tenantSidePct);
    const doc = await this.signedDoc(dealId, '210');
    const consents = p.listingId ? await this.db.select().from(representationConsents).where(eq(representationConsents.listingId, p.listingId)).orderBy(asc(representationConsents.createdAt)) : [];
    const apps = p.listingId ? await this.db.select({ a: leaseApplications, name: users.legalName }).from(leaseApplications)
      .innerJoin(dealParties, and(eq(dealParties.dealId, leaseApplications.dealId), eq(dealParties.role, 'client')))
      .innerJoin(users, eq(users.id, dealParties.userId))
      .where(eq(leaseApplications.listingId, p.listingId)).orderBy(asc(leaseApplications.createdAt)) : [];
    const visits = p.listingId ? await this.db.select().from(showings).where(and(eq(showings.listingId, p.listingId), inArray(showings.status, ['requested', 'confirmed', 'completed']))).orderBy(asc(showings.at)) : [];
    const leased = apps.find(x => x.a.status === 'accepted');
    return {
      dealId, stage: deal!.stage, property: prop, rent: p.rent, availableFrom: p.availableFrom, tenantSidePct: pct,
      viewings: visits.map(v => ({ id: v.id, at: v.at.toISOString(), status: v.status, feedback: v.feedback as VisitFeedbackRequest | null })),
      interest: leased ? await this.interest(leased.a) : [],
      rentControlled: rentControlled(prop.firstOccupied), guideline: RENT_GUIDELINE,
      net: landlordNet({ rent: p.rent, tenantSidePct: pct }), fee: LANDLORD_FEE,
      agreement: doc ? { documentId: doc.id, signedAt: doc.createdAt.toISOString() } : null,
      listingId: p.listingId, publishedAt: p.publishedAt?.toISOString() ?? null,
      agent: await this.agentOf(deal!.agentId),
      consents: consents.map((c, i) => ({ id: c.id, tenant: `Tenant ${i + 1}`, buyerSignedAt: c.buyerSignedAt?.toISOString() ?? null, sellerSignedAt: c.sellerSignedAt?.toISOString() ?? null })),
      applications: apps.map(({ a, name }) => {
        const s = a.snapshot as TenantProfileRequest;
        return {
          ...this.app(a), name,
          // The same facts for every applicant, nothing on protected grounds.
          screening: {
            monthlyIncome: s.monthlyIncome, incomeToRent: Math.round((s.monthlyIncome / a.rent) * 10) / 10, employer: s.employer, jobTitle: s.jobTitle,
            occupants: s.occupants, pets: s.pets ?? null, references: s.references.length, creditConsent: s.creditConsent,
          },
          net: landlordNet({ rent: a.rent, tenantSidePct: pct, months: Math.min(12, a.termMonths) }).net,
        };
      }),
    };
  }

  /** The deposit interest schedule with what the landlord recorded. */
  private async interest(a: typeof leaseApplications.$inferSelect) {
    const recorded = await this.db.select().from(lmrInterest).where(eq(lmrInterest.applicationId, a.id));
    return lmrInterestSchedule(a.rent, a.startDate, today()).map(i => {
      const r = recorded.find(x => x.dueDate === i.dueDate);
      return { ...i, method: r?.method ?? null, recordedAt: r?.recordedAt.toISOString() ?? null };
    });
  }

  private viewing(v: typeof showings.$inferSelect, address: string, city: string) {
    return { id: v.id, listingId: v.listingId, address, city, at: v.at.toISOString(), status: v.status, agentNote: v.agentNote, feedback: v.feedback as VisitFeedbackRequest | null };
  }

  private app(a: typeof leaseApplications.$inferSelect) {
    return {
      id: a.id, listingId: a.listingId, status: a.status, rent: a.rent, startDate: a.startDate, termMonths: a.termMonths,
      moveIn: moveInCost(a.rent), documentId: a.documentId, decidedAt: a.decidedAt?.toISOString() ?? null, createdAt: a.createdAt.toISOString(),
    };
  }

  private rentalCard(r: typeof listings.$inferSelect, photo?: { url: string; alt: string | null }) {
    const raw = (r.raw ?? {}) as { description?: string; availableFrom?: string; utilities?: string; furnished?: boolean };
    return {
      id: r.id, address: r.unit ? `${r.address} #${r.unit}` : r.address, city: r.city, type: r.propertyType, beds: r.beds, baths: r.baths, sqft: r.sqft,
      rent: r.price, moveIn: moveInCost(r.price), rentControlled: r.rentControlled, guideline: RENT_GUIDELINE,
      availableFrom: raw.availableFrom ?? null, parking: r.parking, utilities: raw.utilities ?? null, furnished: raw.furnished ?? false,
      description: raw.description ?? null, listingBrokerage: r.listingBrokerage, source: r.source, status: r.status,
      photo: photo ? { url: this.url(photo.url), alt: photo.alt ?? '' } : null,
    };
  }
  private url(u: string) { return u.startsWith('/') ? config.mediaBaseUrl + u : u; }

  private async consentFor(userId: string, r: typeof listings.$inferSelect) {
    if (r.source !== 'klyr_exclusive') return null;
    const [c] = await this.db.select().from(representationConsents).where(and(eq(representationConsents.listingId, r.id), eq(representationConsents.buyerId, userId)));
    return { buyerSignedAt: c?.buyerSignedAt?.toISOString() ?? null, sellerSignedAt: c?.sellerSignedAt?.toISOString() ?? null };
  }

  private async declined(tenant: { id: string; email: string } | null, address: string) {
    if (!tenant) return;
    await this.mail.send({ to: tenant.email, subject: `Update on your application · ${address}`, text: `The landlord of ${address} chose another application. Your profile is saved, so your next application takes a minute.\n\n${SIGN}` });
    await this.notify.toUser(tenant.id, 'consumer', { title: 'Update on your application', body: address, data: { screen: 'rent' } });
  }

  private async tenantDeal(userId: string) { return this.partyDeal(userId, 'lease_tenant', OPEN_TENANT.concat() as string[]); }
  private async landlordDeal(userId: string) { return this.partyDeal(userId, 'lease_landlord', OPEN_LANDLORD.concat() as string[]); }
  private async partyDeal(userId: string, side: 'lease_tenant' | 'lease_landlord', stages: string[]) {
    const [r] = await this.db.select({ deal: deals }).from(deals)
      .innerJoin(dealParties, and(eq(dealParties.dealId, deals.id), eq(dealParties.userId, userId), eq(dealParties.role, 'client')))
      .where(and(eq(deals.side, side), inArray(deals.stage, stages as (typeof deals.$inferSelect.stage)[]))).orderBy(desc(deals.createdAt)).limit(1);
    return r?.deal ?? null;
  }
  private async requireTenant(userId: string) {
    const d = await this.tenantDeal(userId);
    if (!d || !(await this.signedDoc(d.id, '346'))) throw new ConflictException({ code: 'agreement_required', message: 'Sign your tenant agreement (Form 346) first. It’s free.' });
    return d;
  }
  private async requireLandlord(userId: string) {
    const d = await this.landlordDeal(userId);
    if (!d) throw new NotFoundException({ code: 'not_leasing', message: 'Start by telling us about your rental.' });
    return d;
  }
  private async leaseProfile(dealId: string) {
    const [p] = await this.db.select().from(leaseProfiles).where(eq(leaseProfiles.dealId, dealId));
    if (!p) throw new NotFoundException();
    return p;
  }
  private async signedDoc(dealId: string, form: string) {
    const [doc] = await this.db.select().from(documents).where(and(eq(documents.dealId, dealId), eq(documents.oreaForm, form), eq(documents.status, 'signed'))).orderBy(desc(documents.createdAt)).limit(1);
    return doc ?? null;
  }
  private async agentOf(agentId: string) {
    const [a] = await this.db.select({ name: agents.registeredName, title: agents.title }).from(agents).where(eq(agents.userId, agentId));
    return a ?? null;
  }
  private async client(dealId: string) {
    const [c] = await this.db.select({ id: users.id, email: users.email }).from(dealParties).innerJoin(users, eq(users.id, dealParties.userId))
      .where(and(eq(dealParties.dealId, dealId), eq(dealParties.role, 'client')));
    return c ?? null;
  }
  private async landlordOf(listingId: string) {
    const [r] = await this.db.select({ id: users.id, email: users.email, agentId: deals.agentId }).from(leaseProfiles)
      .innerJoin(deals, eq(deals.id, leaseProfiles.dealId))
      .innerJoin(dealParties, and(eq(dealParties.dealId, deals.id), eq(dealParties.role, 'client')))
      .innerJoin(users, eq(users.id, dealParties.userId))
      .where(eq(leaseProfiles.listingId, listingId)).limit(1);
    return r ?? null;
  }
}
