'use client';

import { useState } from 'react';
import QRCode from 'qrcode';
import { errorText, type KlyrClient } from '@klyr/api-client';

type Step = 'email' | 'code' | 'totp' | 'setup' | 'denied';

/**
 * Staff sign-in for Klyr Pro and Admin: an email code, then the authenticator app. Staff without
 * one set it up here before anything else opens; the API refuses staff routes without a second factor.
 */
export function StaffSignIn({ client, app, roles, home }: { client: KlyrClient; app: string; roles: readonly string[]; home: string }) {
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [totp, setTotp] = useState('');
  const [setup, setSetup] = useState<{ secret: string; qr: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const run = async (fn: () => Promise<unknown>) => { setBusy(true); setError(''); try { await fn(); } finally { setBusy(false); } };
  const done = () => window.location.assign(home);

  const start = () => run(async () => {
    const r = await client.emailStart(email);
    if (!r.ok) return setError(errorText(r.error));
    setStep('code');
  });

  const verifyCode = () => run(async () => {
    const r = await client.emailVerify(email, code);
    if (!r.ok) return setError(errorText(r.error));
    if (r.data.session.mfaRequired) return setStep('totp');
    const me = await client.me();
    if (!me.ok || !me.data.roles.some(x => roles.includes(x))) { await client.logout(); return setStep('denied'); }
    const s = await client.totpSetup();
    if (!s.ok) return setError(errorText(s.error));
    setSetup({ secret: s.data.secret, qr: await QRCode.toDataURL(s.data.otpauthUrl, { margin: 1, width: 200, color: { dark: '#1F2B27' } }) });
    setStep('setup');
  });

  const verifyTotp = () => run(async () => {
    const r = step === 'setup' ? await client.totpEnable(totp) : await client.totpVerify(totp);
    if (!r.ok) return setError(errorText(r.error));
    const me = await client.me();
    if (!me.ok || !me.data.roles.some(x => roles.includes(x))) { await client.logout(); return setStep('denied'); }
    done();
  });

  const codeInput = (value: string, set: (v: string) => void, label: string) => (
    <div className="k-card">
      <label className="k-field">{label}
        <input value={value} onChange={e => set(e.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" autoComplete="one-time-code"
          placeholder="123456" autoFocus style={{ letterSpacing: '.3em', fontSize: 22, fontWeight: 700 }} />
      </label>
    </div>
  );

  return (
    <main className="k-page" style={{ paddingTop: 48 }}>
      <div className="k-label">{app.toUpperCase()}</div>
      {step === 'email' && (
        <>
          <h1 className="k-h1">Sign in</h1>
          <p className="k-sub">For Klyr Realty staff. Use your work email.</p>
          <div className="k-card">
            <label className="k-field">Work email
              <input type="email" value={email} onChange={e => setEmail(e.target.value.trim())} autoComplete="username" autoFocus />
            </label>
          </div>
          {error && <div className="k-error" role="alert">{error}</div>}
          <button className="k-btn" disabled={busy || !email.includes('@')} onClick={start}>Email me a code</button>
        </>
      )}
      {step === 'code' && (
        <>
          <h1 className="k-h1">Check your email</h1>
          <p className="k-sub">We sent a 6-digit code to <strong>{email}</strong>.</p>
          {codeInput(code, setCode, 'Code')}
          {error && <div className="k-error" role="alert">{error}</div>}
          <button className="k-btn" disabled={busy || code.length !== 6} onClick={verifyCode}>Continue</button>
        </>
      )}
      {step === 'totp' && (
        <>
          <h1 className="k-h1">Two-step verification</h1>
          <p className="k-sub">Enter the code from your authenticator app.</p>
          {codeInput(totp, setTotp, 'Authenticator code')}
          {error && <div className="k-error" role="alert">{error}</div>}
          <button className="k-btn" disabled={busy || totp.length !== 6} onClick={verifyTotp}>Sign in</button>
        </>
      )}
      {step === 'setup' && setup && (
        <>
          <h1 className="k-h1">Set up two-step verification</h1>
          <p className="k-sub">Staff accounts need an authenticator app. Scan this with Google Authenticator, 1Password, Authy or similar.</p>
          <div className="k-card" style={{ alignItems: 'center' }}>
            <img src={setup.qr} alt="QR code for your authenticator app" width={200} height={200} />
            <span className="k-note">Can’t scan? Enter this key: <code style={{ userSelect: 'all' }}>{setup.secret}</code></span>
          </div>
          {codeInput(totp, setTotp, 'Code from the app')}
          {error && <div className="k-error" role="alert">{error}</div>}
          <button className="k-btn" disabled={busy || totp.length !== 6} onClick={verifyTotp}>Turn on and continue</button>
        </>
      )}
      {step === 'denied' && (
        <>
          <h1 className="k-h1">This account can’t use {app}</h1>
          <p className="k-sub">{app} is for Klyr Realty staff. If you’re buying or selling, use the Klyr app.</p>
          <button className="k-btn k-alt" onClick={() => { setStep('email'); setCode(''); setTotp(''); }}>Use another email</button>
        </>
      )}
    </main>
  );
}
