// Klyr v11 — Ontario transaction model (illustrative; paraphrased, not official form text)
(function () {
  const START = new Date(2026, 9, 5);
  const fmt$ = n => (n < 0 ? '−' : '') + '$' + Math.abs(Math.round(n)).toLocaleString('en-CA');
  const dateOf = d => { const x = new Date(START); x.setDate(x.getDate() + Math.round(d)); return x.toLocaleDateString('en-CA', { weekday: 'short', month: 'short', day: 'numeric' }); };
  const ltt = p => { const b = [[55000, .005], [250000, .01], [400000, .015], [2000000, .02], [Infinity, .025]]; let prev = 0, t = 0; for (const [cap, r] of b) { if (p > prev) t += (Math.min(p, cap) - prev) * r; prev = cap; } return Math.round(t); };

  const PEOPLE = {
    you: { name: 'Alex Rivera', org: 'You' },
    agent: { name: 'Maya Chen', org: 'Klyr Realty · your agent' },
    seller: { name: 'The Okafor family', org: 'Seller' },
    sellerAgent: { name: 'Daniel Ross', org: 'Harbourline Realty · listing agent' },
    buyer: { name: 'Sam & Leah Ortiz', org: 'Buyer' },
    buyerAgent: { name: 'Nadia Farouk', org: 'Crestview Realty · buyer agent' },
    lender: { name: 'Priya Nair', org: 'Northgate Mortgage · broker' },
    lawyer: { name: 'Sofia Marino', org: 'Marino Law · your lawyer' },
    otherLawyer: { name: 'Kwan & Associates', org: 'Other side’s lawyer' },
    insurer: { name: 'Liam Park', org: 'Coastline Insurance' },
    inspector: { name: 'Jordan Blake', org: 'ClearView Inspections' },
    appraiser: { name: 'Greenfield Appraisals', org: 'Lender’s appraiser' },
    pm: { name: 'Harbourfront Mgmt', org: 'Condo property manager' },
    builder: { name: 'Oakridge Homes', org: 'Builder · Tarion-registered' },
    landlord: { name: 'Ravi Singh', org: 'Landlord' },
    tenant: { name: 'Jamie Lee', org: 'Tenant applicant' },
    screener: { name: 'Keystone Screening', org: 'Credit & reference checks' }
  };

  const FORMS = {
    RECO: { name: 'RECO Information Guide', who: 'You acknowledge', c: [
      ['Who the agent works for', 'The brokerage must explain whether you will be a client (owed full duties) or a self-represented party (owed only fairness and honesty).', 'Before any help, your agent tells you if they are on your side or just being fair to you.'],
      ['Multiple representation', 'A brokerage may act for more than one party only with written informed consent from each.', 'If one company represents both sides, you have to agree to it in writing first.'],
      ['Complaints', 'Concerns about a registrant may be raised with the Real Estate Council of Ontario.', 'If something goes wrong with an agent, RECO is where you complain.']] },
    FINTRAC: { name: 'FINTRAC ID verification', who: 'Agent records', c: [
      ['Identity', 'The brokerage records government photo ID, occupation and the source of deposit funds.', 'Federal anti–money laundering rules. Your ID is checked once and kept securely.']] },
    '300': { name: 'Form 300 · Buyer Representation Agreement', who: 'You + your brokerage', c: [
      ['Term', 'The agreement is effective for a stated period; for residential buyers it cannot exceed six months without consent.', 'How long you are committed to this agent. Keep it short if unsure.'],
      ['Geographic area & property type', 'Services apply to the property types and areas listed.', 'Only the neighbourhoods and home types written here are covered.'],
      ['Commission', 'The buyer agrees to the stated commission, less any amount the brokerage receives from the seller side.', 'What your agent is paid, and when you might owe any shortfall.'],
      ['Holdover', 'Commission may apply if you buy a property you were introduced to within the holdover period after expiry.', 'If you buy a home they showed you right after this ends, they may still be owed.']] },
    '320': { name: 'Form 320 · Confirmation of Co-operation and Representation', who: 'All agents + parties', c: [
      ['Representation', 'Confirms which brokerage represents the buyer and which represents the seller.', 'A written record of who works for whom on this deal.'],
      ['Commission split', 'Records the agreed commission payable to the co-operating brokerage.', 'Shows how the agents are paid.']] },
    '801': { name: 'Form 801 · Offer Summary Document', who: 'Buyer agent submits', c: [
      ['Offer record', 'Summarises the date, time and brokerage of each offer received, without disclosing terms unless the seller directs.', 'Proof your offer was received, especially in multiple offers.']] },
    '100': { name: 'Form 100 · Agreement of Purchase and Sale', who: 'Buyer + seller', c: [
      ['Price & deposit', 'The buyer offers the stated price and delivers the deposit to the listing brokerage within 24 hours of acceptance.', 'The price and the deposit you must send within one day of acceptance.'],
      ['Irrevocability', 'The offer stays open until the time stated, after which it is void if not accepted.', 'The deadline for the seller to say yes.'],
      ['Conditions (Schedule A)', 'The agreement is conditional on financing and inspection for the stated days, for the sole benefit of the buyer.', 'Your escape hatches. You can waive or fulfil them before the deadline.'],
      ['Chattels & fixtures', 'Listed chattels are included; listed fixtures are excluded.', 'Exactly which appliances and fixtures stay with the house.'],
      ['Title', 'The buyer may examine title at their own expense until the requisition date.', 'Your lawyer’s window to find problems with ownership.'],
      ['Completion date', 'The transaction completes on the stated date, when the balance is paid and possession given.', 'Closing day, when you get the keys.']] },
    '101': { name: 'Form 101 · Agreement of Purchase and Sale – Condominium Resale', who: 'Buyer + seller', c: [
      ['Unit, parking & locker', 'Identifies the unit, parking and locker by legal level and unit number.', 'Make sure the parking and locker are the ones you saw.'],
      ['Common expenses', 'States the monthly common expenses and what they include.', 'Your monthly condo fee and what it covers.'],
      ['Status certificate', 'Conditional on the buyer’s lawyer reviewing the status certificate within the stated days.', 'Your lawyer checks the building’s finances, reserve fund and rules.'],
      ['Completion date', 'The transaction completes on the stated date.', 'Closing day.']] },
    '120': { name: 'Form 120 · Amendment to Agreement', who: 'Buyer + seller', c: [
      ['Change', 'The parties agree to amend the stated terms; all other terms remain.', 'Used to change a date, price or clause after signing.']] },
    '123': { name: 'Form 123 · Waiver', who: 'Buyer signs', c: [
      ['Waiver', 'The buyer waives the stated condition, which was for the buyer’s sole benefit.', 'You drop a condition. The deal moves closer to firm.']] },
    '124': { name: 'Form 124 · Notice of Fulfillment of Condition', who: 'Buyer signs', c: [
      ['Fulfilment', 'The buyer confirms the stated condition has been fulfilled.', 'You confirm the condition was met (for example, financing approved).']] },
    '200': { name: 'Form 200 · Listing Agreement – Authority to Offer for Sale', who: 'You + listing brokerage', c: [
      ['Listing price & term', 'The seller grants the brokerage the exclusive right to offer the property at the listed price for the term.', 'How long the agent can sell your home, and at what asking price.'],
      ['Commission', 'The seller agrees to pay the stated commission on a completed sale.', 'What you pay the agents, usually a percentage plus HST.'],
      ['Offers', 'The seller instructs how offers and offer summaries are to be handled.', 'How you want offers presented, including in bidding situations.']] },
    '220': { name: 'Form 220 · Seller Property Information Statement', who: 'You, optional', c: [
      ['Disclosure', 'The seller answers questions about the property’s condition to the best of their knowledge.', 'Optional. Anything you disclose must be true; many lawyers advise care.']] },
    '210': { name: 'Form 210 · Listing Agreement – Authority to Offer for Lease', who: 'You + listing brokerage', c: [
      ['Rent & term', 'The landlord authorises the brokerage to lease the property at the stated rent.', 'Asking rent and how long the agent can market it.'],
      ['Commission', 'Commission is stated, commonly as a portion of rent.', 'Often about one month’s rent, plus HST.']] },
    '410': { name: 'Form 410 · Rental Application', who: 'Tenant fills in', c: [
      ['Applicant details', 'Name, current and previous addresses, employment and income.', 'The standard application most Ontario landlords use.'],
      ['References & consent', 'The applicant consents to credit and reference checks.', 'Lets the landlord run a credit check with your permission.']] },
    '400': { name: 'Form 400 · Agreement to Lease – Residential', who: 'Tenant + landlord', c: [
      ['Rent & deposit', 'Monthly rent and a deposit to be applied to the last month’s rent.', 'In Ontario the only deposit allowed is last month’s rent (plus a refundable key deposit).'],
      ['Condition', 'Conditional on the landlord’s satisfaction with credit and references within the stated time.', 'The landlord gets a short window to check your application.'],
      ['Standard lease', 'The parties will sign the Ontario Standard Form of Lease.', 'The government lease (2229E) must follow.']] },
    '2229E': { name: 'Ontario Standard Lease (2229E)', who: 'Tenant + landlord', c: [
      ['Parties & unit', 'Records landlord, tenants, address for service and the rental unit.', 'Who is on the lease and the exact unit.'],
      ['Rent & services', 'Lawful rent, due date and which utilities and services are included.', 'What you pay and what is included, like water or parking.'],
      ['Deposits', 'Only a rent deposit (last month) and a refundable key deposit are permitted.', 'No damage or pet deposits are allowed in Ontario.'],
      ['Additional terms', 'Extra terms are void if they conflict with the Residential Tenancies Act.', 'A clause that takes away your rights does not count.']] },
    BUILDER: { name: 'Builder APS + Tarion Addendum', who: 'You + builder', c: [
      ['Deposit schedule', 'Deposits are payable on signing and at stated intervals before occupancy.', 'You pay in instalments, often 5% at a time.'],
      ['Tentative closing & delays', 'The Tarion Addendum sets critical dates and compensation for delay.', 'Rules for when the builder is late, and what they owe you.'],
      ['HST & rebate', 'Price includes HST; the buyer assigns the new housing rebate to the builder.', 'The rebate usually goes to the builder, so the sticker price includes tax.'],
      ['Closing adjustments', 'The buyer pays listed adjustments, such as utility connections and Tarion enrolment.', 'Extra costs at closing. Ask for a cap.']] },
    PDI: { name: 'Tarion Pre-Delivery Inspection', who: 'You + builder', c: [
      ['Walkthrough', 'Buyer and builder record visible defects before possession.', 'List every scratch and gap now. It becomes your warranty record.']] },
    LTT: { name: 'Land Transfer Tax Affidavit', who: 'Lawyer prepares, you sign', c: [
      ['Consideration', 'States the value paid and any first-time buyer refund claimed.', 'Your lawyer claims the first-time buyer rebate here.']] },
    DIR: { name: 'Acknowledgement & Direction', who: 'You sign with lawyer', c: [
      ['Authority to register', 'Authorises the lawyer to electronically register the transfer and mortgage.', 'Lets your lawyer register the home in your name.']] }
  };

  const SERVICES = {
    mortgage: { name: 'Mortgage broker', provider: 'Northgate Mortgage', cost: 'Free to you', why: 'Pre-approval, rate hold, then final approval for the financing condition.' },
    lawyer: { name: 'Real estate lawyer', provider: 'Marino Law', cost: '$1,800–2,400', why: 'Title search, adjustments, LTT, registration and funds.' },
    inspector: { name: 'Home inspector', provider: 'ClearView Inspections', cost: '$450–650', why: 'Roof, foundation, electrical and plumbing before you go firm.' },
    title: { name: 'Title insurance', provider: 'via your lawyer', cost: '$300–500 once', why: 'Covers fraud, survey errors and title defects. Lenders usually require it.' },
    insurance: { name: 'Home insurance', provider: 'Coastline Insurance', cost: 'Quote', why: 'Lender needs proof of coverage (a binder) before funds are released.' },
    appraiser: { name: 'Appraiser', provider: 'Greenfield Appraisals', cost: '$350–500', why: 'Lender confirms the home is worth what you are paying.' },
    movers: { name: 'Movers & utilities', provider: 'Klyr Move', cost: 'Quote', why: 'Book movers, transfer hydro, gas, water and internet.' },
    status: { name: 'Condo status certificate', provider: 'Harbourfront Mgmt', cost: '$100 (capped)', why: 'Reserve fund, special assessments, rules and legal claims.' },
    screening: { name: 'Tenant screening', provider: 'Keystone Screening', cost: '$25–45', why: 'Credit report, employment and landlord references.' }
  };

  const J = {
    house: {
      label: 'Buy a resale house', short: 'Resale house', kind: 'buy', city: 'Toronto', toronto: true,
      addr: '48 Bellwoods Ave', meta: '3 bed · 2 bath · detached', price: 1150000, photo: 'photos/home-1.png',
      parties: ['you', 'agent', 'seller', 'sellerAgent', 'lender', 'lawyer', 'otherLawyer', 'inspector', 'appraiser', 'insurer'],
      stages: [
        { l: 'Search & showings', a: 0, b: 41, forms: ['RECO', 'FINTRAC', '300'], sub: 'Browse, book in-person or live video showings, and get pre-approved.', task: { you: 'Shortlist and book showings', agent: 'Run showings, share RECO guide', lender: 'Issue pre-approval' } },
        { l: 'Offer', a: 41, b: 43, forms: ['100', '320', '801'], sub: 'Submit Form 100. Deposit within 24 hours of acceptance.', task: { you: 'Sign offer, send deposit', agent: 'Register offer', seller: 'Review offers', sellerAgent: 'Present offers' } },
        { l: 'Safety checks', a: 43, b: 48, forms: ['123', '124', '120'], sub: 'Financing and inspection. Waive or fulfil before the deadline.', task: { you: 'Attend inspection', lender: 'Final approval', inspector: 'Inspect home', appraiser: 'Appraise value' } },
        { l: 'Locked in', a: 48, b: 55, forms: [], sub: 'Deal is binding. Lawyers and lender are sent the agreement.', task: { agent: 'Send APS to lawyers', lawyer: 'Open file' } },
        { l: 'Lawyer & bank', a: 55, b: 96, forms: [], sub: 'Title search, mortgage instructions, insurance binder, adjustments.', task: { lawyer: 'Search title, draft adjustments', lender: 'Send instructions', insurer: 'Issue binder' } },
        { l: 'Sign papers', a: 96, b: 101, forms: ['LTT', 'DIR'], sub: 'Sign closing documents and send your down payment to trust.', task: { you: 'Sign at lawyer, wire funds', lawyer: 'Collect funds' } },
        { l: 'Keys', a: 101, b: 102, forms: [], sub: 'Transfer registered. Keys released.', task: { lawyer: 'Register transfer', otherLawyer: 'Release keys' } }
      ],
      events: [[1, 'agent', 'Shared the RECO Information Guide'], [3, 'you', 'Signed Form 300 Buyer Representation Agreement'], [6, 'lender', 'Pre-approval issued: $980,000 at 4.39%, 120-day rate hold'], [22, 'agent', 'Booked 4 showings in Trinity Bellwoods'], [41, 'you', 'Signed offer at $1,150,000 with 5-day conditions'], [42, 'seller', 'Accepted your offer'], [43, 'you', 'Deposit of $57,500 received in trust'], [44, 'inspector', 'Inspection report posted: roof 8 years, panel 100A'], [46, 'appraiser', 'Appraised at $1,165,000'], [47, 'lender', 'Mortgage commitment issued'], [48, 'agent', 'Deal is firm'], [58, 'lawyer', 'Title search clear, no liens'], [80, 'insurer', 'Insurance binder sent to lawyer'], [92, 'lawyer', 'Statement of adjustments ready'], [98, 'you', 'Signed closing documents'], [101, 'lawyer', 'Transfer registered on title'], [102, 'agent', 'Keys handed over']],
      conds: [{ id: 'fin', name: 'Mortgage check', a: 43, b: 48, svc: 'mortgage' }, { id: 'ins', name: 'Inspection check', a: 43, b: 48, svc: 'inspector' }],
      services: [['mortgage', 0], ['inspector', 2], ['appraiser', 2], ['lawyer', 3], ['title', 4], ['insurance', 4], ['movers', 6]],
      decisions: ['self', 'fthb', 'titleIns', 'inspect'],
      ready: [['RECO guide acknowledged', 'form', 'RECO'], ['Form 300 signed', 'form', '300'], ['ID verified', 'form', 'FINTRAC'], ['Mortgage pre-approval', 'svc', 'mortgage'], ['Deposit funds ready', 'flag', 'funds'], ['Lawyer lined up', 'svc', 'lawyer'], ['Insurance quote', 'svc', 'insurance']],
      keys: ['The house is yours', 'Registered on title at 48 Bellwoods Ave.']
    },
    condo: {
      label: 'Buy a resale condo', short: 'Resale condo', kind: 'buy', city: 'Toronto', toronto: true,
      addr: '1204 – 88 Queens Quay W', meta: '2 bed · 2 bath · parking + locker', price: 689000, photo: 'photos/home-2.png',
      parties: ['you', 'agent', 'seller', 'sellerAgent', 'lender', 'lawyer', 'otherLawyer', 'pm', 'appraiser', 'insurer'],
      stages: [
        { l: 'Search & showings', a: 0, b: 34, forms: ['RECO', 'FINTRAC', '300'], sub: 'Compare buildings, fees and reserve funds. Book showings.', task: { you: 'Book showings', agent: 'Pull building history', lender: 'Issue pre-approval' } },
        { l: 'Offer', a: 34, b: 36, forms: ['101', '320', '801'], sub: 'Submit Form 101 with a status certificate condition.', task: { you: 'Sign offer, send deposit', sellerAgent: 'Present offers' } },
        { l: 'Safety checks', a: 36, b: 41, forms: ['123', '124', '120'], sub: 'Financing and status certificate review.', task: { pm: 'Deliver status certificate', lawyer: 'Review certificate', lender: 'Final approval' } },
        { l: 'Locked in', a: 41, b: 46, forms: [], sub: 'Deal is binding.', task: { agent: 'Send APS to lawyers' } },
        { l: 'Lawyer & bank', a: 46, b: 70, forms: [], sub: 'Title, mortgage instructions, insurance, fee adjustments.', task: { lawyer: 'Search title', insurer: 'Issue condo policy' } },
        { l: 'Sign papers', a: 70, b: 74, forms: ['LTT', 'DIR'], sub: 'Sign and send funds to trust.', task: { you: 'Sign, wire funds' } },
        { l: 'Keys', a: 74, b: 75, forms: [], sub: 'Transfer registered. Fobs and keys released.', task: { lawyer: 'Register transfer', pm: 'Issue fobs' } }
      ],
      events: [[2, 'you', 'Signed Form 300'], [5, 'lender', 'Pre-approval issued: $620,000'], [34, 'you', 'Signed Form 101 at $689,000'], [35, 'seller', 'Accepted your offer'], [36, 'you', 'Deposit of $34,450 received in trust'], [38, 'pm', 'Status certificate delivered'], [40, 'lawyer', 'Reserve fund healthy, no special assessment planned'], [41, 'agent', 'Deal is firm'], [55, 'lawyer', 'Title clear'], [66, 'insurer', 'Condo unit policy bound'], [72, 'you', 'Signed closing documents'], [74, 'lawyer', 'Transfer registered'], [75, 'pm', 'Fobs, parking pass and keys released']],
      conds: [{ id: 'fin', name: 'Mortgage check', a: 36, b: 41, svc: 'mortgage' }, { id: 'sc', name: 'Building records check', a: 36, b: 41, svc: 'status' }],
      services: [['mortgage', 0], ['status', 2], ['appraiser', 2], ['lawyer', 2], ['title', 4], ['insurance', 4], ['movers', 6]],
      decisions: ['self', 'fthb', 'inspect'],
      ready: [['RECO guide acknowledged', 'form', 'RECO'], ['Form 300 signed', 'form', '300'], ['ID verified', 'form', 'FINTRAC'], ['Mortgage pre-approval', 'svc', 'mortgage'], ['Deposit funds ready', 'flag', 'funds'], ['Lawyer lined up', 'svc', 'lawyer'], ['Insurance quote', 'svc', 'insurance']],
      keys: ['Unit 1204 is yours', 'Fobs, parking pass and keys are ready at the concierge.']
    },
    build: {
      label: 'Buy a new build', short: 'New build', kind: 'buy', city: 'Milton', toronto: false,
      addr: 'Lot 17, Oakridge Meadows', meta: '4 bed · 3 bath · freehold', price: 1040000, photo: 'photos/home-3.png',
      parties: ['you', 'agent', 'builder', 'lender', 'lawyer', 'otherLawyer', 'insurer'],
      stages: [
        { l: 'Search & tour', a: 0, b: 20, forms: ['RECO', 'FINTRAC', '300'], sub: 'Tour model homes, pick a lot and upgrades, get pre-approved.', task: { you: 'Tour models, pick a lot', builder: 'Hold lot', lender: 'Pre-approve' } },
        { l: 'Builder APS', a: 20, b: 22, forms: ['BUILDER'], sub: 'Sign the builder’s agreement and Tarion Addendum.', task: { you: 'Sign, pay first deposit' } },
        { l: 'Lawyer review', a: 22, b: 32, forms: ['123', '124'], sub: 'Lawyer reviews the builder agreement (new condos get a 10-day cooling-off; freehold does not by law).', task: { lawyer: 'Review APS & caps' } },
        { l: 'Construction', a: 32, b: 330, forms: ['120'], sub: 'Deposits at intervals. Builder must give critical-date notices.', task: { builder: 'Build, send date notices', lender: 'Renew rate hold' } },
        { l: 'PDI', a: 330, b: 340, forms: ['PDI'], sub: 'Pre-Delivery Inspection with the builder.', task: { you: 'Walk through and list defects', builder: 'Record PDI' } },
        { l: 'Sign papers', a: 340, b: 348, forms: ['LTT', 'DIR'], sub: 'Adjustments, sign, send funds.', task: { lawyer: 'Finalise adjustments' } },
        { l: 'Keys', a: 348, b: 350, forms: [], sub: 'Transfer registered. Keys and Tarion warranty begin.', task: { builder: 'Release keys' } }
      ],
      events: [[2, 'you', 'Signed Form 300'], [6, 'lender', 'Pre-approval issued'], [21, 'you', 'Signed builder APS and Tarion Addendum'], [21, 'you', 'First deposit of $20,000 paid'], [30, 'lawyer', 'Asked builder to cap closing adjustments at $4,000'], [32, 'lawyer', 'Review complete. Agreement firm'], [52, 'you', 'Second deposit $32,000'], [112, 'you', 'Third deposit $52,000'], [180, 'builder', 'Framing complete'], [240, 'builder', 'Confirmed closing date notice'], [335, 'you', 'PDI done, 14 items listed'], [345, 'lawyer', 'Statement of adjustments ready'], [349, 'lawyer', 'Transfer registered'], [350, 'builder', 'Keys released. Tarion warranty starts']],
      conds: [{ id: 'rev', name: 'Lawyer review', a: 22, b: 32, svc: 'lawyer' }, { id: 'fin', name: 'Mortgage check', a: 22, b: 32, svc: 'mortgage' }],
      services: [['mortgage', 0], ['lawyer', 2], ['title', 5], ['insurance', 5], ['movers', 6]],
      decisions: ['self', 'fthb'],
      ready: [['RECO guide acknowledged', 'form', 'RECO'], ['Form 300 signed', 'form', '300'], ['ID verified', 'form', 'FINTRAC'], ['Mortgage pre-approval', 'svc', 'mortgage'], ['Deposit schedule funded', 'flag', 'funds'], ['Lawyer lined up', 'svc', 'lawyer']],
      keys: ['Welcome home', 'Lot 17 is registered in your name. Your 1-, 2- and 7-year Tarion coverage starts today.']
    },
    sell: {
      label: 'Sell your home', short: 'Sell', kind: 'sell', city: 'Toronto', toronto: true,
      addr: '22 Grace St', meta: '3 bed · 2 bath · semi', price: 1150000, photo: 'photos/home-4.png',
      parties: ['you', 'agent', 'buyer', 'buyerAgent', 'lawyer', 'otherLawyer', 'lender'],
      stages: [
        { l: 'Prepare', a: 0, b: 10, forms: ['RECO', 'FINTRAC', '200', '220'], sub: 'Sign listing agreement, price the home, optional disclosure.', task: { you: 'Sign Form 200', agent: 'Price analysis' } },
        { l: 'Market', a: 10, b: 24, forms: [], sub: 'Photos, listing live, showings and open houses.', task: { agent: 'List and host showings' } },
        { l: 'Offers', a: 24, b: 26, forms: ['801', '100', '320'], sub: 'Review offers; accept or sign back.', task: { you: 'Choose offer', buyerAgent: 'Submit offer' } },
        { l: 'Buyer conditions', a: 26, b: 31, forms: ['120'], sub: 'Buyer’s financing and inspection. Allow access.', task: { buyer: 'Inspect, finance', you: 'Allow inspection' } },
        { l: 'Locked in', a: 31, b: 36, forms: [], sub: 'Buyer waives. Sale is binding.', task: { agent: 'Send APS to lawyers' } },
        { l: 'Lawyer', a: 36, b: 80, forms: [], sub: 'Mortgage payout statement, discharge, adjustments.', task: { lawyer: 'Order payout statement', lender: 'Send payout figures' } },
        { l: 'Sign', a: 80, b: 84, forms: ['DIR'], sub: 'Sign transfer and direction re funds.', task: { you: 'Sign at lawyer' } },
        { l: 'Closing', a: 84, b: 85, forms: [], sub: 'Funds received, mortgage paid out, proceeds released.', task: { lawyer: 'Pay out mortgage, release proceeds' } }
      ],
      events: [[2, 'you', 'Signed Form 200 at $1,149,000 list'], [9, 'agent', 'Photos and floor plan done'], [10, 'agent', 'Listing live on MLS'], [18, 'agent', '32 showings, 2 open houses'], [24, 'buyerAgent', '3 offers registered'], [25, 'you', 'Accepted $1,150,000 with 5-day conditions'], [27, 'buyer', 'Inspection completed'], [30, 'buyer', 'Waived financing and inspection'], [31, 'agent', 'Sale is firm'], [45, 'lender', 'Payout statement issued'], [82, 'you', 'Signed closing documents'], [84, 'lawyer', 'Mortgage paid out, discharge registered'], [85, 'lawyer', 'Net proceeds wired to you']],
      conds: [{ id: 'bfin', name: 'Buyer financing', a: 26, b: 31, other: true }, { id: 'bins', name: 'Buyer inspection', a: 26, b: 31, other: true }],
      services: [['lawyer', 0], ['inspector', 0], ['movers', 6]],
      decisions: ['assisted', 'inspect'],
      ready: [['RECO guide acknowledged', 'form', 'RECO'], ['Form 200 signed', 'form', '200'], ['ID verified', 'form', 'FINTRAC'], ['Mortgage payout requested', 'flag', 'payout'], ['Lawyer lined up', 'svc', 'lawyer'], ['Pre-list inspection', 'svc', 'inspector']],
      keys: ['Sold and closed', 'Proceeds are on their way to your account.']
    },
    rent: {
      label: 'Rent a home', short: 'Rent', kind: 'rent', city: 'Toronto', toronto: true,
      addr: '3 – 140 Ossington Ave', meta: '2 bed · 1 bath · $3,100/mo', price: 3100, photo: 'photos/home-2.png',
      parties: ['you', 'agent', 'landlord', 'sellerAgent', 'screener', 'insurer'],
      stages: [
        { l: 'Search & viewings', a: 0, b: 10, forms: ['RECO'], sub: 'Browse, book viewings, gather credit report and references.', task: { you: 'Book viewings, gather documents', agent: 'Run viewings' } },
        { l: 'Apply', a: 10, b: 12, forms: ['410', '400'], sub: 'Form 410 application and Form 400 offer to lease.', task: { you: 'Submit application', landlord: 'Review' } },
        { l: 'Approval', a: 12, b: 14, forms: ['124'], sub: 'Landlord checks credit and references.', task: { screener: 'Run checks', landlord: 'Decide' } },
        { l: 'Lease', a: 14, b: 21, forms: ['2229E'], sub: 'Sign the Ontario Standard Lease. Pay first and last.', task: { you: 'Sign 2229E, pay deposit', landlord: 'Provide lease copy within 21 days' } },
        { l: 'Move in', a: 21, b: 30, forms: [], sub: 'Tenant insurance, utilities, move-in inspection, keys.', task: { insurer: 'Issue tenant policy', landlord: 'Hand keys' } }
      ],
      events: [[1, 'you', 'Acknowledged RECO guide'], [2, 'screener', 'Credit report ready: 742'], [6, 'agent', 'Booked 3 viewings'], [10, 'you', 'Submitted Form 410 and Form 400'], [13, 'landlord', 'Application approved'], [15, 'you', 'Signed Ontario Standard Lease'], [15, 'you', 'Paid first and last month: $6,200'], [24, 'insurer', 'Tenant policy active'], [30, 'landlord', 'Keys handed over']],
      conds: [{ id: 'cred', name: 'Landlord credit approval', a: 12, b: 14, other: true }],
      services: [['screening', 0], ['insurance', 3], ['movers', 4]],
      decisions: [],
      ready: [['RECO guide acknowledged', 'form', 'RECO'], ['Credit report', 'svc', 'screening'], ['Proof of income', 'flag', 'income'], ['References', 'flag', 'refs'], ['Tenant insurance quote', 'svc', 'insurance']],
      keys: ['Your keys are ready', 'Lease starts at 3 – 140 Ossington Ave.']
    },
    lease: {
      label: 'Lease out a property', short: 'Lease out', kind: 'lease', city: 'Toronto', toronto: true,
      addr: 'Unit 3, 140 Ossington Ave', meta: '2 bed · 1 bath · asking $3,100/mo', price: 3100, photo: 'photos/home-4.png',
      parties: ['you', 'agent', 'tenant', 'buyerAgent', 'screener', 'insurer'],
      stages: [
        { l: 'Prepare', a: 0, b: 5, forms: ['RECO', 'FINTRAC', '210'], sub: 'Listing agreement, rent analysis, unit ready.', task: { you: 'Sign Form 210' } },
        { l: 'Market', a: 5, b: 12, forms: [], sub: 'Listing live, showings.', task: { agent: 'Host showings' } },
        { l: 'Applications', a: 12, b: 15, forms: ['410', '400'], sub: 'Review Form 410 applications and offers to lease.', task: { tenant: 'Apply', screener: 'Screen applicants' } },
        { l: 'Approve', a: 15, b: 17, forms: ['124'], sub: 'Confirm screening and accept the tenant.', task: { you: 'Approve tenant' } },
        { l: 'Lease', a: 17, b: 22, forms: ['2229E'], sub: 'Sign 2229E. Collect first month and last month’s deposit.', task: { you: 'Sign, give copy within 21 days' } },
        { l: 'Hand over', a: 22, b: 30, forms: [], sub: 'Move-in inspection, keys, insurance updated.', task: { insurer: 'Update landlord policy' } }
      ],
      events: [[1, 'you', 'Signed Form 210'], [5, 'agent', 'Listing live at $3,100'], [12, 'buyerAgent', '4 applications received'], [14, 'screener', 'Screening complete for 4 applicants'], [16, 'you', 'Accepted Jamie Lee'], [18, 'tenant', 'Signed Ontario Standard Lease'], [18, 'tenant', 'Paid first and last: $6,200'], [26, 'insurer', 'Landlord policy updated'], [30, 'agent', 'Keys handed to tenant']],
      conds: [{ id: 'scr', name: 'Your screening approval', a: 15, b: 17, svc: 'screening' }],
      services: [['screening', 2], ['insurance', 4]],
      decisions: [],
      ready: [['RECO guide acknowledged', 'form', 'RECO'], ['Form 210 signed', 'form', '210'], ['Screening service', 'svc', 'screening'], ['Landlord insurance', 'svc', 'insurance'], ['Unit ready to show', 'flag', 'unit']],
      keys: ['Leased', 'Jamie Lee moves in. First and last month received.']
    }
  };

  function receipt(id, s) {
    const j = s.home ? { ...J[id], ...s.home } : J[id], p = j.price, d = s.dec || {}, L = [];
    const add = (label, amt, day, note, kind) => L.push({ label, amt, day, note: note || '', kind: kind || 'cost' });
    if (j.kind === 'buy') {
      const pl = ltt(p);
      if (id === 'build') { add('Deposits paid to builder', 104000, 112, 'Credited toward price', 'info'); add('HST', 0, 22, 'Included; rebate assigned to builder', 'info'); }
      else add('Deposit (5%)', Math.round(p * .05), j.stages[1].b, 'Held in trust, credited at closing', 'info');
      add('Ontario land transfer tax', pl, j.stages[5].a, 'Sliding scale on price');
      if (d.fthb) add('First-time buyer refund (Ontario)', -Math.min(pl, 4000), j.stages[5].a, 'Claimed by your lawyer', 'credit');
      if (j.toronto) { add('Toronto land transfer tax', pl, j.stages[5].a, 'Municipal, same scale to $2M'); if (d.fthb) add('First-time buyer rebate (Toronto)', -Math.min(pl, 4475), j.stages[5].a, 'Claimed at registration', 'credit'); }
      add('Legal fees & disbursements', id === 'build' ? 2400 : 2100, j.stages[4].a, 'Searches, registration, trust');
      if (id === 'house') { if (d.titleIns !== false) add('Title insurance', 395, 60, 'Protects your ownership. One-time'); else add('New survey', 1200, 60, 'Instead of title insurance'); }
      else add('Title insurance', id === 'build' ? 450 : 350, j.stages[4].a + 5, 'One-time premium');
      if (d.inspect !== false && id === 'house') add('Home inspection', 575, 44);
      if (d.inspect && id === 'condo') add('Unit inspection', 425, 37);
      if (id === 'condo') add('Status certificate', 100, 38, 'Fee capped by regulation');
      if (id !== 'build') add('Appraisal', 450, j.stages[2].a + 3, 'Lender may cover');
      if (id === 'build') add('Builder closing adjustments', 3800, 345, 'Utility hook-ups, Tarion enrolment');
      add(id === 'condo' ? 'Tax & common fee adjustment' : 'Property tax adjustment', id === 'condo' ? 612 : (id === 'build' ? 480 : 1318), j.stages[5].a - 4, 'Seller prepaid');
      add(id === 'condo' ? 'Condo unit insurance (yr 1)' : 'Home insurance (yr 1)', id === 'condo' ? 540 : 1860, j.stages[4].a + 20);
      add('Movers & utility setup', 1650, j.stages[6].a);
      const sh = d.self ? .8 : .6; add('Klyr cash-back (' + (d.self ? 'Self-directed 80%' : 'Guided 60%') + ')', -Math.round(p * (j.comm || .022) * sh), j.stages[6].a, 'To your bank account after closing · disclosed to your lender', 'credit');
    } else if (j.kind === 'sell') {
      const fee = d.assisted !== false ? p * .01 : 999; add(d.assisted !== false ? 'Klyr listing fee (Assisted, 1%)' : 'Klyr listing fee (flat)', fee, 85, 'Paid from proceeds'); add('HST on listing fee', fee * .13, 85);
      add('Buyer brokerage commission (2.2%)', p * .022, 85, 'Offered to the buyer’s agent'); add('HST on buyer commission', p * .022 * .13, 85);
      add('Legal fees', 1300, 40); add('Mortgage discharge fee', 350, 84);
      if (d.inspect) add('Pre-list inspection', 500, 5);
      add('Photos, staging & floor plan', 1200, 9);
      add('Property tax adjustment', -1318, 78, 'Buyer credits you for prepaid tax', 'credit');
      add('Movers', 1650, 84);
    } else if (j.kind === 'rent') {
      add('Credit report', 25, 2); add('First month’s rent', p, 15); add('Last month’s rent deposit', p, 15, 'Only deposit allowed; earns interest', 'cost');
      add('Key deposit', 150, 30, 'Refundable'); add('Tenant insurance (yr 1)', 336, 24); add('Movers', 900, 30);
    } else {
      add('Leasing commission', p, 18, 'About one month’s rent'); add('HST on commission', p * .13, 18);
      add('Tenant screening', 45 * 4, 14, '4 applicants'); add('Landlord insurance change', 420, 26);
      add('First month received', -p, 18, '', 'credit'); add('Last month’s deposit held', -p, 18, 'Owe annual interest', 'credit');
    }
    return L;
  }

  function model(s) {
    const id = s.j, j = s.home ? { ...J[id], ...s.home } : J[id], t = s.t;
    const X = window.KLYR_X, pk = s.picked || {}, roleName = {}; if (X) Object.keys(X.ROLE).forEach(sv => { if (pk[sv]) roleName[X.ROLE[sv]] = X.prov(sv, pk[sv]).name; });
    const PN = r => roleName[r] ? { name: roleName[r], org: PEOPLE[r].org.replace(/^[^·]*/, roleName[r] + ' ') } : PEOPLE[r], total0 = t, total = j.stages[j.stages.length - 1].b;
    const stIdx = Math.max(0, j.stages.findIndex(x => t >= x.a && t < x.b) < 0 ? j.stages.length - 1 : j.stages.findIndex(x => t >= x.a && t < x.b));
    const st = j.stages[stIdx];
    const formStage = {}; j.stages.forEach((x, i) => x.forms.forEach(f => { if (!(f in formStage)) formStage[f] = i; }));
    const formStatus = f => { const i = formStage[f]; if (s.signed[f]) return 'signed'; if (i === undefined) return 'locked'; if (t >= j.stages[i].b && !['123', '124', '120'].includes(f)) return 'signed'; if (t >= j.stages[i].a) return 'open'; return 'locked'; };
    const forms = Object.keys(formStage).map(f => { const i = formStage[f], stt = formStatus(f); return { no: f, name: FORMS[f].name, who: FORMS[f].who, stage: j.stages[i].l, status: stt, label: stt === 'signed' ? 'Signed' : stt === 'open' ? 'Ready to sign' : 'Unlocks at ' + j.stages[i].l }; });
    const conds = j.conds.map(c => {
      const u = s.cond[c.id]; let status, label, remain = c.b - t;
      if (u) { status = u; label = u === 'waived' ? 'Removed' : 'Approved'; }
      else if (t < c.a) { status = 'upcoming'; label = 'Starts ' + dateOf(c.a); }
      else if (t < c.b) { status = 'open'; label = Math.ceil(remain) + (Math.ceil(remain) === 1 ? ' day left' : ' days left'); }
      else { status = 'fulfilled'; label = c.other ? 'Cleared by the other side' : 'Cleared'; }
      const pct = Math.max(0, Math.min(100, (t - c.a) / (c.b - c.a) * 100));
      return { id: c.id, name: c.name, other: !!c.other, status, label, pct, deadline: dateOf(c.b), canAct: status === 'open' && !c.other, svc: c.svc };
    });
    const lines = receipt(id, s).map(l => ({ ...l, final: t >= l.day, amtFmt: l.kind === 'info' && l.amt === 0 ? 'Incl.' : fmt$(l.amt) }));
    const costLines = lines.filter(l => l.kind !== 'info');
    const sumFinal = costLines.filter(l => l.final).reduce((a, l) => a + l.amt, 0), sumAll = costLines.reduce((a, l) => a + l.amt, 0);
    const events = j.events.filter(e => e[0] <= t).map(e => ({ day: e[0], when: dateOf(e[0]), who: PN(e[1]).name, role: e[1], text: e[2].replace(/\$1,150,000|\$689,000/, fmt$(j.price)).replace('48 Bellwoods Ave', j.addr) })).concat((s.log || []).filter(e => e.day <= t + .01)).sort((a, b) => b.day - a.day);
    const parties = j.parties.map(r => ({ role: r, name: PN(r).name, org: roleName[r] ? PEOPLE[r].org.split('·').pop().trim() : PEOPLE[r].org, initials: PN(r).name.replace(/^The /, '').split(/[\s&]+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase(), task: st.task[r] || '', active: !!st.task[r] }));
    const services = j.services.map(([k, si]) => { const si2 = Math.min(si, j.stages.length - 1), pv = pk[k] && X ? X.prov(k, pk[k]) : null; return { id: k, ...SERVICES[k], provider: pv ? pv.name : SERVICES[k].provider, picked: pk[k] || '', stage: j.stages[si2].l, booked: !!pk[k] || !!s.booked[k] || t >= j.stages[si2].b }; });
    const ready = j.ready.map(([label, kind, ref]) => ({ label, kind, ref, done: kind === 'form' ? formStatus(ref) === 'signed' : kind === 'svc' ? services.some(x => x.id === ref && x.booked) : !!(s.flags || {})[ref] }));
    const score = Math.round(ready.filter(r => r.done).length / ready.length * 100);
    const d = s.dec || {}; let usp = null;
    if (j.kind === 'buy') { const sh = d.self ? .8 : .6; usp = { kicker: 'Your cash back', amt: fmt$(j.price * (j.comm || .022) * sh), sub: Math.round(sh * 100) + '% of the buyer commission the seller pays. Sent to your bank account after closing and disclosed to your lender.', plan: d.self ? 'Self-directed plan' : 'Guided plan' }; }
    if (j.kind === 'sell') { const fee = d.assisted !== false ? j.price * .01 : 999; usp = { kicker: 'You keep more', amt: fmt$((j.price * .025 - fee) * 1.13), sub: 'Saved against a typical 2.5% listing commission, including HST.', plan: d.assisted !== false ? 'Assisted · 1% + HST' : 'Flat · $999 + HST' }; }
    return {
      usp, hasUsp: !!usp,
      j: { id, label: j.label, short: j.short, kind: j.kind, addr: j.addr, city: j.city, meta: j.meta, photo: j.photo, priceFmt: j.kind === 'rent' || j.kind === 'lease' ? fmt$(j.price) + '/mo' : fmt$(j.price), total },
      t, pct: t / total * 100, date: dateOf(t), dayLabel: 'Day ' + Math.round(t) + ' of ' + total, done: t >= total,
      stIdx, stage: { l: st.l, sub: st.sub, n: stIdx + 1, of: j.stages.length },
      stages: j.stages.map((x, i) => ({ l: x.l, i, left: x.a / total * 100, w: (x.b - x.a) / total * 100, state: i < stIdx ? 'done' : i === stIdx ? 'now' : 'next', a: x.a, date: dateOf(x.a) })),
      forms, conds, lines, sumFinal: fmt$(sumFinal), sumAll: fmt$(sumAll), finalCount: costLines.filter(l => l.final).length, lineCount: costLines.length,
      events, parties, services, ready, score, keys: { title: j.keys[0], sub: j.keys[1] }, decisions: j.decisions
    };
  }

  window.KLYR = { J, FORMS, SERVICES, PEOPLE, model, fmt$, dateOf, ltt, journeys: Object.keys(J).map(k => ({ id: k, label: J[k].label, short: J[k].short, photo: J[k].photo, addr: J[k].addr, kind: J[k].kind })) };
})();
