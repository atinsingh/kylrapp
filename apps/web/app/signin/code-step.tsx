'use client';

import { useState } from 'react';
import type { SignedIn } from '@klyr/api-client';
import { errorText, klyr } from '@/lib/client';

type Session = Pick<SignedIn, 'session'>;

/** "Enter the 6-digit code" — shared by sign-up and sign-in. */
export function CodeStep({ email, purpose, onDone }: { email: string; purpose: 'signup' | 'signin'; onDone: (s: Session) => void }) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');

  async function verify() {
    setBusy(true); setError('');
    const r = await klyr.emailVerify(email, code);
    setBusy(false);
    if (!r.ok) return setError(errorText(r.error));
    onDone(r.data);
  }

  async function resend() {
    setError(''); setNote('');
    const r = await klyr.emailStart(email);
    if (!r.ok) return setError(errorText(r.error));
    setNote('A new code is on its way.');
  }

  return (
    <>
      <h1 className="k-h1">{purpose === 'signup' ? 'Confirm your email' : 'Check your email'}</h1>
      <p className="k-sub">We sent a 6-digit code to <strong>{email}</strong>. It expires in 10 minutes.</p>
      <div className="k-card">
        <label className="k-field">Code
          <input value={code} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            inputMode="numeric" autoComplete="one-time-code" placeholder="123456" autoFocus
            style={{ letterSpacing: '.3em', fontSize: 22, fontWeight: 700 }} />
        </label>
      </div>
      {error && <div className="k-error" role="alert">{error}</div>}
      {note && <div className="k-note" role="status">{note}</div>}
      <button className="k-btn" disabled={busy || code.length !== 6} onClick={verify}>Continue</button>
      <button className="k-btn k-alt" onClick={resend}>Send a new code</button>
    </>
  );
}
