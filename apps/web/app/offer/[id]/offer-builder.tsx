'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Assumptions, OfferTermsInput } from '@klyr/api-client';
import { OFFER_RULES } from '@klyr/contracts';
import { buyerEstimate, fromTorontoInput, money, type PropertyType, TORONTO, torontoInputValue, torontoWhen } from '@klyr/core';
import { StepUp } from '@/components/step-up';
import { errorText, klyr } from '@/lib/client';

type Home = { id: string; price: number; city: string; type: PropertyType; coop: number; tax: number; fee?: number; brokerage: string };
type Cond = 'financingDays' | 'inspectionDays' | 'statusCertificateDays';

const when = (iso: string) => torontoWhen(iso);
const longDate = (ymd: string) => new Date(ymd + 'T12:00:00Z').toLocaleDateString('en-CA', { weekday: 'short', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });

/** Build → review → sign. The all-in at the offered price updates as you type, with the buyer's own assumptions. */
export function OfferBuilder({ listing: l, assumptions: a, initial, enabled, agent, legalName }: {
  listing: Home; assumptions: Assumptions; initial: OfferTermsInput; enabled: boolean; agent: string; legalName: string;
}) {
  const router = useRouter();
  const [t, setT] = useState(initial);
  const [step, setStep] = useState<'build' | 'review'>('build');
  const [offerId, setOfferId] = useState<string | null>(null);
  const [read, setRead] = useState(false);
  const [name, setName] = useState('');
  const [stepUp, setStepUp] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');

  const set = <K extends keyof OfferTermsInput>(k: K, v: OfferTermsInput[K]) => setT(x => ({ ...x, [k]: v }));
  const est = useMemo(() => buyerEstimate({ price: l.price, city: l.city, type: l.type, coop: l.coop, tax: l.tax, fee: l.fee },
    { price: t.price, rate: a.rate, downPct: a.downPct, firstTime: a.firstTime, lawyer: a.lawyerFee }), [t.price, l, a]);
  const asking = useMemo(() => buyerEstimate({ price: l.price, city: l.city, type: l.type, coop: l.coop, tax: l.tax, fee: l.fee },
    { rate: a.rate, downPct: a.downPct, firstTime: a.firstTime, lawyer: a.lawyerFee }), [l, a]);
  const diff = est.allIn - asking.allIn;
  const condo = l.type === 'Condo';
  const conds: [Cond, string, string][] = [
    ['financingDays', 'Financing', 'Your lender approves the mortgage and the appraisal.'],
    ...(condo ? [['statusCertificateDays', 'Status certificate', 'Your lawyer reviews the condo corporation’s finances and rules.'] as [Cond, string, string]]
      : [['inspectionDays', 'Inspection', 'A home inspector checks the house; you decide if you’re satisfied.'] as [Cond, string, string]]),
  ];
  const firm = conds.every(([k]) => !t[k]);

  async function save(): Promise<string | null> {
    setBusy(true); setError(''); setNote('');
    const r = await klyr.saveOffer(t);
    setBusy(false);
    if (!r.ok) { setError(errorText(r.error)); return null; }
    setOfferId(r.data.id);
    return r.data.id;
  }

  async function sign() {
    if (!offerId) return;
    setBusy(true); setError('');
    const r = await klyr.signOffer(offerId, name);
    setBusy(false);
    if (r.status === 403 && r.error?.code === 'step_up_required') return setStepUp(true);
    if (!r.ok) return setError(errorText(r.error));
    router.push('/offers?sent=1');
    router.refresh();
  }

  if (stepUp) return <StepUp reason="Signing an offer needs a fresh check." onCancel={() => setStepUp(false)} onDone={() => { setStepUp(false); void sign(); }} />;

  const hero = (
    <section className="k-card" style={{ background: 'var(--ink)', color: '#fff', borderRadius: 20, padding: 18 }} aria-label="All-in at this offer">
      <div className="k-label" style={{ color: '#8CC2B1' }}>ALL-IN AT THIS OFFER</div>
      <div style={{ fontSize: 38, fontWeight: 800, letterSpacing: '-.03em', lineHeight: 1 }}>{money(est.allIn)}</div>
      <div style={{ fontSize: 13, color: '#C9DDD6' }}>
        {diff === 0 ? 'Same as at asking' : `${diff > 0 ? '+' : '−'}${money(Math.abs(diff))} vs asking`} · cash back {money(est.cashBack)} · land transfer tax {money(est.ltt.total)}
      </div>
    </section>
  );

  if (step === 'review') {
    const rows: [string, string][] = [
      ['Price', money(t.price)],
      ['Deposit', t.deposit ? `${money(t.deposit)} to ${l.brokerage} in trust, within 24 hours of acceptance` : 'None'],
      ['Open until', `${when(t.irrevocableAt)}. After that the offer is void.`],
      ['Closing', longDate(t.closingDate)],
      ['Included', t.inclusions || 'Nothing beyond the property'],
      ...(t.exclusions ? [['Excluded', t.exclusions] as [string, string]] : []),
      ...conds.filter(([k]) => t[k]).map(([k, label]) => [`${label} condition`, `${t[k]} banking days after acceptance, until 11:59 pm`] as [string, string]),
      ...(firm ? [['Conditions', 'None: firm once accepted'] as [string, string]] : []),
    ];
    return (
      <>
        {hero}
        <section className="k-card" aria-label="Your offer">
          <div className="k-label">YOUR OFFER · OREA FORM {condo ? '101' : '100'}{firm ? '' : ' WITH SCHEDULE A'}</div>
          <dl style={{ margin: 0 }}>
            {rows.map(([k, v], i) => (
              <div key={k} style={{ display: 'flex', gap: 12, padding: '9px 0', borderTop: i ? '.5px solid var(--sep)' : 0 }}>
                <dt style={{ width: 150, flex: 'none', color: 'var(--muted)', fontSize: 14 }}>{k}</dt><dd style={{ margin: 0, fontWeight: 600, fontSize: 14 }}>{v}</dd>
              </div>
            ))}
          </dl>
        </section>
        <p className="k-note" style={{ margin: 0 }}>
          {agent} reviews your offer before it goes to {l.brokerage}. The listing brokerage confirms it received it (Form 801). You can withdraw it until the seller accepts.
        </p>
        <section className="k-card">
          <button className="k-check" role="checkbox" aria-checked={read} onClick={() => setRead(!read)}>
            <span className="k-dot" aria-hidden>{read ? '✓' : ''}</span><span>I’ve read my offer. Once the seller accepts it, it’s a binding agreement.</span>
          </button>
          <label className="k-field">Type your full name to sign ({legalName})
            <input value={name} onChange={e => setName(e.target.value)} autoComplete="name" />
          </label>
          {error && <div className="k-error" role="alert">{error}</div>}
          <button className="k-btn" disabled={busy || !read || name.trim().length < 2} onClick={sign}>Sign and send to {agent}</button>
          <button className="k-btn k-alt" disabled={busy} onClick={() => setStep('build')}>Change the offer</button>
        </section>
      </>
    );
  }

  const min = Math.round((l.price * 0.9) / 5000) * 5000, max = Math.round((l.price * 1.15) / 5000) * 5000;
  return (
    <>
      {hero}
      <fieldset disabled={!enabled} style={{ border: 0, padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 12, opacity: enabled ? 1 : 0.6 }}>
        <section className="k-card" aria-label="Price and deposit">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span className="k-label">OFFER PRICE</span><span className="k-note">Asking {money(l.price)}</span>
          </div>
          <input type="range" aria-label="Offer price slider" min={min} max={max} step={5000} value={Math.min(max, Math.max(min, t.price))} onChange={e => set('price', +e.target.value)} />
          <label className="k-field">Price
            <input inputMode="numeric" value={t.price.toLocaleString('en-CA')} onChange={e => set('price', Number(e.target.value.replace(/\D/g, '')) || 0)} />
          </label>
          <label className="k-field">Deposit · usually {OFFER_RULES.defaultDepositPct}% · within 24 hours of acceptance
            <input inputMode="numeric" value={t.deposit.toLocaleString('en-CA')} onChange={e => set('deposit', Number(e.target.value.replace(/\D/g, '')) || 0)} />
          </label>
          <span className="k-note">Paid to {l.brokerage} in trust and credited to the price at closing. Returned in full if a condition isn’t met.</span>
        </section>

        <section className="k-card" aria-label="Conditions">
          <div className="k-label">CONDITIONS · SCHEDULE A</div>
          {conds.map(([k, label, sub]) => (
            <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 44 }}>
              <button className="k-check" role="checkbox" aria-checked={!!t[k]} style={{ flex: 1 }} onClick={() => set(k, t[k] ? null : OFFER_RULES.defaultConditionDays)}>
                <span className="k-dot" aria-hidden>{t[k] ? '✓' : ''}</span>
                <span><strong>{label}</strong><br /><span className="k-note">{sub}</span></span>
              </button>
              {t[k] && (
                <select aria-label={`${label}: banking days`} value={t[k]!} onChange={e => set(k, +e.target.value)} className="k-select">
                  {Array.from({ length: OFFER_RULES.maxConditionDays }, (_, i) => i + 1).map(n => <option key={n} value={n}>{n} banking day{n > 1 ? 's' : ''}</option>)}
                </select>
              )}
            </div>
          ))}
          {firm && (
            <div className="k-error" style={{ background: '#FBEBDD', color: '#A54B00' }}>
              <strong>No conditions.</strong> You’re firm the moment it’s accepted. If the appraisal comes in low, you cover the gap. Get your mortgage approval first.
            </div>
          )}
        </section>

        <section className="k-card" aria-label="Dates and what's included">
          <label className="k-field">Open until (Toronto time)
            <input type="datetime-local" value={torontoInputValue(t.irrevocableAt)} onChange={e => e.target.value && set('irrevocableAt', fromTorontoInput(e.target.value).toISOString())} />
          </label>
          <label className="k-field">Closing date
            <input type="date" value={t.closingDate} onChange={e => set('closingDate', e.target.value)} />
          </label>
          <label className="k-field">Included
            <input value={t.inclusions} onChange={e => set('inclusions', e.target.value)} maxLength={500} />
          </label>
          <label className="k-field">Excluded (optional)
            <input value={t.exclusions} onChange={e => set('exclusions', e.target.value)} maxLength={500} />
          </label>
          <label className="k-field">Note for {agent} (optional)
            <input value={t.noteToAgent} onChange={e => set('noteToAgent', e.target.value)} maxLength={1000} placeholder="e.g. Can we ask for a shorter closing?" />
          </label>
        </section>

        {error && <div className="k-error" role="alert">{error}</div>}
        {note && <div className="k-note" role="status">{note}</div>}
        <button className="k-btn" disabled={busy} onClick={async () => { if (await save()) { setStep('review'); window.scrollTo(0, 0); } }}>Review and sign</button>
        <button className="k-btn k-alt" disabled={busy} onClick={async () => { if (await save()) setNote('Draft saved. Pick it up from Offers any time.'); }}>Save draft</button>
      </fieldset>
    </>
  );
}
