# Launch preparation checklist

_Started 2026-10-27 16:24 UTC_

---

## User

<artifact-content-authored-by-others/>
Continuing from "Home buying journey elements".

## Assistant

We've been building Klyr from a pure app experience centered on all-in cost transparency for buyers, net proceeds for sellers, and rent-control clarity for tenants and landlords. You chose the 1a money-first direction and answered a detailed scope form covering five journeys (buying, selling, leasing as tenant/landlord, sell+buy bundle, onboarding), both platforms, high-fidelity screens, eight search features, nine post-firm steps, and shared screens like messaging and e-sign.

Key decisions made:

- One shared core file (**Klyr App Core.dc.html**) powers both web (sidebar navigation) and mobile (tab bar) views, with a plan switcher and state toggle for testing accepted offers.
- Login redirects to the app instead of a marketing site; onboarding covers RECO guide and account setup upfront.
- Search and listings show all-in cost as the hero metric, with map pins, filters, photo gallery, video tour tab, and neighbourhood/school/commute/price-history data.
- Klyr AI moved from a floating button to the top bar ("Ask AI" on home screens, small "AI" button elsewhere) with suggested questions and the ability to open screens.
- Photos, videos and maps are functional: real street map with cost pins, gallery with thumbnails and full-screen viewer, map tabs showing 1 km radius, and separate List/Map views for rentals with rent-control status.
- All 56 screens reviewed and refined: UI clutter removed, repeated titles eliminated, back button logic fixed, tab icons added, contrast and spacing improved.

Current state:

**Klyr App Core.dc.html** has 56 production-quality screens across buying, selling, leasing, onboarding and shared flows. The web app just passed checks; I've fixed sidebar contrast and label consistency. I've also written **Klyr Production Readiness.dc.html**, which identifies eight blockers for launch: brokerage labelling on all listings, all-in cost assumptions with dates, accessibility (WCAG 2.0 AA contrast and focus states), AML ID verification flows, deposit handling with fraud protection, sold-data login requirements, and agent registration titles.

Open next steps:

- Fix brokerage labels, all-in cost assumptions and contrast on existing screens.
- Build deposit screen with countdown and trust-account verification.
- Build full ID-check flow (source of funds, third-party verification, fund records).
- Add co-buyer flow and condo-specific screens.
- Legal review of all rule notes and form summaries before client testing.

Files involved: **Klyr App Core.dc.html**, **Klyr.dc.html** (login), **Klyr Production Readiness.dc.html**, **Klyr App Directions.dc.html**, plus supporting logic in **klyr-app.js**, **image-slot.js**, **klyr-guided.js** and **klyr-partners.js**. Design system provided separately.

## User

lets fix all gap and list of items I need to be done before we lauch so I can pass this business team

## Assistant

_[tool: read_file]_

_[tool: list_files]_

_[tool: run_script]_

_[tool: run_script]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: run_script]_

_[tool: run_script]_

_[tool: run_script]_

_[tool: update_todos]_

_[tool: run_script]_

_[tool: run_script]_

_[tool: run_script]_

_[tool: show_html]_

_[tool: get_webview_logs]_

_[tool: update_todos]_

_[tool: dc_write]_

_[tool: update_todos]_

_[tool: ready_for_verification]_

I've worked all eight launch-blocking (P0) items from the readiness review into Klyr App Core, and written a new **Klyr Launch Checklist** to give the business team. A review of the app is running now; I haven't looked through the screens myself yet.

**Fixes to existing screens:**
- **Brokerage labels:** "Listing brokerage: …" now appears on search results, the map preview, compare and the listing header. Every screen has a footer naming Klyr Realty Inc., Brokerage, its RECO registration and the listing-data source. Maya now shows as "Maya Chen, Salesperson".
- **All-in and net figures:** lawyer costs now include HST and disbursements. Every big money figure has an "Estimate as of Oct 27, 2026" link to a new screen explaining how it's calculated. The listing also shows a likely range, and search notes the 100-home limit per search.
- **Accessibility:** grey text is darker, nothing is smaller than 12 px, and every control shows a focus outline. Listing photos have descriptions and the video tour has captions.
- **Sign-up:** new users must accept the listing-data terms and read the privacy notice before the account is created.
- **Klyr AI:** it shows a one-time notice on what it can see, lists sources at the end of each answer, and has a "Send to Maya to confirm" button. It stops giving price advice once the client consents to Klyr acting for both sides (Form 326).
- **Cash back:** the screen now covers the verified bank account, the letter to the lender, and what happens if the commission is reduced or late.

**Nine new screens (56 → 65):** Deposit (24-hour countdown, trust account checked by phone, wire-fraud warning, received and in-trust states), full ID check, ID request for a buyer or seller with no agent, co-buyers, condo details, if the deal ends, privacy and consent, security and alerts, and how we estimate. On the estimate screen, changing the rate, down payment or lawyer updates every all-in in the app.

**The checklist** shows what's now fixed in the design, 14 business actions with an owner for each, and sign-off rows.

**Decisions for you:**
- Six transaction flows aren't built yet: new builds, offer edge cases, the showing system, listing changes, tenancy after move-in, and agent handoff. For each, choose whether to build it before launch or leave it out and send those clients straight to an agent.
- The brokerage address, account numbers and vendor names are placeholders until the business confirms the real details.
- The ID request for a party with no agent is only reachable from the sidebar list. I can add an entry point from the seller's offer screen if you want one.

## User

\

## Assistant

Your message came through as just "\". Did you mean to send something? If you want a next step, I can:

- Build the six transaction flows that aren't in the app yet (new builds, offer edge cases, showings, listing changes, tenancy after move-in, agent handoff)
- Add a way into the "ID for a self-represented party" screen from the seller's offer screen
- Export the Launch Checklist as a PDF for the business team

## User

so me design

## Assistant

_[tool: show_to_user]_

I've opened the app on the new Deposit screen. To see the other new screens, use the sidebar list (Account and After firm sections) or the links in **Klyr Launch Checklist.dc.html**.

## User

Fix all gaps

## Assistant

_[tool: run_script]_

_[tool: run_script]_

_[tool: run_script]_

_[tool: run_script]_

_[tool: ready_for_verification]_

I've built the last six missing transaction flows, so every launch-blocking design item and every listed transaction flow is now covered in the app (71 screens). A background check is still reviewing them, and I haven't stepped through them myself yet.

**New screens, and where each one opens from:**
- **New build** (opens from Search): 10-day cooling-off countdown, new-home warranty (Tarion), HST relief check, extra builder costs in the all-in, and rules for selling before closing.
- **Offer options** (from Build an offer): regular, pre-emptive and bully offers; buying on condition you sell your home; seller clauses (Schedule B); changing an accepted offer; and what happens when an offer isn't accepted.
- **Your showings** (from Book a visit): each visit's status, notice to tenants, reschedule or cancel, and calendar sync.
- **Listing changes** (from Your listing): price change with a live net figure, extending, pausing or cancelling the listing, and a history.
- **After move-in** (from Your lease): rent receipts, repair requests, landlord notices, renewal and giving notice to move out.
- **Your agent** (from Your team): Maya's availability, a backup agent when she's away, and how to escalate a complaint.
- The ID request for a buyer with no agent now opens from the seller's Offers screen.

**Launch Checklist:** updated to show the transaction flows as 12 of 12 built and 71 screens in total.

What's left is mostly business work: the 14 actions in the checklist, starting with legal review of all copy and signing the listing-data agreement. The design polish items (component spec, dark mode, languages, photo testing, usage tracking) don't block launch.

The new screens use placeholder names, numbers and fees (Priya Nair as broker of record, Daniel Okafor as backup agent, the new-build costs). They need to be replaced with real details before client testing. The tax relief and new-home warranty sections are deliberately general until your lawyer confirms the current rules.

## User

Save this design as a PDF: `Klyr Launch Checklist.dc.html`

## Assistant

_[tool: read_file]_

_[tool: copy_starter_component]_

_[tool: run_script]_

_[tool: show_html]_

_[tool: get_webview_logs]_

_[tool: show_pdf_export_dialog]_

I've made a printable copy of the Launch Checklist, and the export dialog is open. Click "Print or save as PDF" there and choose your paper size. Nothing prints until you do.

The original checklist is unchanged. In the PDF, the business actions start on a new page and table rows don't split across pages.

