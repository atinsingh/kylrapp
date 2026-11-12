// Ontario partner workflows: documents and communication each role needs. Sample data for prototypes.
window.KLYR_P = (() => {
  const STEPS = ['Buyer agreement', 'Find and visit', 'Offer', 'Deposit', 'Mortgage', 'Financing', 'Inspection', 'Lock in', 'Lawyer', 'Insurance', 'Sign', 'Keys'];
  const PHASE = i => i < 2 ? 'Find your home' : i < 8 ? 'Secure the deal' : 'Move in';
  const CLIENTS = [
    { id: 'alex', name: 'Alex Rivera', kind: 'Buyer · first home', addr: '48 Bellwoods Ave', price: 1150000, step: 6, due: 'Inspection check ends', dueDay: 2, plan: 'Guided', comm: .025, closeDay: 58 },
    { id: 'lin', name: 'Jun & Mei Lin', kind: 'Buyer', addr: '227 Symington Ave', price: 988000, step: 4, due: 'Mortgage check ends', dueDay: 1, plan: 'Guided', comm: .025, closeDay: 34 },
    { id: 'nguyen', name: 'Priya & Dev Nguyen', kind: 'Buyer · first home', addr: '', price: 1100000, step: 1, due: '3 visits booked', dueDay: 0, plan: 'Self-directed', comm: .025, closeDay: 0 },
    { id: 'farah', name: 'T. Farah', kind: 'Condo buyer', addr: '18 Mimico Ave, Unit 1204', price: 689000, step: 10, due: 'Closing papers', dueDay: 6, plan: 'Guided', comm: .025, closeDay: 9 },
    { id: 'walsh', name: 'M. Walsh', kind: 'Buyer', addr: '64 Galley Ave', price: 899000, step: 2, due: 'Counter-offer expires 9 pm', dueDay: 0, plan: 'Self-directed', comm: .025, closeDay: 0 },
    { id: 'okafor', name: 'J. Okafor', kind: 'Buyer', addr: '', price: 850000, step: 0, due: 'Buyer agreement sent', dueDay: 0, plan: 'Guided', comm: .025, closeDay: 0 },
    { id: 'kim', name: 'S. Kim', kind: 'Buyer', addr: '35 Lynd Ave', price: 1240000, step: 11, due: 'Closed Sep 30', dueDay: -5, plan: 'Guided', comm: .025, closeDay: -5 }
  ];
  // [document, why it is needed, who provides it, when]
  const DOCS = {
    agent: [
      ['Buyer Representation Agreement (Form 300)', 'RECO requires it in writing before showing homes', 'Buyer signs', 'Before first visit'],
      ['RECO Information Guide acknowledgement', 'Buyer confirms they received the consumer guide', 'Buyer signs', 'Before first visit'],
      ['FINTRAC individual ID record', 'Anti-money-laundering ID check, kept 5 years', 'Agent records', 'Before the offer'],
      ['Agreement of Purchase and Sale (Form 100/101)', 'The offer: price, deposit, conditions, closing date', 'Agent drafts, buyer signs', 'Offer day'],
      ['Confirmation of Co-operation (Form 320)', 'Records who represents whom and the commission split', 'Both brokerages', 'With the offer'],
      ['Offer Summary Document (Form 801)', 'Registers the offer time and deadline with the seller side', 'Agent', 'With the offer'],
      ['Deposit receipt', 'Proof the deposit reached the seller’s brokerage trust', 'Seller brokerage', 'Within 24 hours'],
      ['FINTRAC receipt of funds record', 'Source of the deposit money', 'Agent records', 'When deposit is paid'],
      ['Notice of Fulfillment (Form 124)', 'Tells the seller a condition is met', 'Buyer signs', 'By each condition deadline'],
      ['Waiver (Form 123)', 'Removes a condition the buyer no longer needs', 'Buyer signs', 'By each condition deadline'],
      ['Amendment (Form 120)', 'Any change to price, dates or terms after acceptance', 'Both sides sign', 'As needed'],
      ['Showing record', 'Time in and out, geofenced, for every visit', 'App records', 'Each visit']
    ],
    lawyer: [
      ['Client ID (two pieces, one with photo)', 'Law Society client identification and verification', 'Buyer', 'On retainer'],
      ['Retainer and fee estimate', 'Flat fee plus disbursements, in writing', 'Lawyer', 'On retainer'],
      ['Agreement of Purchase and Sale with amendments and waivers', 'What is being bought, and the dates', 'Buyer’s agent', 'When the deal is firm'],
      ['Deposit receipt', 'Credited in the statement of adjustments', 'Buyer’s agent', 'When the deal is firm'],
      ['Mortgage instructions', 'How to register the lender’s mortgage', 'Lender', '10 days before closing'],
      ['Insurance binder with mortgagee clause', 'Lender needs cover from closing day', 'Insurer', '5 days before closing'],
      ['Title search and requisition letter', 'Checks for liens and problems on title', 'Lawyer', '15 to 10 days before closing'],
      ['Condo status certificate (condos)', 'Reserve fund, fees, lawsuits, rules', 'Condo corporation', 'Within 10 days of request'],
      ['Statement of adjustments', 'Tax, utility and fee credits between buyer and seller', 'Seller’s lawyer', '5 days before closing'],
      ['Direction re funds and undertakings', 'Where money goes, and promises to clear debts', 'Both lawyers', 'Closing week'],
      ['Land transfer tax affidavit', 'Ontario and Toronto tax, first-time buyer refund', 'Buyer signs', 'Signing appointment'],
      ['Closing funds by wire or certified cheque', 'Balance of the down payment', 'Buyer', '1 day before closing'],
      ['Title insurance policy', 'Protects against title fraud and defects', 'Lawyer orders', 'Closing day'],
      ['Reporting letter', 'Final record of the purchase and registration', 'Lawyer', 'After closing']
    ],
    lender: [
      ['Mortgage application and credit consent', 'Needed before any credit check', 'Buyer', 'On request'],
      ['Government photo ID', 'Identity check', 'Buyer', 'On request'],
      ['Two recent pay stubs and job letter', 'Income and job length', 'Buyer', 'Day 1'],
      ['Notices of Assessment (2 years)', 'Income history, no tax owing', 'Buyer', 'Day 1'],
      ['90 days of bank statements', 'Where the down payment comes from', 'Buyer', 'Day 1'],
      ['Gift letter (if family helps)', 'Gift must not be repaid', 'Buyer and giver', 'Day 1'],
      ['Agreement of Purchase and Sale and MLS listing', 'The property and price being financed', 'Buyer’s agent', 'Day 0'],
      ['Appraisal', 'Lender confirms the home is worth the price', 'Appraiser', 'Day 2 to 3'],
      ['Condo status certificate (condos)', 'Lender checks the building', 'Lawyer', 'Before approval'],
      ['Mortgage commitment', 'Final approval and conditions', 'Lender', 'By the mortgage check deadline'],
      ['Instructions to lawyer', 'Tells the lawyer how to register the mortgage', 'Lender', '10 days before closing']
    ],
    inspector: [
      ['Pre-inspection agreement', 'Scope, limits and fee, signed before starting', 'Buyer signs', 'When booking'],
      ['Access confirmation', 'Seller agrees to the time through the agents', 'Listing agent', 'Within 24 hours'],
      ['Seller property disclosure (if any)', 'Known issues to look at closely', 'Listing agent', 'Before the visit'],
      ['Inspection report with photos', 'Findings, sorted by urgency', 'Inspector', 'Same day'],
      ['Repair cost estimates', 'Helps the buyer ask for a credit', 'Inspector', 'With the report'],
      ['Specialist referrals', 'Sewer camera, WETT for wood stoves, electrical', 'Inspector', 'If needed']
    ],
    insurer: [
      ['Property details', 'Age of roof, wiring, plumbing, heating', 'Buyer or listing', 'On request'],
      ['Claims history or letter of experience', 'Prior claims affect price', 'Buyer', 'On request'],
      ['Agreement of Purchase and Sale', 'Address, closing date and lender', 'Buyer’s agent', 'On request'],
      ['Inspection report (optional)', 'Can lower the price or remove exclusions', 'Buyer', 'After inspection'],
      ['Binder with mortgagee clause', 'Proof of cover for the lender and lawyer', 'Insurer', '5 days before closing'],
      ['Policy documents', 'Full wording and coverage', 'Insurer', 'Closing day']
    ]
  };
  // [with whom, what, when, how]
  const COMMS = {
    agent: [['Buyer', 'Visit confirmations, offer strategy, condition deadlines', 'Daily during a deal', 'App chat + SMS'], ['Listing agent', 'Showing requests, offers, counter-offers', 'Offer days', 'Phone + email with forms'], ['Lawyer', 'Firm deal package', 'Once firm', 'Secure share'], ['Lender', 'APS, MLS and appraisal access', 'After acceptance', 'Secure share'], ['Inspector', 'Access time and lockbox', 'Inspection day', 'App']],
    lawyer: [['Buyer', 'Retainer, ID, signing appointment, funds', 'Weekly, daily in closing week', 'App + video'], ['Seller’s lawyer', 'Requisitions, adjustments, undertakings', 'Last 2 weeks', 'Email + Teraview'], ['Lender', 'Instructions, final report', 'Last 10 days', 'Lender portal'], ['Insurer', 'Binder', 'Last week', 'Email'], ['Agent', 'Firm deal package, key release', 'Firm day and closing day', 'App']],
    lender: [['Buyer', 'Quotes, document list, approval', 'Daily until approved', 'App + phone'], ['Agent', 'Appraisal access, approval news', 'Mortgage check period', 'App'], ['Lawyer', 'Instructions, funding', 'Last 10 days', 'Lender portal'], ['Appraiser', 'Booking and report', 'Day 1 to 3', 'Portal']],
    inspector: [['Buyer', 'Booking, what to expect, report walkthrough', 'Booking and same day', 'App + on site'], ['Agents', 'Access window', 'Day before', 'App'], ['Specialists', 'Referral for sewer, WETT, electrical', 'If needed', 'Phone']],
    insurer: [['Buyer', 'Questions, quote, coverage options', 'Within 2 hours', 'App + phone'], ['Lawyer', 'Binder with mortgagee clause', '5 days before closing', 'Email'], ['Lender', 'Proof of cover', 'Before funding', 'Via lawyer']]
  };
  // Fee rules each partner must follow when Klyr refers a client
  const FEES = {
    lawyer: ['Referral fees to Klyr: not allowed', 'Law Society rules only allow referral fees between licensees. Klyr is paid nothing by lawyers.'],
    lender: ['Referral fee: allowed with disclosure', 'Disclosed to the buyer in writing before they choose. Paid on funding.'],
    inspector: ['Referral fee: allowed with disclosure', 'Disclosed to the buyer in writing before booking.'],
    insurer: ['Referral fee: allowed with disclosure', 'Disclosed to the buyer in writing. Paid when the policy is bound.']
  };
  return { STEPS, PHASE, CLIENTS, DOCS, COMMS, FEES };
})();
