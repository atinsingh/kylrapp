'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { Offer } from '@klyr/api-client';
import { money, TORONTO, torontoWhen } from '@klyr/core';
import { StepUp } from '@/components/step-up';
import { errorText, klyr } from '@/lib/client';

const when = (iso: string) => torontoWhen(iso);

export function OfferActions({ offer: o, legalName }: { offer: Offer; legalName: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<null | 'withdraw' | 'accept'>(null);
  const [name, setName] = useState('');
  const [stepUp, setStepUp] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const run = async (fn: () => Promise<{ ok: boolean; status: number; error?: { code?: string; message?: unknown } }>) => {
    setBusy(true); setError('');
    const r = await fn();
    setBusy(false);
    if (r.status === 403 && r.error?.code === 'step_up_required') return setStepUp(true);
    if (!r.ok) return setError(errorText(r.error));
    setMode(null);
    router.refresh();
  };
  const accept = () => run(() => klyr.acceptSignBack(o.signBack!.id, name));

  if (stepUp) return <StepUp reason="Accepting a sign-back is a signature and needs a fresh check." onCancel={() => setStepUp(false)} onDone={() => { setStepUp(false); void accept(); }} />;

  const sb = o.signBack?.status === 'signed_back' ? o.signBack : null;
  return (
    <>
      {sb && (
        <div style={{ background: '#E8EEF9', borderRadius: 12, padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div className="k-label" style={{ color: '#2A4D8F' }}>SIGNED BACK</div>
          <strong style={{ fontSize: 22 }}>{money(sb.price)}</strong>
          <span style={{ fontSize: 14 }}>You offered {money(o.price)}. Other terms are unchanged. Open until {when(sb.irrevocableAt)}.</span>
          {sb.agentNote && <span className="k-note" style={{ color: 'var(--text)' }}>Your agent: “{sb.agentNote}”</span>}
          {mode === 'accept' ? (
            <>
              <label className="k-field">Type your full name to accept ({legalName})
                <input value={name} onChange={e => setName(e.target.value)} autoComplete="name" />
              </label>
              <span className="k-note">Accepting makes this a binding agreement at {money(sb.price)}. Your deposit is due within 24 hours.</span>
              <button className="k-btn" disabled={busy || name.trim().length < 2} onClick={accept}>Accept at {money(sb.price)}</button>
              <button className="k-btn k-alt" disabled={busy} onClick={() => setMode(null)}>Back</button>
            </>
          ) : (
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="k-btn" onClick={() => setMode('accept')}>Accept</button>
              <button className="k-btn k-alt" disabled={busy} onClick={() => run(() => klyr.declineSignBack(sb.id))}>Decline</button>
            </div>
          )}
        </div>
      )}
      {(o.status === 'draft' || o.status === 'returned') && (
        <Link href={`/offer/${o.listingId}`} className="k-btn" style={{ display: 'grid', placeItems: 'center', textDecoration: 'none' }}>{o.status === 'returned' ? 'Change and sign again' : 'Finish your offer'}</Link>
      )}
      {(o.status === 'sent' || o.status === 'registered') && (mode === 'withdraw' ? (
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="k-btn" style={{ background: 'var(--accent)' }} disabled={busy} onClick={() => run(() => klyr.withdrawOffer(o.id))}>Withdraw this offer</button>
          <button className="k-btn k-alt" onClick={() => setMode(null)}>Keep it</button>
        </div>
      ) : <button className="k-btn k-alt" onClick={() => setMode('withdraw')}>Withdraw</button>)}
      {error && <div className="k-error" role="alert">{error}</div>}
    </>
  );
}
