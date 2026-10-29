# Klyr architecture

Status: **proposed, v0.1** (Oct 28, 2026). Decisions confirmed by the product owner: AWS Canada, Expo for mobile, NestJS backend, one TypeScript monorepo.

Source design: `design/prototype/Klyr App Core.dc.html` (71 screens: buy, sell, sell + buy, rent, lease out, account, shared), plus the Agent, Pro and four provider prototypes, `Klyr Production Readiness` and `Klyr Launch Checklist`.

---

## 1. What we are building

| Surface | Users | Platform | App in this repo |
|---|---|---|---|
| **Klyr** (consumer) | Buyers, sellers, sell + buy, tenants, landlords | iOS + Android | `apps/mobile` (Expo) |
| **Klyr web** (consumer) | Same as above, plus public listing pages | Web (responsive) | `apps/web` (Next.js) |
| **Klyr Pro** | Agents; lawyers, lenders, inspectors, insurers | Web | `apps/pro` (Next.js) |
| **Klyr Pro phone app** | Agents in the field | iOS + Android | `apps/agent` (Expo) |
| **Klyr Admin** | Broker of record, compliance, privacy, ops, finance | Web, internal only | `apps/admin` (Next.js) |
| **API + worker** | All of the above | AWS ECS | `apps/api` (NestJS) |

The prototype's "one core, two shells" model (sidebar on web, tab bar on phone) carries over. Each consumer client renders the same five plans and the same route map (`ROUTES` in App Core). Both clients get the cost engine, contracts and design tokens from shared packages.

Agents in the field get their own phone app, **Klyr Pro** (`apps/agent`), rather than a role inside the consumer app:
* Only the agent app asks for location, so buyers never see that prompt.
* Its sign-in always requires the authenticator.
* It has its own store listing and release cycle.

The phone app covers showings with GPS check-in, the day's activity and clients. Desk work (pipeline, documents, offers) stays in Klyr Pro on the web, which can confirm or move visits but sends agents to the phone to check in.

## 2. Stack at a glance

| Layer | Choice | Why |
|---|---|---|
| Language | TypeScript everywhere | One set of types from the database to the screens. The cost engine runs identically on the phone, the web and the server. |
| Repo | pnpm workspaces + Turborepo | Fast installs, task caching, one PR spans API and UI |
| Consumer web | Next.js 16 (App Router, React 19) | Server rendering for public listing and SEO pages. Sold data stays behind login per VOW rules. |
| Mobile | Expo 58 / React Native 0.88, Expo Router | One codebase for iOS + Android. OTA updates for copy and legal-text fixes. Native modules for camera ID capture, geofencing and push. |
| Pro + Admin | Next.js 16 | Same component and token system as web. Admin is deployed separately and served only behind SSO/VPN. |
| API | NestJS 12 (modular monolith), REST + zod contracts | Clear module boundaries without microservice overhead. Contracts in `@klyr/contracts` validate requests and type every client. |
| Background jobs | BullMQ on Redis | Listing feed sync, deadline reminders, alerts, document rendering |
| Database | PostgreSQL 16 + PostGIS (Amazon RDS, Multi-AZ) | Relational deal data, plus geospatial queries for the map, 1 km radius and geofences. Drizzle ORM keeps SQL visible. |
| Cache / queues | Redis (ElastiCache) | Queues, rate limits, sessions |
| Search | Postgres (PostGIS + btree + pg_trgm) first; OpenSearch only if needed | VOW caps results at 100 per search and the GTA dataset is small enough for Postgres. Revisit if address autocomplete or relevance tuning outgrows it. |
| Files | S3: `docs` bucket (versioned), `records` bucket (Object Lock, compliance mode, 5 years) | Signed forms and FINTRAC records must be tamper-proof and retained |
| AI | Claude via Amazon Bedrock in ca-central-1 | Client data stays in Canada and isn't used for training (Launch Checklist action 11) |
| Hosting | AWS ca-central-1 only | PIPEDA comfort, credit-bureau and PropTx contracts, FINTRAC records |

## 3. System diagram

```
             ┌──────────── CloudFront + WAF ────────────┐
 Phone app ──┤                                           ├── ALB ── ECS: api (NestJS) ──┬── RDS Postgres + PostGIS
 Web ────────┤  ECS: web   ECS: pro   ECS: admin (VPN)   │                              ├── ElastiCache Redis
             └───────────────────────────────────────────┘                              ├── S3 docs / records (Object Lock)
                                                          ECS: worker (BullMQ) ─────────┤
                                                                                        └── Bedrock (Claude), SES, SNS/Pinpoint
 External: PropTx VOW (RESO Web API) · e-sign · ID verification · credit bureau · EFT payouts · Expo push · Twilio SMS · maps
```

## 4. Backend modules

One deployable, with each module owning its own tables (`apps/api/src/db/schema.ts`). Modules talk through services, never through each other's tables. That keeps each one splittable later.

| Module | Owns | Built now? |
|---|---|---|
| `identity` | users, roles, consents, sessions, email codes, passwords, passkeys, TOTP | **Yes**: sign-up, sign-in, step-up, devices |
| `listings` | PropTx VOW replica, media, saved searches, views, 100-result cap, no-display flag | **Yes**: search, near-me, detail |
| `estimates` | Wraps `@klyr/core`; records the estimate shown at each decision point | **Yes**: `POST /estimates` |
| `deals` | Deals, parties, Form 300, documents, showings; offers, conditions and timeline next | **Yes**: agreement, documents, visits |
| `documents` | OREA form rendering, e-sign envelopes, S3, hashes | Schema only |
| `compliance` | FINTRAC ID, third-party and PEP checks, receipt of funds, retention | **Yes**: ID check (sandbox verifier until the vendor is chosen) |
| `money` | Deposits (24 h countdown, trust call-back), cash-back payouts | Schema only |
| `marketplace` | Providers, quotes (typed in or imported), referral-fee disclosure | Schema only |
| `messaging` / `notifications` | Threads, push, email, SMS inside 24 h, quiet hours | Schema only |
| `ai` | Klyr AI turns stored as messages, with sources and model; "Send to Maya" | Schema only |
| `audit` | Append-only log (no UPDATE/DELETE grant for the app role) | Schema only |
| `health` | Liveness/readiness | **Yes** |

**Auth.** Built in-house on Postgres so identity data stays in Canada (hosted IdPs such as Clerk or Auth0 were rejected for data residency): email codes, passkeys (WebAuthn), passwords (scrypt) and TOTP. Opaque session tokens, stored hashed; web keeps them in an httpOnly cookie via a same-origin proxy, the phone app will keep them in the secure keychain. Sign in with Apple/Google and SMS step-up are still to add. Staff sign in to Admin through the company IdP (SAML/OIDC).

**Authorization.** Role plus relationship checks: a user acts on a deal only as one of its `deal_parties`. Agents see their own deals and their backup assignments. Providers see only deals that sent them a quote request.

## 5. Data rules that shape the schema

| Rule (source) | Where it lives |
|---|---|
| "Listing brokerage: …" on every listing (VOW, RECO) | `listings.listing_brokerage` NOT NULL; included in every search card |
| No-display flag | `listings.internet_display` filtered in every query |
| 100 results per search | `VOW_RESULT_CAP` in `listings.service.ts` |
| Sold data only behind a registered login | `sold_price` is excluded from public endpoints; needs a `vow_terms` consent |
| All-in includes HST and disbursements, dated (Competition Act) | `@klyr/core` `DEFAULT_ASSUMPTIONS.asOf`; returned with every estimate |
| FINTRAC: ID, third party, PEP, beneficial owners; 5 years | `id_verifications` + S3 Object Lock record; `retain_until` |
| Deposit within 24 h; trust account verified by call-back | `deposits.due_at`, `trust_account_verified_by` |
| Referral fees disclosed; ranking never by Klyr earnings | `quotes.referral_fee` separate from `client_cost` |
| AI conversations kept in the client file; no price advice under Form 326 | `messages.author_kind = 'assistant'`; `deals.multiple_representation` |
| Consent per credit pull, naming the recipient (PIPEDA) | `consents.kind = 'credit_check'`, `recipient` |

## 6. Integrations (vendors to choose; the Launch Checklist owner signs off)

| Need | Shortlist | Notes |
|---|---|---|
| Listings | PropTx VOW Datafeed (RESO Web API) | Blocked on the VOW agreement (action 1). The worker's `listing-feed` job is stubbed. |
| OREA forms + e-sign | OREA forms licence via WEBForms/Transaction Desk; DocuSign or Dropbox Sign | Form text is licensed; confirm we may render it in-app |
| ID verification (FINTRAC) | Canadian vendors that support FINTRAC methods (e.g. Trulioo, Interac verification, Persona) | Must meet FINTRAC's ID methods; keep the raw evidence in the `records` bucket |
| Credit checks (tenants) | Equifax / TransUnion via a reseller | Credit bureau agreement (action 10) |
| Payouts | EFT via the bank's API or a Canadian payables platform | No card processing in scope |
| Notifications | Expo push, Amazon SES, Twilio (SMS) | SMS only for deadlines inside 24 h |
| Maps | MapLibre with a commercial tile host (Mapbox or Stadia) | Web uses Leaflet with `NEXT_PUBLIC_MAP_TILES`; the OpenStreetMap default is for development only |
| Observability | Sentry, OpenTelemetry → CloudWatch, PostHog (self-hosted or EU/CA) | Journey events: search → visit → offer → firm → keys |

## 7. Environments and delivery

* **local**: `docker compose up` (PostGIS, Redis, MinIO for S3, Mailpit for SES). `pnpm db:migrate && pnpm db:seed` loads the six prototype listings.
* **dev / staging / prod**: separate AWS accounts under one Organization, all in ca-central-1. Infrastructure as Terraform (`infra/`).
* **CI** (`.github/workflows/ci.yml`): build, typecheck, test, and migrations against PostGIS on every PR.
* **CD**: build the API image once (`apps/api/Dockerfile`) and deploy it as two ECS services, api and worker. Web, Pro and Admin ship as Next.js standalone images. Mobile builds through EAS: store builds for native changes, OTA updates for JS-only fixes.
* **Migrations**: Drizzle SQL files in `apps/api/drizzle`, applied by a one-off ECS task before each deploy. Always backward-compatible (expand, then contract).

## 8. Security baseline

TLS everywhere; RDS and S3 encrypted with KMS; secrets in AWS Secrets Manager. WAF on CloudFront. MFA for signing, payouts and every staff account. Session timeout and a device list (Security screen). Append-only audit log. PII is never logged; Sentry scrubbing is on. Penetration test before launch (action 13). Admin is reachable only through SSO and the VPN.

## 9. What's in this scaffold vs next steps

**Working now** (verified locally):
* `@klyr/core`: the prototype's Ontario cost engine as typed TS, with 10 tests pinned to the prototype's own numbers.
* `apps/api`: Postgres + PostGIS schema for all modules; the first migration; seed data; `GET /health`, `GET /listings` (filters, `near=lat,lng,metres`, 100 cap, brokerage label, all-in per card), `GET /listings/:id`, `POST /estimates`.
* Identity: sign-up that records terms, VOW, privacy and RECO-guide acceptance by version; 6-digit email codes; passkeys; passwords with lockout; TOTP two-step; MFA-pending sessions; step-up for sensitive actions; device list and sign-out. Listings and estimates require sign-in. Covered by RFC test vectors and end-to-end tests on Postgres.
* `apps/web`: welcome → plan → your move → RECO guide → account → email code → passkey or password → search, matching App Core. The session lives in an httpOnly cookie behind a same-origin proxy (`app/api/[...path]`). Screenshots in `docs/screenshots/`.
* Security screen on web and phone: passkeys (add on web, remove), password set/change, authenticator app on/off (QR on web, open-in-app or copy key on phone), devices with "sign out" and "sign out all other devices". Sensitive changes ask "Confirm it’s you" (passkey on web, authenticator code on both).
* `apps/mobile`: same onboarding as web with email code and password, then home with live all-in cards and the Security screen. Token in the iOS Keychain / Android Keystore (`expo-secure-store`); Fonts: San Francisco on Apple devices, Inter elsewhere. Screenshots `docs/screenshots/2*-phone-*.png`.
* `packages/api-client`: typed calls shared by web (through its proxy) and mobile (bearer token).
* First visit (web and phone): Form 300 as a plain-language summary signed by typed name after a fresh check (passkey, authenticator, or an emailed code for email-only accounts); the signed record is stored with its SHA-256 and shown under Documents. FINTRAC ID check with occupation, source of funds, third-party, PEP and company questions; third-party, PEP and company cases wait for the compliance officer. Visits booked in Toronto time once both are done, listed under Visits with cancel. New buyers are spread across agents by open deals.
* Buyer tools: "How we estimate" (rate, down payment, first-time status, lawyer — stored per buyer and applied to every all-in, with the down payment raised to the legal minimum where needed), "What you can afford" (stress test plus down-payment caps, feeding search), Compare (up to 3 homes, lowest all-in and monthly marked), and a map view with all-in pins on web.
* Buyer browsing on web and phone: search with swipeable photos, filters (cities, price, beds, type, sort; in the URL on web), "Viewed" badges, saved homes, and the listing page: gallery, all-in breakdown, monthly costs, open house, price history, sold nearby (same type, within 2 km, last 6 months, from a PostGIS query), schools, commute and details.
* Klyr Pro for agents (`apps/pro`, screenshots `6*-pro-*.png`): staff sign in with an email code plus an authenticator app, set up on first sign-in. The API refuses staff routes (`RolesGuard`) without the role and a second factor in the session, and buyers who try Pro are turned away. Visits: a list grouped by day, where the agent confirms (with a note for the client), suggests a new time or declines. The buyer is emailed and sees the agent's note on web and phone. Clients: each buyer's Form 300, ID and visit status, saved homes and documents. An agent sees only their own deals.
* Klyr Pro phone app (`apps/agent`, Expo, screenshots `7*-agent-app-*.png`):
  * Staff sign-in: an email code, then the authenticator app, set up in the app the first time.
  * Today: visits to confirm, re-time or decline; the live distance to each home while a visit is near; check-in and completion from the phone's GPS (`expo-location`, best accuracy, Android's mock-location flag); directions; and calling the client.
  * Activity: the agent's day (visits done, time on site, check-ins, refused attempts and a timeline) from the audit trail.
  * Clients: each buyer's Form 300, ID and visit status.
  * Location is read only while the app is open (no background tracking).
* Push to the agent's phone (Klyr Pro app, `expo-notifications`):
  * "New visit request" when a client books, and "Visit cancelled by your client" when they cancel.
  * "Visit at 2:00 p.m." about 45 minutes before a confirmed visit, from the worker (`visit-reminders`, every minute). A visit is marked when its reminder goes out, so it is sent once even with two workers.
  * Payloads carry only the address and time, since lock screens are public, never client names or contact details.
  * Each phone's token is tied to the sign-in that registered it: signing out, revoking or expiry stops the pushes. Tokens reported as uninstalled are switched off.
  * Tapping a push opens Today.
  * Sent through Expo's push service (`PUSH_PROVIDER=expo`, relayed to APNs and FCM); locally pushes go to the log.
  * Needs the app linked to an EAS project (`eas init`) for push tokens.
* Field activity in Admin, for the broker of record: every agent's day with the same timeline, refused attempts in red, and which app each reading came from.
* Geofenced showings: an agent can check in only within 150 m of the listing, from 30 minutes before the visit until 2 hours after, with a location fix accurate to 100 m. Completing the visit needs at least 10 minutes on site and a second reading at the property. The API measures the distance (PostGIS) against the listing's own location rather than trusting the device. Every refused attempt (too far, low accuracy, mock location, outside the window, too soon) is written to the audit log with its coordinates for the broker of record. Readings must come from the phone app: the API refuses web readings (allowed only in development, with `GEOFENCE_ALLOW_WEB=1`, for the app's web preview). Limits: iOS doesn't report simulated locations through Expo, and a rooted or jailbroken phone can fake GPS. Next steps are device attestation (App Attest / Play Integrity) so the API knows a reading came from the real app, and review of check-ins that cluster suspiciously.
* Klyr Admin (`apps/admin`): the FINTRAC ID review queue for the compliance officer or broker of record. Approving or rejecting needs a note, can be done only once, and can't be done on your own file; the buyer is emailed and can then book. Other Admin modules are still listed as placeholders.
* `packages/web-kit`: what the three Next.js apps share — the session-cookie proxy (each app has its own cookie), server-side API calls, base styles, staff sign-in and the geolocation helper.

* Offers (web, phone, Klyr Pro web and phone app; screenshots `8*-*offer*.png`, `86-web-deal.png`, `9*-*.png`):
  * Build: price, deposit, financing and inspection conditions (or status certificate for condos) in banking days, irrevocable time, closing date, inclusions, and a note to the agent, with the all-in at the offered price updating as you type. Form 100 for houses and towns, 101 for condos.
  * Requires a signed Form 300 and a verified ID.
  * Signing needs a fresh check and the legal name, and stores a plain-language summary of the form and Schedule A with its SHA-256 (a draft for legal review until the OREA forms licence and e-sign provider are in place).
  * Agent: return it for changes or register it with the listing brokerage (Form 801), then record the seller's answer (accepted, signed back with price and open-until, or not accepted). The client is emailed at each step and the agent gets pushes.
  * Buyer: withdraw before the seller decides, or accept (a signature) or decline a sign-back. Offers past their irrevocable time expire.
  * Acceptance: the deal becomes conditional (or firm), the deposit falls due 24 hours later to the listing brokerage in trust, and each condition gets its deadline at 11:59 pm on the Nth banking day (Form 100: no weekends or Ontario statutory holidays, including moved ones; `@klyr/core`). The deal page warns the buyer to confirm trust account details by phone before sending money. The agent records the deposit receipt.
  * Closing dates must be banking days (the land registry is closed otherwise).

* After acceptance (web, phone, Klyr Pro web and agent app; screenshots `92`–`98`):
  * The agent records the trust-account call: who they spoke to, and the number they looked up themselves. The buyer sees it next to the wire-fraud warning.
  * The buyer signs a waiver or notice of fulfillment (Form 123) with a fresh check. It counts only once the agent marks it delivered to the listing brokerage; when every condition is delivered the deal is firm.
  * A condition still open at its deadline voids the agreement: the offer becomes void and the buyer's representation carries on (they can offer again). The buyer then signs a mutual release (Form 122) and the agent records the deposit's return.
  * The worker job `deadlines` (every minute) runs the lapse check and sends one reminder 6 hours before the deposit is due and 24 hours before a condition ends. Reads also run the lapse check, so screens are never stale.

* Amendments (Form 120), on the web and phone: the buyer proposes a new closing date and/or later condition deadlines (banking days only) and signs. The agent records whether the seller agreed, in Klyr Pro or the agent app; only then do the deadlines and closing change. One amendment can be open at a time and the buyer can withdraw it. If a condition lapses before the seller agrees, accepting is refused because the agreement is already void.
* Push in the buyer app (`expo-notifications`, `/me/devices`, tied to the sign-in like agent devices):
  * Visit confirmed, moved or declined; offer sent back, registered, signed back, not accepted or accepted; deposit received; condition removed or deal firm; reminders; agreement ended; amendment agreed or refused.
  * Tapping a push opens the deal, offers or visits.
  * Lock-screen text never includes prices or amounts, on either app.

* Closing:
  * Checklist on the web and phone: the buyer records their lawyer (name, firm, email), lender and insurer, and confirms the statement of adjustments. The agent records the final walk-through.
  * The agent records "Closed: keys released" (Klyr Pro web or agent app) on or after the closing date, once the deal is firm and the deposit receipt is recorded.
  * The cash-back record starts at the plan share frozen in Form 300.
* Trust and payouts in Klyr Admin (broker of record): record the commission actually received (the cash back becomes the plan share of it), then the EFT reference once paid from Klyr Realty's bank. The buyer sees each step and gets an email and push. Klyr keeps the record and does not move money. Lender disclosure of cash back stays with the buyer's lawyer and lender for now.

* Saved searches with alerts (web and phone):
  * Save the current filters with alerts "right away", daily, or off; manage them under Saved (web) or Saved searches (phone). Up to 10 per person.
  * When a search is saved, Klyr records what already matches. The worker job `alerts` (every 5 minutes; daily digests from 7 am Toronto) then sends one email per search listing new homes and price drops, and a push that names no prices. This works the same with seed data and with the PropTx feed later.
* The map on the phone: react-native-maps (Apple Maps on iOS; Google Maps on Android, which needs a Google Maps API key in the app config before release), with the all-in on each pin. The web preview uses Leaflet. Tiles come from `EXPO_PUBLIC_MAP_TILES`; OpenStreetMap is the development default only.

* Selling, part 1 (web, phone and Klyr Pro web; screenshots `100`–`108`):
  * The seller describes the home and sees what they keep: sale price less Klyr's fee, the buyer's brokerage share, the lawyer and the mortgage payout, all including HST.
  * Plan: Self-directed ($999 + HST, the seller hosts showings) or Assisted (1% + HST). The buyer's brokerage share (1.5%, 2% or 2.5%) is the seller's choice, and the net updates as it changes.
  * Listing agreement (Form 200 summary: 90 days, 60-day holdover, Form 326 notice), signed with a fresh check after the ID check (FINTRAC).
  * Prep: the seller records the mortgage payout, showing times and offer date, and approves the description and inclusions. The agent marks photos and the optional inspection.
  * The agent publishes from the Klyr Pro Listings tab with coordinates and photo URLs (no geocoder or media vendor yet). The home goes live as a `klyr_exclusive` listing in search, and the seller gets an email and a push.
  * A Klyr buyer offering on it is stopped until multiple representation is consented to (Form 326).

* Selling, part 2 (web, phone and Klyr Pro web; screenshots `109`–`116`):
  * Buyers leave a few taps of feedback after a completed visit (interest, price, optional comment). A Klyr seller sees it without the buyer's name.
  * Form 326 before a Klyr buyer offers on a Klyr listing. The buyer signs first, the seller is emailed and pushed, and the seller signs from Sell. Each signature is a document on that person's own deal. The offer builder stays closed until both have signed.
  * Offers on a Klyr listing reach the seller once the buyer's agent registers them. The seller sees what they'd keep at that price (and at a sign-back price as they type), then accepts or signs back (both signatures, with a fresh check) or declines. The buyer's agent can't record the answer for a Klyr seller (`seller_decides`).
  * Acceptance runs the same deal flow (deposit, conditions, closing) and moves the seller's deal to conditional or firm; the seller sees "Conditional sale" and the agent sees it on the Listings tab.

* Renting and leasing out (web for both sides, phone for tenants, Klyr Pro web; screenshots `117`–`125`):
  * Tenants sign Form 346 (no cost to them) and fill one profile that becomes Form 410 for every application. It holds only what Ontario landlords may consider: income, work, references, occupants, pets and credit-check consent. Nothing on Human Rights Code grounds.
  * Rentals show the move-in cost (first month plus the last month's rent deposit, the only deposit Ontario allows) and rent-control status from the first-occupied date (units first occupied after November 15, 2018 are exempt from the guideline; `RENT_GUIDELINE` is 2.1% for 2026). Rentals never appear in the for-sale search.
  * Landlords see their first year's rent after Klyr's fee ($699 + HST, still a placeholder) and the tenant-side fee they choose (none, half a month or one month). They sign Form 210 with a fresh check, and the agent publishes from the Listings tab.
  * Klyr represents both sides on its own rentals, so Form 326 is signed by the tenant, then the landlord, before an application. Applications are Form 410 + 400 signed together.
  * The landlord sees every applicant with the same facts (income ÷ rent, work, occupants, pets, references, credit consent) and a note on the Human Rights Code. Accepting is a signature: other applicants hear back the same day, the listing becomes leased, and both deals go firm. The Ontario Standard Lease (2229E) comes next and is prepared by the agent outside Klyr for now.
  * Not built yet: viewings for rentals, the landlord screens on the phone, generating the Standard Lease, credit reports (needs a screening vendor), and tracking interest on the last month's rent deposit.

* Provider marketplace (web, phone and Klyr Pro web; screenshots `126`–`130`):
  * A client asks up to four providers of one kind (mortgage, lawyer, inspection, insurance) for a quote. Their agent enters each quote from the provider's own system in Klyr Pro (a provider portal and imports come later).
  * Quotes are ranked only by what the client pays: lenders by 5-year cost (interest plus fees, `termCost` in `@klyr/core`, Canadian semi-annual compounding), lawyers by fee with HST plus disbursements and title insurance, inspectors by price with HST, insurers by yearly premium. In the test run the lowest rate (Summit) wasn't the cheapest: its fees made it second.
  * Every quote says what Klyr earns. Choosing one that pays a referral fee needs a written acknowledgement (TRESA / RECO), which is logged and repeated in the client's email. Lawyers can't pay referral fees (Law Society), and Klyr refuses a fee from a provider without a referral agreement.
  * On a conditional or firm purchase, choosing a lawyer, lender or insurer fills that step of the closing checklist. The chosen provider gets the client's contact details.
  * The nine providers are seeded samples, marked "(sample)", until partner agreements are signed.

* Klyr Admin, the rest of the back office (screenshots `131`–`136`):
  * Listings feed: inventory by source and status, VOW checks (no-display listings never reach clients, every listing names its brokerage), Klyr exclusive listings, and suspend/restore with a logged reason. The PropTx feed shows as not connected.
  * Marketplace: every provider with its licence, referral agreement, quotes and fees; every chosen quote with the client's cost and whether a referral fee was acknowledged; a check that no lawyer paid a fee.
  * Privacy (PIPEDA, privacy officer): clients ask for a copy, a correction or deletion from Security on the web. Requests are due in 30 days and overdue ones are flagged. A completed access request lets the client download a JSON copy. A completed deletion closes the account: sign-in, contact details, devices, saved searches, profiles and second factors go; FINTRAC records (5 years), trade records (6 years) and the audit log stay. Deletion waits while the person has an open deal.
  * Content and assumptions: the estimate defaults (rate, down payment, lawyer's fee) are published as versions with a note and the publisher, reviewed at least every 90 days, and every new client starts from the newest one.
  * Users and roles: staff, their roles, second factor and last sign-in; adding an agent needs their RECO name, title and number; the brokerage always keeps a broker of record (and you can't remove your own); an agent with open deals is reassigned first; the audit log.

* Rentals, part 2 (web, phone and Klyr Pro; screenshots `137`–`140`):
  * Tenants book viewings once Form 346 is signed. A viewing is an ordinary visit: it reaches the tenant's agent in Klyr Pro and the agent app, which confirm it and check in at the home with the phone's location. Afterwards the tenant leaves feedback, which the landlord sees without a name.
  * Interest on the last month's rent deposit (RTA s. 106): due every lease anniversary at that year's guideline (`lmrInterestSchedule` and `RENT_GUIDELINES` in `@klyr/core`). The landlord records each year as paid, or kept to top the deposit up to a new rent, within 30 days of the date. The tenant sees it and is emailed.
  * Landlords have the full flow on the phone: start, first year after fees, Form 210, Form 326 consents, applicants on the same facts, viewings and deposit interest.

* Partner portal (Klyr Pro `/partner`, Klyr Admin; screenshots `141`–`143`):
  * Klyr Admin links a person to a provider firm (lender, lawyer, inspector or insurer role, scoped to that firm). They sign in like staff: emailed code, then an authenticator.
  * Each firm is emailed when a client asks it for a quote, and sees the requests that named it with only what it needs to quote: the client's first name, the amount and their note. The client's name and email appear only once the client chooses that firm.
  * The firm sends or updates its own quote. The same rules apply as when an agent enters one: ranked only by the client's cost, any referral fee shown to the client, none from lawyers or firms without a referral agreement. The client's agent is told when a partner quotes.

* Design system (Apple Human Interface Guidelines; `packages/tokens`, `packages/web-kit/src/styles.ts`, `apps/*/components/ui.tsx`):
  * iOS system colours: blue tint for actions, links and the selected tab; green for money; orange for waiting; red for alerts; dark grey panels for the one big number on a screen.
  * Grouped grey backgrounds with white inset sections, iOS radii, large titles, filled and tinted buttons, capsule chips, Settings-style rows with coloured icon tiles (Ionicons on the phone, lucide on the web).
  * Phone apps have bottom tab bars (client: Home, Saved, Offers, Visits, Account; agent: Today, Offers, Deals, Activity, Clients). Pro and Admin use a macOS-style sidebar.
  * Type: San Francisco on iPhone and Mac, Inter on Android and other browsers. Text colours meet WCAG AA.

**Still to build** (no outside dependency, smaller follow-ups):
* Client web layouts in the new design (it already uses the new colours, type and controls).
* Quote imports from providers' own systems.
* Privacy requests on the phone (web only today); the client-facing "as of" date reading the published assumptions everywhere (the Admin value drives defaults today, the label still shows the shipped date on some screens).
* Reassigning an agent's deals from Users and roles.

**Blocked on outside parties** (built as interfaces with development stand-ins, refused in production):
* OREA forms licence and an e-sign provider: signed records are plain-language summaries until then.
* ID verification vendor, S3 with Object Lock, SES: chosen in the vendor review.
* PropTx VOW feed: listings are seed data until the agreement is signed.
* Device attestation for agent check-ins: needs Apple and Google developer accounts and real devices.
* Phone passkeys and Sign in with Apple/Google: need the klyr.ca associated domain and developer accounts.
* Google Maps API key for the Android map, and a commercial map tile host for web.
* Klyr AI (and its Admin review queue): a model provider agreement, and a prompt and guardrails reviewed by the broker of record and counsel (no advice to either side under Form 326).
* Ontario Standard Lease (2229E) generation and a tenant screening (credit report) vendor.
* Real provider partners and their referral agreements: the nine providers are samples.
* Pricing decisions: the $699 landlord fee is a placeholder.

## 10. Open decisions

| Decision | Default if nobody objects |
|---|---|
| ID verification vendor | Pick in the compliance vendor review (action 6) |
| E-sign provider and OREA form licensing route | Confirm with OREA before building `documents` |
| French and other languages | Plan i18n keys from day one; ship English first |
| Push delivery: Expo push service or SNS (APNs/FCM) from ca-central-1 | Expo push for now (payloads hold no personal information); move to SNS if privacy review asks for no US relay |
| Agent mobile: role in the consumer app or a separate app | Decided: a separate app, Klyr Pro (`apps/agent`) |
| Klyr exclusive (non-MLS) listings | Supported in the schema (`source = 'klyr_exclusive'`); no UI yet |
