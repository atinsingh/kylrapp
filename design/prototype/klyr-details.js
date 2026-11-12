// Listing details: virtual tour rooms, AI highlights, schools, neighbourhood (illustrative)
(function () {
  const PH = ['photos/home-1.png', 'photos/home-2.png', 'photos/home-3.png', 'photos/home-4.png'];
  const HL = {
    h1: [['Park at the end of the street', 'Trinity Bellwoods Park is a 3-minute walk.'], ['Room for a garden suite', 'The lot backs onto a lane. Toronto rules may allow a second home out back.'], ['Recently updated', 'New roof in 2018 and a renovated kitchen in 2022.']],
    h2: [['Legal basement apartment', 'Separate entrance. Could rent for about $1,900 a month.'], ['Room to negotiate', '21 days on the market, so the seller may take less.'], ['Deep lot', '25 × 130 ft, deeper than most on the street.']],
    h3: [['Walk to Dufferin Grove Park', 'Farmers’ market every Thursday, 2 minutes away.'], ['Strong school nearby', 'Kent Senior PS is 0.3 km away.'], ['Priced to move', 'Lowest-priced 3-bedroom in the area this month.']],
    h4: [['Rare 4-bed detached', 'Only 3 have sold in Palmerston in the past year.'], ['Original character', 'Stained glass and plaster mouldings kept throughout.'], ['Rewiring needed', 'Old wiring disclosed. Budget $12,000 to $18,000.', true]],
    c1: [['Lake views', 'South-facing unit on the 12th floor.'], ['Low monthly fees', '$0.71 per sq ft, below the building average.'], ['Parking and locker included', 'Worth about $60,000 if bought separately.']],
    c2: [['Close to transit', '5-minute walk to the Spadina streetcar.'], ['Past one-time charge', 'Owners paid a special assessment in 2023. Check the records.', true], ['Good value', '$905 per sq ft, 8% below the area.']],
    c3: [['Historic neighbourhood', 'St. Lawrence Market is across the street.'], ['Mostly owners, not renters', 'Only 18% of units are rented out.'], ['Two baths and a locker', 'Rare under $750,000 here.']],
    b1: [['Builder has been late before', 'Two late closings in 5 years. Ask for a cap on closing costs.', true], ['New school planned', 'A public school is planned inside the subdivision.'], ['New-home warranty', '1-, 2- and 7-year Tarion coverage included.']],
    b2: [['Corner lot', 'Bigger side yard and more daylight.'], ['Upgrade credit', '$15,000 design credit if you sign this month.'], ['Near the GO train', 'Milton GO station is 8 minutes by car.']],
    r1: [['Heat and water included', 'Saves about $120 a month.'], ['On the Ossington strip', 'Cafés and shops 2 minutes away.'], ['Laundry in the unit', 'Rare in older buildings.']],
    r2: [['Below the area average', '$250 less than similar units.'], ['Near U of T', '10-minute walk to campus.'], ['Hydro is extra', 'About $90 a month.', true]],
    r3: [['Parking included', 'Worth about $200 a month.'], ['Gym and concierge', 'Building amenities included.'], ['Park next door', 'Fort York and Garrison Common.']]
  };
  const SC = {
    west: ['Toronto District School Board', [['Givins/Shaw Junior PS', 'Public · JK–6', '0.4 km', 7.6, 'Your school'], ['St. Mary Catholic School', 'Catholic · JK–8', '0.6 km', 7.4, ''], ['Central Technical School', 'Public · 9–12', '1.2 km', 6.8, 'Your school'], ['École Pierre-Elliott-Trudeau', 'French · JK–6', '1.5 km', 7.9, '']]],
    lake: ['Toronto District School Board', [['The Waterfront School', 'Public · JK–8', '0.5 km', 7.2, 'Your school'], ['Jarvis Collegiate', 'Public · 9–12', '2.1 km', 7.0, 'Your school'], ['St. Michael’s Choir School', 'Catholic · 3–12', '1.8 km', 8.1, '']]],
    milton: ['Halton District School Board', [['Oakridge PS (planned)', 'Public · JK–8', '0.3 km', 0, 'Opens 2028'], ['Bruce Trail PS', 'Public · JK–8', '1.6 km', 7.3, 'Your school'], ['Craig Kielburger SS', 'Public · 9–12', '2.4 km', 7.5, 'Your school']]]
  };
  const AREA = {
    h1: [['Walk score', '94 · errands on foot'], ['Transit', 'Streetcar 2 min'], ['To downtown', '18 min by transit'], ['Nearest park', '3 min walk']],
    h2: [['Walk score', '91'], ['Transit', 'Dundas streetcar 3 min'], ['To downtown', '22 min'], ['Nearest park', 'Trinity Bellwoods, 6 min']],
    h3: [['Walk score', '93'], ['Transit', 'Dufferin subway 7 min'], ['To downtown', '20 min'], ['Nearest park', '2 min walk']],
    h4: [['Walk score', '96'], ['Transit', 'Bathurst subway 6 min'], ['To downtown', '15 min'], ['Nearest park', '4 min walk']],
    c: [['Walk score', '97'], ['Transit', 'Streetcar at the door'], ['To downtown', '10 min'], ['Waterfront', '1 min walk']],
    b: [['Walk score', '38 · car needed'], ['Transit', 'Milton GO 8 min drive'], ['To Toronto', '55 min by GO'], ['Nearest park', 'Trail at the end of the street']],
    r: [['Walk score', '95'], ['Transit', 'Streetcar 2 min'], ['To downtown', '17 min'], ['Nearest park', '5 min walk']]
  };
  function detail(L) {
    const id = L.id, k = id[0], start = PH.indexOf(L.photo) < 0 ? 0 : PH.indexOf(L.photo);
    const rooms = k === 'c' ? ['Living room', 'Kitchen', 'Bedroom', 'Balcony view'] : k === 'b' ? ['Model home', 'Kitchen', 'Primary suite', 'Lot view'] : ['Front', 'Living room', 'Kitchen', 'Backyard'];
    const orig = ['30% 40%', '70% 50%', '50% 70%', '60% 30%'];
    return {
      tour: rooms.map((name, i) => ({ name, photo: PH[(start + i) % PH.length], o: orig[i] })),
      highlights: HL[id] || HL.h1,
      district: (k === 'b' ? SC.milton : k === 'c' ? SC.lake : SC.west)[0],
      schools: (k === 'b' ? SC.milton : k === 'c' ? SC.lake : SC.west)[1],
      nstats: AREA[id] || AREA[k] || AREA.h1
    };
  }
  const CM = { h1: .025, h2: .025, h3: .02, h4: .025, c1: .025, c2: .02, c3: .025, b1: .02, b2: .02 };
  if (window.KLYR_X && window.KLYR_X.LISTINGS) Object.values(window.KLYR_X.LISTINGS).forEach(a => a.forEach(L => { if (CM[L.id]) L.comm = CM[L.id]; }));
  window.KLYR_X = Object.assign(window.KLYR_X || {}, { detail });
  window.KLYR_DETAIL = detail;
})();
