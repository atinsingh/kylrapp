'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { QuoteInput, QuoteKind, QuoteRequest } from '@klyr/api-client';
import { money } from '@klyr/core';
import { errorText, klyr } from '@/lib/client';

const LABEL: Record<QuoteKind, string> = { lender: 'Mortgage', lawyer: 'Lawyer', inspector: 'Home inspection', insurer: 'Home insurance' };
const FIELDS: Record<QuoteKind, [string, string, number][]> = {
  lender: [['rate', 'Rate, % (5-year fixed)', 0], ['fees', 'Fees, $', 0], ['prepaymentPct', 'Prepayment, % a year', 20], ['approvalDays', 'Approval, days', 2]],
  lawyer: [['fee', 'Fee before HST, $', 0], ['disbursements', 'Disbursements, $', 0], ['titleInsurance', 'Title insurance, $', 0]],
  inspector: [['price', 'Price before HST, $', 0], ['reportHours', 'Report within, hours', 24]],
  insurer: [['annualPremium', 'Yearly premium, $', 0], ['deductible', 'Deductible, $', 1000]],
};

export function QuoteBuilder({ r }: { r: QuoteRequest & { clientName: string | null; clientEmail: string } }) {
  const router = useRouter();
  const [provider, setProvider] = useState<string | null>(null);
  const [v, setV] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  function open(id: string) {
    setProvider(id); setError('');
    setV(Object.fromEntries([...FIELDS[r.kind].map(([k, , d]) => [k, d ? String(d) : '']), ['referralFee', '0'], ['validDays', '30']]));
  }
  async function save() {
    setBusy(true); setError('');
    const num = (k: string) => Number(v[k] || 0);
    const base = { providerId: provider!, referralFee: num('referralFee'), validDays: num('validDays') };
    const q = (r.kind === 'lender' ? { ...base, kind: 'lender', rate: num('rate') / 100, fees: num('fees'), prepaymentPct: num('prepaymentPct'), approvalDays: num('approvalDays') }
      : r.kind === 'lawyer' ? { ...base, kind: 'lawyer', fee: num('fee'), disbursements: num('disbursements'), titleInsurance: num('titleInsurance') }
      : r.kind === 'inspector' ? { ...base, kind: 'inspector', price: num('price'), reportHours: num('reportHours') }
      : { ...base, kind: 'insurer', annualPremium: num('annualPremium'), deductible: num('deductible') }) as QuoteInput;
    const res = await klyr.pro.enterQuote(r.id, q);
    setBusy(false);
    if (!res.ok) return setError(errorText(res.error));
    setProvider(null); router.refresh();
  }
  const ask = r.kind === 'lender' ? `${money(r.details.loan!)} over ${r.details.amortYears} years` : r.kind === 'lawyer' ? `purchase at ${money(r.details.price!)}` : r.kind === 'insurer' ? `home value ${money(r.details.homeValue!)}` : 'inspection';

  return (
    <article className="k-card" aria-label={`${LABEL[r.kind]} quotes for ${r.clientName ?? r.clientEmail}`}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
        <strong style={{ fontSize: 17 }}>{LABEL[r.kind]} · {r.clientName ?? r.clientEmail}</strong>
        <span className="k-note">{ask} · {r.quotes.length} of {r.providers.length} quoted{r.status !== 'open' ? ` · ${r.status}` : ''}</span>
      </div>
      {r.providers.map(p => {
        const q = r.quotes.find(x => x.provider.id === p.id);
        return (
          <div key={p.id} style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '8px 0', borderTop: '.5px solid var(--sep)' }}>
            <div><strong>{p.name}</strong> <span className="k-note">· {p.registration}{p.phone ? ` · ${p.phone}` : ''}</span></div>
            {q ? <span className="k-note">#{q.rank} · {money(q.clientCost)} to the client{r.kind === 'lender' ? ' over 5 years' : ''} · referral fee {money(q.referralFee)}{q.chosen ? ' · CHOSEN' : ''}</span> : <span className="k-note">No quote yet</span>}
            {r.status === 'open' && (provider === p.id ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {FIELDS[r.kind].map(([k, label]) => <label key={k} className="k-field" style={{ flex: 1, minWidth: 140 }}>{label}<input inputMode="decimal" value={v[k] ?? ''} onChange={e => setV(x => ({ ...x, [k]: e.target.value }))} /></label>)}
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <label className="k-field" style={{ flex: 1, minWidth: 140 }}>Referral fee to Klyr, $<input inputMode="numeric" disabled={r.kind === 'lawyer'} value={v.referralFee ?? '0'} onChange={e => setV(x => ({ ...x, referralFee: e.target.value }))} /></label>
                  <label className="k-field" style={{ flex: 1, minWidth: 140 }}>Valid for, days<input inputMode="numeric" value={v.validDays ?? '30'} onChange={e => setV(x => ({ ...x, validDays: e.target.value }))} /></label>
                </div>
                {error && <div className="k-error" role="alert">{error}</div>}
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="k-btn" disabled={busy} onClick={save}>Save quote</button>
                  <button className="k-btn k-alt" disabled={busy} onClick={() => setProvider(null)}>Back</button>
                </div>
              </div>
            ) : (
              <button className="k-btn k-alt" style={{ width: 'auto', padding: '0 14px', minHeight: 40, alignSelf: 'flex-start' }} onClick={() => open(p.id)}>{q ? 'Update quote' : 'Enter quote'}</button>
            ))}
          </div>
        );
      })}
    </article>
  );
}
