'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { PartnerQuoteInput, PartnerRequest, QuoteKind } from '@klyr/api-client';
import { money, torontoWhen } from '@klyr/core';
import { errorText, klyr } from '@/lib/client';

const LABEL: Record<QuoteKind, string> = { lender: 'Mortgage', lawyer: 'Lawyer', inspector: 'Home inspection', insurer: 'Home insurance' };
const FIELDS: Record<QuoteKind, [string, string, number][]> = {
  lender: [['rate', 'Rate, % (5-year fixed)', 0], ['fees', 'Fees, $', 0], ['prepaymentPct', 'Prepayment, % a year', 20], ['approvalDays', 'Approval, days', 2]],
  lawyer: [['fee', 'Fee before HST, $', 0], ['disbursements', 'Disbursements, $', 0], ['titleInsurance', 'Title insurance, $', 0]],
  inspector: [['price', 'Price before HST, $', 0], ['reportHours', 'Report within, hours', 24]],
  insurer: [['annualPremium', 'Yearly premium, $', 0], ['deductible', 'Deductible, $', 1000]],
};
const STATUS = { open: 'Waiting for your quote', won: 'The client chose you', not_chosen: 'The client chose another provider', cancelled: 'Cancelled by the client' } as const;

export function PartnerQuote({ r, referral }: { r: PartnerRequest; referral: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [v, setV] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const ask = r.kind === 'lender' ? `${money(r.details.loan!)} over ${r.details.amortYears} years` : r.kind === 'lawyer' ? `purchase at ${money(r.details.price!)}` : r.kind === 'insurer' ? `home value ${money(r.details.homeValue!)}` : 'a home inspection';

  function start() {
    setOpen(true); setError('');
    const d = r.quote?.details ?? {};
    setV(Object.fromEntries([...FIELDS[r.kind].map(([k, , def]) => [k, d[k] != null ? String(k === 'rate' ? +(d[k]! * 100).toFixed(2) : d[k]) : def ? String(def) : '']), ['referralFee', String(r.quote?.referralFee ?? 0)], ['validDays', '30']]));
  }
  async function send() {
    setBusy(true); setError('');
    const num = (k: string) => Number(v[k] || 0);
    const base = { referralFee: referral && r.kind !== 'lawyer' ? num('referralFee') : 0, validDays: num('validDays') };
    const q = (r.kind === 'lender' ? { ...base, kind: 'lender', rate: Math.round(num('rate') * 100) / 10_000, fees: num('fees'), prepaymentPct: num('prepaymentPct'), approvalDays: num('approvalDays') }
      : r.kind === 'lawyer' ? { ...base, kind: 'lawyer', fee: num('fee'), disbursements: num('disbursements'), titleInsurance: num('titleInsurance') }
      : r.kind === 'inspector' ? { ...base, kind: 'inspector', price: num('price'), reportHours: num('reportHours') }
      : { ...base, kind: 'insurer', annualPremium: num('annualPremium'), deductible: num('deductible') }) as PartnerQuoteInput;
    const res = await klyr.partner.quote(r.id, q);
    setBusy(false);
    if (!res.ok) return setError(errorText(res.error));
    setOpen(false); router.refresh();
  }

  return (
    <article className="k-card" aria-label={`${LABEL[r.kind]} request from ${r.client.name}`}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
        <strong style={{ fontSize: 17 }}>{LABEL[r.kind]} · {r.client.name}</strong>
        <span className="k-note">{STATUS[r.status]}</span>
      </div>
      <span className="k-note">{ask} · asked {torontoWhen(r.createdAt)}{r.note ? ` · “${r.note}”` : ''}</span>
      {r.status === 'won' && r.client.email && <div className="p-fence">Contact {r.client.name} at <strong>{r.client.email}</strong>. They chose your quote.</div>}
      {r.quote && <span className="k-note">Your quote: {money(r.quote.clientCost)} to the client{r.kind === 'lender' ? ' over 5 years' : ''} · referral fee {money(r.quote.referralFee)}{r.quote.validUntil ? ` · valid until ${torontoWhen(r.quote.validUntil)}` : ''}</span>}
      {r.status === 'open' && (open ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {FIELDS[r.kind].map(([k, label]) => <label key={k} className="k-field" style={{ flex: 1, minWidth: 140 }}>{label}<input inputMode="decimal" value={v[k] ?? ''} onChange={e => setV(x => ({ ...x, [k]: e.target.value }))} /></label>)}
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {referral && r.kind !== 'lawyer' && <label className="k-field" style={{ flex: 1, minWidth: 140 }}>Referral fee to Klyr, $ (shown to the client)<input inputMode="numeric" value={v.referralFee ?? '0'} onChange={e => setV(x => ({ ...x, referralFee: e.target.value }))} /></label>}
            <label className="k-field" style={{ flex: 1, minWidth: 140 }}>Valid for, days<input inputMode="numeric" value={v.validDays ?? '30'} onChange={e => setV(x => ({ ...x, validDays: e.target.value }))} /></label>
          </div>
          {error && <div className="k-error" role="alert">{error}</div>}
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="k-btn" disabled={busy} onClick={send}>{r.quote ? 'Update quote' : 'Send quote'}</button>
            <button className="k-btn k-alt" disabled={busy} onClick={() => setOpen(false)}>Back</button>
          </div>
        </div>
      ) : <button className="k-btn" style={{ width: 'auto', padding: '0 16px', alignSelf: 'flex-start' }} onClick={start}>{r.quote ? 'Update your quote' : 'Write a quote'}</button>)}
    </article>
  );
}
