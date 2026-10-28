'use client';

import { useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { startRegistration } from '@simplewebauthn/browser';
import type { ConsumerPlan } from '@klyr/contracts';
import { call, errorText } from '@/lib/client';
import { CodeStep } from '../signin/code-step';

const PLANS: [ConsumerPlan, string, string][] = [
  ['buyer', 'Buy a home', '60–80% of the buyer commission back, the same whichever lender or lawyer you use'],
  ['seller', 'Sell a home', '$999 flat or 1% + HST, with a listing agreement and a licensed agent'],
  ['bundle', 'Sell and buy', 'One team for both sides, with closing dates planned together'],
  ['tenant', 'Rent a home', 'No fee to you. Move-in cost and rent-control status on every rental'],
  ['landlord', 'Lease out a home', 'Fixed fee, screened applicants and the Ontario Standard Lease'],
];
const AREAS = ['Mississauga', 'Toronto', 'Oakville', 'Brampton', 'Burlington'];
const BUDGETS = [900_000, 1_100_000, 1_300_000, 1_600_000];
const short = (n: number) => '$' + (n >= 1e6 ? (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M' : n / 1000 + 'K');

type Step = 'intent' | 'setup' | 'reco' | 'account' | 'code' | 'secure';

export function Onboarding() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('intent');
  const [plan, setPlan] = useState<ConsumerPlan>('buyer');
  const [areas, setAreas] = useState<string[]>(['Mississauga']);
  const [maxPrice, setMaxPrice] = useState(1_100_000);
  const [firstTime, setFirstTime] = useState(true);
  const [move, setMove] = useState({ address: '', mortgage: '', when: '', rent: '', moveIn: '' });
  const [acct, setAcct] = useState({ legalName: '', email: '', phone: '' });
  const [dealUpdates, setDealUpdates] = useState(true);
  const [marketing, setMarketing] = useState(false);
  const [terms, setTerms] = useState(false);
  const [privacy, setPrivacy] = useState(false);
  const [method, setMethod] = useState<'passkey' | 'password'>('passkey');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const buying = plan === 'buyer' || plan === 'bundle', selling = plan === 'seller' || plan === 'bundle';
  const toggleArea = (a: string) => setAreas(x => (x.includes(a) ? x.filter(y => y !== a) : [...x, a]));

  async function createAccount(m: 'passkey' | 'password') {
    setError('');
    if (!terms || !privacy) return setError('Accept the terms and privacy notice to continue.');
    setBusy(true);
    const setup = buying ? { areas, maxPrice, firstTime, ...(selling ? move : {}) } : move;
    const r = await call('/auth/signup', {
      ...acct, phone: acct.phone || undefined, plan, setup, dealUpdates, marketing,
      acceptTerms: true, acceptPrivacy: true, recoGuideRead: true,
    });
    setBusy(false);
    if (!r.ok) return setError(errorText(r.data));
    setMethod(m);
    setStep('code');
  }

  async function addPasskey() {
    setError(''); setBusy(true);
    try {
      const o = await call<{ challengeId: string; options: Parameters<typeof startRegistration>[0]['optionsJSON'] }>('/auth/passkey/register/options');
      if (!o.ok) throw new Error(errorText(o.data));
      const response = await startRegistration({ optionsJSON: o.data.options });
      const v = await call('/auth/passkey/register/verify', { challengeId: o.data.challengeId, response, name: 'This device' });
      if (!v.ok) throw new Error(errorText(v.data));
      router.replace('/');
    } catch (e) {
      setError(e instanceof Error && e.name !== 'NotAllowedError' ? e.message : 'The passkey wasn’t saved. Try again, or use a password.');
    } finally { setBusy(false); }
  }

  async function savePassword() {
    setError(''); setBusy(true);
    const r = await call('/auth/password', { password });
    setBusy(false);
    if (!r.ok) return setError(errorText(r.data));
    router.replace('/');
  }

  const progress = { intent: 1, setup: 2, reco: 3, account: 4, code: 4, secure: 4 }[step];

  return (
    <main className="k-page">
      <div className="k-progress" aria-hidden>{[1, 2, 3, 4].map(i => <span key={i} className={i <= progress ? 'on' : ''} />)}</div>

      {step === 'intent' && (
        <Screen title="What are you planning?" sub="You can add another plan later from your profile." next={() => setStep('setup')}>
          <div role="radiogroup" aria-label="Plan" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {PLANS.map(([k, t, d]) => (
              <button key={k} role="radio" aria-checked={plan === k} onClick={() => setPlan(k)}
                style={{ border: 0, borderRadius: 18, padding: '16px 18px', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 3,
                  background: plan === k ? 'var(--brand)' : '#fff', color: plan === k ? '#fff' : 'var(--text)', boxShadow: '0 1px 2px rgba(0,0,0,.05)' }}>
                <span style={{ fontSize: 18, fontWeight: 700 }}>{t}</span>
                <span style={{ fontSize: 13, color: plan === k ? 'rgba(255,255,255,.85)' : 'var(--muted)' }}>{d}</span>
              </button>
            ))}
          </div>
        </Screen>
      )}

      {step === 'setup' && (
        <Screen title="Tell us about your move" sub="Used to set up your home screen. Nothing is shared with anyone." next={() => setStep('reco')}>
          {buying && (
            <div className="k-card">
              <div className="k-label">WHERE YOU’D BUY</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {AREAS.map(a => <button key={a} className="k-chip" aria-pressed={areas.includes(a)} onClick={() => toggleArea(a)}>{a}</button>)}
              </div>
              <div className="k-label" style={{ marginTop: 6 }}>BUDGET</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {BUDGETS.map(v => <button key={v} className="k-chip" aria-pressed={maxPrice === v} onClick={() => setMaxPrice(v)}>Up to {short(v)}</button>)}
              </div>
              <div className="k-label" style={{ marginTop: 6 }}>FIRST HOME IN CANADA?</div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="k-chip" style={{ flex: 1 }} aria-pressed={firstTime} onClick={() => setFirstTime(true)}>Yes</button>
                <button className="k-chip" style={{ flex: 1 }} aria-pressed={!firstTime} onClick={() => setFirstTime(false)}>No</button>
              </div>
              <div className="k-note">First-time buyers get up to $4,000 back on Ontario land transfer tax, plus up to $4,475 in Toronto.</div>
            </div>
          )}
          {selling && (
            <div className="k-card">
              <div className="k-label">HOME YOU’RE SELLING</div>
              <Field label="Address" value={move.address} onChange={v => setMove({ ...move, address: v })} autoComplete="street-address" />
              <Field label="Mortgage balance, roughly" value={move.mortgage} onChange={v => setMove({ ...move, mortgage: v })} inputMode="numeric" />
              <Field label="When do you want to move?" value={move.when} onChange={v => setMove({ ...move, when: v })} />
            </div>
          )}
          {plan === 'tenant' && (
            <div className="k-card">
              <div className="k-label">WHERE YOU’D RENT</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {AREAS.map(a => <button key={a} className="k-chip" aria-pressed={areas.includes(a)} onClick={() => toggleArea(a)}>{a}</button>)}
              </div>
              <Field label="Most you want to pay a month" value={move.rent} onChange={v => setMove({ ...move, rent: v })} inputMode="numeric" />
              <Field label="Move-in" value={move.moveIn} onChange={v => setMove({ ...move, moveIn: v })} />
            </div>
          )}
          {plan === 'landlord' && (
            <div className="k-card">
              <div className="k-label">HOME YOU’RE LEASING OUT</div>
              <Field label="Address" value={move.address} onChange={v => setMove({ ...move, address: v })} autoComplete="street-address" />
              <Field label="Rent you’re aiming for, a month" value={move.rent} onChange={v => setMove({ ...move, rent: v })} inputMode="numeric" />
              <Field label="Available from" value={move.moveIn} onChange={v => setMove({ ...move, moveIn: v })} />
            </div>
          )}
        </Screen>
      )}

      {step === 'reco' && (
        <Screen title="Before we give advice" sub="Ontario law requires a few things before an agent can work for you." next={() => setStep('account')} nextLabel="I’ve read the guide">
          <div className="k-card">
            <div style={{ fontWeight: 700 }}>RECO Information Guide</div>
            <div className="k-note">Explains being a client versus self-represented. 6 min read.</div>
            <a href="https://www.reco.on.ca/" target="_blank" rel="noreferrer" style={{ fontSize: 13, fontWeight: 700 }}>Read the guide</a>
            <div className="k-note" style={{ fontWeight: 700, color: 'var(--brand)' }}>● Rule · before any service</div>
          </div>
          <div className="k-card">
            <div style={{ fontWeight: 700 }}>Your representation agreement</div>
            <div className="k-note">Form 300 to buy, Form 200 to sell, Form 346 to rent, Form 210 to lease out. You sign it before your first visit or listing, not now.</div>
            <div className="k-note" style={{ fontWeight: 700, color: 'var(--brand)' }}>● Rule · before showings, offers or listing</div>
          </div>
          <div className="k-card" style={{ fontSize: 13 }}>
            <div style={{ fontWeight: 700, fontSize: 14 }}>What to expect</div>
            <div>· Until you sign, tips in the app are general information.</div>
            <div>· Cash back is paid on the commission Klyr actually receives.</div>
            <div>· Any fee Klyr earns from a lender, lawyer or insurer is shown on the quote.</div>
          </div>
        </Screen>
      )}

      {step === 'account' && (
        <>
          <h1 className="k-h1">Create your account</h1>
          <div className="k-card">
            <Field label="Full legal name" value={acct.legalName} onChange={v => setAcct({ ...acct, legalName: v })} autoComplete="name" />
            <Field label="Email" type="email" value={acct.email} onChange={v => setAcct({ ...acct, email: v })} autoComplete="email" />
            <Field label="Mobile" type="tel" value={acct.phone} onChange={v => setAcct({ ...acct, phone: v })} autoComplete="tel" />
            <div className="k-note">Your legal name must match your ID. Klyr verifies ID once, before your first visit or listing, under federal FINTRAC rules.</div>
          </div>
          <div className="k-card">
            <Check on={dealUpdates} set={setDealUpdates}>Send me deal updates by text and email</Check>
            <Check on={marketing} set={setMarketing}>Send me market news (optional)</Check>
            <div className="k-note">You can change these any time. Consent follows Canada’s anti-spam law.</div>
          </div>
          <div className="k-card">
            <div className="k-label">TERMS AND PRIVACY</div>
            <Check on={terms} set={v => { setTerms(v); setError(''); }}>I agree to the Klyr Terms and the MLS® Virtual Office Website terms of use</Check>
            <Check on={privacy} set={v => { setPrivacy(v); setError(''); }}>I have read the privacy notice</Check>
            <div className="k-note">We’ll send a 6-digit code to {acct.email || 'your email'}. Sold prices show only after your email is confirmed.</div>
          </div>
          {error && <div className="k-error" role="alert">{error}</div>}
          <button className="k-btn" disabled={busy} onClick={() => createAccount('passkey')}>Create account with a passkey</button>
          <button className="k-btn k-alt" disabled={busy} onClick={() => createAccount('password')}>Use a password instead</button>
        </>
      )}

      {step === 'code' && (
        <CodeStep email={acct.email} purpose="signup" onDone={() => { setError(''); setStep('secure'); }} />
      )}

      {step === 'secure' && method === 'passkey' && (
        <>
          <h1 className="k-h1">Save a passkey</h1>
          <p className="k-sub">Sign in with your face, fingerprint or device PIN. Nothing to remember, and it can’t be phished.</p>
          {error && <div className="k-error" role="alert">{error}</div>}
          <button className="k-btn" disabled={busy} onClick={addPasskey}>Save passkey</button>
          <button className="k-btn k-alt" disabled={busy} onClick={() => { setError(''); setMethod('password'); }}>Use a password instead</button>
        </>
      )}

      {step === 'secure' && method === 'password' && (
        <>
          <h1 className="k-h1">Choose a password</h1>
          <p className="k-sub">At least 12 characters. A short sentence is easy to remember and hard to guess.</p>
          <div className="k-card"><Field label="Password" type="password" value={password} onChange={setPassword} autoComplete="new-password" /></div>
          {error && <div className="k-error" role="alert">{error}</div>}
          <button className="k-btn" disabled={busy || password.length < 12} onClick={savePassword}>Save password</button>
          <button className="k-btn k-alt" onClick={() => router.replace('/')}>Skip for now, use email codes</button>
        </>
      )}
    </main>
  );
}

function Screen({ title, sub, children, next, nextLabel = 'Continue' }: { title: string; sub: string; children: ReactNode; next: () => void; nextLabel?: string }) {
  return (
    <>
      <div><h1 className="k-h1">{title}</h1><p className="k-sub" style={{ marginTop: 4 }}>{sub}</p></div>
      {children}
      <button className="k-btn" onClick={next}>{nextLabel}</button>
    </>
  );
}

export function Field({ label, value, onChange, ...rest }: { label: string; value: string; onChange: (v: string) => void } & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'>) {
  return <label className="k-field">{label}<input value={value} onChange={e => onChange(e.target.value)} {...rest} /></label>;
}

function Check({ on, set, children }: { on: boolean; set: (v: boolean) => void; children: ReactNode }) {
  return (
    <button className="k-check" role="checkbox" aria-checked={on} onClick={() => set(!on)}>
      <span className="k-dot" aria-hidden>{on ? '✓' : ''}</span><span>{children}</span>
    </button>
  );
}
