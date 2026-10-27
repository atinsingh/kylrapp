// Guided buyer journey (house, condo): 11 steps, next-step UI, day-by-day plan. Shared by the web and mobile apps.
window.KLYR_GUIDED = function (self, c) {
  const { st, p, m, K, X, pick, results, shows, go } = c;
  const pk = p.picked || {};
    const guided = st.j === 'house' || st.j === 'condo';
    const SG = pick.stages, fl = p.flags || {}, cd = p.cond || {}, price = (p.home && p.home.price) || pick.price, dep = Math.round(price * .05);
    const at = (i, d) => SG[i].a + (d || 0);
    const setT = (t, extra) => self.upd(cur => ({ t: Math.max(cur.t, t), ...(extra ? extra(cur) : {}) }));
    const U = p.ui || {}, setU = (k, v) => self.upd(cur => ({ ui: { ...(cur.ui || {}), [k]: v } }));
    const ask = p.home ? (p.home.ask || p.home.price) : pick.price, offer = U.offer || ask, depO = Math.round((fl.offer ? price : offer) * .05), safeFin = U.safeFin !== false, safeIns = U.safeIns !== false;
    const REC = { mortgage: 'northgate', lawyer: 'chen', inspector: 'clearview', insurance: 'coastline' };
    const flash = t => { clearTimeout(self._tt); self.setState({ toast: t }); self._tt = setTimeout(() => self.setState({ toast: '' }), 2600); };
    const chooser = svc => (X.PROVIDERS[svc] || []).map(o => { const rec = REC[svc] === o[0]; return { name: o[1], meta: o[2], price: o[3], stat: o[4], rating: o[5].toFixed(1), rec, bd: rec ? '2px solid var(--tint)' : '.5px solid var(--sep)', btnBg: rec ? 'var(--tint)' : 'var(--fill)', btnFg: rec ? 'var(--onTint)' : 'var(--label)',
      pick: () => { self.upd(cur => ({ picked: { ...(cur.picked || {}), [svc]: o[0] }, log: self.logIt('Connected with ' + o[1]) })); flash('Connected with ' + o[1]); } }; });
    const pv = svc => pk[svc] ? X.prov(svc, pk[svc]).name : '';
    const isCondo = st.j === 'condo';
    const cb = m.usp ? m.usp.amt : '';
    const lo = K.fmt$(Math.round(price * .97 / 5000) * 5000), hi = K.fmt$(Math.round(price * 1.01 / 5000) * 5000);
    const STEPS = !guided ? [] : [
      { id: 'home', ph: 'FIND YOUR HOME', short: 'Find and visit homes', t: 'Find a home you love', why: 'Tell Klyr AI what you want and book visits. Before your first visit you sign a buyer agreement with Klyr, as RECO requires. When you find the one, tap “I want this one”.', done: !!p.home, sub: p.home ? p.home.addr : '', btn: 'Start searching', run: go('search'), noFlash: true,
        tip: 'Homes under the area median here sell in about 9 days. Book visits early in the week.' },
      { id: 'offer', short: 'Make an offer', t: 'Make an offer', why: 'Klyr writes the offer for you. You choose the price. We add two safety checks so you can still walk away if the mortgage or the ' + (isCondo ? 'building records' : 'inspection') + ' don’t work out.', done: !!fl.offer, sub: fl.offer ? K.fmt$(price) + ' · safety checks added' : '', btn: 'Send my offer at ' + K.fmt$(offer), ok: 'Offer sent',
        run: () => setT(at(1, .5), cur => ({ home: { ...(cur.home || {}), price: offer }, flags: { ...cur.flags, offer: true }, signed: { ...cur.signed, [isCondo ? '101' : '100']: true, '320': true }, log: self.logIt('Sent an offer at ' + K.fmt$(offer)) })),
        tip: 'Similar homes sold for ' + lo + ' to ' + hi + '. Most sellers here accept 5 days of safety checks.' },
      { id: 'deposit', short: 'Pay your deposit', t: 'Accepted! Now pay your deposit', why: 'Your deposit is ' + K.fmt$(dep) + ' (5% of the price). It’s held safely in trust and counts toward what you pay. Send it within 24 hours.', done: !!fl.deposit, sub: fl.deposit ? K.fmt$(dep) + ' paid' : '', btn: 'Pay ' + K.fmt$(dep), ok: 'Deposit paid', clock: 'Due in 24 hours',
        run: () => setT(at(2, .2), cur => ({ flags: { ...cur.flags, deposit: true }, log: self.logIt('Paid the ' + K.fmt$(dep) + ' deposit') })),
        tip: 'Send it by wire or bank draft and keep the receipt. Your lawyer will ask for it.' },
      { id: 'mortgage', ph: 'SECURE THE DEAL', short: 'Get your mortgage approved', t: pk.mortgage ? 'Waiting for your mortgage approval' : U.qAsked ? 'Compare your mortgage quotes' : 'Get mortgage quotes', why: pk.mortgage ? pv('mortgage') + ' is getting final approval from the lender. This usually takes 2 to 4 days.' : U.qAsked ? 'Talk to each advisor, ask them to beat the best rate, then choose one. It’s free for you.' : 'Pick the advisors you want to hear from. Klyr sends your details once and each one sends you a quote.', done: !!fl.mApproved, sub: pk.mortgage ? pv('mortgage') + (fl.mApproved ? ' · approved' : ' · working on it') : '', cond: 'fin',
        pickSvc: null, btn: pk.mortgage && ['stubs','job','id','dp'].every(k => (U.docs || {})[k]) ? 'Mark as approved' : '', ok: 'Mortgage approved', run: () => setT(at(2, 3), cur => ({ flags: { ...cur.flags, mApproved: true }, log: self.logIt('Mortgage approved by ' + pv('mortgage')) })),
        tip: pk.mortgage ? 'Upload two pay stubs and a job letter today. Missing papers are the most common delay.' : (U.qAsked ? 'The lowest rate isn’t always best. Check how much extra you can pay down each year and how fast they approve.' : 'Asking 3 or 4 advisors usually gets you a better rate. Only the one you choose runs a full credit check.') },
      { id: 'fin', short: 'Confirm your financing', t: 'Tell the seller you’re approved', why: 'This removes your mortgage safety check. After this you can’t walk away because of the mortgage.', done: !!cd.fin || (fl.offer && !safeFin), sub: cd.fin ? 'Mortgage check removed' : (fl.offer && !safeFin ? 'Skipped · no mortgage check' : ''), btn: 'Send the good news', ok: 'Seller told', cond: 'fin',
        run: () => self.upd(cur => ({ cond: { ...cur.cond, fin: 'fulfilled' }, signed: { ...cur.signed, '124': true }, log: self.logIt('Removed the mortgage check') })),
        tip: 'Only do this once you have the approval letter in hand, not just a pre-approval.' },
      isCondo
        ? { id: 'check', short: 'Check the building', t: pk.lawyer ? 'Your lawyer is reading the building’s records' : 'Choose a lawyer to check the building', why: 'They read the condo’s records: its savings fund, planned repairs and rules. The condo charges at most $100.', done: !!fl.checked, sub: pk.lawyer ? pv('lawyer') : '', cond: 'sc', pickSvc: pk.lawyer ? null : 'lawyer', btn: pk.lawyer ? 'The records look good' : '', ok: 'Building checked', run: () => self.upd(cur => ({ flags: { ...cur.flags, checked: true }, log: self.logIt('Building records reviewed') })),
            tip: 'Watch for a savings fund under $1,000 per unit or a large repair bill planned in the next 2 years.' }
        : { id: 'check', short: 'Get the home inspected', t: pk.inspector ? (U.inspSlot ? 'Your inspection report is ready' : 'Pick a time for your inspection') : 'Book a home inspector', why: pk.inspector ? pv('inspector') + ' checks the roof, wiring, plumbing and foundation. You get the report the same day.' : 'An inspector looks for problems before you commit. About $500.', done: !!fl.checked || (fl.offer && !safeIns), sub: fl.offer && !safeIns ? 'Skipped · no inspection' : pk.inspector ? pv('inspector') + (fl.checked ? ' · report read' : U.inspSlot ? ' · ' + U.inspSlot : '') : '', cond: 'ins',
            pickSvc: pk.inspector ? null : 'inspector', btn: pk.inspector && U.inspSlot ? 'I’ve read the report' : '', ok: 'Report reviewed', run: () => self.upd(cur => ({ flags: { ...cur.flags, checked: true }, log: self.logIt('Inspection report reviewed') })),
            tip: pk.inspector ? 'Go along if you can. It takes 2 to 3 hours and you can ask questions on the spot.' : 'ClearView adds a sewer camera check. Older Toronto homes often have clay pipes.' },
      { id: 'lock', short: 'Lock in your purchase', t: 'Happy? Lock in your purchase', why: 'This removes your last safety check. The home is then yours to buy, with no backing out.', done: !!cd[isCondo ? 'sc' : 'ins'] || (fl.offer && !isCondo && !safeIns), sub: cd[isCondo ? 'sc' : 'ins'] ? 'Purchase locked in' : '', btn: U.lock === 'fix' ? 'Send my request' : 'Sign and lock it in', alt: '', ok: 'Purchase locked in', cond: isCondo ? 'sc' : 'ins',
        run: U.lock === 'fix' ? () => { self.upd(() => ({ log: self.logIt('Asked the seller for a $' + (U.fix || 5000).toLocaleString('en-CA') + ' price reduction') })); setU({ lock: 'ok' }); } : () => setT(at(3, .2), cur => ({ cond: { ...cur.cond, [isCondo ? 'sc' : 'ins']: 'waived' }, signed: { ...cur.signed, '123': true }, log: self.logIt('Locked in the purchase') })),
        altRun: () => { self.upd(() => ({ log: self.logIt('Asked my agent to negotiate a repair') })); flash('Your agent will ask the seller'); self.setState({ view: 'room' }); },
        tip: 'If the report found problems, your agent can ask for a lower price or a repair credit instead.' },
      { id: 'lawyer', ph: 'MOVE IN', short: 'Choose your lawyer', t: pk.lawyer ? 'Send your file to ' + pv('lawyer') : 'Choose your lawyer', why: 'Your lawyer makes the home legally yours, handles the money and registers it in your name.', done: !!pk.lawyer && p.t >= at(4), sub: pk.lawyer ? pv('lawyer') : '', pickSvc: pk.lawyer ? null : 'lawyer', btn: pk.lawyer ? 'Send my file' : '', ok: 'File sent to your lawyer', run: () => setT(at(4, 1)),
        tip: 'Flat fees include the title search and registration. Your lawyer also claims the first-time buyer tax refund.' },
      { id: 'ins', short: 'Get home insurance', t: 'Get home insurance', why: 'Your lender needs proof of insurance before closing day. Pick one and we send it to your lawyer.', done: !!pk.insurance, sub: pk.insurance ? pv('insurance') : '', pickSvc: 'insurance', btn: '',
        tip: 'Add sewer backup cover. Bundling with car insurance usually saves 10 to 15%.' },
      { id: 'sign', short: 'Sign closing papers', t: 'Sign your closing papers', why: 'Meet your lawyer in person or on video, sign, and send the rest of your down payment.', done: !!fl.signedClose, sub: fl.signedClose ? 'Signed' : '', btn: '', ok: 'Signing booked', run: () => setT(at(5, 1), cur => ({ flags: { ...cur.flags, signedClose: true }, signed: { ...cur.signed, LTT: true, DIR: true }, log: self.logIt('Signed closing papers') })),
        tip: 'Bring two pieces of ID. Send the down payment a day early so it clears in time.' },
      { id: 'keys', short: 'Get your keys', t: 'Get your keys', why: 'On closing day your lawyer registers the home in your name' + (cb ? ' and your ' + cb + ' cash back is paid.' : '.'), done: m.done, btn: 'It’s closing day', noFlash: true, run: () => { self.stop(); self.upd(() => ({ t: SG[SG.length - 1].b })); },
        tip: 'Book movers and transfer hydro, gas and internet for the same day.' }
    ];
    const byId = id => STEPS.find(x => x.id === id);
    if (guided) {
      const so = byId('offer');
      so.btn = 'Send my offer at ' + K.fmt$(offer);
      so.run = () => setT(at(1, .5), cur => ({ flags: { ...cur.flags, offer: true }, home: { ...(cur.home || {}), ask, price: offer }, ui: { ...(cur.ui || {}), accDay: Math.floor(Math.max(cur.t, at(1, .5))) + 1 }, signed: { ...cur.signed, [isCondo ? '101' : '100']: true, '320': true }, log: self.logIt('Sent an offer at ' + K.fmt$(offer)) }));
      if (fl.offer && U.safeFin === false) { const f2 = byId('fin'); f2.done = true; f2.sub = 'No mortgage check in offer'; }
      if (fl.offer && U.safeIns === false) { ['check', 'lock'].forEach(k => { const z = byId(k); z.done = true; z.sub = 'Skipped'; }); }
    }
    let dplan = null, PLAN = [], A = 0;
    const finD = U.finDays || 5, insD = U.insDays || (isCondo ? 5 : 7), clD = U.close || 60;
    if (guided) {
      A = fl.offer ? (U.accDay || SG[2].a) : Math.floor(p.t) + 1;
      const firm = Math.max(safeFin ? finD : 0, safeIns ? insD : 0, 1) + 1, af = d => Math.max(firm + 1, d);
      PLAN = [
        [0, 'offer', 'Offer accepted', 'Your agent confirms in writing. Every date below counts from today.'],
        [1, 'deposit', 'Deposit due', K.fmt$(depO) + ' by wire or bank draft, within 24 hours', true],
        [1, 'mortgage', 'Send your mortgage papers', 'Pay stubs, job letter, ID and proof of down payment'],
        ...(isCondo ? [[2, null, 'Status certificate arrives', 'Your lawyer starts reading the building’s records']] : safeIns ? [[Math.max(2, insD - 3), 'check', 'Home inspection', 'About 2 to 3 hours. Go along if you can.']] : []),
        ...(safeFin ? [[finD, 'fin', 'Mortgage check ends', 'Tell the seller you’re approved by 11:59 pm', true]] : []),
        ...(safeIns ? [[insD, 'lock', isCondo ? 'Building records check ends' : 'Inspection check ends', 'Lock it in, ask for a repair credit, or walk away', true]] : []),
        [firm, 'lawyer', 'Your deal is firm', 'Klyr sends the signed agreement to your lawyer'],
        [af(clD - 30), 'ins', 'Choose home insurance', 'Your lender needs proof before closing'],
        [af(clD - 21), null, 'Book movers and utilities', 'Hydro, gas, water and internet for closing day'],
        [af(clD - 10), null, 'Title search done', 'Your lawyer checks there are no debts registered on the home'],
        [af(clD - 5), null, 'Mortgage funds ready', 'Your lender sends the money to your lawyer'],
        [af(clD - 3), 'sign', 'Sign your closing papers', 'Bring two pieces of ID. About an hour with your lawyer.'],
        [af(clD - 1), null, 'Final walk-through', 'Send the rest of your down payment, then visit the home with your agent'],
        [clD, 'keys', 'Closing day · get your keys', 'Registered in your name by 2 pm' + (cb ? '. Your ' + cb + ' cash back is paid.' : '.')]
      ].sort((a, b) => a[0] - b[0]);
      const fu = PLAN.findIndex(x => x[1] && !(byId(x[1]) || {}).done);
      dplan = { sub: fl.offer ? 'Closing ' + K.dateOf(A + clD) + ' · ' + clD + ' days after acceptance' : 'Preview if your offer is accepted ' + K.dateOf(A) + '. It updates when you change your move-in date or safety checks.',
        items: PLAN.map(([d, sid, t, sub, dl], i) => { const done = fu < 0 || i < fu, now = i === fu;
          return { t, sub, day: 'Day ' + d, date: K.dateOf(A + d), isDl: !!dl && !done, fw: now ? 700 : 600, fg: done ? 'var(--label2)' : 'var(--label)', rowBg: now ? 'var(--tintSoft)' : 'transparent',
            dotBg: done ? 'var(--tint)' : now ? 'var(--card)' : 'transparent', dotBd: done ? '0' : now ? '3px solid var(--tint)' : '1.5px solid var(--label3)' }; }) };
    }
    const curI = STEPS.findIndex(x => !x.done);
    const steps = STEPS.map((x, i) => ({ short: x.short, ph: x.ph || '', hasPh: !!x.ph, sub: x.sub || (i === curI ? 'Now' : ''), hasSub: !!(x.sub || i === curI), done: x.done, dotBg: x.done ? 'var(--tint)' : i === curI ? 'var(--card)' : 'transparent', dotBd: x.done ? '0' : i === curI ? '2px solid var(--tint)' : '1.5px solid var(--label3)', fg: x.done ? 'var(--label2)' : 'var(--label)', fw: i === curI ? 700 : 500, rowBg: i === curI ? 'var(--tintSoft)' : 'transparent' }));
    const nx = curI >= 0 ? STEPS[curI] : null;
    let uiK = '', ui = {};
    const bt = i => i ? '.5px solid var(--sep)' : '0';
    const chip = (on) => ({ bg: on ? 'var(--tint)' : 'var(--card)', fg: on ? 'var(--onTint)' : 'var(--label)', bd: on ? '2px solid var(--tint)' : '.5px solid var(--sep)' });
    const tog = (on, fn) => ({ on, off: !on, bg: on ? 'var(--ok)' : 'var(--fill)', x: on ? 22 : 2, dotBg: on ? 'var(--tint)' : 'transparent', dotBd: on ? '0' : '1.5px solid var(--label3)', toggle: fn });
    if (nx) {
      const id = nx.id;
      if (id === 'home') { uiK = 'Home'; const pr = results.slice(0, 3); ui.feat = pr[0] ? { ...pr[0], reasons: (pr[0].ai || '').split(/\.\s+/).filter(Boolean).slice(0, 2).map(t => ({ t: t.replace(/\.$/, '') })) } : null; ui.hasFeat = !!ui.feat; ui.more = pr.slice(1); ui.nAll = results.length;
        ui.visits = Object.keys(shows).map((vid, i) => { const L = results.find(r => r.id === vid) || {}; return { addr: L.addr || '', slot: shows[vid].slot, photo: L.photo, bt: i ? '.5px solid var(--sep)' : '0', open: () => self.openDetail(vid) }; }); ui.hasVisits = ui.visits.length > 0; }
      if (id === 'offer') {
        uiK = 'Offer'; const r = offer / ask, mn = Math.round(ask * .9 / 5000) * 5000, mx = Math.round(ask * 1.08 / 5000) * 5000;
        const ch = r >= 1.02 ? ['Strong chance', 'var(--ok)', 'var(--okSoft)'] : r >= .98 ? ['Good chance', 'var(--tint)', 'var(--tintSoft)'] : r >= .95 ? ['Fair chance', 'var(--warn)', 'var(--warnSoft)'] : ['Low chance', 'var(--warn)', 'var(--warnSoft)'];
        const cl = U.close || 60;
        Object.assign(ui, { offer, offerFmt: K.fmt$(offer), min: mn, max: mx, minFmt: K.fmt$(mn), maxFmt: K.fmt$(mx), askFmt: K.fmt$(ask), setOffer: e => setU('offer', +e.target.value),
          chance: ch[0], chanceFg: ch[1], chanceBg: ch[2], depFmt: K.fmt$(depO), cbFmt: K.fmt$(offer * ((p.home && p.home.comm) || .022) * ((p.dec || {}).self ? .8 : .6)), closeFmt: K.dateOf(SG[1].a + cl).replace(/^\w+, /, ''),
          closes: [30, 60, 90].map(d => ({ t: d + ' days', ...chip(cl === d), pick: () => setU('close', d) })),
          safe: [['safeFin', 'Mortgage check', 'Walk away if your mortgage isn’t approved in ' + finD + ' days', 'finDays', finD, [3, 5]], ['safeIns', isCondo ? 'Building records check' : 'Inspection check', isCondo ? 'Walk away if the condo’s records show problems within ' + insD + ' days' : 'Walk away if the inspection finds problems within ' + insD + ' days', 'insDays', insD, isCondo ? [5, 7] : [5, 7, 10]]].map(([k, t, sub, dk, dv, opts], i) => { const on = U[k] !== false; return { t, sub: on ? sub : 'Off · stronger offer, more risk', bt: bt(i), days: on ? opts.map(n => ({ t: n + ' days', ...chip(dv === n), pick: () => setU(dk, n) })) : [], ...tog(on, () => setU(k, !on)) }; }) });
      }
      if (id === 'deposit') {
        uiK = 'Deposit'; const dm = U.dep || 'klyr';
        ui.depFmt = K.fmt$(dep);
        ui.methods = [['klyr', 'Klyr Pay', 'Instant, from your bank'], ['wire', 'Wire transfer', 'Same day, bank fee applies'], ['draft', 'Bank draft', 'Drop off at the brokerage']].map(([k, t, sub]) => ({ t, sub, ...chip(dm === k), bg: dm === k ? 'var(--tintSoft)' : 'var(--card)', pick: () => setU('dep', k) }));
        nx.btn = 'Pay ' + K.fmt$(dep) + (dm === 'klyr' ? ' with Klyr Pay' : '');
      }
      if (id === 'mortgage' && !pk.mortgage) {
        uiK = 'Quotes'; const QS = X.QUOTES, provs = X.PROVIDERS.mortgage, sel = U.qSel || provs.map(o => o[0]), match = U.qMatch || {}, calls = U.qCall || {};
        const loan = price * .8, pay = r => { const i = r / 100 / 12; return loan * i / (1 - Math.pow(1 + i, -300)); };
        const got = provs.filter(o => sel.includes(o[0]));
        const baseBest = Math.min(...got.map(o => QS[o[0]][0]));
        const rows = got.map(o => { const q = QS[o[0]], r = match[o[0]] ? Math.max(baseBest - .05, q[0] - .15) : q[0]; return { id: o[0], name: o[1], kind: o[2], who: q[3], rate: r, prepay: q[1], days: q[2], matched: !!match[o[0]] }; });
        const minR = Math.min(...rows.map(r => r.rate)), maxR = Math.max(...rows.map(r => r.rate));
        const score = r => (maxR - r.rate) * 40 + r.prepay * .25 - r.days * .8, bestId = rows.length ? rows.slice().sort((a, b) => score(b) - score(a))[0].id : '';
        const quotes = rows.sort((a, b) => a.rate - b.rate).map((r, i) => ({ ...r, rateFmt: r.rate.toFixed(2) + '%', monthly: K.fmt$(pay(r.rate)), save: r.rate > minR ? '+' + K.fmt$((pay(r.rate) - pay(minR)) * 60) + ' over 5 yrs' : 'Lowest rate', saveFg: r.rate > minR ? 'var(--label2)' : 'var(--ok)', prepayFmt: r.prepay + '% a year', daysFmt: r.days + ' days', best: r.id === bestId, bt: i ? '.5px solid var(--sep)' : '0', bd: r.id === bestId ? '2px solid var(--tint)' : '.5px solid var(--sep)',
          canMatch: !r.matched && r.rate > minR, isMatched: r.matched, callLabel: calls[r.id] ? 'Call booked · ' + calls[r.id] : 'Book a call', callDone: !!calls[r.id],
          askMatch: () => { setU('qMatch', { ...match, [r.id]: true }); flash(r.name + ' lowered their rate'); },
          call: () => { if (!calls[r.id]) { setU('qCall', { ...calls, [r.id]: X.SLOTS[1] }); flash('Call booked with ' + r.who); } },
          choose: () => { self.upd(cur => ({ picked: { ...(cur.picked || {}), mortgage: r.id }, log: self.logIt('Chose ' + r.name + ' at ' + r.rate.toFixed(2) + '%') })); flash('Connected with ' + r.name + ' · next: send your papers'); } }));
        const bq = quotes.find(q => q.best) || quotes[0];
        ui = { asked: !!U.qAsked, notAsked: !U.qAsked, loanFmt: K.fmt$(loan), quotes, nSel: sel.length,
          pickList: provs.map((o, i) => { const on = sel.includes(o[0]); return { name: o[1], kind: o[2], rating: o[5].toFixed(1), on, bt: i ? '.5px solid var(--sep)' : '0', dotBg: on ? 'var(--tint)' : 'transparent', dotBd: on ? '0' : '1.5px solid var(--label3)', toggle: () => setU('qSel', on ? sel.filter(x => x !== o[0]) : [...sel, o[0]]) }; }),
          ask: () => { if (!sel.length) return; setU('qAsked', true); flash(sel.length + ' quotes are in'); }, edit: () => setU('qAsked', false),
          aiQ: bq ? bq.name + ' is the best fit: ' + bq.rateFmt + ', ' + bq.prepayFmt + ' extra payments, approval in ' + bq.daysFmt + '. ' + (quotes.some(q => q.canMatch) ? 'Ask the others to match the lowest rate before you choose.' : 'Everyone has matched. Pick the one you trust most.') : '' };
      }
      if (id === 'mortgage' && pk.mortgage) {
        uiK = 'Docs'; const D = U.docs || {};
        const list = [['stubs', 'Two recent pay stubs', 'PDF or photo'], ['job', 'Job letter', 'Salary and start date'], ['id', 'Photo ID', 'Driver’s licence or passport'], ['bank', 'Down payment proof', '90 days of bank statements']];
        const n = list.filter(d => D[d[0]]).length;
        ui.docs = list.map(([k, t, sub], i) => ({ t, sub, bt: bt(i), ...tog(!!D[k], () => self.upd(cur => ({ ui: { ...(cur.ui || {}), docs: { ...((cur.ui || {}).docs || {}), [k]: true } } }))) }));
        ui.docsDone = n; ui.docsAll = list.length; ui.docsMissing = n < list.length; ui.lender = pv('mortgage').toUpperCase();
        const tk = n === 0 ? 0 : n < list.length ? 1 : 2;
        ui.track = ['Advisor connected', 'Papers sent', 'Lender review', 'Approved'].map((t, i) => ({ t, bg: i <= tk ? 'var(--tint)' : 'var(--fill)', fg: i <= tk ? 'var(--label)' : 'var(--label3)', fw: i === tk ? 700 : 500 }));
        if (n < list.length) nx.btn = ''; else nx.btn = 'Lender approved me';
      }
      if (id === 'fin') { uiK = 'Sign'; Object.assign(ui, { formName: 'Mortgage approved notice · Form 124', formTo: 'the seller’s agent', formPlain: 'You confirm your mortgage is approved, so your mortgage safety check is met.' }); nx.btn = 'Sign and send'; }
      if (id === 'check') {
        const who = isCondo ? pk.lawyer : pk.inspector;
        if (who && !isCondo && !U.inspSlot) { uiK = 'Slots'; Object.assign(ui, { slotTitle: 'PICK A TIME FOR THE INSPECTION', slots: X.SLOTS.map(t => ({ t, ...chip(false), bg: 'var(--card)', pick: () => { setU('inspSlot', t); flash('Inspection booked · ' + t); } })) }); nx.btn = ''; }
        else if (who) {
          uiK = 'Report';
          ui.repTitle = isCondo ? 'BUILDING RECORDS SUMMARY' : 'INSPECTION REPORT SUMMARY'; ui.repBy = (isCondo ? pv('lawyer') : pv('inspector') + ' · ' + U.inspSlot);
          const F = isCondo ? [['Savings fund', '$2.1M, about $6,800 per unit. Healthy.', 'Good', 'var(--ok)'], ['Planned repairs', 'Elevator upgrade 2027, already funded.', 'Good', 'var(--ok)'], ['Monthly fees', 'Up 3% last year, in line with the area.', 'Normal', 'var(--tint)'], ['Rules', 'Pets allowed. No short-term rentals.', 'Note', 'var(--label3)']]
            : [['Roof', 'About 8 years old. 10 to 15 years left.', 'Good', 'var(--ok)'], ['Electrical', '100-amp panel. Fine today; upgrade if you add an EV charger.', 'Note', 'var(--tint)'], ['Plumbing', 'Small leak under the kitchen sink. About $200 to fix.', 'Minor', 'var(--warn)'], ['Foundation', 'Hairline crack in the basement. Common; keep an eye on it.', 'Minor', 'var(--warn)']];
          ui.findings = F.map(([t, sub, tag, dot], i) => ({ t, sub, tag, dot, bt: bt(i) }));
        }
      }
      if (id === 'lock') {
        uiK = 'Lock'; const lk = U.lock || 'happy';
        ui.offerFmt = K.fmt$(price);
        ui.lockOpts = [['happy', 'Everything looks good', 'Sign and lock in'], ['price', 'Ask for a lower price', 'Your agent asks for $5,000 off'], ['repair', 'Ask for a repair', 'Seller fixes it before closing']].map(([k, t, sub]) => ({ t, sub, ...chip(lk === k), bg: lk === k ? 'var(--tintSoft)' : 'var(--card)', pick: () => setU('lock', k) }));
        ui.lockSign = lk === 'happy';
        if (lk === 'happy') nx.btn = 'Sign and lock in';
        else { nx.btn = 'Send request to seller'; nx.noFlash = true; nx.run = () => { self.upd(cur => ({ ui: { ...(cur.ui || {}), lock: 'happy' }, home: lk === 'price' ? { ...cur.home, price: cur.home.price - 5000 } : cur.home, log: self.logIt(lk === 'price' ? 'Seller agreed to $5,000 off' : 'Seller agreed to fix the plumbing leak') })); flash(lk === 'price' ? 'Seller agreed to $5,000 off' : 'Seller agreed to the repair'); }; }
        nx.alt = ''; nx.altRun = null;
      }
      if (id === 'lawyer' && pk.lawyer) { uiK = 'List'; ui.listTitle = 'WHAT ' + pv('lawyer').toUpperCase() + ' WILL DO'; ui.list = ['Check nobody else has a claim on the home', 'Work out property tax and fee adjustments', 'Claim your first-time buyer tax refund', 'Register the home in your name'].map((t, i) => ({ t, v: '', bt: bt(i), ...tog(false) })); }
      if (id === 'sign') {
        uiK = 'Slots'; const md = U.signMode || 'video', ss = U.signSlot;
        const down = Math.max(0, price * .2 - dep);
        Object.assign(ui, { hasMode: true, modes: [['video', 'Video call'], ['person', 'In person']].map(([k, t]) => ({ t, bg: md === k ? 'var(--card)' : 'transparent', sh: md === k ? '0 1px 3px rgba(0,0,0,.15)' : 'none', pick: () => setU('signMode', k) })),
          slotTitle: 'PICK A TIME WITH ' + (pv('lawyer') || 'YOUR LAWYER').toUpperCase(), slots: X.SLOTS.map(t => ({ t, ...chip(ss === t), bg: ss === t ? 'var(--tintSoft)' : 'var(--card)', pick: () => setU('signSlot', t) })),
          hasBring: true, bring: [['Two pieces of ID', ''], ['Rest of your down payment', K.fmt$(down)], ['Closing costs', m.sumAll]].map(([t, v], i) => ({ t, v, bt: bt(i) })) });
        nx.btn = ss ? 'Book ' + ss + (md === 'video' ? ' by video' : '') : '';
      }
      if (id === 'keys') { uiK = 'List'; ui.listTitle = 'CLOSING DAY'; ui.list = [['Home registered in your name', 'by 2:00 pm'], ['Keys ready at your lawyer’s office', ''], ['Cash back paid to you', cb]].map(([t, v], i) => ({ t, v, bt: bt(i), ...tog(false) })); }
    }
    let clock = nx && nx.clock ? nx.clock : '', urgent = !!(nx && nx.clock);
    if (nx && nx.cond) { const c = m.conds.find(z => z.id === nx.cond); if (c && c.status === 'open') { const d = parseInt(c.label, 10); clock = d + (d === 1 ? ' day' : ' days') + ' left to decide'; urgent = d <= 2; } }
    if (nx && fl.offer && guided) { const due = PLAN.find(z => z[1] === (nx.id === 'mortgage' ? 'fin' : nx.id)); if (due && nx.id !== 'deposit') { const left = A + due[0] - Math.floor(p.t); clock = (left > 0 ? left + (left === 1 ? ' day left' : ' days left') : 'Due today') + ' · ' + K.dateOf(A + due[0]); urgent = left <= 2; } }
    const wrap = x => () => { x.run(); if (!x.noFlash) flash((x.ok || 'Done') + (STEPS[curI + 1] ? ' · Next: ' + STEPS[curI + 1].short.toLowerCase() : '')); };
    const next = nx ? { isHome: uiK === 'Home', isOffer: uiK === 'Offer', isDeposit: uiK === 'Deposit', isDocs: uiK === 'Docs', isSign: uiK === 'Sign', isSlots: uiK === 'Slots', isReport: uiK === 'Report', isLock: uiK === 'Lock', isList: uiK === 'List', isQuotes: uiK === 'Quotes', t: nx.t, why: nx.why, btn: nx.btn, hasBtn: !!nx.btn && !!nx.run, run: nx.run ? wrap(nx) : () => {}, alt: nx.alt || '', hasAlt: !!nx.alt, altRun: nx.altRun || (() => {}), opts: nx.pickSvc ? chooser(nx.pickSvc) : [], hasOpts: !!nx.pickSvc, tip: nx.tip,
      clock, hasClock: !!clock, clockFg: urgent ? 'var(--warn)' : 'var(--tint)', clockBg: urgent ? 'var(--warnSoft)' : 'var(--tintSoft)' } : null;
    const doneCount = STEPS.filter(x => x.done).length;
    const phases = [];
    STEPS.forEach((x, i) => { if (x.ph || !phases.length) phases.push({ l: (x.ph || '').charAt(0) + (x.ph || '').slice(1).toLowerCase(), segs: [] }); const P = phases[phases.length - 1]; P.segs.push({ t: x.short, bg: x.done ? 'var(--tint)' : i === curI ? 'color-mix(in oklab, var(--tint) 45%, var(--fill))' : 'var(--fill)' }); });
    phases.forEach(P => { const on = P.segs.some((g, k) => g.bg !== 'var(--fill)'); P.n = P.segs.length; P.fg = on ? 'var(--label)' : 'var(--label2)'; });
  return { guided, SG, fl, cd, U, setU, setT, at, price, dep, depO, pv, flash, isCondo, cb, chooser, STEPS, byId, curI, steps, nx, next, ui, dplan, PLAN, A, phases, doneCount, curShort: curI >= 0 ? STEPS[curI].short : 'All done' };
};
