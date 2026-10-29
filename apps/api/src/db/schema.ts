/**
 * Core relational model. One Postgres (RDS, ca-central-1) with PostGIS.
 * Bounded contexts are kept as separate groups of tables so they can be
 * split into schemas or services later without rewriting queries.
 */
import { sql } from 'drizzle-orm';
import {
  bigserial, boolean, char, customType, date, geometry, index, integer, jsonb, numeric, pgEnum, pgTable,
  primaryKey, text, timestamp, uniqueIndex, uuid,
} from 'drizzle-orm/pg-core';

const id = () => uuid('id').primaryKey().default(sql`gen_random_uuid()`);
const created = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();
const ts = (name: string) => timestamp(name, { withTimezone: true });
/** Whole dollars. Trust-account money should move to bigint cents before deposits go live. */
const dollars = (name: string) => integer(name);
const bytea = customType<{ data: Uint8Array<ArrayBuffer>; driverData: Buffer }>({
  dataType: () => 'bytea',
  toDriver: v => Buffer.from(v),
  fromDriver: v => new Uint8Array(v),
});

// ── Identity ────────────────────────────────────────────────────────────────
export const roleEnum = pgEnum('role', [
  'buyer', 'seller', 'bundle', 'tenant', 'landlord',
  'agent', 'broker_of_record', 'compliance_officer', 'privacy_officer', 'ops', 'admin',
  'lawyer', 'lender', 'inspector', 'insurer',
]);

export const organizations = pgTable('organizations', {
  id: id(),
  kind: text('kind', { enum: ['brokerage', 'law_firm', 'lender', 'inspector', 'insurer', 'mover', 'media'] }).notNull(),
  name: text('name').notNull(),
  /** RECO / LSO / FSRA registration shown wherever the org is advertised. */
  registration: text('registration'),
  /** Providers: contact email, phone, a one-line about, and whether they may pay Klyr a referral fee. */
  details: jsonb('details'),
  createdAt: created(),
});

export const users = pgTable('users', {
  id: id(),
  email: text('email').notNull(),
  emailVerifiedAt: ts('email_verified_at'),
  phone: text('phone'),
  legalName: text('legal_name'),
  mfaEnrolledAt: ts('mfa_enrolled_at'),
  /** Service-message preferences (deal updates by SMS/email, quiet hours). Marketing consent lives in `consents`. */
  prefs: jsonb('prefs').notNull().default({}),
  deletedAt: ts('deleted_at'),
  createdAt: created(),
}, t => [uniqueIndex('users_email_uq').on(sql`lower(${t.email})`)]);

export const userRoles = pgTable('user_roles', {
  userId: uuid('user_id').notNull().references(() => users.id),
  role: roleEnum('role').notNull(),
  /** Provider firm or brokerage the role acts for. */
  orgId: uuid('org_id').references(() => organizations.id),
}, t => [primaryKey({ columns: [t.userId, t.role] })]);

export const agents = pgTable('agents', {
  userId: uuid('user_id').primaryKey().references(() => users.id),
  brokerageId: uuid('brokerage_id').notNull().references(() => organizations.id),
  registeredName: text('registered_name').notNull(),
  title: text('title', { enum: ['Salesperson', 'Broker', 'Broker of Record'] }).notNull(),
  recoNumber: text('reco_number').notNull(),
  backupAgentId: uuid('backup_agent_id'),
});

/** Every consent is versioned and never overwritten (PIPEDA, CASL, VOW terms, credit pulls). */
export const consents = pgTable('consents', {
  id: id(),
  userId: uuid('user_id').notNull().references(() => users.id),
  kind: text('kind', { enum: ['privacy_notice', 'vow_terms', 'reco_guide', 'marketing', 'credit_check', 'ai_notice', 'sold_data'] }).notNull(),
  documentVersion: text('document_version').notNull(),
  /** For credit checks: who receives the report. */
  recipient: text('recipient'),
  grantedAt: ts('granted_at').notNull().defaultNow(),
  revokedAt: ts('revoked_at'),
});

/** Answers from onboarding "Tell us about your move"; seeds the home screen. */
export const moveProfiles = pgTable('move_profiles', {
  userId: uuid('user_id').notNull().references(() => users.id),
  plan: roleEnum('plan').notNull(),
  data: jsonb('data').notNull(),
  updatedAt: ts('updated_at').notNull().defaultNow(),
}, t => [primaryKey({ columns: [t.userId, t.plan] })]);

/** "How we estimate": the buyer's own inputs. Every all-in shown to them uses these. */
export const buyerAssumptions = pgTable('buyer_assumptions', {
  userId: uuid('user_id').primaryKey().references(() => users.id),
  rate: numeric('rate', { precision: 6, scale: 4, mode: 'number' }).notNull(),
  downPct: numeric('down_pct', { precision: 5, scale: 4, mode: 'number' }).notNull(),
  firstTime: boolean('first_time').notNull(),
  /** Lawyer's quoted fee before HST and disbursements. */
  lawyerFee: integer('lawyer_fee').notNull(),
  updatedAt: ts('updated_at').notNull().defaultNow(),
});

// ── Authentication ──────────────────────────────────────────────────────────
/** Opaque bearer sessions. Only a SHA-256 of the token is stored. */
export const sessions = pgTable('sessions', {
  id: id(),
  userId: uuid('user_id').notNull().references(() => users.id),
  tokenHash: char('token_hash', { length: 64 }).notNull(),
  /** 'mfa_pending' sessions can only complete the second factor. */
  state: text('state', { enum: ['active', 'mfa_pending'] }).notNull(),
  method: text('method', { enum: ['email_code', 'password', 'passkey'] }).notNull(),
  /** Last strong verification (passkey or TOTP); step-up for signing and payouts checks this. */
  mfaAt: ts('mfa_at'),
  userAgent: text('user_agent'),
  ip: text('ip'),
  createdAt: created(),
  lastSeenAt: ts('last_seen_at').notNull().defaultNow(),
  expiresAt: ts('expires_at').notNull(),
  revokedAt: ts('revoked_at'),
}, t => [uniqueIndex('sessions_token_uq').on(t.tokenHash), index('sessions_user_ix').on(t.userId)]);

export const emailCodes = pgTable('email_codes', {
  id: id(),
  email: text('email').notNull(),
  purpose: text('purpose', { enum: ['signup', 'signin', 'stepup'] }).notNull(),
  codeHash: char('code_hash', { length: 64 }).notNull(),
  attempts: integer('attempts').notNull().default(0),
  expiresAt: ts('expires_at').notNull(),
  consumedAt: ts('consumed_at'),
  createdAt: created(),
}, t => [index('email_codes_email_ix').on(t.email, t.createdAt)]);

export const passwordCredentials = pgTable('password_credentials', {
  userId: uuid('user_id').primaryKey().references(() => users.id),
  hash: text('hash').notNull(),
  failedCount: integer('failed_count').notNull().default(0),
  lockedUntil: ts('locked_until'),
  updatedAt: ts('updated_at').notNull().defaultNow(),
});

export const passkeys = pgTable('passkeys', {
  /** WebAuthn credential ID, base64url. */
  id: text('id').primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id),
  publicKey: bytea('public_key').notNull(),
  counter: integer('counter').notNull(),
  transports: text('transports').array(),
  deviceType: text('device_type').notNull(),
  backedUp: boolean('backed_up').notNull(),
  name: text('name'),
  createdAt: created(),
  lastUsedAt: ts('last_used_at'),
}, t => [index('passkeys_user_ix').on(t.userId)]);

export const webauthnChallenges = pgTable('webauthn_challenges', {
  id: id(),
  userId: uuid('user_id').references(() => users.id),
  kind: text('kind', { enum: ['registration', 'authentication'] }).notNull(),
  challenge: text('challenge').notNull(),
  expiresAt: ts('expires_at').notNull(),
});

/** TOTP secret, AES-256-GCM encrypted with AUTH_ENCRYPTION_KEY (KMS data key in AWS). */
export const totpCredentials = pgTable('totp_credentials', {
  userId: uuid('user_id').primaryKey().references(() => users.id),
  secretEnc: text('secret_enc').notNull(),
  enabledAt: ts('enabled_at'),
  /** Last accepted 30-second step, so a code can't be replayed. */
  lastStep: integer('last_step'),
});

// ── Listings (PropTx VOW / RESO Web API replica) ────────────────────────────
export const listings = pgTable('listings', {
  id: id(),
  mlsNumber: text('mls_number').notNull(),
  source: text('source', { enum: ['proptx_vow', 'klyr_exclusive', 'seed'] }).notNull(),
  status: text('status', { enum: ['active', 'sold', 'leased', 'expired', 'terminated', 'suspended'] }).notNull(),
  kind: text('kind', { enum: ['sale', 'lease'] }).notNull(),
  /** "Listing brokerage: …" is required on every card, thumbnail and detail view. */
  listingBrokerage: text('listing_brokerage').notNull(),
  /** VOW "no internet display" flag: never return these to clients. */
  internetDisplay: boolean('internet_display').notNull().default(true),
  address: text('address').notNull(),
  unit: text('unit'),
  city: text('city').notNull(),
  neighbourhood: text('neighbourhood'),
  propertyType: text('property_type', { enum: ['House', 'Townhouse', 'Condo'] }).notNull(),
  style: text('style'),
  beds: integer('beds'),
  baths: integer('baths'),
  sqft: integer('sqft'),
  yearBuilt: integer('year_built'),
  price: dollars('price').notNull(),
  /** Buyer brokerage co-op commission, fraction of price. */
  coop: numeric('coop', { precision: 6, scale: 4 }),
  annualTax: dollars('annual_tax'),
  condoFee: dollars('condo_fee'),
  rentControlled: boolean('rent_controlled'),
  lot: text('lot'),
  parking: text('parking'),
  heating: text('heating'),
  /** Free text from the listing brokerage, e.g. "Sat Oct 31 · 2–4 pm". */
  openHouse: text('open_house'),
  offerDate: text('offer_date'),
  geom: geometry('geom', { type: 'point', mode: 'xy', srid: 4326 }).notNull(),
  listedAt: date('listed_at'),
  soldAt: date('sold_at'),
  soldPrice: dollars('sold_price'),
  /** Untouched RESO payload for fields we don't model yet. */
  raw: jsonb('raw'),
  feedUpdatedAt: ts('feed_updated_at'),
  createdAt: created(),
}, t => [
  uniqueIndex('listings_source_mls_uq').on(t.source, t.mlsNumber),
  index('listings_geom_gix').using('gist', t.geom),
  index('listings_search_ix').on(t.kind, t.status, t.city, t.price),
]);

export const listingMedia = pgTable('listing_media', {
  id: id(),
  listingId: uuid('listing_id').notNull().references(() => listings.id, { onDelete: 'cascade' }),
  kind: text('kind', { enum: ['photo', 'video', 'floor_plan', 'tour_3d'] }).notNull(),
  url: text('url').notNull(),
  altText: text('alt_text'),
  captionsUrl: text('captions_url'),
  position: integer('position').notNull(),
});

/** Price history: listed, price changes, sold, terminated (VOW data, signed-in users only). */
export const listingEvents = pgTable('listing_events', {
  id: id(),
  listingId: uuid('listing_id').notNull().references(() => listings.id, { onDelete: 'cascade' }),
  at: date('at').notNull(),
  event: text('event', { enum: ['listed', 'price_change', 'sold', 'leased', 'terminated', 'expired'] }).notNull(),
  price: dollars('price'),
}, t => [index('listing_events_listing_ix').on(t.listingId, t.at)]);

/** Schools, commute and nearby places. Not MLS data: comes from school-board and routing providers. */
export const listingInsights = pgTable('listing_insights', {
  listingId: uuid('listing_id').primaryKey().references(() => listings.id, { onDelete: 'cascade' }),
  schools: jsonb('schools').$type<{ name: string; grades: string; distance: string }[]>().notNull(),
  commute: jsonb('commute').$type<{ to: string; how: string; time: string }[]>().notNull(),
  nearby: text('nearby'),
  source: text('source').notNull(),
  updatedAt: ts('updated_at').notNull().defaultNow(),
});

export const savedSearches = pgTable('saved_searches', {
  id: id(),
  userId: uuid('user_id').notNull().references(() => users.id),
  name: text('name').notNull(),
  filters: jsonb('filters').notNull(),
  alert: text('alert', { enum: ['instant', 'daily', 'off'] }).notNull().default('daily'),
  createdAt: created(),
  lastAlertedAt: ts('last_alerted_at'),
});

/**
 * What a saved search has already told its owner about, and at what price. A matching home with no row
 * is new; a lower price than the row's is a price drop. Works the same for seed data and the VOW feed.
 */
export const savedSearchHits = pgTable('saved_search_hits', {
  searchId: uuid('search_id').notNull().references(() => savedSearches.id, { onDelete: 'cascade' }),
  listingId: uuid('listing_id').notNull().references(() => listings.id, { onDelete: 'cascade' }),
  price: dollars('price').notNull(),
  seenAt: ts('seen_at').notNull().defaultNow(),
}, t => [primaryKey({ columns: [t.searchId, t.listingId] })]);

/** Drives the "Viewed Oct 24" badge and saved homes. */
export const listingViews = pgTable('listing_views', {
  userId: uuid('user_id').notNull().references(() => users.id),
  listingId: uuid('listing_id').notNull().references(() => listings.id),
  saved: boolean('saved').notNull().default(false),
  lastViewedAt: ts('last_viewed_at').notNull().defaultNow(),
}, t => [primaryKey({ columns: [t.userId, t.listingId] })]);

// ── Deals ───────────────────────────────────────────────────────────────────
export const dealStageEnum = pgEnum('deal_stage', ['searching', 'touring', 'offer', 'conditional', 'firm', 'closing', 'closed', 'released', 'preparing', 'listed']);

export const deals = pgTable('deals', {
  id: id(),
  side: text('side', { enum: ['buy', 'sell', 'lease_tenant', 'lease_landlord'] }).notNull(),
  /** Links the two deals of a sell + buy bundle. */
  bundleId: uuid('bundle_id'),
  listingId: uuid('listing_id').references(() => listings.id),
  agentId: uuid('agent_id').notNull().references(() => agents.userId),
  stage: dealStageEnum('stage').notNull().default('searching'),
  /** Cash-back plan (60–80 %) or seller plan, frozen when the representation agreement is signed. */
  plan: jsonb('plan').notNull(),
  /** Form 326 signed: Klyr AI stops giving price and negotiation advice. */
  multipleRepresentation: boolean('multiple_representation').notNull().default(false),
  closingDate: date('closing_date'),
  /** Keys released, recorded by the agent. */
  closedAt: ts('closed_at'),
  createdAt: created(),
}, t => [index('deals_agent_stage_ix').on(t.agentId, t.stage)]);

export const dealParties = pgTable('deal_parties', {
  dealId: uuid('deal_id').notNull().references(() => deals.id),
  userId: uuid('user_id').notNull().references(() => users.id),
  role: text('role', { enum: ['client', 'co_client', 'counterparty_unrepresented', 'lawyer', 'lender', 'inspector', 'insurer'] }).notNull(),
}, t => [primaryKey({ columns: [t.dealId, t.userId, t.role] })]);

/**
 * An offer on one home. draft → sent (buyer signed; with their agent) → registered (listing brokerage
 * confirmed receipt, Form 801) → accepted | signed_back | rejected; an accepted offer whose condition lapses is void. The agent can return a sent offer
 * for changes; the buyer can withdraw before the seller decides; past irrevocableAt it expires.
 * A sign-back is its own row (kind 'sign_back', parentId → the buyer's offer).
 */
export const offers = pgTable('offers', {
  id: id(),
  dealId: uuid('deal_id').notNull().references(() => deals.id),
  listingId: uuid('listing_id').notNull().references(() => listings.id),
  parentId: uuid('parent_id'),
  kind: text('kind', { enum: ['regular', 'pre_emptive', 'bully', 'sign_back', 'amendment'] }).notNull(),
  price: dollars('price').notNull(),
  deposit: dollars('deposit').notNull(),
  irrevocableAt: ts('irrevocable_at').notNull(),
  status: text('status', { enum: ['draft', 'sent', 'returned', 'registered', 'signed_back', 'accepted', 'rejected', 'expired', 'withdrawn', 'void'] }).notNull(),
  /** Conditions (days), closing date, inclusions, exclusions, note to agent. */
  terms: jsonb('terms').notNull(),
  /** The signed Form 100/101 record (buyer's offer) or the accepted sign-back. */
  documentId: uuid('document_id').references(() => documents.id),
  agentNote: text('agent_note'),
  sentAt: ts('sent_at'),
  registeredAt: ts('registered_at'),
  decidedAt: ts('decided_at'),
  createdAt: created(),
  updatedAt: ts('updated_at').notNull().defaultNow(),
}, t => [index('offers_deal_ix').on(t.dealId), index('offers_listing_ix').on(t.listingId)]);

/** Condition deadlines drive the day-by-day timeline and reminder jobs. */
export const conditions = pgTable('conditions', {
  id: id(),
  dealId: uuid('deal_id').notNull().references(() => deals.id),
  kind: text('kind', { enum: ['financing', 'inspection', 'status_certificate', 'sale_of_buyer_home', 'other'] }).notNull(),
  dueAt: ts('due_at').notNull(),
  /** The buyer signed a waiver or notice of fulfillment (Form 123)… */
  waivedAt: ts('waived_at'),
  fulfilledAt: ts('fulfilled_at'),
  documentId: uuid('document_id').references(() => documents.id),
  /** …which only counts once the agent delivers it to the listing brokerage before the deadline. */
  deliveredAt: ts('delivered_at'),
  /** Passed its deadline without a delivered notice: the agreement is void. */
  lapsedAt: ts('lapsed_at'),
  reminderSentAt: ts('reminder_sent_at'),
}, t => [index('conditions_open_due_ix').on(t.dueAt).where(sql`${t.waivedAt} is null and ${t.fulfilledAt} is null`)]);

/**
 * Amendment to an accepted agreement (Form 120): move closing and/or extend conditions. The buyer signs,
 * the agent presents it, and it changes the deal only once the seller accepts.
 */
export const amendments = pgTable('amendments', {
  id: id(),
  dealId: uuid('deal_id').notNull().references(() => deals.id),
  offerId: uuid('offer_id').notNull().references(() => offers.id),
  /** { closingDate?: 'YYYY-MM-DD', extend?: [{ conditionId, until: 'YYYY-MM-DD', from: ISO }] } */
  changes: jsonb('changes').notNull(),
  status: text('status', { enum: ['signed', 'accepted', 'rejected', 'withdrawn'] }).notNull(),
  documentId: uuid('document_id').references(() => documents.id),
  agentNote: text('agent_note'),
  createdAt: created(),
  decidedAt: ts('decided_at'),
}, t => [index('amendments_deal_ix').on(t.dealId)]);

/** The closing checklist after acceptance: one row per finished step, with what the buyer told us. */
export const dealTasks = pgTable('deal_tasks', {
  dealId: uuid('deal_id').notNull().references(() => deals.id),
  /** Buying: lawyer … walkthrough. Selling prep: payout, rules, approve (seller); photos, inspection (agent). */
  key: text('key', { enum: ['lawyer', 'mortgage', 'insurance', 'adjustments', 'walkthrough', 'payout', 'photos', 'inspection', 'rules', 'approve'] }).notNull(),
  details: jsonb('details').notNull().default({}),
  doneAt: ts('done_at').notNull().defaultNow(),
  doneBy: uuid('done_by').notNull().references(() => users.id),
}, t => [primaryKey({ columns: [t.dealId, t.key] })]);

/** A seller's home and listing plan, on their sell deal. The listing row exists once the agent publishes it. */
export const sellProfiles = pgTable('sell_profiles', {
  dealId: uuid('deal_id').primaryKey().references(() => deals.id),
  /** Address, city, type, beds, baths, sqft, year built, tax, condo fee. */
  property: jsonb('property').notNull(),
  plan: text('plan', { enum: ['flat', 'percent'] }).notNull().default('flat'),
  /** Offered to the buyer's brokerage, fraction of price. The seller decides this, not the agent. */
  coop: numeric('coop', { precision: 6, scale: 4 }).notNull().default('0.025'),
  listPrice: dollars('list_price').notNull(),
  mortgageBalance: dollars('mortgage_balance').notNull().default(0),
  listingId: uuid('listing_id').references(() => listings.id),
  publishedAt: ts('published_at'),
  createdAt: created(),
});

/** A tenant's profile, used to fill every Form 410 the same way. Only what Ontario landlords may ask. */
export const tenantProfiles = pgTable('tenant_profiles', {
  userId: uuid('user_id').primaryKey().references(() => users.id),
  /** Monthly income, employer, job title, occupants, pets, move-in, references, credit-check consent. */
  data: jsonb('data').notNull(),
  updatedAt: ts('updated_at').notNull().defaultNow(),
});

/** A landlord's home and lease terms, on their lease_landlord deal. The listing exists once the agent publishes it. */
export const leaseProfiles = pgTable('lease_profiles', {
  dealId: uuid('deal_id').primaryKey().references(() => deals.id),
  /** Address, city, type, beds, baths, sqft, first-occupied date, parking, utilities, furnished, description. */
  property: jsonb('property').notNull(),
  rent: dollars('rent').notNull(),
  availableFrom: date('available_from', { mode: 'string' }).notNull(),
  /** Offered to the tenant's brokerage, as a share of one month's rent. The landlord decides. */
  tenantSidePct: numeric('tenant_side_pct', { precision: 4, scale: 2 }).notNull().default('0.5'),
  listingId: uuid('listing_id').references(() => listings.id),
  publishedAt: ts('published_at'),
  createdAt: created(),
});

/** Form 410 (rental application) and Form 400 (offer to lease), submitted together on a rental. */
export const leaseApplications = pgTable('lease_applications', {
  id: id(),
  listingId: uuid('listing_id').notNull().references(() => listings.id),
  dealId: uuid('deal_id').notNull().references(() => deals.id),
  rent: dollars('rent').notNull(),
  startDate: date('start_date', { mode: 'string' }).notNull(),
  termMonths: integer('term_months').notNull(),
  /** The tenant profile as submitted, so every applicant is judged on what they sent. */
  snapshot: jsonb('snapshot').notNull(),
  status: text('status', { enum: ['submitted', 'accepted', 'declined', 'withdrawn'] }).notNull().default('submitted'),
  documentId: uuid('document_id').references(() => documents.id),
  landlordDocumentId: uuid('landlord_document_id').references(() => documents.id),
  decidedAt: ts('decided_at'),
  createdAt: created(),
}, t => [index('lease_applications_listing_ix').on(t.listingId)]);

/** Interest on a last month's rent deposit, recorded by the landlord each anniversary: paid, or kept to top the deposit up. */
export const lmrInterest = pgTable('lmr_interest', {
  applicationId: uuid('application_id').notNull().references(() => leaseApplications.id),
  dueDate: date('due_date', { mode: 'string' }).notNull(),
  amount: numeric('amount', { precision: 10, scale: 2 }).notNull(),
  method: text('method', { enum: ['paid', 'topped_up'] }).notNull(),
  recordedBy: uuid('recorded_by').notNull().references(() => users.id),
  recordedAt: ts('recorded_at').notNull().defaultNow(),
}, t => [primaryKey({ columns: [t.applicationId, t.dueDate] })]);

/**
 * Multiple representation (OREA Form 326): Klyr represents the seller and the buyer of the same home.
 * Both sign before the buyer can make an offer; each signature is a document on that party's own deal.
 */
export const representationConsents = pgTable('representation_consents', {
  id: id(),
  listingId: uuid('listing_id').notNull().references(() => listings.id),
  buyerId: uuid('buyer_id').notNull().references(() => users.id),
  buyerDocumentId: uuid('buyer_document_id').references(() => documents.id),
  buyerSignedAt: ts('buyer_signed_at'),
  sellerDocumentId: uuid('seller_document_id').references(() => documents.id),
  sellerSignedAt: ts('seller_signed_at'),
  createdAt: created(),
}, t => [uniqueIndex('representation_consents_uq').on(t.listingId, t.buyerId)]);

/** Visits a buyer books; the listing brokerage confirms. */
export const showings = pgTable('showings', {
  id: id(),
  dealId: uuid('deal_id').notNull().references(() => deals.id),
  listingId: uuid('listing_id').notNull().references(() => listings.id),
  at: ts('at').notNull(),
  status: text('status', { enum: ['requested', 'confirmed', 'declined', 'cancelled', 'completed'] }).notNull().default('requested'),
  note: text('note'),
  /** What the agent told the buyer when confirming, moving or declining. */
  agentNote: text('agent_note'),
  decidedBy: uuid('decided_by').references(() => users.id),
  decidedAt: ts('decided_at'),
  /** Geofenced check-in and check-out by the agent at the property: proof the visit happened. */
  checkInAt: ts('check_in_at'),
  checkInGeom: geometry('check_in_geom', { type: 'point', mode: 'xy', srid: 4326 }),
  checkInDistanceM: integer('check_in_distance_m'),
  checkInAccuracyM: integer('check_in_accuracy_m'),
  checkOutAt: ts('check_out_at'),
  checkOutGeom: geometry('check_out_geom', { type: 'point', mode: 'xy', srid: 4326 }),
  checkOutDistanceM: integer('check_out_distance_m'),
  /** When the agent's "visit soon" push went out, so the worker sends it once. */
  reminderSentAt: ts('reminder_sent_at'),
  /** The buyer's feedback after the visit; a Klyr seller sees it without the buyer's name. */
  feedback: jsonb('feedback'),
  feedbackAt: ts('feedback_at'),
  createdAt: created(),
  cancelledAt: ts('cancelled_at'),
}, t => [index('showings_deal_ix').on(t.dealId, t.at)]);

/**
 * A phone that receives push for a signed-in user. Tied to the session that registered it: when the
 * session is signed out, revoked or expires, that phone stops getting notifications.
 */
export const pushDevices = pgTable('push_devices', {
  id: id(),
  userId: uuid('user_id').notNull().references(() => users.id),
  sessionId: uuid('session_id').notNull().references(() => sessions.id),
  /** Expo push token ("ExponentPushToken[…]"). */
  token: text('token').notNull(),
  platform: text('platform', { enum: ['ios', 'android'] }).notNull(),
  app: text('app', { enum: ['agent', 'consumer'] }).notNull(),
  createdAt: created(),
  /** Set when the push service reports the token is no longer valid (app uninstalled). */
  disabledAt: ts('disabled_at'),
}, t => [uniqueIndex('push_devices_token_uq').on(t.token), index('push_devices_user_ix').on(t.userId)]);

// ── Documents and e-sign ────────────────────────────────────────────────────
export const documents = pgTable('documents', {
  id: id(),
  dealId: uuid('deal_id').references(() => deals.id),
  ownerId: uuid('owner_id').references(() => users.id),
  oreaForm: text('orea_form'),
  title: text('title').notNull(),
  status: text('status', { enum: ['draft', 'out_for_signature', 'signed', 'void'] }).notNull(),
  s3Key: text('s3_key').notNull(),
  sha256: char('sha256', { length: 64 }).notNull(),
  esignEnvelopeId: text('esign_envelope_id'),
  createdAt: created(),
});

export const signatures = pgTable('signatures', {
  id: id(),
  documentId: uuid('document_id').notNull().references(() => documents.id),
  userId: uuid('user_id').notNull().references(() => users.id),
  signedAt: ts('signed_at'),
  ip: text('ip'),
});

// ── Compliance (FINTRAC): records kept ≥ 5 years in S3 Object Lock ──────────
export const idVerifications = pgTable('id_verifications', {
  id: id(),
  userId: uuid('user_id').notNull().references(() => users.id),
  dealId: uuid('deal_id').references(() => deals.id),
  method: text('method', { enum: ['government_photo_id', 'credit_file', 'dual_process', 'reliance'] }).notNull(),
  vendor: text('vendor').notNull(),
  vendorRef: text('vendor_ref').notNull(),
  occupation: text('occupation'),
  sourceOfFunds: text('source_of_funds'),
  actingForThirdParty: boolean('acting_for_third_party'),
  thirdPartyDetails: jsonb('third_party_details'),
  politicallyExposed: boolean('politically_exposed'),
  beneficialOwners: jsonb('beneficial_owners'),
  /** Third-party or politically exposed cases wait for the compliance officer before visits and offers. */
  status: text('status', { enum: ['verified', 'needs_review', 'rejected'] }).notNull().default('verified'),
  buyingAs: text('buying_as', { enum: ['self', 'company'] }).notNull().default('self'),
  reviewedBy: uuid('reviewed_by').references(() => users.id),
  reviewedAt: ts('reviewed_at'),
  reviewNote: text('review_note'),
  /** Pointer to the immutable record in the records bucket. */
  recordS3Key: text('record_s3_key').notNull(),
  verifiedAt: ts('verified_at').notNull(),
  retainUntil: date('retain_until').notNull(),
});

// ── Money (no card processing: trust account + EFT) ─────────────────────────
export const deposits = pgTable('deposits', {
  id: id(),
  dealId: uuid('deal_id').notNull().references(() => deals.id),
  amount: dollars('amount').notNull(),
  holder: text('holder').notNull(),
  /** 24 h after acceptance under Form 100. */
  dueAt: ts('due_at').notNull(),
  /** Who confirmed the trust account details by phone, with whom, and when (wire-fraud check). */
  trustAccountVerifiedBy: text('trust_account_verified_by'),
  trustVerifiedAt: ts('trust_verified_at'),
  reminderSentAt: ts('reminder_sent_at'),
  receivedAt: ts('received_at'),
  inTrustAt: ts('in_trust_at'),
  receiptDocumentId: uuid('receipt_document_id').references(() => documents.id),
  returnedAt: ts('returned_at'),
});

export const cashBackPayouts = pgTable('cash_back_payouts', {
  id: id(),
  dealId: uuid('deal_id').notNull().references(() => deals.id),
  commissionReceived: dollars('commission_received'),
  amount: dollars('amount').notNull(),
  bankAccountVerifiedAt: ts('bank_account_verified_at'),
  lenderLetterDocumentId: uuid('lender_letter_document_id').references(() => documents.id),
  status: text('status', { enum: ['pending_commission', 'ready', 'sent', 'failed', 'reduced'] }).notNull(),
  /** Share of the commission paid back, frozen from Form 300 (e.g. 60). */
  pct: integer('pct').notNull().default(60),
  /** The EFT reference from the bank, once paid. */
  reference: text('reference'),
  createdAt: ts('created_at').notNull().defaultNow(),
  paidAt: ts('paid_at'),
});

// ── Provider marketplace ────────────────────────────────────────────────────
/** A client asks 1–4 providers of one kind for a quote; their agent enters the quotes as they arrive. */
export const quoteRequests = pgTable('quote_requests', {
  id: id(),
  dealId: uuid('deal_id').notNull().references(() => deals.id),
  kind: text('kind', { enum: ['lawyer', 'lender', 'inspector', 'insurer'] }).notNull(),
  providerIds: jsonb('provider_ids').notNull().$type<string[]>(),
  /** Lender: loan and amortization; insurer: home value; lawyer and inspector: price and city. */
  details: jsonb('details').notNull(),
  note: text('note'),
  status: text('status', { enum: ['open', 'chosen', 'cancelled'] }).notNull().default('open'),
  chosenQuoteId: uuid('chosen_quote_id'),
  createdAt: created(),
});

export const quotes = pgTable('quotes', {
  id: id(),
  requestId: uuid('request_id').references(() => quoteRequests.id),
  dealId: uuid('deal_id').notNull().references(() => deals.id),
  providerOrgId: uuid('provider_org_id').notNull().references(() => organizations.id),
  kind: text('kind', { enum: ['lawyer', 'lender', 'inspector', 'insurer', 'mover', 'media'] }).notNull(),
  /** What the client pays. Ranking uses this only, never the referral fee. */
  clientCost: dollars('client_cost').notNull(),
  rate: numeric('rate', { precision: 6, scale: 4 }),
  /** Disclosed to the client in writing (RECO Bulletin 3.3). */
  referralFee: dollars('referral_fee').notNull().default(0),
  source: text('source', { enum: ['manual', 'import'] }).notNull(),
  details: jsonb('details'),
  validUntil: ts('valid_until'),
  acceptedAt: ts('accepted_at'),
  createdAt: created(),
});

// ── Privacy and published settings ──────────────────────────────────────────
/** PIPEDA requests: access to, correction of, or deletion of a person's information. Answered within 30 days. */
export const privacyRequests = pgTable('privacy_requests', {
  id: id(),
  userId: uuid('user_id').notNull().references(() => users.id),
  kind: text('kind', { enum: ['access', 'correction', 'deletion'] }).notNull(),
  details: text('details'),
  status: text('status', { enum: ['open', 'completed', 'denied'] }).notNull().default('open'),
  dueAt: ts('due_at').notNull(),
  response: text('response'),
  decidedBy: uuid('decided_by').references(() => users.id),
  decidedAt: ts('decided_at'),
  createdAt: created(),
});

/** Values the brokerage publishes and reviews (estimate assumptions), versioned: the newest row is in force. */
export const publishedSettings = pgTable('published_settings', {
  id: id(),
  key: text('key', { enum: ['assumptions'] }).notNull(),
  value: jsonb('value').notNull(),
  note: text('note').notNull(),
  publishedBy: uuid('published_by').notNull().references(() => users.id),
  publishedAt: ts('published_at').notNull().defaultNow(),
}, t => [index('published_settings_key_ix').on(t.key, t.publishedAt)]);

// ── Messaging, AI and audit ─────────────────────────────────────────────────
export const threads = pgTable('threads', {
  id: id(),
  dealId: uuid('deal_id').references(() => deals.id),
  subject: text('subject'),
  createdAt: created(),
});

export const messages = pgTable('messages', {
  id: id(),
  threadId: uuid('thread_id').notNull().references(() => threads.id),
  authorId: uuid('author_id').references(() => users.id),
  /** 'assistant' rows are Klyr AI turns, saved to the client file by design. */
  authorKind: text('author_kind', { enum: ['user', 'assistant', 'system'] }).notNull(),
  body: text('body').notNull(),
  sources: jsonb('sources'),
  model: text('model'),
  sentToAgentAt: ts('sent_to_agent_at'),
  createdAt: created(),
}, t => [index('messages_thread_ix').on(t.threadId, t.createdAt)]);

/** Append-only. The app's DB role gets INSERT but not UPDATE or DELETE on this table. */
export const auditLog = pgTable('audit_log', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  actorId: uuid('actor_id'),
  action: text('action').notNull(),
  entity: text('entity').notNull(),
  entityId: text('entity_id'),
  data: jsonb('data'),
  at: ts('at').notNull().defaultNow(),
});
