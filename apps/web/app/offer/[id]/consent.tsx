'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Consent } from '@klyr/api-client';
import { torontoWhen } from '@klyr/core';
import { StepUp } from '@/components/step-up';
import { errorText, klyr } from '@/lib/client';

/** Form 326 in plain language, from either side. */
export const consent326 = (side: 'buyer' | 'seller'): [string, string][] => [
  ['What it means', `Klyr Realty represents both you and the ${side === 'buyer' ? 'seller' : 'buyer'} of this home. Each side keeps its own salesperson at Klyr.`],
  ['What stays private', side === 'buyer'
    ? 'Klyr won’t tell the seller the most you’d pay, or tell you the least they’d take, or share either side’s reasons.'
    : 'Klyr won’t tell the buyer the least you’d take, or tell you the most they’d pay, or share either side’s reasons.'],
  ['What Klyr still does', 'Treats both sides fairly, shares facts about the home’s value or condition, and helps each side with offers and paperwork.'],
  ['Your choice', `You don’t have to consent. If either side says no, ${side === 'buyer' ? 'you can’t offer on this home' : 'this buyer can’t offer on your home'} through Klyr.`],
];

/** Form 326 before an offer on a Klyr listing: the buyer signs, then waits for the seller. */
export function ConsentCard({ listingId, consent, legalName }: { listingId: string; consent: Consent; legalName: string }) {
  const router = useRouter();
  const [read, setRead] = useState(false);
  const [name, setName] = useState('');
  const [stepUp, setStepUp] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function sign() {
    setBusy(true); setError('');
    const r = await klyr.consentToOffer(listingId, name);
    setBusy(false);
    if (r.status === 403 && r.error?.code === 'step_up_required') return setStepUp(true);
    if (!r.ok) return setError(errorText(r.error));
    router.refresh();
  }
  if (stepUp) return <StepUp reason="Signing a consent needs a fresh check." onCancel={() => setStepUp(false)} onDone={() => { setStepUp(false); void sign(); }} />;

  return (
    <section className="k-card" aria-label="Consent to multiple representation">
      <div className="k-label">● KLYR LISTING · OREA FORM 326</div>
      <strong style={{ fontSize: 18 }}>{consent.buyerSignedAt ? 'Waiting for the seller' : 'Klyr represents this seller too'}</strong>
      {consent.buyerSignedAt
        ? <span className="k-note">You consented {torontoWhen(consent.buyerSignedAt)}. We asked the seller; you can make your offer as soon as they sign, and we’ll let you know.</span>
        : (
          <>
            <span className="k-note">Before an offer, you and the seller both consent in writing to multiple representation.</span>
            {consent326('buyer').map(([k, v], i) => (
              <div key={k} style={{ padding: '6px 0', borderTop: i ? '.5px solid var(--sep)' : 0 }}><strong>{k}</strong><div className="k-note">{v}</div></div>
            ))}
            <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}><input type="checkbox" checked={read} onChange={e => setRead(e.target.checked)} /> I’ve read this. The standard OREA terms apply in full.</label>
            <label className="k-field">Type your full name to consent ({legalName})<input value={name} onChange={e => setName(e.target.value)} autoComplete="name" /></label>
            {error && <div className="k-error" role="alert">{error}</div>}
            <button className="k-btn" disabled={busy || !read || name.trim().length < 2} onClick={sign}>Sign consent</button>
          </>
        )}
    </section>
  );
}
