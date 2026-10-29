'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { startAuthentication } from '@simplewebauthn/browser';
import type { SignedIn } from '@klyr/api-client';
import { errorText, klyr } from '@/lib/client';
import { Field } from '../start/onboarding';
import { CodeStep } from './code-step';

type Step = 'choose' | 'code' | 'password' | 'totp';
type Session = Pick<SignedIn, 'session'>;

export function SignIn() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('choose');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [totp, setTotp] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const finish = (s: Session) => (s.session.mfaRequired ? setStep('totp') : router.replace('/'));
  const run = async (fn: () => Promise<void>) => { setBusy(true); setError(''); try { await fn(); } finally { setBusy(false); } };

  const passkey = () => run(async () => {
    try {
      const o = await klyr.passkeyLoginOptions<Parameters<typeof startAuthentication>[0]['optionsJSON']>();
      if (!o.ok) throw new Error(errorText(o.error));
      const response = await startAuthentication({ optionsJSON: o.data.options });
      const v = await klyr.passkeyLoginVerify(o.data.challengeId, response);
      if (!v.ok) throw new Error(errorText(v.error));
      finish(v.data);
    } catch (e) {
      setError(e instanceof Error && e.name !== 'NotAllowedError' ? e.message : 'No passkey was used. Try again, or get an email code.');
    }
  });

  const emailCode = () => run(async () => {
    const r = await klyr.emailStart(email);
    if (!r.ok) return setError(errorText(r.error));
    setStep('code');
  });

  const passwordLogin = () => run(async () => {
    const r = await klyr.passwordLogin(email, password);
    if (!r.ok) return setError(errorText(r.error));
    finish(r.data);
  });

  const verifyTotp = () => run(async () => {
    const r = await klyr.totpVerify(totp);
    if (!r.ok) return setError(errorText(r.error));
    router.replace('/');
  });

  return (
    <main className="k-page" style={{ paddingTop: 48 }}>
      {step === 'choose' && (
        <>
          <h1 className="k-h1">Welcome back</h1>
          <button className="k-btn" disabled={busy} onClick={passkey}>Sign in with a passkey</button>
          <div className="k-card">
            <Field label="Email" type="email" value={email} onChange={setEmail} autoComplete="username webauthn" />
          </div>
          {error && <div className="k-error" role="alert">{error}</div>}
          <button className="k-btn k-alt" disabled={busy || !email.includes('@')} onClick={emailCode}>Email me a code</button>
          <button className="k-btn k-alt" disabled={busy || !email.includes('@')} onClick={() => { setError(''); setStep('password'); }}>Use my password</button>
          <p className="k-note" style={{ textAlign: 'center' }}>New to Klyr? <Link href="/start">Get started</Link></p>
        </>
      )}

      {step === 'code' && <CodeStep email={email} purpose="signin" onDone={finish} />}

      {step === 'password' && (
        <>
          <h1 className="k-h1">Enter your password</h1>
          <p className="k-sub">{email}</p>
          <div className="k-card"><Field label="Password" type="password" value={password} onChange={setPassword} autoComplete="current-password" autoFocus /></div>
          {error && <div className="k-error" role="alert">{error}</div>}
          <button className="k-btn" disabled={busy || !password} onClick={passwordLogin}>Sign in</button>
          <button className="k-btn k-alt" disabled={busy} onClick={emailCode}>Email me a code instead</button>
        </>
      )}

      {step === 'totp' && (
        <>
          <h1 className="k-h1">Two-step verification</h1>
          <p className="k-sub">Enter the 6-digit code from your authenticator app.</p>
          <div className="k-card"><Field label="Code" value={totp} onChange={v => setTotp(v.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" autoFocus /></div>
          {error && <div className="k-error" role="alert">{error}</div>}
          <button className="k-btn" disabled={busy || totp.length !== 6} onClick={verifyTotp}>Verify</button>
        </>
      )}
    </main>
  );
}
