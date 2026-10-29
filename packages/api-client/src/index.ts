import type { Me, SessionResponse, SignupRequest } from '@klyr/contracts';

export interface Result<T> { ok: boolean; status: number; data: T; error?: ApiError }
export interface ApiError { code?: string; message?: unknown }

export interface Device { id: string; method: string; userAgent: string | null; ip: string | null; createdAt: string; lastSeenAt: string; current: boolean }
export interface Passkey { id: string; name: string | null; deviceType: string; backedUp: boolean; createdAt: string; lastUsedAt: string | null }
export interface ListingCard {
  id: string; mlsNumber: string; address: string; city: string; neighbourhood: string | null; type: string;
  beds: number | null; baths: number | null; sqft: number | null; price: number; lat: number; lng: number;
  listingBrokerage: string; allIn: number; cashBack: number; monthly: number;
  photos: { url: string; alt: string }[];
  /** True for seed data, whose photos are stand-ins and must be labelled as such. */
  samplePhotos: boolean;
  saved: boolean;
  /** When this user last opened the listing, for the "Viewed" badge. */
  viewedAt: string | null;
  /** Mortgage + property tax + condo fee. */
  monthlyTotal: number;
  landTransfer: number;
  style: string | null; yearBuilt: number | null; offerDate: string | null;
}

export interface ListingDetail extends ListingCard {
  lot: string | null; parking: string | null; heating: string | null;
  annualTax: number | null; condoFee: number | null; coop: number; openHouse: string | null;
  daysOnMarket: number | null;
  estimate: {
    asOf: string; downPct: number; price: number; plan: number;
    /** The buyer's down payment was below the legal minimum here and was raised to it. */
    downRaised: boolean;
    /** True when the buyer changed "How we estimate"; false when published defaults apply. */
    customAssumptions: boolean;
    ltt: { on: number; onR: number; to: number; toR: number; total: number };
    lawyer: number; inspection: number; statusCertificate: number; title: number; adjustments: number;
    commission: number; cashBack: number; down: number; cmhc: number; cmhcPst: number; loan: number; rate: number;
    monthly: number; monthlyTax: number; condoFee: number; costs: number; allIn: number;
  };
  history: { at: string; event: 'listed' | 'price_change' | 'sold' | 'leased' | 'terminated' | 'expired'; price: number | null }[];
  comparables: { address: string; beds: number | null; sqft: number | null; soldPrice: number; soldAt: string; distanceM: number }[];
  insights: { schools: { name: string; grades: string; distance: string }[]; commute: { to: string; how: string; time: string }[]; nearby: string | null } | null;
}

export interface SearchQuery {
  city?: string; minPrice?: number; maxPrice?: number; minBeds?: number; type?: 'House' | 'Townhouse' | 'Condo';
  sort?: 'price_asc' | 'price_desc' | 'newest'; saved?: boolean;
  /** Specific homes, for Compare. */
  ids?: string;
}

export interface BuyingStatus {
  agreement: { signed: true; documentId: string; signedAt: string; endsOn: string } | { signed: false };
  idCheck: { status: 'not_started' | 'verified' | 'needs_review' | 'rejected'; verifiedAt?: string };
  agent: { name: string; title: string; brokerage: string } | null;
  canBookVisits: boolean;
}
export interface AgreementTerms {
  form: '300'; title: string; version: string; buyer: string; brokerage: string;
  startsOn: string; endsOn: string; area: string; cashBackPct: number; clauses: [string, string][];
}
export interface DocumentSummary { id: string; title: string; oreaForm: string | null; status: string; sha256: string; createdAt: string }
export interface Showing {
  id: string; at: string; status: 'requested' | 'confirmed' | 'declined' | 'cancelled' | 'completed'; note: string | null; agentNote: string | null;
  listingId: string; address: string; city: string; listingBrokerage: string; photo: { url: string; alt: string } | null;
}
export interface IdCheckAnswers {
  occupation: string; sourceOfFunds: ('savings' | 'sale_of_property' | 'gift' | 'investments' | 'employment' | 'other')[];
  actingForThirdParty: boolean; politicallyExposed: boolean; buyingAs: 'self' | 'company'; vendorRef: string;
}

/** An offer on one home, as the buyer and their agent see it. */
export interface OfferTermsInput {
  listingId: string; price: number; deposit: number;
  financingDays: number | null; inspectionDays: number | null; statusCertificateDays: number | null;
  irrevocableAt: string; closingDate: string; inclusions: string; exclusions: string; noteToAgent: string;
}
export type OfferStatus = 'draft' | 'sent' | 'returned' | 'registered' | 'signed_back' | 'accepted' | 'rejected' | 'expired' | 'withdrawn' | 'void';
export interface Offer {
  id: string; dealId: string; listingId: string; address: string; city: string; listingBrokerage: string; askingPrice: number; form: '100' | '101';
  photo: { url: string; alt: string } | null;
  status: OfferStatus; price: number; deposit: number; irrevocableAt: string;
  terms: Omit<OfferTermsInput, 'listingId' | 'price' | 'deposit' | 'irrevocableAt'>;
  agentNote: string | null; documentId: string | null;
  sentAt: string | null; registeredAt: string | null; decidedAt: string | null; updatedAt: string;
  allIn: number; cashBack: number; landTransfer: number;
  signBack: { id: string; price: number; irrevocableAt: string; status: OfferStatus; agentNote: string | null; decidedAt: string | null } | null;
}
export interface ProOffer extends Offer { clientId: string; clientName: string | null; clientEmail: string; depositStatus: Deal['deposit'] }
export interface Deal {
  dealId: string; stage: string; status: 'accepted' | 'void'; offerId: string; listingId: string; address: string; city: string; listingBrokerage: string;
  price: number; acceptedAt: string; closingDate: string;
  deposit: {
    amount: number; holder: string; dueAt: string; receivedAt: string | null;
    trustVerifiedAt: string | null; trustVerifiedBy: string | null; returnedAt: string | null;
  } | null;
  conditions: {
    id: string; kind: 'financing' | 'inspection' | 'status_certificate' | 'sale_of_buyer_home' | 'other'; dueAt: string;
    waivedAt: string | null; fulfilledAt: string | null; documentId: string | null; deliveredAt: string | null; lapsedAt: string | null;
  }[];
  /** Mutual release (Form 122) signed by the buyer after the agreement went void. */
  release: { documentId: string; signedAt: string } | null;
  /** Form 120 changes, newest first. */
  amendments: Amendment[];
  allIn: number; cashBack: number; landTransfer: number;
}
export interface Amendment {
  id: string; status: 'signed' | 'accepted' | 'rejected' | 'withdrawn';
  changes: { closingDate?: string; extend?: { conditionId: string; kind: Deal['conditions'][number]['kind']; from: string; until: string }[] };
  documentId: string | null; agentNote: string | null; createdAt: string; decidedAt: string | null;
}
export interface ProDeal extends Deal { clientName: string | null; clientEmail: string }

/** Klyr Pro (agents). */
export interface ProMe { name: string; title: string; reco: string | null; brokerage: string }
export interface ProShowing {
  id: string; at: string; status: Showing['status']; note: string | null; agentNote: string | null;
  checkInAt: string | null; checkInDistanceM: number | null; checkOutAt: string | null; checkOutDistanceM: number | null;
  listingId: string; address: string; city: string; listingBrokerage: string; lat: number; lng: number;
  clientId: string; clientName: string | null; clientPhone: string | null;
}
export type Decision = { action: 'confirm'; note?: string } | { action: 'move'; at: string; note: string } | { action: 'decline'; note: string };
/** A location reading for geofenced check-in; only the phone app's readings are accepted in production. */
export interface GeoReading { lat: number; lng: number; accuracyM: number; mocked?: boolean; platform: 'ios' | 'android' | 'web' }
export interface FieldEvent {
  at: string; action: string; showingId: string; address: string; clientName: string | null;
  reason: string | null; distanceM: number | null; accuracyM: number | null; platform: string | null; note: string | null;
}
export interface FieldDay {
  agentId: string; name: string;
  summary: { visitsCompleted: number; minutesOnSite: number; checkIns: number; refused: number; decisions: number };
  events: FieldEvent[];
}
export interface ClientProgress { agreementSignedAt: string | null; idStatus: BuyingStatus['idCheck']['status']; openVisits: number }
export interface ProClient extends ClientProgress { dealId: string; stage: string; userId: string; name: string | null; email: string; phone: string | null; since: string }
export interface ProClientDetail extends ClientProgress {
  dealId: string; stage: string; name: string | null; email: string; phone: string | null;
  profile: { plan: string; data: Record<string, unknown> }[];
  saved: { id: string; address: string; city: string; price: number }[];
  documents: { id: string; title: string; createdAt: string }[];
  visits: { id: string; at: string; status: Showing['status']; address: string }[];
}
/** Klyr Admin: an ID check waiting for the compliance officer. */
export interface IdReview {
  id: string; verifiedAt: string; name: string | null; email: string; occupation: string; sourceOfFunds: string[];
  actingForThirdParty: boolean; politicallyExposed: boolean; buyingAs: 'self' | 'company'; vendor: string; method: string;
}

export interface Assumptions { rate: number; downPct: number; firstTime: boolean; lawyerFee: number }
/** Session as the client sees it; web never receives the token (the proxy keeps it). */
export type SignedIn = Omit<SessionResponse, 'session'> & { session: { token?: string; expiresAt: string; mfaRequired: boolean } };
// WebAuthn JSON is passed through untouched; each platform's WebAuthn library types it.
type Json = Record<string, unknown>;
export interface Challenge<O = Json> { challengeId: string; options: O }

export interface ClientOptions {
  /** '/api' on web (same-origin proxy), the API URL on mobile. */
  baseUrl: string;
  /** Mobile: returns the stored bearer token. */
  getToken?: () => Promise<string | null> | string | null;
  /** Mobile: called with a new token after sign-in, and with null after sign-out or a 401. */
  onToken?: (token: string | null) => Promise<void> | void;
}

/** One sentence for the user from any API error body. */
export function errorText(e: ApiError | undefined): string {
  const m = e?.message;
  if (typeof m === 'string') return m;
  if (Array.isArray(m) && m[0]?.message) return String(m[0].message);
  return 'Something went wrong. Try again.';
}

export function createClient(opts: ClientOptions) {
  async function call<T>(method: string, path: string, body?: unknown): Promise<Result<T>> {
    const token = opts.getToken ? await opts.getToken() : null;
    let res: Response;
    try {
      res = await fetch(opts.baseUrl + path, {
        method,
        headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch {
      return { ok: false, status: 0, data: undefined as T, error: { code: 'offline', message: 'Can’t reach Klyr. Check your connection and try again.' } };
    }
    const data = await res.json().catch(() => undefined);
    if (res.ok && data?.session?.token && opts.onToken) await opts.onToken(data.session.token);
    if (res.status === 401 && token && opts.onToken && data?.code === 'signed_out') await opts.onToken(null);
    return res.ok ? { ok: true, status: res.status, data } : { ok: false, status: res.status, data, error: data ?? {} };
  }
  const post = <T>(path: string, body?: unknown) => call<T>('POST', path, body);
  const get = <T>(path: string) => call<T>('GET', path);
  const del = <T>(path: string) => call<T>('DELETE', path);

  return {
    signup: (b: Omit<SignupRequest, 'setup' | 'dealUpdates' | 'marketing'> & Partial<SignupRequest>) => post<{ sent: true }>('/auth/signup', b),
    emailStart: (email: string) => post<{ sent: true }>('/auth/email/start', { email }),
    emailVerify: (email: string, code: string) => post<SignedIn>('/auth/email/verify', { email, code }),
    passwordLogin: (email: string, password: string) => post<SignedIn>('/auth/password/login', { email, password }),
    setPassword: (password: string) => post<{ ok: true }>('/auth/password', { password }),
    me: () => get<Me>('/auth/me'),
    logout: async () => { const r = await post<{ ok: true }>('/auth/logout'); await opts.onToken?.(null); return r; },

    totpSetup: () => post<{ secret: string; otpauthUrl: string }>('/auth/mfa/totp/setup'),
    totpEnable: (code: string) => post<{ ok: true }>('/auth/mfa/totp/enable', { code }),
    totpVerify: (code: string) => post<{ ok: true }>('/auth/mfa/totp/verify', { code }),
    totpDisable: () => post<{ ok: true }>('/auth/mfa/totp/disable'),

    devices: () => get<Device[]>('/auth/sessions'),
    signOutDevice: (id: string) => del<{ ok: true }>(`/auth/sessions/${encodeURIComponent(id)}`),
    signOutOthers: () => post<{ signedOut: number }>('/auth/sessions/revoke-others'),

    passkeys: () => get<Passkey[]>('/auth/passkeys'),
    removePasskey: (id: string) => del<{ ok: true }>(`/auth/passkeys/${encodeURIComponent(id)}`),
    passkeyRegisterOptions: <O = Json>() => post<Challenge<O>>('/auth/passkey/register/options'),
    passkeyRegisterVerify: (challengeId: string, response: unknown, name?: string) => post<{ ok: true }>('/auth/passkey/register/verify', { challengeId, response, name }),
    passkeyLoginOptions: <O = Json>() => post<Challenge<O>>('/auth/passkey/login/options'),
    passkeyLoginVerify: (challengeId: string, response: unknown) => post<SignedIn>('/auth/passkey/login/verify', { challengeId, response }),
    passkeyStepUpOptions: <O = Json>() => post<Challenge<O>>('/auth/passkey/stepup/options'),
    passkeyStepUpVerify: (challengeId: string, response: unknown) => post<{ ok: true }>('/auth/passkey/stepup/verify', { challengeId, response }),

    listings: (q: SearchQuery = {}) => get<{ results: ListingCard[]; capped: boolean }>(`/listings${searchParams(q)}`),
    assumptions: () => get<Assumptions & { custom: boolean }>('/me/assumptions'),
    setAssumptions: (a: Assumptions) => call<Assumptions & { custom: boolean }>('PUT', '/me/assumptions', a),
    resetAssumptions: () => del<Assumptions & { custom: boolean }>('/me/assumptions'),
    stepUpEmailStart: () => post<{ sent: true }>('/auth/stepup/email/start'),
    stepUpEmailVerify: (code: string) => post<{ ok: true }>('/auth/stepup/email/verify', { code }),
    buying: () => get<BuyingStatus>('/buying'),
    agreementTerms: () => get<AgreementTerms>('/agreements/300'),
    signAgreement: (typedName: string) => post<{ documentId: string; sha256: string; signedAt: string }>('/agreements/300/sign', { typedName, readConfirmed: true }),
    documents: () => get<DocumentSummary[]>('/documents'),
    document: (id: string) => get<DocumentSummary & { record: Record<string, unknown> & { clauses?: [string, string][]; signer?: { typedName: string; signedAt: string } } }>(`/documents/${encodeURIComponent(id)}`),
    idCheck: () => get<{ status: BuyingStatus['idCheck']['status']; verifiedAt?: string; vendor?: string }>('/id-check'),
    submitIdCheck: (a: IdCheckAnswers) => post<{ status: BuyingStatus['idCheck']['status'] }>('/id-check', a),
    showings: () => get<Showing[]>('/showings'),
    bookShowing: (listingId: string, at: string, note?: string) => post<Showing>('/showings', { listingId, at, note }),
    cancelShowing: (id: string) => del<{ ok: true }>(`/showings/${encodeURIComponent(id)}`),
    listing: (id: string) => get<ListingDetail>(`/listings/${encodeURIComponent(id)}`),
    save: (id: string) => call<{ saved: boolean }>('PUT', `/listings/${encodeURIComponent(id)}/save`),
    unsave: (id: string) => del<{ saved: boolean }>(`/listings/${encodeURIComponent(id)}/save`),

    offerStart: (listingId: string) => get<{ draft: Offer | null; defaults: OfferTermsInput | null }>(`/offers/start?listingId=${encodeURIComponent(listingId)}`),
    saveOffer: (t: OfferTermsInput) => call<Offer>('PUT', '/offers/draft', t),
    signOffer: (id: string, typedName: string) => post<Offer>(`/offers/${encodeURIComponent(id)}/sign`, { typedName, readConfirmed: true }),
    offers: () => get<Offer[]>('/offers'),
    offer: (id: string) => get<Offer>(`/offers/${encodeURIComponent(id)}`),
    withdrawOffer: (id: string) => del<{ ok: true }>(`/offers/${encodeURIComponent(id)}`),
    acceptSignBack: (id: string, typedName: string) => post<Offer>(`/offers/${encodeURIComponent(id)}/respond`, { decision: 'accept', typedName, readConfirmed: true }),
    declineSignBack: (id: string, note?: string) => post<Offer>(`/offers/${encodeURIComponent(id)}/respond`, { decision: 'decline', note }),
    deal: () => get<Deal>('/deal'),
    /** The Klyr app on this phone gets push while this sign-in lasts. */
    registerDevice: (token: string, platform: 'ios' | 'android') => post<{ ok: true }>('/me/devices', { token, platform }),
    conditionNotice: (id: string, action: 'waive' | 'fulfil', typedName: string) => post<Deal>(`/deal/conditions/${encodeURIComponent(id)}`, { action, typedName, readConfirmed: true }),
    proposeAmendment: (a: { closingDate?: string; extend: { conditionId: string; until: string }[] }, typedName: string) => post<Deal>('/deal/amendments', { ...a, typedName, readConfirmed: true }),
    withdrawAmendment: (id: string) => del<Deal>(`/deal/amendments/${encodeURIComponent(id)}`),
    signRelease: (typedName: string) => post<Deal>('/deal/release', { typedName, readConfirmed: true }),

    pro: {
      offers: () => get<ProOffer[]>('/pro/offers'),
      reviewOffer: (id: string, r: { action: 'register'; note?: string } | { action: 'return'; note: string }) => post<{ id: string; status: OfferStatus }>(`/pro/offers/${encodeURIComponent(id)}/review`, r),
      offerResult: (id: string, r: { result: 'accepted'; note?: string } | { result: 'signed_back'; price: number; irrevocableAt: string; note?: string } | { result: 'rejected'; note?: string }) =>
        post<{ id: string; status: OfferStatus; signBackId?: string }>(`/pro/offers/${encodeURIComponent(id)}/result`, r),
      deals: () => get<ProDeal[]>('/pro/deals'),
      amendmentResult: (id: string, result: 'accepted' | 'rejected', note?: string) => post<{ id: string; status: string }>(`/pro/amendments/${encodeURIComponent(id)}/result`, { result, note }),
      delivered: (conditionId: string) => post<{ id: string; firm: boolean }>(`/pro/conditions/${encodeURIComponent(conditionId)}/delivered`),
      trustVerified: (dealId: string, note: string) => post<{ ok: true }>(`/pro/deals/${encodeURIComponent(dealId)}/trust-verified`, { note }),
      depositReturned: (dealId: string) => post<{ ok: true }>(`/pro/deals/${encodeURIComponent(dealId)}/deposit-returned`),
      depositReceived: (dealId: string) => post<{ ok: true }>(`/pro/deals/${encodeURIComponent(dealId)}/deposit-received`),
      me: () => get<ProMe>('/pro/me'),
      showings: () => get<ProShowing[]>('/pro/showings'),
      decide: (id: string, d: Decision) => post<{ id: string; status: Showing['status']; at: string }>(`/pro/showings/${encodeURIComponent(id)}/decide`, d),
      checkIn: (id: string, g: GeoReading) => post<{ checkedIn: true; distanceM: number }>(`/pro/showings/${encodeURIComponent(id)}/check-in`, g),
      complete: (id: string, g: GeoReading) => post<{ completed: true; distanceM: number }>(`/pro/showings/${encodeURIComponent(id)}/complete`, g),
      registerDevice: (token: string, platform: 'ios' | 'android') => post<{ ok: true }>('/pro/devices', { token, platform }),
      activity: (day?: string) => get<FieldDay & { day: string }>(`/pro/activity${day ? `?day=${day}` : ''}`),
      clients: () => get<ProClient[]>('/pro/clients'),
      client: (id: string) => get<ProClientDetail>(`/pro/clients/${encodeURIComponent(id)}`),
    },
    admin: {
      idReviews: () => get<IdReview[]>('/admin/id-reviews'),
      fieldActivity: (day?: string) => get<{ day: string; agents: FieldDay[] }>(`/admin/field-activity${day ? `?day=${day}` : ''}`),
      reviewId: (id: string, decision: 'approve' | 'reject', note: string) => post<{ id: string; status: 'verified' | 'rejected' }>(`/admin/id-reviews/${encodeURIComponent(id)}`, { decision, note }),
    },
  };
}

export type KlyrClient = ReturnType<typeof createClient>;

const metres = (m: number) => (m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${m} m`);

const REASONS: Record<string, string> = {
  too_far: 'too far from the home', low_accuracy: 'GPS not accurate enough', mocked_location: 'mock location detected',
  outside_window: 'outside the visit time', too_soon: 'less than 10 minutes on site', not_phone: 'not from the phone app',
};

/** One line per audit event, the same words in the app and in Admin. */
export function describeFieldEvent(e: FieldEvent): { title: string; detail: string; tone: 'ok' | 'warn' | 'plain' } {
  const where = e.distanceM !== null ? metres(e.distanceM) + ' from the home' : '';
  if (e.action.endsWith('_refused')) {
    const what = e.action.startsWith('showing_complete') ? 'Completion refused' : 'Check-in refused';
    return { title: `${what}: ${REASONS[e.reason ?? ''] ?? e.reason}`, detail: [where, e.accuracyM !== null ? `GPS ±${e.accuracyM} m` : ''].filter(Boolean).join(' · '), tone: 'warn' };
  }
  switch (e.action) {
    case 'showing_check_in': return { title: 'Checked in', detail: [where, e.accuracyM !== null ? `GPS ±${e.accuracyM} m` : ''].filter(Boolean).join(' · '), tone: 'ok' };
    case 'showing_complete': return { title: 'Completed visit', detail: where, tone: 'ok' };
    case 'showing_confirm': return { title: 'Confirmed visit', detail: e.note ? `“${e.note}”` : '', tone: 'plain' };
    case 'showing_move': return { title: 'Moved visit', detail: e.note ? `“${e.note}”` : '', tone: 'plain' };
    case 'showing_decline': return { title: 'Declined visit', detail: e.note ? `“${e.note}”` : '', tone: 'plain' };
    default: return { title: e.action, detail: '', tone: 'plain' };
  }
}


export function searchParams(q: SearchQuery): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(q)) if (v !== undefined && v !== '' && v !== false) p.set(k, String(v));
  const s = p.toString();
  return s ? '?' + s : '';
}
