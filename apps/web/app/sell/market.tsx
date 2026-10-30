'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Selling, SellerDecision, SellerOffer } from '@klyr/api-client';
import { fromTorontoInput, money, sellerNet, torontoInputValue, torontoWhen } from '@klyr/core';
import { StepUp } from '@/components/step-up';
import { errorText, klyr } from '@/lib/client';
import { consent326 } from '../offer/[id]/consent';
import { INTEREST, PRICE } from '../visits/visit-feedback';

const longDate = (ymd: string) => new Date(ymd + 'T12:00:00Z').toLocaleDateString('en-CA', { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
const STATUS: Partial<Record<SellerOffer['status'], string>> = {
  registered: 'Waiting for your answer', signed_back: 'You signed back', accepted: 'Accepted', rejected: 'Declined', expired: 'Expired', withdrawn: 'Withdrawn by the buyer', void: 'Ended',
};

type Pending = { kind: 'consent'; id: string } | { kind: 'offer'; id: string; decision: SellerDecision };

/** On the market: consents to sign, offers with what you'd keep at each price, and visit feedback. */
export function Market({ s, legalName }: { s: Selling; legalName: string }) {
  const router = useRouter();
  const [open, setOpen] = useState<{ id: string; action: 'accept' | 'sign_back' | 'consent' } | null>(null);
  const [name, setName] = useState('');
  const [read, setRead] = useState(false);
  const [price, setPrice] = useState(0);
  const [until, setUntil] = useState(torontoInputValue(new Date(Date.now() + 6 * 3_600_000)));
  const [pending, setPending] = useState<Pending | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function run(p: Pending) {
    setBusy(true); setError('');
    const r = p.kind === 'consent' ? await klyr.signSellerConsent(p.id, name) : await klyr.decideOffer(p.id, p.decision);
    setBusy(false);
    if (r.status === 403 && r.error?.code === 'step_up_required') return setPending(p);
    if (!r.ok) return setError(errorText(r.error));
    setOpen(null); setName(''); setRead(false); setPending(null);
    router.refresh();
  }
  if (pending) return <StepUp reason="Signing needs a fresh check." onCancel={() => setPending(null)} onDone={() => { const p = pending; setPending(null); void run(p); }} />;

  const signBox = (label: string, onSign: () => void, disabled = false) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}><input type="checkbox" checked={read} onChange={e => setRead(e.target.checked)} /> I’ve read this. Once signed, it’s binding.</label>
      <label className="k-field">Type your full name to sign ({legalName})<input value={name} onChange={e => setName(e.target.value)} autoComplete="name" /></label>
      {error && <div className="k-error" role="alert">{error}</div>}
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="k-btn" disabled={busy || disabled || !read || name.trim().length < 2} onClick={onSign}>{label}</button>
        <button className="k-btn k-alt" disabled={busy} onClick={() => { setOpen(null); setError(''); }}>Back</button>
      </div>
    </div>
  );
  const waiting = s.consents.filter(c => !c.sellerSignedAt);
  const live = s.offers.filter(o => o.status === 'registered');

  return (
    <>
      {waiting.map(c => (
        <section key={c.id} className="k-card" aria-label={`Consent for ${c.buyer}`} style={{ boxShadow: '0 0 0 2px var(--brand)' }}>
          <div className="k-label">● ACTION · OREA FORM 326</div>
          <strong style={{ fontSize: 18 }}>A Klyr buyer wants to make an offer</strong>
          <span className="k-note">{c.buyer} is also a Klyr client{c.buyerSignedAt ? ` and consented ${torontoWhen(c.buyerSignedAt)}` : ''}. They can offer once you consent to Klyr representing both of you.</span>
          {consent326('seller').map(([k, v], i) => (
            <div key={k} style={{ padding: '6px 0', borderTop: i ? '.5px solid var(--sep)' : 0 }}><strong>{k}</strong><div className="k-note">{v}</div></div>
          ))}
          {open?.id === c.id ? signBox('Sign consent', () => run({ kind: 'consent', id: c.id }))
            : <button className="k-btn" style={{ width: 'auto', padding: '0 18px', alignSelf: 'flex-start' }} onClick={() => { setOpen({ id: c.id, action: 'consent' }); setRead(false); setName(''); }}>Review and sign</button>}
        </section>
      ))}

      {s.offers.length > 0 && (
        <section className="k-card" aria-label="Offers">
          <div className="k-label">OFFERS · {live.length} WAITING FOR YOU</div>
          {s.offers.map((o, i) => (
            <article key={o.id} aria-label={`Offer of ${money(o.price)}`} style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '10px 0', borderTop: i ? '.5px solid var(--sep)' : 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                <strong style={{ fontSize: 20 }}>{money(o.price)}</strong>
                <span className="k-note">{STATUS[o.status] ?? o.status}</span>
              </div>
              <div style={{ fontWeight: 700 }}>You’d keep about {money(o.net)}</div>
              <div className="k-note">
                Deposit {money(o.deposit)} · {o.conditions.length ? o.conditions.join(' · ') : 'No conditions'} · closing {longDate(o.closingDate)}
                {o.status === 'registered' ? ` · open until ${torontoWhen(o.irrevocableAt)}` : ''}
              </div>
              {o.signBack && <div className="k-note">Your sign-back: {money(o.signBack.price)} (you’d keep {money(o.signBack.net)}) · {o.signBack.status === 'signed_back' ? `buyer has until ${torontoWhen(o.signBack.irrevocableAt)}` : STATUS[o.signBack.status] ?? o.signBack.status}</div>}
              {o.status === 'registered' && (open?.id === o.id ? (
                open.action === 'accept'
                  ? <><span className="k-note">Accepting at {money(o.price)} makes it a binding agreement on these terms.</span>{signBox(`Accept ${money(o.price)}`, () => run({ kind: 'offer', id: o.id, decision: { result: 'accepted', typedName: name, readConfirmed: true } }))}</>
                  : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <label className="k-field" style={{ flex: 1, minWidth: 160 }}>Your price<input inputMode="numeric" value={price ? price.toLocaleString('en-CA') : ''} onChange={e => setPrice(Number(e.target.value.replace(/\D/g, '')) || 0)} /></label>
                        <label className="k-field" style={{ flex: 1, minWidth: 200 }}>Buyer has until<input type="datetime-local" value={until} onChange={e => setUntil(e.target.value)} /></label>
                      </div>
                      {price > 0 && <span className="k-note">At {money(price)} you’d keep about {money(sellerNet({ price, plan: s.plan, coop: s.coop, mortgageBalance: s.mortgageBalance }).net)}. Other terms stay the same.</span>}
                      {signBox('Sign back', () => run({ kind: 'offer', id: o.id, decision: { result: 'signed_back', price, irrevocableAt: fromTorontoInput(until).toISOString(), typedName: name, readConfirmed: true } }), price <= o.price)}
                    </div>
                  )
              ) : (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button className="k-btn" style={{ width: 'auto', padding: '0 16px' }} onClick={() => { setOpen({ id: o.id, action: 'accept' }); setRead(false); setName(''); setError(''); }}>Accept</button>
                  <button className="k-btn k-alt" style={{ width: 'auto', padding: '0 16px' }} onClick={() => { setOpen({ id: o.id, action: 'sign_back' }); setPrice(Math.max(o.price, s.listPrice)); setRead(false); setName(''); setError(''); }}>Sign back</button>
                  <button className="k-btn k-alt" style={{ width: 'auto', padding: '0 16px' }} disabled={busy} onClick={() => { if (confirm('Decline this offer?')) void run({ kind: 'offer', id: o.id, decision: { result: 'rejected' } }); }}>Decline</button>
                </div>
              ))}
            </article>
          ))}
          {error && !open && <div className="k-error" role="alert">{error}</div>}
          <span className="k-note">You decide on every offer. Your agent can talk it through with you, but Klyr never answers for you.</span>
        </section>
      )}

      {s.visits.length > 0 && (
        <section className="k-card" aria-label="Visits">
          <div className="k-label">VISITS · {s.visits.filter(v => v.status === 'completed').length} DONE · {s.visits.filter(v => v.status !== 'completed').length} BOOKED</div>
          {s.visits.map((v, i) => (
            <div key={v.id} style={{ padding: '8px 0', borderTop: i ? '.5px solid var(--sep)' : 0 }}>
              <strong>{torontoWhen(v.at)}</strong> <span className="k-note">· {v.status === 'completed' ? 'visited' : v.status}</span>
              {v.feedback && <div className="k-note" style={{ color: 'var(--text)' }}>{INTEREST[v.feedback.interest]} · {PRICE[v.feedback.price]}{v.feedback.comment ? ` · “${v.feedback.comment}”` : ''}</div>}
            </div>
          ))}
        </section>
      )}
    </>
  );
}
