'use client';

import { useEffect, useState } from 'react';
import { startAuthentication } from '@simplewebauthn/browser';
import type { Me } from '@klyr/contracts';
import { errorText, klyr } from '@/lib/client';

/**
 * "Confirm it’s you" before signing or other sensitive actions: passkey, then authenticator code;
 * accounts with neither confirm with an emailed code.
 */
export function StepUp({ reason, onDone, onCancel }: { reason: string; onDone: () => void; onCancel: () => void }) {
  const [me, setMe] = useState<Me | null>(null);
  const [code, setCode] = useState('');
  const [emailSent, setEmailSent] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { void klyr.me().then(r => r.ok && setMe(r.data)); }, []);
  const emailOnly = !!me && !me.passkeys && !me.totpEnabled;

  async function passkey() {
    setBusy(true); setError('');
    try {
      const o = await klyr.passkeyStepUpOptions<Parameters<typeof startAuthentication>[0]['optionsJSON']>();
      if (!o.ok) throw new Error(errorText(o.error));
      const v = await klyr.passkeyStepUpVerify(o.data.challengeId, await startAuthentication({ optionsJSON: o.data.options }));
      if (!v.ok) throw new Error(errorText(v.error));
      onDone();
    } catch (e) { setError(e instanceof Error && e.name !== 'NotAllowedError' ? e.message : 'No passkey was used.'); } finally { setBusy(false); }
  }
  async function confirmCode() {
    setBusy(true); setError('');
    const r = emailOnly ? await klyr.stepUpEmailVerify(code) : await klyr.totpVerify(code);
    setBusy(false);
    if (!r.ok) return setError(errorText(r.error));
    onDone();
  }
  async function sendEmail() {
    setError('');
    const r = await klyr.stepUpEmailStart();
    if (!r.ok) return setError(errorText(r.error));
    setEmailSent(true);
  }

  return (
    <section className="k-card" aria-label="Confirm it’s you" style={{ border: '2px solid var(--brand)' }}>
      <h2 style={{ fontSize: 17, fontWeight: 700, margin: 0 }}>Confirm it’s you</h2>
      <p className="k-note" style={{ margin: 0 }}>{reason}</p>
      {!me && <p className="k-note">Loading…</p>}
      {me && me.passkeys > 0 && <button className="k-btn" disabled={busy} onClick={passkey}>Use my passkey</button>}
      {me?.totpEnabled && (
        <CodeField label="Code from your authenticator app" code={code} setCode={setCode} />
      )}
      {emailOnly && !emailSent && <button className="k-btn" onClick={sendEmail}>Email me a code</button>}
      {emailOnly && emailSent && (
        <>
          <p className="k-note" style={{ margin: 0 }}>We sent a 6-digit code to {me!.email}.</p>
          <CodeField label="Code from your email" code={code} setCode={setCode} />
        </>
      )}
      {(me?.totpEnabled || (emailOnly && emailSent)) && <button className={me?.passkeys ? 'k-btn k-alt' : 'k-btn'} disabled={busy || code.length !== 6} onClick={confirmCode}>Confirm</button>}
      {error && <div className="k-error" role="alert">{error}</div>}
      <button className="k-btn k-alt" onClick={onCancel}>Cancel</button>
    </section>
  );
}

function CodeField({ label, code, setCode }: { label: string; code: string; setCode: (v: string) => void }) {
  return (
    <label className="k-field">{label}
      <input value={code} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" autoFocus />
    </label>
  );
}
