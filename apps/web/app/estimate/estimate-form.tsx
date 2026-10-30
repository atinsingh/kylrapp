'use client';

import { useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { shortDate, HST } from '@klyr/core';
import type { Assumptions } from '@klyr/api-client';
import { errorText, klyr } from '@/lib/client';

const RATES = [0.0399, 0.0449, 0.0499];
const DOWNS = [0.05, 0.1, 0.15, 0.2, 0.25];
/** Sample lawyer quotes from the prototype's marketplace; real quotes come from the provider apps. */
const LAWYERS: [string, number][] = [['Harbour Law', 1400], ['Ng & Patel LLP', 1650], ['Brightside Legal', 1850]];
const pct = (n: number) => `${+(n * 100).toFixed(2)}%`;
const money = (n: number) => '$' + Math.round(n).toLocaleString('en-CA');

export function EstimateForm({ initial }: { initial: Assumptions & { custom: boolean; asOf: string } }) {
  const router = useRouter();
  const [a, setA] = useState<Assumptions>(initial);
  const [custom, setCustom] = useState(initial.custom);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const dirty = a.rate !== initial.rate || a.downPct !== initial.downPct || a.firstTime !== initial.firstTime || a.lawyerFee !== initial.lawyerFee;

  async function save() {
    const r = await klyr.setAssumptions(a);
    if (!r.ok) return setStatus({ ok: false, text: errorText(r.error) });
    setCustom(true); setStatus({ ok: true, text: 'Saved. Every all-in now uses these inputs.' });
    router.refresh();
  }
  async function reset() {
    const r = await klyr.resetAssumptions();
    if (!r.ok) return setStatus({ ok: false, text: errorText(r.error) });
    setA(r.data); setCustom(false); setStatus({ ok: true, text: 'Back to the standard inputs.' });
    router.refresh();
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Card label="MORTGAGE RATE · 5-YEAR FIXED" note="Lenders also test you at the higher of your rate + 2% or 5.25%.">
        <Chips options={RATES.map(r => [pct(r), r])} value={a.rate} onPick={rate => setA({ ...a, rate })} />
      </Card>
      <Card label="DOWN PAYMENT" note="Under 20% adds CMHC insurance, plus 8% Ontario PST on the premium paid at closing. Where your choice is below the legal minimum for a home, we use the minimum and say so on the listing.">
        <Chips options={DOWNS.map(d => [pct(d), d])} value={a.downPct} onPick={downPct => setA({ ...a, downPct })} />
      </Card>
      <Card label="FIRST-TIME BUYER" note="Refunds up to $4,000 Ontario and $4,475 Toronto land transfer tax.">
        <Chips options={[['Yes', true], ['No', false]]} value={a.firstTime} onPick={firstTime => setA({ ...a, firstTime })} />
      </Card>
      <Card label="LAWYER" note={`Quoted fee + 13% HST + $450 typical disbursements = ${money(a.lawyerFee * HST + 450)}`}>
        <Chips options={LAWYERS.map(([n, f]) => [`${n} · ${money(f)}`, f])} value={a.lawyerFee} onPick={lawyerFee => setA({ ...a, lawyerFee })} />
      </Card>

      {status && <div className={status.ok ? 'k-card' : 'k-error'} role="status" style={status.ok ? { background: 'var(--tint)', color: 'var(--brand)', fontWeight: 600 } : undefined}>{status.text}</div>}
      <button className="k-btn" disabled={!dirty} onClick={save}>Save and update all-ins</button>
      {custom && <button className="k-btn k-alt" onClick={reset}>Use the standard inputs</button>}

      <section className="k-card">
        <div className="k-label">ALSO IN THE BUYER ALL-IN</div>
        <Rows rows={[
          ['Land transfer tax', 'Ontario + Toronto rates, Oct 2026'], ['Inspection', '$550 · houses'], ['Title insurance', '$350'],
          ['Status certificate', '$100 · condos'], ['Adjustments', 'Property tax, utilities, fuel, condo fee · prorated'],
          ['Klyr fees to buyers', '$0'], ['Cash back', 'Your plan % of the commission offered'],
        ]} />
        <p className="k-note" style={{ margin: 0 }}>Not included: down payment, moving costs, HST on a new build, and any special assessment not yet known. Estimates as of {shortDate(initial.asOf)}. Your lawyer’s statement of adjustments gives the final figure.</p>
      </section>
    </div>
  );
}

function Card({ label, note, children }: { label: string; note: string; children: ReactNode }) {
  return <section className="k-card"><div className="k-label">{label}</div>{children}<div className="k-note">{note}</div></section>;
}

function Chips<T>({ options, value, onPick }: { options: [string, T][]; value: T; onPick: (v: T) => void }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {options.map(([l, v]) => <button key={l} className="k-chip" aria-pressed={v === value} onClick={() => onPick(v)}>{l}</button>)}
    </div>
  );
}

function Rows({ rows }: { rows: [string, string][] }) {
  return (
    <dl style={{ margin: 0 }}>
      {rows.map(([k, v], i) => (
        <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '8px 0', borderTop: i ? '.5px solid var(--sep)' : 0, fontSize: 14 }}>
          <dt>{k}</dt><dd style={{ margin: 0, color: 'var(--muted)', textAlign: 'right' }}>{v}</dd>
        </div>
      ))}
    </dl>
  );
}
