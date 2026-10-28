# Klyr architecture

Status: **proposed, v0.1** (Oct 28, 2026). Decisions confirmed by the product owner: AWS Canada, Expo for mobile, NestJS backend, one TypeScript monorepo.

Source design: `design/prototype/Klyr App Core.dc.html` (71 screens: buy, sell, sell + buy, rent, lease out, account, shared), plus the Agent, Pro and four provider prototypes, `Klyr Production Readiness` and `Klyr Launch Checklist`.

---

## 1. What we are building

| Surface | Users | Platform | App in this repo |
|---|---|---|---|
| **Klyr** (consumer) | Buyers, sellers, sell + buy, tenants, landlords | iOS + Android | `apps/mobile` (Expo) |
| **Klyr web** (consumer) | Same as above, plus public listing pages | Web (responsive) | `apps/web` (Next.js) |
| **Klyr Pro** | Agents; lawyers, lenders, inspectors, insurers | Web; agents also use the phone app | `apps/pro` (Next.js) |
| **Klyr Admin** | Broker of record, compliance, privacy, ops, finance | Web, internal only | `apps/admin` (Next.js) |
| **API + worker** | All of the above | AWS ECS | `apps/api` (NestJS) |

The prototype's "one core, two shells" model (sidebar on web, tab bar on phone) carries over. Each consumer client renders the same five plans and the same route map (`ROUTES` in App Core). Both clients get the cost engine, contracts and design tokens from shared packages.

Agents need the phone for geofenced showing check-in. Rather than a fourth app, the agent workspace ships as a role inside `apps/mobile` once the consumer app is stable. Everything else an agent does stays in Klyr Pro.

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
| `identity` | users, roles, organizations, agents, consents, MFA, sessions | Schema only |
| `listings` | PropTx VOW replica, media, saved searches, views, 100-result cap, no-display flag | **Yes**: search, near-me, detail |
| `estimates` | Wraps `@klyr/core`; records the estimate shown at each decision point | **Yes**: `POST /estimates` |
| `deals` | Deals, parties, offers, conditions, timeline, sell + buy bundle | Schema only |
| `documents` | OREA form rendering, e-sign envelopes, S3, hashes | Schema only |
| `compliance` | FINTRAC ID, third-party and PEP checks, receipt of funds, retention | Schema only |
| `money` | Deposits (24 h countdown, trust call-back), cash-back payouts | Schema only |
| `marketplace` | Providers, quotes (typed in or imported), referral-fee disclosure | Schema only |
| `messaging` / `notifications` | Threads, push, email, SMS inside 24 h, quiet hours | Schema only |
| `ai` | Klyr AI turns stored as messages, with sources and model; "Send to Maya" | Schema only |
| `audit` | Append-only log (no UPDATE/DELETE grant for the app role) | Schema only |
| `health` | Liveness/readiness | **Yes** |

**Auth.** Self-hosted in our own Postgres, so identity data stays in Canada: email + passkeys, Sign in with Apple/Google, and TOTP/SMS step-up for signing and payouts. A library such as Better Auth fits; hosted IdPs (Clerk, Auth0) were rejected for data residency. Staff sign in to Admin through the company IdP (SAML/OIDC).

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
| Maps | MapLibre with a commercial tile host (Mapbox or Stadia) | The prototype's Leaflet + OSM tiles are not licensed for production traffic |
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
* `apps/web`: search page rendering live all-in cards from the API.
* `apps/mobile`: Expo Router app with an all-in hero computed on-device; Metro bundles it in the monorepo.
* `apps/pro`, `apps/admin`: shells listing the role workspaces and admin modules.

**Next, in order:**
1. Identity module: sign-up with privacy and VOW consent, email verification, passkeys, MFA.
2. Port the consumer screens from App Core, starting with onboarding and the buyer home, search, listing and afford flows. Pull a shared component layer (money hero, breakdown row, task row, quote row, rule tag) into `packages/ui`.
3. Deals: representation agreement gate (Form 300 before the first visit), offers, conditions, timeline, deadline jobs.
4. Documents + e-sign, then compliance (ID check), then money (deposit, cash back).
5. Klyr Pro agent workspace; provider quote builders; then the Admin modules in the order the Launch Checklist owners need them.

## 10. Open decisions

| Decision | Default if nobody objects |
|---|---|
| ID verification vendor | Pick in the compliance vendor review (action 6) |
| E-sign provider and OREA form licensing route | Confirm with OREA before building `documents` |
| French and other languages | Plan i18n keys from day one; ship English first |
| Agent mobile: role in the consumer app or a separate app | Role in the consumer app |
| Klyr exclusive (non-MLS) listings | Supported in the schema (`source = 'klyr_exclusive'`); no UI yet |
