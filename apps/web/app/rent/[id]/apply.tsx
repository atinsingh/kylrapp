'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { RentalDetail, Renting } from '@klyr/api-client';
import { money, torontoWhen } from '@klyr/core';
import { StepUp } from '@/components/step-up';
import { errorText, klyr } from '@/lib/client';
import { consent326 } from '../../offer/[id]/consent';
import { STATUS } from '../tenant';

const n = (v: string) => Number(v.replace(/\D/g, '')) || 0;

/** Form 326 if Klyr represents the landlord, then Form 410 + 400 from the profile. */
export function Apply({ rental: r, renting, legalName }: { rental: RentalDetail; renting: Renting; legalName: string }) {
  const router = useRouter();
  const [rent, setRent] = useState(r.rent);
  const [start, setStart] = useState(r.availableFrom ?? renting.profile?.moveIn ?? '');
  const [term, setTerm] = useState(12);
  const [read, setRead] = useState(false);
  const [name, setName] = useState('');
  const [stepUp, setStepUp] = useState<'consent' | 'apply' | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function go(kind: 'consent' | 'apply') {
    setBusy(true); setError('');
    const res = kind === 'consent' ? await klyr.consentToApply(r.id, name) : await klyr.applyForRental(r.id, { rent, startDate: start, termMonths: term, typedName: name });
    setBusy(false);
    if (res.status === 403 && res.error?.code === 'step_up_required') return setStepUp(kind);
    if (!res.ok) return setError(errorText(res.error));
    setName(''); setRead(false); router.refresh();
  }
  if (stepUp) return <StepUp reason="Signing needs a fresh check." onCancel={() => setStepUp(null)} onDone={() => { const k = stepUp; setStepUp(null); void go(k); }} />;

  const signBox = (label: string, kind: 'consent' | 'apply', ok = true) => (
    <>
      <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}><input type="checkbox" checked={read} onChange={e => setRead(e.target.checked)} /> I’ve read this. The standard OREA terms apply in full.</label>
      <label className="k-field">Type your full name to sign ({legalName})<input value={name} onChange={e => setName(e.target.value)} autoComplete="name" /></label>
      {error && <div className="k-error" role="alert">{error}</div>}
      <button className="k-btn" disabled={busy || !ok || !read || name.trim().length < 2} onClick={() => go(kind)}>{label}</button>
    </>
  );

  if (r.application && r.application.status !== 'withdrawn') return (
    <section className="k-card" role="status">
      <div className="k-label">YOUR APPLICATION</div>
      <strong style={{ fontSize: 18 }}>{STATUS[r.application.status]}</strong>
      <span className="k-note">{money(r.application.rent)}/month for {r.application.termMonths} months from {r.application.startDate} · sent {torontoWhen(r.application.createdAt)}</span>
      {r.application.status === 'accepted' && <span className="k-note">Next: you and the landlord sign the Ontario Standard Lease (2229E), and you pay {money(r.application.moveIn.total)}. Arrange tenant insurance before move-in.</span>}
    </section>
  );
  if (!renting.agreement || !renting.profile) return (
    <section className="k-card">
      <div className="k-label">● BEFORE YOU APPLY</div>
      <strong>{!renting.agreement ? 'Sign your tenant agreement ($0) first' : 'Fill in your rental profile first'}</strong>
      <Link href="/rent" className="k-btn" style={{ display: 'grid', placeItems: 'center', textDecoration: 'none' }}>{!renting.agreement ? 'Review Form 346' : 'Fill in my profile'}</Link>
    </section>
  );
  if (r.consent && !(r.consent.buyerSignedAt && r.consent.sellerSignedAt)) return (
    <section className="k-card" aria-label="Consent to multiple representation">
      <div className="k-label">● KLYR LISTING · OREA FORM 326</div>
      <strong style={{ fontSize: 18 }}>{r.consent.buyerSignedAt ? 'Waiting for the landlord' : 'Klyr represents this landlord too'}</strong>
      {r.consent.buyerSignedAt
        ? <span className="k-note">You consented {torontoWhen(r.consent.buyerSignedAt)}. You can apply as soon as the landlord signs; we’ll let you know.</span>
        : <>
          {consent326('buyer', true).map(([k, v]) => <div key={k}><strong>{k}</strong><div className="k-note">{v}</div></div>)}
          {signBox('Sign consent', 'consent')}
        </>}
    </section>
  );
  return (
    <section className="k-card" aria-label="Apply">
      <div className="k-label">APPLY · FORM 410 FROM YOUR PROFILE + FORM 400 OFFER TO LEASE</div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <label className="k-field" style={{ flex: 1, minWidth: 140 }}>Rent a month<input inputMode="numeric" value={rent.toLocaleString('en-CA')} onChange={e => setRent(n(e.target.value))} /></label>
        <label className="k-field" style={{ flex: 1, minWidth: 160 }}>Start date<input type="date" value={start} onChange={e => setStart(e.target.value)} /></label>
      </div>
      <div className="k-label">TERM</div>
      <div style={{ display: 'flex', gap: 6 }} role="group" aria-label="Term">
        {[6, 12, 24].map(m => <button key={m} className="k-chip" aria-pressed={term === m} onClick={() => setTerm(m)}>{m} months</button>)}
      </div>
      <span className="k-note">You pay {money(rent * 2)} when the lease is signed: first month and the last month’s rent deposit. The lease is the Ontario Standard Lease. Your profile goes with the offer: {money(renting.profile.monthlyIncome)}/month, {renting.profile.jobTitle} at {renting.profile.employer}.</span>
      {signBox('Sign and apply', 'apply', rent >= 300 && !!start)}
    </section>
  );
}
