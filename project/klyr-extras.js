// Klyr v11 extras: search listings, provider marketplace, Klyr AI insights (illustrative data)
(function () {
  const f = n => '$' + Math.round(n).toLocaleString('en-CA');
  const LISTINGS = {
    house: [
      { id: 'h1', comm: 0.025, addr: '48 Bellwoods Ave', area: 'Trinity Bellwoods', price: 1150000, meta: '3 bed · 2 bath · detached', photo: 'photos/home-1.png', dom: 6, ai: 'Priced 4% under the area median for detached. Similar homes sold in 9 days.' },
      { id: 'h2', comm: 0.025, addr: '211 Crawford St', area: 'Little Portugal', price: 1289000, meta: '4 bed · 3 bath · semi', photo: 'photos/home-3.png', dom: 21, ai: '21 days on market, twice the area average. Room to offer below list.' },
      { id: 'h3', comm: 0.02, addr: '9 Dewson St', area: 'Dufferin Grove', price: 1049000, meta: '3 bed · 1 bath · semi', photo: 'photos/home-4.png', dom: 2, ai: 'New listing with an offer date. Expect competition; get pre-approval updated.' },
      { id: 'h4', comm: 0.025, addr: '67 Euclid Ave', area: 'Palmerston', price: 1395000, meta: '4 bed · 2 bath · detached', photo: 'photos/home-2.png', dom: 12, ai: 'Knob-and-tube disclosed. Budget $12–18k for rewiring and keep the inspection condition.' }
    ],
    condo: [
      { id: 'c1', comm: 0.025, addr: '1204 – 88 Queens Quay W', area: 'Harbourfront', price: 689000, meta: '2 bed · 2 bath · parking', photo: 'photos/home-2.png', dom: 8, ai: 'Fees $0.71/sq ft, below the building average. Reserve fund study done in 2025.' },
      { id: 'c2', comm: 0.02, addr: '2907 – 15 Iceboat Terr', area: 'CityPlace', price: 629000, meta: '2 bed · 1 bath', photo: 'photos/home-1.png', dom: 30, ai: 'Building had a special assessment in 2023. Read the status certificate closely.' },
      { id: 'c3', comm: 0.025, addr: '508 – 1 Market St', area: 'St. Lawrence', price: 749000, meta: '2 bed · 2 bath · locker', photo: 'photos/home-3.png', dom: 4, ai: 'Low rental ratio (18%). Tends to hold value in slower markets.' }
    ],
    build: [
      { id: 'b1', comm: 0.02, addr: 'Lot 17, Oakridge Meadows', area: 'Milton', price: 1040000, meta: '4 bed · 3 bath · freehold', photo: 'photos/home-3.png', dom: 0, ai: 'Builder has 2 Tarion delay claims in 5 years. Ask for capped closing adjustments.' },
      { id: 'b2', comm: 0.02, addr: 'Lot 42, Oakridge Meadows', area: 'Milton', price: 1115000, meta: '4 bed · 3.5 bath · corner', photo: 'photos/home-1.png', dom: 0, ai: 'Corner lot premium of $45k. Resale data shows about half of that is recovered.' }
    ],
    rent: [
      { id: 'r1', addr: '3 – 140 Ossington Ave', area: 'Ossington', price: 3100, meta: '2 bed · 1 bath', photo: 'photos/home-2.png', dom: 3, ai: 'At the area median for 2 bed. Water and heat included.' },
      { id: 'r2', addr: '2nd fl – 88 Harbord St', area: 'Harbord Village', price: 2850, meta: '2 bed · 1 bath', photo: 'photos/home-4.png', dom: 9, ai: '$250 below median. Hydro extra, about $90/mo.' },
      { id: 'r3', addr: '1502 – 20 Bruyeres Mews', area: 'Fort York', price: 3350, meta: '2 bed · 2 bath · parking', photo: 'photos/home-1.png', dom: 1, ai: 'Includes parking worth about $200/mo nearby.' }
    ]
  };
  const SLOTS = ['Today 6:30 pm', 'Tomorrow 12:00 pm', 'Sat 10:30 am', 'Sat 2:00 pm'];
  const SHOWREQ = {
    sell: [['Sam & Leah Ortiz', 'Nadia Farouk · Crestview', 'Today 6:30 pm'], ['Priyanka Das', 'Self-represented', 'Sat 10:30 am'], ['Tom Becker', 'Harbourline', 'Sat 2:00 pm']],
    lease: [['Jamie Lee', 'Tenant · credit 761', 'Today 6:30 pm'], ['Omar & Sara K.', 'Tenants · credit 702', 'Tomorrow 12:00 pm'], ['Wen Zhao', 'Tenant · credit 688', 'Sat 10:30 am']]
  };
  const QUOTES = { northgate: [4.09, 20, 1.8, 'Adrian Kim'], td: [4.19, 15, 3.5, 'Priya Shah'], pine: [3.99, 10, 2.5, 'Leo Martin'], maple: [4.14, 20, 3, 'Grace Obi'] };
  const PROVIDERS = {
    mortgage: [['northgate', 'Northgate Mortgage', 'Broker · 4 lenders', '4.09% 5-yr', 'Commitment in 1.8 days', 4.8], ['td', 'TD Mortgage', 'Bank lender', '4.19% 5-yr', 'Branch or remote', 4.5], ['pine', 'Pine Mortgages', 'Online broker', '3.99% 5-yr', '$3,500 prepay limit', 4.4], ['maple', 'Maple Credit Union', 'Credit union', '4.14% 5-yr', '20% yearly prepay', 4.7]],
    lawyer: [['marino', 'Marino Law', 'Closes in 22 days avg', '$1,850 flat', 'Evening signings', 4.9], ['chen', 'Chen & Reyes LLP', '38 Klyr closings', '$1,450 flat', 'Remote ID and signing', 4.8], ['okonkwo', 'Okonkwo Law', '17 Klyr closings', '$1,295 flat', 'Weekend signings', 4.6]],
    inspector: [['clearview', 'ClearView Inspections', 'Report same day', '$575', 'Thermal + sewer scope', 4.9], ['keyhome', 'KeyHome Inspect', 'Report next day', '$495', 'Standard visual', 4.6]],
    title: [['fct', 'FCT', 'Via your lawyer', '$395', 'Most common in Ontario', 4.7], ['stewart', 'Stewart Title', 'Via your lawyer', '$410', 'Adds legal-access cover', 4.6]],
    insurance: [['coastline', 'Coastline Insurance', 'Binder in 2 hours', '$155/mo', 'Water + sewer backup', 4.7], ['harbourline', 'Harbourline Brokers', 'Compares 6 insurers', '$142/mo', 'Standard cover', 4.6], ['sonnet', 'Sonnet', 'Online, instant', '$128/mo', 'Basic cover', 4.3]],
    appraiser: [['greenfield', 'Greenfield Appraisals', 'Lender-approved', '$450', 'Visit in 48 h', 4.7]],
    movers: [['klyrmove', 'Klyr Move', 'Movers + utility transfer', 'From $1,450', 'Hydro, gas, water, internet', 4.8], ['twomen', 'Two Hands Moving', 'Movers only', 'From $1,190', '3-person crew', 4.5]],
    status: [['harbourfront', 'Harbourfront Mgmt', 'Property manager', '$100', 'Delivered in 2–3 days', 4.4]],
    screening: [['keystone', 'Keystone Screening', 'Credit + references', '$45', 'Results in 1 hour', 4.7], ['rentcheck', 'RentCheck', 'Credit only', '$25', 'Instant', 4.3]]
  };
  const ROLE = { mortgage: 'lender', lawyer: 'lawyer', inspector: 'inspector', insurance: 'insurer', appraiser: 'appraiser', screening: 'screener' };
  const prov = (svc, id) => { const L = PROVIDERS[svc] || []; const x = L.find(p => p[0] === id) || L[0]; return x ? { id: x[0], name: x[1], meta: x[2], price: x[3], stat: x[4], rating: x[5] } : null; };

  function insights(m, s, J) {
    const out = [], k = m.j.kind, st = m.stage.l, p = m.j.price;
    const openC = m.conds.filter(c => c.status === 'open');
    openC.forEach(c => { const left = parseInt(c.label, 10); if (left <= 2) out.push({ tone: 'warn', t: c.name + ' deadline is close', b: 'The condition ends ' + c.deadline + '. If it is not fulfilled or waived by then, the deal ends and your deposit is returned.' }); });
    if (m.score < 100 && m.stIdx <= 2) { const miss = m.ready.filter(r => !r.done).map(r => r.label.toLowerCase()); out.push({ t: 'Finish ' + miss.length + ' item' + (miss.length > 1 ? 's' : '') + ' before you offer', b: 'Still open: ' + miss.slice(0, 3).join(', ') + '. Sellers favour offers with an updated pre-approval and deposit ready.' }); }
    if (k === 'buy' && m.usp) out.push({ t: 'Your cash back covers ' + Math.min(100, Math.round(parseFloat(m.usp.amt.replace(/[^0-9.]/g, '')) / Math.max(1, parseFloat(m.sumAll.replace(/[^0-9.-]/g, ''))) * 100)) + '% of closing costs', b: m.usp.amt + ' comes back on closing day against a projected ' + m.sumAll + ' in costs.' });
    if (k === 'buy' && (st === 'Search' || st === 'Offer' || st === 'Choose lot')) out.push({ t: 'Suggested offer range', b: 'Recent comparable sales point to ' + f(p * .97) + ' to ' + f(p * 1.02) + '. Five-day financing and inspection conditions are typical here.' });
    if (k === 'buy' && m.decisions.includes('titleIns') && s.dec && s.dec.titleIns === false) out.push({ t: 'Title insurance is cheaper', b: 'A new survey costs about $1,200. Title insurance is $395 and most lenders accept it.' });
    if (k === 'buy' && m.decisions.includes('self') && !(s.dec && s.dec.self)) out.push({ t: 'Self-directed adds ' + f(p * .022 * .2) + ' cash back', b: 'You lead the search and an advisor still reviews your offer and forms.' });
    const pk = s.picked || {};
    if (m.services.some(x => x.id === 'mortgage') && !pk.mortgage) out.push({ t: 'Pine Mortgages is cheapest on rate', b: 'At 3.99% it saves about ' + f(p * .8 * .002 * 5) + ' over five years against 4.19%, but with a lower prepayment limit.' });
    if (k === 'sell') out.push({ t: 'Showing feedback', b: '3 of 5 buyers mentioned the kitchen. Similar sellers who priced within 1% of comparables sold in 9 days.' });
    if (k === 'rent') out.push({ t: 'Strengthen your application', b: 'Landlords here respond faster to a credit report, two pay stubs and a reference letter sent with Form 410.' });
    if (k === 'lease') out.push({ t: 'Pricing check', b: 'Similar 2-bed units leased at $3,000–3,250 in the last 60 days. Your ask is at the median.' });
    return out.slice(0, 3);
  }
  const SCH = {
    'Trinity Bellwoods': [['Givins/Shaw Jr PS', 'Public · JK–6', '0.4 km', 8.1], ['Ossington/Old Orchard PS', 'French immersion · JK–8', '0.9 km', 7.6], ['Central Tech', 'Public · 9–12', '1.6 km', 6.9]],
    'Little Portugal': [['Alexander Muir/Gladstone PS', 'Public · JK–8', '0.5 km', 7.2], ['St. Helen Catholic', 'Catholic · JK–8', '0.7 km', 7.4], ['Bloor CI', 'Public · 9–12', '2.1 km', 7.8]],
    'Dufferin Grove': [['Pauline Jr PS', 'Public · JK–6', '0.3 km', 7.9], ['Kent Sr PS', 'Public · 7–8', '0.8 km', 6.8], ['Bloor CI', 'Public · 9–12', '1.2 km', 7.8]],
    'Palmerston': [['Palmerston Ave Jr PS', 'Public · JK–6', '0.2 km', 8.6], ['Clinton St Jr PS', 'Public · JK–6', '0.6 km', 8.3], ['Harbord CI', 'Public · 9–12', '0.5 km', 8.0]],
    'Harbourfront': [['Waterfront School', 'Public · JK–8', '0.3 km', 7.3], ['Jarvis CI', 'Public · 9–12', '2.4 km', 7.1]],
    'CityPlace': [['Canoe Landing Schools', 'Public + Catholic · JK–8', '0.2 km', 7.5], ['Jarvis CI', 'Public · 9–12', '3.0 km', 7.1]],
    'St. Lawrence': [['Market Lane PS', 'Public · JK–8', '0.3 km', 7.7], ['Jarvis CI', 'Public · 9–12', '1.4 km', 7.1]],
    'Milton': [['Oakridge Meadows PS (planned 2028)', 'Public · JK–8', '0.6 km', null], ['Craig Kielburger SS', 'Public · 9–12', '2.8 km', 7.4]]
  };
  const HL = {
    h1: [['Walk to the park', 'Trinity Bellwoods is 3 minutes away.'], ['New roof', 'Replaced in 2018.'], ['Laneway potential', 'Lot backs onto a lane. A garden suite may be possible.'], ['Worth knowing', '100-amp electrical. Budget for an upgrade if you add an EV charger.', 1]],
    h2: [['Room to negotiate', '21 days on market, twice the area average.'], ['Separate side entrance', 'Good for a future basement unit.'], ['Worth knowing', 'Original windows on the second floor.', 1]],
    h3: [['Under $1.1M semi', 'Rare at this price in Dufferin Grove.'], ['Sunny south garden', 'Full sun most of the day.'], ['Worth knowing', 'Offer date set. Expect competition.', 1]],
    h4: [['Top-rated schools', 'Palmerston Ave Jr PS is a 2-minute walk.'], ['Big lot', '25 × 130 ft, larger than most nearby.'], ['Worth knowing', 'Knob-and-tube wiring disclosed. $12–18k to replace.', 1]]
  };
  const detail = (L, kind) => {
    const hl = HL[L.id] || [['Close to transit', 'Streetcar stop within a 5-minute walk.'], ['Good value', L.ai], ['Worth knowing', 'Check the status certificate for planned repairs.', 1]];
    return { schools: (SCH[L.area] || []).map(([n, t, d, r]) => ({ n, t, d, r: r == null ? 'New' : r.toFixed(1), pct: r == null ? 0 : r * 10 })), board: L.area === 'Milton' ? 'Halton District School Board' : 'Toronto District School Board',
      highlights: hl.filter(h => !h[2]).map(h => ({ t: h[0], b: h[1] })), watch: hl.filter(h => h[2]).map(h => ({ t: h[0], b: h[1] })),
      scores: [['Walk', L.area === 'Milton' ? 38 : 94], ['Transit', L.area === 'Milton' ? 41 : 88], ['Parks', L.area === 'Milton' ? 72 : 91]].map(([t, v]) => ({ t, v, pct: v })),
      tour: L.area === 'Milton' ? '3:05' : '2:14' };
  };
  window.KLYR_X = Object.assign(window.KLYR_X || {}, { QUOTES, oldDetail: detail, LISTINGS, SLOTS, SHOWREQ, PROVIDERS, ROLE, prov, insights, f });
})();
