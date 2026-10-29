'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { LeaseProperty, Leasing } from '@klyr/api-client';
import { landlordNet, money, RENT_CONTROL_CUTOFF, rentControlled, TENANT_SIDE_CHOICES, torontoWhen } from '@klyr/core';
import { StepUp } from '@/components/step-up';
import { errorText, klyr } from '@/lib/client';
import { consent326 } from '../offer/[id]/consent';

const n = (v: string) => Number(v.replace(/\D/g, '')) || 0;
const SIDE: Record<number, string> = { 0: 'None', 0.5: 'Half a month', 1: 'One month' };
const STATUS = { submitted: 'Waiting for you', accepted: 'Chosen', declined: 'Not chosen', withdrawn: 'Withdrawn' } as const;

export function LeaseFlow({ leasing, legalName }: { leasing: Leasing | null; legalName: string }) {
  if (!leasing) return <Start />;
  if (!leasing.agreement) return <PlanAndSign l={leasing} legalName={legalName} />;
  return <Live l={leasing} legalName={legalName} />;
}

function Start() {
  const router = useRouter();
  const [p, setP] = useState<LeaseProperty & { rent: number; availableFrom: string }>({ address: '', city: '', type: 'Condo', beds: 1, baths: 1, firstOccupied: '', parking: '', utilities: '', furnished: false, description: '', rent: 0, availableFrom: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = <K extends keyof typeof p>(k: K, v: (typeof p)[K]) => setP(x => ({ ...x, [k]: v }));
  async function start() {
    setBusy(true); setError('');
    const r = await klyr.startLeasing({ ...p, unit: p.unit || undefined, sqft: p.sqft || undefined });
    setBusy(false);
    if (!r.ok) return setError(errorText(r.error));
    router.refresh();
  }
  return (
    <>
      <h1 className="k-h1" style={{ fontSize: 28 }}>Lease out your home</h1>
      <p className="k-sub" style={{ margin: 0 }}>See your first year’s rent after fees, then choose from applicants compared on the same terms.</p>
      <section className="k-card">
        <label className="k-field">Street address<input value={p.address} onChange={e => set('address', e.target.value)} /></label>
        <div style={{ display: 'flex', gap: 8 }}>
          <label className="k-field" style={{ flex: 1 }}>Unit (optional)<input value={p.unit ?? ''} onChange={e => set('unit', e.target.value)} /></label>
          <label className="k-field" style={{ flex: 2 }}>City<input value={p.city} onChange={e => set('city', e.target.value)} /></label>
        </div>
        <div style={{ display: 'flex', gap: 6 }} role="group" aria-label="Type">
          {(['House', 'Townhouse', 'Condo'] as const).map(t => <button key={t} className="k-chip" aria-pressed={p.type === t} onClick={() => set('type', t)}>{t}</button>)}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <label className="k-field" style={{ flex: 1 }}>Bedrooms<input inputMode="numeric" value={p.beds} onChange={e => set('beds', n(e.target.value))} /></label>
          <label className="k-field" style={{ flex: 1 }}>Bathrooms<input inputMode="numeric" value={p.baths} onChange={e => set('baths', n(e.target.value))} /></label>
          <label className="k-field" style={{ flex: 1 }}>Sq ft (optional)<input inputMode="numeric" value={p.sqft ?? ''} onChange={e => set('sqft', n(e.target.value))} /></label>
        </div>
        <label className="k-field">First lived in (date the unit was first occupied)<input type="date" value={p.firstOccupied} onChange={e => set('firstOccupied', e.target.value)} /></label>
        {p.firstOccupied && <span className="k-note">{rentControlled(p.firstOccupied) ? 'Rent-controlled: increases are capped at the yearly guideline.' : `First occupied after ${RENT_CONTROL_CUTOFF}: not rent-controlled, but still one increase a year with 90 days’ notice.`}</span>}
        <div style={{ display: 'flex', gap: 8 }}>
          <label className="k-field" style={{ flex: 1 }}>Parking<input value={p.parking} onChange={e => set('parking', e.target.value)} placeholder="e.g. 1 underground" /></label>
          <label className="k-field" style={{ flex: 1 }}>Utilities<input value={p.utilities} onChange={e => set('utilities', e.target.value)} placeholder="e.g. hydro extra" /></label>
        </div>
        <label style={{ display: 'flex', gap: 8 }}><input type="checkbox" checked={p.furnished} onChange={e => set('furnished', e.target.checked)} /> Furnished</label>
        <label className="k-field">Description<textarea rows={3} value={p.description} onChange={e => set('description', e.target.value)} /></label>
        <div style={{ display: 'flex', gap: 8 }}>
          <label className="k-field" style={{ flex: 1 }}>Rent a month<input inputMode="numeric" value={p.rent ? p.rent.toLocaleString('en-CA') : ''} onChange={e => set('rent', n(e.target.value))} /></label>
          <label className="k-field" style={{ flex: 1 }}>Available from<input type="date" value={p.availableFrom} onChange={e => set('availableFrom', e.target.value)} /></label>
        </div>
      </section>
      {error && <div className="k-error" role="alert">{error}</div>}
      <button className="k-btn" disabled={busy || !p.address.trim() || !p.city.trim() || !p.firstOccupied || !p.description.trim() || p.rent < 300 || !p.availableFrom} onClick={start}>See my first-year rent</button>
    </>
  );
}

function PlanAndSign({ l, legalName }: { l: Leasing; legalName: string }) {
  const router = useRouter();
  const [rent, setRent] = useState(l.rent);
  const [side, setSide] = useState(l.tenantSidePct as 0 | 0.5 | 1);
  const [read, setRead] = useState(false);
  const [name, setName] = useState('');
  const [stepUp, setStepUp] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const net = landlordNet({ rent, tenantSidePct: side });

  async function sign() {
    setBusy(true); setError('');
    const p = await klyr.setLeasePlan({ rent, tenantSidePct: side, availableFrom: l.availableFrom });
    if (!p.ok) { setBusy(false); return setError(errorText(p.error)); }
    const r = await klyr.signLeaseListing(name);
    setBusy(false);
    if (r.status === 403 && r.error?.code === 'step_up_required') return setStepUp(true);
    if (!r.ok) return setError(errorText(r.error));
    router.refresh();
  }
  if (stepUp) return <StepUp reason="Signing your listing agreement needs a fresh check." onCancel={() => setStepUp(false)} onDone={() => { setStepUp(false); void sign(); }} />;
  return (
    <>
      <section className="k-card" style={{ background: 'var(--ink)', color: '#fff', borderRadius: 20, padding: 18 }} aria-label={`First year after fees ${money(net.net)}`}>
        <div className="k-label" style={{ color: '#8CC2B1' }}>{l.property.address.toUpperCase()}, {l.property.city.toUpperCase()} · FIRST YEAR AFTER FEES</div>
        <div style={{ fontSize: 34, fontWeight: 800 }}>{money(net.net)}</div>
        <div style={{ fontSize: 13, color: '#C9DDD6' }}>12 × {money(rent)} = {money(net.gross)} · Klyr fee {money(net.fee)} · tenant’s brokerage {money(net.tenantSide)} (HST included)</div>
      </section>
      <section className="k-card">
        <label className="k-field">Rent a month<input inputMode="numeric" value={rent.toLocaleString('en-CA')} onChange={e => setRent(n(e.target.value))} /></label>
        <div className="k-label">TO THE TENANT’S BROKERAGE · YOUR CHOICE</div>
        <div style={{ display: 'flex', gap: 6 }} role="group" aria-label="Tenant’s brokerage">
          {TENANT_SIDE_CHOICES.map(c => <button key={c} className="k-chip" aria-pressed={side === c} onClick={() => setSide(c)}>{SIDE[c]}</button>)}
        </div>
        <span className="k-note">{l.rentControlled ? `Rent-controlled: after the first year, increases are capped at the guideline (${l.guideline.pct}% in ${l.guideline.year}).` : 'Not rent-controlled (first occupied after Nov 15, 2018). Increases: once a year, 90 days’ written notice.'}</span>
      </section>
      <section className="k-card">
        <div className="k-label">OREA FORM 210 · LISTING AGREEMENT FOR A LEASE · SUMMARY</div>
        {[['Term', '60 days, 30-day holdover.'], ['Klyr’s fee', `${money(l.fee)} + HST, once a lease is signed.`], ['Tenant’s brokerage', side ? `${SIDE[side]}’s rent + HST. You chose this.` : 'Nothing offered. You chose this.'],
          ['Fair screening', 'Every applicant is compared on the same facts: income, work, references and, with consent, credit. The Human Rights Code bars choosing on family status, age, public assistance or other protected grounds.']].map(([k, v], i) => (
          <div key={k} style={{ padding: '6px 0', borderTop: i ? '.5px solid var(--sep)' : 0 }}><strong>{k}</strong><div className="k-note">{v}</div></div>
        ))}
        <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}><input type="checkbox" checked={read} onChange={e => setRead(e.target.checked)} /> I’ve read the summary. The standard OREA terms apply in full.</label>
        <label className="k-field">Type your full name to sign ({legalName})<input value={name} onChange={e => setName(e.target.value)} autoComplete="name" /></label>
        {error && <div className="k-error" role="alert">{error}</div>}
        <button className="k-btn" disabled={busy || !read || name.trim().length < 2 || rent < 300} onClick={sign}>Sign listing agreement</button>
      </section>
    </>
  );
}

function Live({ l, legalName }: { l: Leasing; legalName: string }) {
  const router = useRouter();
  const [open, setOpen] = useState<{ id: string; kind: 'consent' | 'accept' } | null>(null);
  const [read, setRead] = useState(false);
  const [name, setName] = useState('');
  const [pending, setPending] = useState<{ id: string; kind: 'consent' | 'accept' } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const leased = l.applications.find(a => a.status === 'accepted');

  async function run(id: string, kind: 'consent' | 'accept' | 'decline') {
    setBusy(true); setError('');
    const r = kind === 'consent' ? await klyr.signLandlordConsent(id, name)
      : await klyr.decideApplication(id, kind === 'accept' ? { result: 'accepted', typedName: name, readConfirmed: true } : { result: 'declined' });
    setBusy(false);
    if (r.status === 403 && r.error?.code === 'step_up_required' && kind !== 'decline') return setPending({ id, kind });
    if (!r.ok) return setError(errorText(r.error));
    setOpen(null); setName(''); setRead(false); router.refresh();
  }
  if (pending) return <StepUp reason="Signing needs a fresh check." onCancel={() => setPending(null)} onDone={() => { const p = pending; setPending(null); void run(p.id, p.kind); }} />;
  const signBox = (label: string, id: string, kind: 'consent' | 'accept') => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}><input type="checkbox" checked={read} onChange={e => setRead(e.target.checked)} /> I’ve read this. Once signed, it’s binding.</label>
      <label className="k-field">Type your full name to sign ({legalName})<input value={name} onChange={e => setName(e.target.value)} autoComplete="name" /></label>
      {error && <div className="k-error" role="alert">{error}</div>}
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="k-btn" disabled={busy || !read || name.trim().length < 2} onClick={() => run(id, kind)}>{label}</button>
        <button className="k-btn k-alt" disabled={busy} onClick={() => setOpen(null)}>Back</button>
      </div>
    </div>
  );

  return (
    <>
      <section className="k-card" style={{ background: 'var(--ink)', color: '#fff', borderRadius: 20, padding: 18 }}>
        <div className="k-label" style={{ color: '#8CC2B1' }}>{l.property.address.toUpperCase()}{l.property.unit ? ` #${l.property.unit}` : ''}, {l.property.city.toUpperCase()} · {money(l.rent)}/MONTH</div>
        <div style={{ fontSize: 30, fontWeight: 800 }}>{leased ? 'Leased' : l.publishedAt ? 'You’re live' : 'Getting listed'}</div>
        <div style={{ fontSize: 13, color: '#C9DDD6' }}>
          {leased ? `${leased.name} at ${money(leased.rent)}/month from ${leased.startDate}. Next: you both sign the Ontario Standard Lease (2229E) within 21 days, and you collect the first and last month’s rent.`
            : l.publishedAt ? `Listed ${torontoWhen(l.publishedAt)}. Applications come here, each with the same facts.`
            : `Agreement signed ${torontoWhen(l.agreement!.signedAt)}. ${l.agent?.name ?? 'Your agent'} adds photos and publishes it. First year after fees: about ${money(l.net.net)}.`}
        </div>
      </section>
      {l.listingId && l.publishedAt && <Link href={`/rent/${l.listingId}`} className="k-btn k-alt" style={{ display: 'grid', placeItems: 'center', textDecoration: 'none' }}>See your rental</Link>}

      {l.consents.filter(c => !c.sellerSignedAt).map(c => (
        <section key={c.id} className="k-card" aria-label={`Consent for ${c.tenant}`} style={{ boxShadow: '0 0 0 2px var(--brand)' }}>
          <div className="k-label">● ACTION · OREA FORM 326</div>
          <strong style={{ fontSize: 18 }}>A Klyr tenant wants to apply</strong>
          {consent326('seller', true).map(([k, v]) => <div key={k}><strong>{k}</strong><div className="k-note">{v}</div></div>)}
          {open?.id === c.id ? signBox('Sign consent', c.id, 'consent')
            : <button className="k-btn" style={{ width: 'auto', padding: '0 18px', alignSelf: 'flex-start' }} onClick={() => { setOpen({ id: c.id, kind: 'consent' }); setRead(false); setName(''); }}>Review and sign</button>}
        </section>
      ))}

      {l.applications.length > 0 && (
        <section className="k-card" aria-label="Applicants">
          <div className="k-label">APPLICANTS · {l.applications.filter(a => a.status === 'submitted').length} WAITING · SAME FACTS FOR EVERYONE</div>
          {l.applications.map((a, i) => {
            const facts: [string, string][] = [
              ['Rent offered', `${money(a.rent)}/month`], ['Start · term', `${a.startDate} · ${a.termMonths} months`],
              ['Income', `${money(a.screening.monthlyIncome)}/month`], ['Income ÷ rent', `${a.screening.incomeToRent}×`],
              ['Work', `${a.screening.jobTitle}, ${a.screening.employer}`], ['Occupants', String(a.screening.occupants)],
              ['Pets', a.screening.pets ?? 'None'], ['References', String(a.screening.references)],
              ['Credit check', a.screening.creditConsent ? 'Allowed' : 'Not allowed'], ['First year after fees', money(a.net)],
            ];
            return (
              <article key={a.id} aria-label={`Applicant ${a.name}`} style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '10px 0', borderTop: i ? '.5px solid var(--sep)' : 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}><strong style={{ fontSize: 17 }}>{a.name}</strong><span className="k-note">{STATUS[a.status]}</span></div>
                <dl style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '6px 12px', margin: 0 }}>
                  {facts.map(([k, v]) => <div key={k}><dt className="k-note" style={{ fontSize: 12 }}>{k}</dt><dd style={{ margin: 0, fontWeight: 600 }}>{v}</dd></div>)}
                </dl>
                {!leased && a.status === 'submitted' && (open?.id === a.id ? signBox(`Accept ${a.name}`, a.id, 'accept') : (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="k-btn" style={{ width: 'auto', padding: '0 16px' }} onClick={() => { setOpen({ id: a.id, kind: 'accept' }); setRead(false); setName(''); }}>Accept</button>
                    <button className="k-btn k-alt" style={{ width: 'auto', padding: '0 16px' }} disabled={busy} onClick={() => { if (confirm(`Decline ${a.name}?`)) void run(a.id, 'decline'); }}>Decline</button>
                  </div>
                ))}
              </article>
            );
          })}
          <span className="k-note">Income ÷ rent is a guide, not a rule: Ontario landlords must also consider rental history, references and credit. Choosing on family status, age, receipt of public assistance or other Human Rights Code grounds is against the law.</span>
          {!leased && l.applications.some(a => a.status === 'submitted') && <span className="k-note">Accepting one tells every other applicant the same day.</span>}
        </section>
      )}
    </>
  );
}
