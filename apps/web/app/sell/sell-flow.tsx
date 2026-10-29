'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { SellProperty, Selling, SellTaskInput, SellTaskKey } from '@klyr/api-client';
import { COOP_CHOICES } from '@klyr/contracts';
import { money, sellerNet, torontoWhen } from '@klyr/core';
import { StepUp } from '@/components/step-up';
import { errorText, klyr } from '@/lib/client';

const TYPES = ['House', 'Townhouse', 'Condo'] as const;
const n = (v: string) => Number(v.replace(/\D/g, '')) || 0;
const pct = (c: number) => `${(c * 100).toFixed(1)}%`;

const STEPS: Record<SellTaskKey, [string, string]> = {
  payout: ['Mortgage payout', 'Your lender and balance, so your lawyer can order the payout statement.'],
  photos: ['Photos and floor plan', 'Your agent books the photographer.'],
  inspection: ['Pre-listing inspection', 'Optional. Your agent can book one so buyers can offer firm.'],
  rules: ['Showings and offer date', 'When buyers can visit, and whether you hold offers.'],
  approve: ['Approve the listing', 'The description and what’s included. Nothing goes live without it.'],
};
const FIELDS: Partial<Record<SellTaskKey, [string, string, boolean?][]>> = {
  payout: [['lender', 'Lender'], ['balance', 'Balance owing']],
  rules: [['showings', 'Showings (e.g. weekdays 5–8 pm, weekends 10–4)'], ['offerDate', 'Offer date (optional, e.g. Tuesday at 7 pm)']],
  approve: [['description', 'Description', true], ['inclusions', 'Included (e.g. fridge, stove, washer, dryer)']],
};
const done = (k: SellTaskKey, d: Record<string, string>) =>
  k === 'payout' ? `${d.lender}, ${money(Number(d.balance))}` : k === 'rules' ? d.showings : k === 'approve' ? 'Approved' : (d.note || 'Done');

/** The seller's side, start to live. Each step is a decision the seller makes; Klyr shows the money. */
export function SellFlow({ selling, legalName, idVerified }: { selling: Selling | null; legalName: string; idVerified: boolean }) {
  if (!selling) return <StartSelling />;
  if (!selling.agreement) return <PlanAndSign s={selling} legalName={legalName} idVerified={idVerified} />;
  return <Prep s={selling} />;
}

function StartSelling() {
  const router = useRouter();
  const [p, setP] = useState<SellProperty & { listPrice: number; mortgageBalance: number }>({ address: '', city: '', type: 'House', beds: 3, baths: 2, listPrice: 0, mortgageBalance: 0 });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = <K extends keyof typeof p>(k: K, v: (typeof p)[K]) => setP(x => ({ ...x, [k]: v }));
  const est = p.listPrice >= 50_000 ? sellerNet({ price: p.listPrice, plan: 'flat', coop: 0.02, mortgageBalance: p.mortgageBalance }) : null;

  async function start() {
    setBusy(true); setError('');
    const r = await klyr.startSelling({ ...p, unit: p.unit || undefined, sqft: p.sqft || undefined, annualTax: p.annualTax || undefined, condoFee: p.condoFee || undefined });
    setBusy(false);
    if (!r.ok) return setError(errorText(r.error));
    router.refresh();
  }

  return (
    <>
      <h1 style={{ margin: 0, fontSize: 28, letterSpacing: '-.02em' }}>Sell your home</h1>
      <p className="k-note" style={{ margin: 0 }}>Tell us about it and see what you keep. You choose the plan and what you offer the buyer’s brokerage.</p>
      <section className="k-card">
        <label className="k-field">Street address<input value={p.address} onChange={e => set('address', e.target.value)} autoComplete="street-address" /></label>
        <div style={{ display: 'flex', gap: 8 }}>
          <label className="k-field" style={{ flex: 1 }}>Unit (optional)<input value={p.unit ?? ''} onChange={e => set('unit', e.target.value)} /></label>
          <label className="k-field" style={{ flex: 2 }}>City<input value={p.city} onChange={e => set('city', e.target.value)} /></label>
        </div>
        <div className="k-label">TYPE</div>
        <div style={{ display: 'flex', gap: 6 }} role="group" aria-label="Type">
          {TYPES.map(t => <button key={t} className="k-chip" aria-pressed={p.type === t} onClick={() => set('type', t)}>{t}</button>)}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <label className="k-field" style={{ flex: 1 }}>Bedrooms<input inputMode="numeric" value={p.beds} onChange={e => set('beds', n(e.target.value))} /></label>
          <label className="k-field" style={{ flex: 1 }}>Bathrooms<input inputMode="numeric" value={p.baths} onChange={e => set('baths', n(e.target.value))} /></label>
          <label className="k-field" style={{ flex: 1 }}>Sq ft (optional)<input inputMode="numeric" value={p.sqft ?? ''} onChange={e => set('sqft', n(e.target.value))} /></label>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <label className="k-field" style={{ flex: 1 }}>Property tax / year<input inputMode="numeric" value={p.annualTax ? p.annualTax.toLocaleString('en-CA') : ''} onChange={e => set('annualTax', n(e.target.value))} /></label>
          {p.type === 'Condo' && <label className="k-field" style={{ flex: 1 }}>Condo fee / month<input inputMode="numeric" value={p.condoFee ? p.condoFee.toLocaleString('en-CA') : ''} onChange={e => set('condoFee', n(e.target.value))} /></label>}
        </div>
      </section>
      <section className="k-card">
        <label className="k-field">Asking price<input inputMode="numeric" value={p.listPrice ? p.listPrice.toLocaleString('en-CA') : ''} onChange={e => set('listPrice', n(e.target.value))} /></label>
        <label className="k-field">Mortgage balance (0 if none)<input inputMode="numeric" value={p.mortgageBalance.toLocaleString('en-CA')} onChange={e => set('mortgageBalance', n(e.target.value))} /></label>
        {est && <div className="k-note">With the Self-directed plan and 2% to the buyer’s brokerage, you’d keep about <strong>{money(est.net)}</strong>.</div>}
      </section>
      {error && <div className="k-error" role="alert">{error}</div>}
      <button className="k-btn" disabled={busy || !p.address.trim() || !p.city.trim() || p.listPrice < 50_000} onClick={start}>See my net and plans</button>
    </>
  );
}

function PlanAndSign({ s, legalName, idVerified }: { s: Selling; legalName: string; idVerified: boolean }) {
  const router = useRouter();
  const [plan, setPlan] = useState(s.plan);
  const [coop, setCoop] = useState(s.coop);
  const [price, setPrice] = useState(s.listPrice);
  const [step, setStep] = useState<'plan' | 'sign'>('plan');
  const [read, setRead] = useState(false);
  const [name, setName] = useState('');
  const [stepUp, setStepUp] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const net = (pl: Selling['plan']) => sellerNet({ price, plan: pl, coop, mortgageBalance: s.mortgageBalance });
  const cur = net(plan);
  const agent = s.agent?.name ?? 'Your agent';

  async function save() {
    setBusy(true); setError('');
    const r = await klyr.setSellPlan({ plan, coop, listPrice: price, mortgageBalance: s.mortgageBalance });
    setBusy(false);
    if (!r.ok) return setError(errorText(r.error));
    setStep('sign');
  }
  async function sign() {
    setBusy(true); setError('');
    const r = await klyr.signListing(name);
    setBusy(false);
    if (r.status === 403 && r.error?.code === 'step_up_required') return setStepUp(true);
    if (!r.ok) return setError(errorText(r.error));
    router.refresh();
  }
  if (stepUp) return <StepUp reason="Signing your listing agreement needs a fresh check." onCancel={() => setStepUp(false)} onDone={() => { setStepUp(false); void sign(); }} />;

  const hero = (
    <section className="k-card" style={{ background: 'var(--ink)', color: '#fff', borderRadius: 20, padding: 18 }} aria-label={`You keep about ${money(cur.net)}`}>
      <div className="k-label" style={{ color: '#8CC2B1' }}>{s.property.address.toUpperCase()}, {s.property.city.toUpperCase()} · YOU KEEP ABOUT</div>
      <div style={{ fontSize: 34, fontWeight: 800, letterSpacing: '-.02em' }}>{money(cur.net)}</div>
      <div style={{ fontSize: 13, color: '#C9DDD6' }}>About {money(cur.vsTraditional)} more than a traditional 2.5% listing side</div>
    </section>
  );
  const rows: [string, number][] = [['Sale price', cur.price], ['Klyr fee incl. HST', -cur.fee], [`Buyer’s brokerage ${pct(coop)} incl. HST`, -cur.coop], ['Lawyer, estimate', -cur.lawyer], ['Mortgage payout', -cur.mortgage]];

  if (step === 'sign') {
    return (
      <>
        <h1 style={{ margin: 0, fontSize: 28, letterSpacing: '-.02em' }}>Your listing agreement</h1>
        <section className="k-card">
          <div className="k-label">OREA FORM 200 · PLAIN-LANGUAGE SUMMARY</div>
          {[
            ['Term', '90 days. You can ask to end it early.'],
            ['Price', `Listed at ${money(price)}. You decide on every offer; Klyr never accepts one for you.`],
            ['Klyr’s fee', plan === 'flat' ? `${money(s.fees.flat)} + HST, Self-directed: you host showings and open houses.` : `${s.fees.percentPct}% of the sale price + HST, Assisted: ${agent} runs showings, open houses and offer night.`],
            ['Buyer’s brokerage', `${pct(coop)} of the sale price + HST, to the brokerage that brings the buyer. You chose this amount.`],
            ['Holdover', '60 days: if someone introduced during the listing buys within 60 days after it ends, the fees are still owed.'],
            ['Multiple representation', 'If a Klyr buyer wants your home, Klyr asks for both sides’ written consent (Form 326) before any offer.'],
          ].map(([k, v], i) => (
            <div key={k} style={{ padding: '8px 0', borderTop: i ? '.5px solid var(--sep)' : 0 }}><strong>{k}</strong><div className="k-note">{v}</div></div>
          ))}
        </section>
        {!idVerified ? (
          <section className="k-card">
            <div className="k-label">● RULE · BEFORE YOU SIGN</div>
            <strong>Verify your ID first</strong>
            <span className="k-note">Brokerages must confirm who their clients are (FINTRAC) before a listing agreement.</span>
            <Link href="/id-check?next=/sell" className="k-btn" style={{ display: 'grid', placeItems: 'center', textDecoration: 'none' }}>Verify my ID</Link>
          </section>
        ) : (
          <section className="k-card">
            <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}><input type="checkbox" checked={read} onChange={e => setRead(e.target.checked)} /> I’ve read the summary. The standard OREA terms apply in full.</label>
            <label className="k-field">Type your full name to sign ({legalName})<input value={name} onChange={e => setName(e.target.value)} autoComplete="name" /></label>
            {error && <div className="k-error" role="alert">{error}</div>}
            <button className="k-btn" disabled={busy || !read || name.trim().length < 2} onClick={sign}>Sign listing agreement</button>
          </section>
        )}
        <button className="k-btn k-alt" onClick={() => setStep('plan')}>Change the plan</button>
      </>
    );
  }

  return (
    <>
      {hero}
      <section className="k-card">
        <div className="k-label">YOUR PLAN</div>
        {(['flat', 'percent'] as const).map(pl => (
          <button key={pl} aria-pressed={plan === pl} onClick={() => setPlan(pl)}
            style={{ textAlign: 'left', padding: 12, borderRadius: 14, border: plan === pl ? '2px solid var(--brand)' : '1px solid var(--sep)', background: 'transparent', cursor: 'pointer', color: 'var(--text)' }}>
            <strong>{pl === 'flat' ? `Self-directed · ${money(s.fees.flat)} + HST` : `Assisted · ${s.fees.percentPct}% + HST`}</strong>
            <div className="k-note">{pl === 'flat' ? 'You host showings and open houses; your agent prices, lists and negotiates.' : `${agent} runs showings, open houses and offer night.`} You keep {money(net(pl).net)}.</div>
          </button>
        ))}
      </section>
      <section className="k-card">
        <div className="k-label">TO THE BUYER’S BROKERAGE · YOUR CHOICE</div>
        <div style={{ display: 'flex', gap: 6 }} role="group" aria-label="Buyer’s brokerage">
          {COOP_CHOICES.map(c => <button key={c} className="k-chip" aria-pressed={coop === c} onClick={() => setCoop(c)}>{pct(c)}</button>)}
        </div>
        <span className="k-note">Most Toronto-area listings offer 2–2.5%. Less can mean fewer buyers’ agents show your home.</span>
        <label className="k-field">Asking price<input inputMode="numeric" value={price.toLocaleString('en-CA')} onChange={e => setPrice(n(e.target.value))} /></label>
      </section>
      <section className="k-card" aria-label="Net proceeds">
        {rows.map(([k, v], i) => (
          <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderTop: i ? '.5px solid var(--sep)' : 0 }}><span>{k}</span><strong>{money(v)}</strong></div>
        ))}
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderTop: '1px solid var(--text)' }}><strong>You keep</strong><strong>{money(cur.net)}</strong></div>
      </section>
      {error && <div className="k-error" role="alert">{error}</div>}
      <button className="k-btn" disabled={busy || price < 50_000} onClick={save}>Continue to the listing agreement</button>
    </>
  );
}

function Prep({ s }: { s: Selling }) {
  const router = useRouter();
  const [open, setOpen] = useState<SellTaskKey | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const live = s.stage !== 'preparing';
  const agent = s.agent?.name ?? 'Your agent';
  const finished = s.tasks.filter(t => t.doneAt).length;

  async function save(key: SellTaskKey) {
    setBusy(true); setError('');
    const clean = Object.fromEntries(Object.entries(form).filter(([, v]) => v.trim()));
    const r = await klyr.sellTask({ key, ...clean, ...(key === 'payout' ? { balance: n(form.balance ?? '') } : {}) } as SellTaskInput);
    setBusy(false);
    if (!r.ok) return setError(errorText(r.error));
    setOpen(null); setForm({});
    router.refresh();
  }
  function edit(key: SellTaskKey) {
    setOpen(key); setError('');
    setForm(key === 'payout' ? { balance: String(s.mortgageBalance) } : key === 'approve' ? { description: `${s.property.beds}-bedroom ${s.property.type.toLowerCase()} in ${s.property.city}.`, inclusions: '' } : {});
  }

  return (
    <>
      <section className="k-card" style={{ background: 'var(--ink)', color: '#fff', borderRadius: 20, padding: 18 }}>
        <div className="k-label" style={{ color: '#8CC2B1' }}>{s.property.address.toUpperCase()}, {s.property.city.toUpperCase()} · {money(s.listPrice)}</div>
        <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-.02em' }}>{live ? 'You’re live' : 'Getting ready'}</div>
        <div style={{ fontSize: 13, color: '#C9DDD6' }}>
          {live ? `Listed ${torontoWhen(s.publishedAt!)} as a Klyr listing. Showing requests and offers come here.`
            : `Agreement signed ${torontoWhen(s.agreement!.signedAt)} · ${s.plan === 'flat' ? 'Self-directed' : 'Assisted'} · ${pct(s.coop)} to the buyer’s brokerage · you keep about ${money(s.net.net)}`}
        </div>
      </section>
      {live && s.listingId && <Link href={`/listings/${s.listingId}`} className="k-btn k-alt" style={{ display: 'grid', placeItems: 'center', textDecoration: 'none' }}>See your listing</Link>}
      <section className="k-card" aria-label="Prep checklist">
        <div className="k-label">{live ? 'PREP' : 'BEFORE YOU GO LIVE'} · {finished} OF {s.tasks.length} DONE</div>
        {s.tasks.map((t, i) => {
          const [title, sub] = STEPS[t.key];
          const agentStep = t.key === 'photos' || t.key === 'inspection';
          return (
            <div key={t.key} style={{ display: 'flex', gap: 10, padding: '8px 0', borderTop: i ? '.5px solid var(--sep)' : 0 }} aria-label={title}>
              <span className="k-dot" aria-hidden style={t.doneAt ? { background: '#2B7A4B', borderColor: '#2B7A4B' } : undefined}>{t.doneAt ? '✓' : ''}</span>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div><strong>{title}</strong>{t.doneAt && <span className="k-note"> · {done(t.key, t.details)} · {torontoWhen(t.doneAt)}</span>}<div className="k-note">{agentStep ? sub.replace('Your agent', agent) : sub}</div></div>
                {!live && !agentStep && open !== t.key && (
                  <button className="k-btn k-alt" style={{ width: 'auto', minHeight: 40, padding: '0 14px', alignSelf: 'flex-start' }} onClick={() => edit(t.key)}>
                    {t.doneAt ? 'Change' : t.key === 'approve' ? 'Review and approve' : 'Add details'}
                  </button>
                )}
                {open === t.key && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {(FIELDS[t.key] ?? []).map(([f, label, long]) => (
                      <label key={f} className="k-field">{label}
                        {long ? <textarea rows={4} value={form[f] ?? ''} onChange={e => setForm(x => ({ ...x, [f]: e.target.value }))} />
                          : <input value={f === 'balance' ? (Number(form[f] || 0)).toLocaleString('en-CA') : form[f] ?? ''} inputMode={f === 'balance' ? 'numeric' : undefined}
                            onChange={e => setForm(x => ({ ...x, [f]: f === 'balance' ? String(n(e.target.value)) : e.target.value }))} />}
                      </label>
                    ))}
                    {error && <div className="k-error" role="alert">{error}</div>}
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="k-btn" disabled={busy} onClick={() => save(t.key)}>{t.key === 'approve' ? 'Approve' : 'Save'}</button>
                      <button className="k-btn k-alt" disabled={busy} onClick={() => setOpen(null)}>Back</button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
        {!live && <span className="k-note">{agent} publishes it once you’ve approved the listing and the photos are in.</span>}
      </section>
    </>
  );
}
