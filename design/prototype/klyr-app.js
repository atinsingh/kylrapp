// Klyr app v2 — sample data and Ontario cost math (illustrative figures; not advice)
(function () {
  const $ = n => (n < 0 ? '−' : '') + '$' + Math.abs(Math.round(n)).toLocaleString('en-CA');
  const K = n => n >= 1e6 ? '$' + (n / 1e6).toFixed(n % 1e6 ? 2 : 1).replace(/\.?0+$/, '') + 'M' : '$' + Math.round(n / 1000) + 'K';
  const brackets = (p, b) => { let prev = 0, t = 0; for (const [cap, r] of b) { if (p > prev) t += (Math.min(p, cap) - prev) * r; prev = cap; } return Math.round(t); };
  const ON = [[55000, .005], [250000, .01], [400000, .015], [2000000, .02], [Infinity, .025]];
  const TO = [[55000, .005], [250000, .01], [400000, .015], [2000000, .02], [3000000, .025], [4000000, .035], [Infinity, .045]];
  const HST = 1.13;

  function ltt(price, toronto, first) {
    const on = brackets(price, ON), onR = first ? Math.min(4000, on) : 0;
    const to = toronto ? brackets(price, TO) : 0, toR = toronto && first ? Math.min(4475, to) : 0;
    return { on, onR, to, toR, total: on - onR + to - toR };
  }
  function pay(loan, rate, years) { const r = Math.pow(1 + rate / 2, 1 / 6) - 1, n = years * 12; return loan * r / (1 - Math.pow(1 + r, -n)); }
  function cmhc(price, downPct) {
    if (downPct >= .2 || price >= 1500000) return 0;
    const rate = downPct >= .15 ? .028 : downPct >= .1 ? .031 : .04;
    return Math.round(price * (1 - downPct) * rate);
  }
  function minDown(price) { return price <= 500000 ? price * .05 : price < 1500000 ? 25000 + (price - 500000) * .1 : price * .2; }

  function buyer(L, o) {
    o = o || {};
    const price = o.price || L.price, plan = o.plan || 60, first = o.first !== false;
    const t = ltt(price, L.city === 'Toronto', first);
    const lawFee = o.lawyer != null ? o.lawyer : 1850, lawyer = Math.round(lawFee * HST) + 450, insp = L.type === 'Condo' ? 0 : 550, cert = L.type === 'Condo' ? 100 : 0, title = 350, adj = L.type === 'Condo' ? 820 : 1245;
    const commission = price * L.coop, cash = Math.round(commission * plan / 100);
    const downPct = o.downPct != null ? o.downPct : .2, down = Math.round(price * downPct), prem = cmhc(price, downPct), pst = Math.round(prem * .08);
    const loan = price - down + prem, rate = o.rate || .0449, mo = pay(loan, rate, 25);
    const costs = t.total + lawyer + insp + cert + title + adj + pst;
    return { price, plan, t, lawyer, insp, cert, title, adj, cash, commission, down, prem, pst, loan, rate, mo, tax: Math.round(L.tax / 12), fee: L.fee || 0, costs, allin: costs - cash,
      other: insp + cert + title + adj };
  }
  function seller(o) {
    const price = o.price, fee = o.plan === 'self' ? Math.round(999 * HST) : Math.round(price * .01 * HST), coop = Math.round(price * o.coop * HST), lawyer = Math.round(1200 * HST) + 300, mort = 512750, pen = o.penalty || 0;
    return { price, fee, coop, lawyer, mort, pen, net: price - fee - coop - lawyer - mort - pen, vs25: Math.round(price * .025 * HST) - fee };
  }
  function afford(o) {
    const q = Math.max(o.rate + .02, .0525), inc = o.income / 12;
    const heat = 100, room = Math.min(inc * .39 - o.tax - heat, inc * .44 - o.tax - heat - o.debts);
    const r = Math.pow(1 + q / 2, 1 / 6) - 1, n = 25 * 12, loan = room * (1 - Math.pow(1 + r, -n)) / r;
    return { max: Math.round((loan + o.down) / 1000) * 1000, loan: Math.round(loan), q };
  }

  const L = [
    { id: 'maple', lat: 43.6046, lng: -79.5958, addr: '41 Maple Cres', city: 'Mississauga', hood: 'Applewood', type: 'House', style: 'Detached', beds: 4, baths: 3, sqft: 2350, lot: '50 × 120 ft', built: 1998, price: 1150000, coop: .022, tax: 6960, img: 'photos/home-1.png', open: 'Sat Oct 31 · 2–4 pm', offers: 'Tue Nov 3 · 7 pm', dom: 6, x: 34, y: 58, park: '2-car garage', heat: 'Gas forced air · central AC',
      hist: [['Oct 21, 2026', 'Listed', 1150000], ['Jun 12, 2014', 'Sold', 640000], ['May 2, 2014', 'Listed', 649900]],
      comps: [['52 Maple Cres', '4 bed · 2,280 sq ft', 1128000, 'Sep 2026'], ['17 Oakmont Dr', '4 bed · 2,410 sq ft', 1172000, 'Aug 2026'], ['9 Sycamore Crt', '3 bed · 2,050 sq ft', 1095000, 'Jul 2026']],
      schools: [['Maple Ridge PS', 'JK–8 · public', '0.6 km'], ['St. Catherine CS', 'JK–8 · Catholic', '0.9 km'], ['Applewood Heights SS', '9–12 · public', '1.4 km']],
      commute: [['Union Station', 'GO train from Cooksville', '52 min'], ['Union Station', 'Drive, 8 am', '41 min'], ['Square One', 'Bus', '24 min']],
      near: 'Parks 3 within 1 km · grocery 0.8 km · GO station 2.6 km' },
    { id: 'queens', lat: 43.6389, lng: -79.3851, addr: '250 Queens Quay W #1204', city: 'Toronto', hood: 'Harbourfront', type: 'Condo', style: 'Apartment', beds: 2, baths: 2, sqft: 880, lot: '', built: 2009, price: 689000, coop: .025, tax: 2840, fee: 712, img: 'photos/home-2.png', open: 'Sun Nov 1 · 1–3 pm', offers: 'Any time', dom: 18, x: 74, y: 70, park: '1 parking · 1 locker', heat: 'Fan coil · fee includes heat, water',
      hist: [['Oct 9, 2026', 'Listed', 699000], ['Oct 23, 2026', 'Price drop', 689000], ['Aug 2019', 'Sold', 655000]],
      comps: [['250 Queens Quay W #907', '2 bed · 860 sq ft', 672000, 'Sep 2026'], ['230 Queens Quay W #1510', '2 bed · 910 sq ft', 701000, 'Aug 2026'], ['260 Queens Quay W #604', '2 bed · 840 sq ft', 655000, 'Jul 2026']],
      schools: [['Waterfront School', 'JK–8 · public', '0.4 km'], ['Jarvis CI', '9–12 · public', '2.1 km']],
      commute: [['Union Station', 'Streetcar', '12 min'], ['Union Station', 'Walk', '18 min']],
      near: 'Lakefront trail 0.1 km · grocery 0.3 km · status certificate ordered' },
    { id: 'fern', lat: 43.4719, lng: -79.7004, addr: '9 Fern Ln', city: 'Oakville', hood: 'College Park', type: 'House', style: 'Detached', beds: 3, baths: 3, sqft: 1780, lot: '45 × 110 ft', built: 1986, price: 1049000, coop: .02, tax: 5410, img: 'photos/home-3.png', open: 'Sat Oct 31 · 1–3 pm', offers: 'Mon Nov 2 · 6 pm', dom: 4, x: 14, y: 76, park: '1-car garage', heat: 'Gas forced air · central AC',
      hist: [['Oct 23, 2026', 'Listed', 1049000], ['Mar 2009', 'Sold', 478000]],
      comps: [['14 Fern Ln', '3 bed · 1,720 sq ft', 1032000, 'Aug 2026'], ['220 Sumner Rd', '3 bed · 1,850 sq ft', 1068000, 'Jun 2026']],
      schools: [['Sunningdale PS', 'JK–8 · public', '0.7 km'], ['White Oaks SS', '9–12 · public', '1.1 km']],
      commute: [['Union Station', 'GO train from Oakville', '44 min'], ['Union Station', 'Drive, 8 am', '55 min']],
      near: 'Sheridan College 1.2 km · grocery 0.6 km · GO station 2.0 km' },
    { id: 'willow', lat: 43.5131, lng: -79.6327, addr: '1207 Willowbrook Dr', city: 'Mississauga', hood: 'Clarkson', type: 'Townhouse', style: 'Freehold town', beds: 3, baths: 3, sqft: 1540, lot: '20 × 100 ft', built: 2004, price: 879000, coop: .025, tax: 4720, img: 'photos/home-4.png', open: 'Sun Nov 1 · 2–4 pm', offers: 'Any time', dom: 11, x: 46, y: 34, park: '1-car garage', heat: 'Gas forced air · central AC',
      hist: [['Oct 16, 2026', 'Listed', 899000], ['Oct 25, 2026', 'Price drop', 879000], ['Apr 2017', 'Sold', 702000]],
      comps: [['1211 Willowbrook Dr', '3 bed · 1,520 sq ft', 862000, 'Sep 2026'], ['1195 Willowbrook Dr', '3 bed · 1,560 sq ft', 890000, 'Jul 2026']],
      schools: [['Hillside PS', 'JK–8 · public', '0.5 km'], ['Lorne Park SS', '9–12 · public', '2.3 km']],
      commute: [['Union Station', 'GO train from Clarkson', '38 min'], ['Union Station', 'Drive, 8 am', '46 min']],
      near: 'Clarkson GO 1.1 km · grocery 0.4 km' },
    { id: 'galley', lat: 43.6411, lng: -79.4469, addr: '63 Galley Ave', city: 'Toronto', hood: 'Roncesvalles', type: 'House', style: 'Semi-detached', beds: 3, baths: 2, sqft: 1620, lot: '18 × 125 ft', built: 1912, price: 1295000, coop: .02, tax: 6120, img: 'photos/home-1.png', open: 'Sat Oct 31 · 2–4 pm', offers: 'Wed Nov 4 · 7 pm', dom: 3, x: 66, y: 44, park: 'Laneway parking', heat: 'Gas boiler · radiators',
      hist: [['Oct 24, 2026', 'Listed', 1295000], ['Nov 2011', 'Sold', 612000]],
      comps: [['71 Galley Ave', '3 bed semi', 1318000, 'Sep 2026'], ['40 Fern Ave', '3 bed semi', 1260000, 'Jul 2026']],
      schools: [['Fern Avenue PS', 'JK–8 · public', '0.3 km'], ['Parkdale CI', '9–12 · public', '1.0 km']],
      commute: [['Union Station', 'Streetcar + subway', '28 min'], ['Union Station', 'Bike', '22 min']],
      near: 'High Park 0.8 km · Roncesvalles shops 0.2 km' },
    { id: 'rebecca', lat: 43.4441, lng: -79.6797, addr: '402 Rebecca St #305', city: 'Oakville', hood: 'Old Oakville', type: 'Condo', style: 'Apartment', beds: 2, baths: 2, sqft: 1010, lot: '', built: 2016, price: 739000, coop: .025, tax: 3380, fee: 640, img: 'photos/home-2.png', open: 'By appointment', offers: 'Any time', dom: 22, x: 22, y: 50, park: '1 parking · 1 locker', heat: 'Heat pump · fee includes water',
      hist: [['Oct 5, 2026', 'Listed', 759000], ['Oct 20, 2026', 'Price drop', 739000]],
      comps: [['400 Rebecca St #208', '2 bed · 980 sq ft', 728000, 'Aug 2026']],
      schools: [['New Central PS', 'JK–8 · public', '0.5 km'], ['Oakville Trafalgar HS', '9–12 · public', '1.3 km']],
      commute: [['Union Station', 'GO train from Oakville', '44 min']],
      near: 'Lakeshore shops 0.4 km · harbour 0.6 km' }
  ];

  const R = [
    { id: 'king', lat: 43.6441, lng: -79.4012, addr: '625 King St W #1810', city: 'Toronto', beds: 2, baths: 2, sqft: 760, rent: 2450, built: 2021, ctrl: false, img: 'photos/home-2.png', move: 'Dec 1', inc: 'Water · 1 parking · 1 locker', pets: 'Small pets OK', fee: 'Landlord pays Klyr' },
    { id: 'shaw', lat: 43.6449, lng: -79.4188, addr: '22 Shaw St #3', city: 'Toronto', beds: 1, baths: 1, sqft: 580, rent: 2150, built: 1978, ctrl: true, img: 'photos/home-4.png', move: 'Nov 15', inc: 'Heat · water', pets: 'Ask landlord', fee: 'Landlord pays Klyr' },
    { id: 'glen', lat: 43.5468, lng: -79.7118, addr: '3445 Glen Erin Dr', city: 'Mississauga', beds: 3, baths: 2, sqft: 1300, rent: 3100, built: 1985, ctrl: true, img: 'photos/home-3.png', move: 'Jan 1', inc: 'Parking for 2', pets: 'Pets OK', fee: 'Landlord pays Klyr' },
    { id: 'trafalgar', lat: 43.4879, lng: -79.7238, addr: '2520 Trafalgar Rd #702', city: 'Oakville', beds: 1, baths: 1, sqft: 640, rent: 2300, built: 2020, ctrl: false, img: 'photos/home-1.png', move: 'Dec 1', inc: 'Water · 1 parking', pets: 'No pets', fee: 'Landlord pays Klyr' }
  ];

  const PRO = {
    lawyer: [['Harbour Law', 'Real estate lawyer · Mississauga', 1400, 0, '4.9 · 212 closings'], ['Ng & Patel LLP', 'Real estate lawyers · Toronto', 1650, 0, '4.8 · 340 closings'], ['Brightside Legal', 'Real estate lawyer · Oakville', 1850, 150, '4.7 · 98 closings']],
    lender: [['Pine Mortgage', 'Broker · 5-yr fixed 4.49%', 0, 0, 'Paid by the lender, not you'], ['Northgate Mortgage', 'Broker · 5-yr fixed 4.39%', 0, 250, 'Klyr gets a $250 referral fee'], ['Lakeshore Credit Union', 'Lender · 5-yr fixed 4.64%', 0, 0, 'Direct lender']],
    inspector: [['Northline Inspect', 'Certified home inspector', 550, 0, '4.9 · report in 24 h'], ['ClearView Inspections', 'Certified home inspector', 495, 0, '4.8 · report same day']],
    insurer: [['Coastline Insurance', 'Home insurance broker', 1920, 0, 'per year · binder to lawyer'], ['Maple Mutual', 'Home insurer', 2140, 75, 'per year · Klyr gets $75']],
    mover: [['Two Bay Movers', 'Local movers · 3 crew', 1600, 0, 'Estimate · 4-bed house']],
    media: [['Lumen Media', 'Photos, floor plan, 3D tour', 390, 0, 'Seller service']]
  };

  const ROOMS = { House: [['living','Living room'],['kitchen','Kitchen'],['dining','Dining room'],['primary','Primary bedroom'],['bath','Main bathroom'],['basement','Basement'],['yard','Backyard']], Townhouse: [['living','Living room'],['kitchen','Kitchen'],['primary','Primary bedroom'],['bath','Main bathroom'],['yard','Backyard']], Condo: [['living','Living room'],['kitchen','Kitchen'],['primary','Primary bedroom'],['bath','Bathroom'],['view','Balcony view'],['amen','Building amenities']] };
  const CHAPTERS = { House: [['0:00','Street and exterior'],['0:18','Living and dining'],['0:42','Kitchen'],['1:05','Bedrooms'],['1:28','Basement and yard']], Townhouse: [['0:00','Exterior'],['0:15','Main floor'],['0:40','Bedrooms'],['1:02','Yard']], Condo: [['0:00','Lobby and amenities'],['0:20','Living and kitchen'],['0:45','Bedrooms'],['1:05','Balcony view']] };
  window.KLYR_APP = { ROOMS, CHAPTERS, $, K, ltt, pay, cmhc, minDown, buyer, seller, afford, L, R, PRO, HST };
})();
