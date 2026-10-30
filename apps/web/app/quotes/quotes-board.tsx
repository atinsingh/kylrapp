'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Provider, Quote, QuoteKind, QuoteRequest, QuoteRequestInput } from '@klyr/api-client';
import { money, torontoWhen } from '@klyr/core';
import { errorText, klyr } from '@/lib/client';

const n = (v: string) => Number(v.replace(/\D/g, '')) || 0;
export const KIND: Record<QuoteKind, [string, string]> = {
  lender: ['Mortgage', 'Compared on 5-year cost: interest plus fees, not the headline rate.'],
  lawyer: ['Lawyer', 'Fee with HST, disbursements and title insurance. Lawyers can’t pay referral fees.'],
  inspector: ['Home inspection', 'Price with HST, and how soon the report arrives.'],
  insurer: ['Home insurance', 'Yearly premium and deductible. Your lender needs a binder before closing.'],
};
/** One line per quote, in the client's terms. */
export function quoteLine(kind: QuoteKind, q: Quote) {
  const d = q.details;
  return kind === 'lender' ? `${(d.rate! * 100).toFixed(2)}% · ${money(d.monthly!)}/month · fees ${money(d.fees!)} · prepay ${d.prepaymentPct}%/year · approval in ${d.approvalDays} day(s)`
    : kind === 'lawyer' ? `Fee ${money(d.fee!)} + HST ${money(d.hst!)} · disbursements ${money(d.disbursements!)} · title insurance ${money(d.titleInsurance!)}`
    : kind === 'inspector' ? `${money(d.price!)} + HST ${money(d.hst!)} · report within ${d.reportHours} h`
    : `Deductible ${money(d.deductible!)}`;
}

export function QuotesBoard({ requests, providers }: { requests: QuoteRequest[]; providers: Provider[] }) {
  const router = useRouter();
  const [kind, setKind] = useState<QuoteKind | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [amount, setAmount] = useState(0);
  const [amort, setAmort] = useState<25 | 30>(25);
  const [disclose, setDisclose] = useState<Quote | null>(null);
  const [ack, setAck] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const open = new Set(requests.filter(r => r.status === 'open').map(r => r.kind));

  async function ask() {
    if (!kind) return;
    setBusy(true); setError('');
    const body: QuoteRequestInput = kind === 'lender' ? { kind, providerIds: picked, loan: amount, amortYears: amort }
      : kind === 'lawyer' ? { kind, providerIds: picked, price: amount } : kind === 'insurer' ? { kind, providerIds: picked, homeValue: amount } : { kind, providerIds: picked };
    const r = await klyr.requestQuotes(body);
    setBusy(false);
    if (!r.ok) return setError(errorText(r.error));
    setKind(null); setPicked([]); setAmount(0); router.refresh();
  }
  async function choose(q: Quote, acknowledged: boolean) {
    setBusy(true); setError('');
    const r = await klyr.chooseQuote(q.id, acknowledged);
    setBusy(false);
    if (!r.ok) return setError(errorText(r.error));
    setDisclose(null); setAck(false); router.refresh();
  }

  return (
    <>
      <section className="k-card" aria-label="Ask for quotes">
        <div className="k-label">ASK FOR QUOTES</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }} role="group" aria-label="Kind">
          {(Object.keys(KIND) as QuoteKind[]).map(k => <button key={k} className="k-chip" aria-pressed={kind === k} disabled={open.has(k)} onClick={() => { setKind(k); setPicked([]); setError(''); }}>{KIND[k][0]}{open.has(k) ? ' · on the way' : ''}</button>)}
        </div>
        {kind && (
          <>
            <span className="k-note">{KIND[kind][1]}</span>
            {providers.filter(p => p.kind === kind).map(p => (
              <label key={p.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <input type="checkbox" checked={picked.includes(p.id)} disabled={!picked.includes(p.id) && picked.length >= 4} onChange={e => setPicked(x => e.target.checked ? [...x, p.id] : x.filter(i => i !== p.id))} />
                <span><strong>{p.name}</strong> <span className="k-note">· {p.registration}</span><br /><span className="k-note">{p.about} {p.paysReferral ? 'May pay Klyr a referral fee, shown on the quote.' : 'Pays Klyr nothing.'}</span></span>
              </label>
            ))}
            {kind !== 'inspector' && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <label className="k-field" style={{ flex: 1, minWidth: 180 }}>{kind === 'lender' ? 'Mortgage amount' : kind === 'lawyer' ? 'Purchase price' : 'Home value to insure'}<input inputMode="numeric" value={amount ? amount.toLocaleString('en-CA') : ''} onChange={e => setAmount(n(e.target.value))} /></label>
                {kind === 'lender' && <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end' }} role="group" aria-label="Amortization">{([25, 30] as const).map(y => <button key={y} className="k-chip" aria-pressed={amort === y} onClick={() => setAmort(y)}>{y} years</button>)}</div>}
              </div>
            )}
            {error && <div className="k-error" role="alert">{error}</div>}
            <button className="k-btn" disabled={busy || !picked.length || (kind !== 'inspector' && amount < 50_000)} onClick={ask}>Ask {picked.length || ''} for quotes</button>
          </>
        )}
      </section>

      {requests.filter(r => r.status !== 'cancelled').map(r => (
        <section key={r.id} className="k-card" aria-label={`${KIND[r.kind][0]} quotes`}>
          <div className="k-label">{KIND[r.kind][0].toUpperCase()} · {r.quotes.length} OF {r.providers.length} QUOTED{r.status === 'chosen' ? ' · CHOSEN' : ''}</div>
          {r.kind === 'lender' && <span className="k-note">{money(r.details.loan!)} over {r.details.amortYears} years. Ranked by 5-year cost.</span>}
          {r.quotes.length === 0 && <span className="k-note">Your agent adds each quote here as it arrives, usually within a day. Waiting on {r.providers.map(p => p.name).join(', ')}.</span>}
          {r.quotes.map(q => (
            <article key={q.id} aria-label={`Quote from ${q.provider.name}`} style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '10px 0', borderTop: '.5px solid var(--sep)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                <strong>{q.rank}. {q.provider.name}</strong>
                <strong>{money(q.clientCost)}{r.kind === 'lender' ? ' over 5 years' : r.kind === 'insurer' ? ' a year' : ''}</strong>
              </div>
              <span className="k-note">{quoteLine(r.kind, q)}{q.vsBest ? ` · ${money(q.vsBest)} more than the lowest` : ' · lowest'}</span>
              <span className="k-note" style={{ color: q.referralFee ? 'var(--warn)' : 'var(--muted)', fontWeight: 600 }}>{q.referralFee ? `Klyr earns ${money(q.referralFee)} if you choose this` : 'Klyr earns nothing from this quote'}</span>
              {q.chosen && <span style={{ fontWeight: 700, color: 'var(--brand)' }}>✓ You chose this</span>}
              {r.status === 'open' && !q.expired && (disclose?.id === q.id ? (
                <div className="k-card" style={{ background: 'var(--warn-tint)', gap: 8 }} role="dialog" aria-label="Referral fee disclosure">
                  <strong>Referral fee disclosure</strong>
                  <span style={{ fontSize: 14 }}>{q.provider.name} pays Klyr Realty Inc., Brokerage {money(q.referralFee)} if you go ahead. It doesn’t change your price, and it played no part in how these quotes were ranked. You’re free to choose any provider, including one not listed.</span>
                  <label style={{ display: 'flex', gap: 8 }}><input type="checkbox" checked={ack} onChange={e => setAck(e.target.checked)} /> I’ve read this disclosure.</label>
                  {error && <div className="k-error" role="alert">{error}</div>}
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="k-btn" disabled={busy || !ack} onClick={() => choose(q, true)}>Choose {q.provider.name}</button>
                    <button className="k-btn k-alt" onClick={() => setDisclose(null)}>Back</button>
                  </div>
                </div>
              ) : (
                <button className="k-btn k-alt" style={{ width: 'auto', padding: '0 16px', alignSelf: 'flex-start' }} disabled={busy} onClick={() => (q.referralFee ? (setDisclose(q), setAck(false)) : void choose(q, false))}>Choose</button>
              ))}
              {q.expired && <span className="k-note">Expired {torontoWhen(q.validUntil!)}</span>}
            </article>
          ))}
          {r.status === 'open' && r.quotes.length > 0 && r.quotes.length < r.providers.length && <span className="k-note">Still waiting on {r.providers.filter(p => !p.quoted).map(p => p.name).join(', ')}.</span>}
        </section>
      ))}
    </>
  );
}
