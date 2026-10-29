'use client';

import { useState } from 'react';
import Link from 'next/link';
import { affordFromIncome, money } from '@klyr/core';

/** Income and down payment in, maximum price out — live, using the same engine as the API. */
export function AffordCalculator({ rate, initialDownPct }: { rate: number; initialDownPct: number }) {
  const [income, setIncome] = useState(150_000);
  const [debts, setDebts] = useState(450);
  const [downPct, setDownPct] = useState(Math.round(initialDownPct * 100));
  const r = affordFromIncome({ income, debts, downPct: downPct / 100, rate });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <section className="k-card" aria-live="polite">
        <div className="k-label">YOU COULD BUY UP TO</div>
        <div style={{ fontSize: 36, fontWeight: 800, color: 'var(--brand)', letterSpacing: '-.02em' }}>{money(r.maxPrice)}</div>
        <div className="k-note">about {money(r.monthly)}/month · lenders test you at {(r.qualifyingRate * 100).toFixed(2)}%</div>
      </section>

      <section className="k-card">
        <Slider label="HOUSEHOLD INCOME" value={income} display={money(income)} min={50_000} max={500_000} step={5_000} onChange={setIncome} />
        <Slider label="MONTHLY DEBT PAYMENTS" value={debts} display={money(debts) + '/mo'} min={0} max={5_000} step={50} onChange={setDebts} />
        <Slider label="DOWN PAYMENT" value={downPct} display={downPct + '%'} min={5} max={50} step={1} onChange={setDownPct} />
      </section>

      <section className="k-card">
        <dl style={{ margin: 0 }}>
          {([
            ['Down payment', money(r.down)],
            ['Minimum required at this price', money(r.minDown)],
            ...(r.cmhc ? [['CMHC insurance, added to the mortgage', money(r.cmhc)], ['Ontario PST on it, due at closing', money(r.cmhcPst)]] : []),
            ['Mortgage payment', money(r.monthly) + '/mo'],
            ['Qualifying rate (stress test)', (r.qualifyingRate * 100).toFixed(2) + '%'],
          ] as [string, string][]).map(([k, v], i) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '8px 0', borderTop: i ? '.5px solid var(--sep)' : 0 }}>
              <dt>{k}</dt><dd style={{ margin: 0, fontWeight: 600 }}>{v}</dd>
            </div>
          ))}
        </dl>
        {r.limitedByDown && <div className="k-note" style={{ color: 'var(--warn)' }}>Your down payment, not your income, sets this limit: at this price you need at least {money(r.minDown)}.</div>}
        {r.maxPrice >= 1_500_000 && downPct < 20 && <div className="k-note" style={{ color: 'var(--warn)' }}>At $1.5M and up you need 20% down. Insured mortgages are only available under $1.5M.</div>}
      </section>

      <section className="k-card" style={{ fontSize: 13 }}>
        <div className="k-label">RULES USED</div>
        <div>· Housing costs up to 39% of income, all debts up to 44%.</div>
        <div>· Qualifying rate is the higher of your rate + 2% or 5.25%.</div>
        <div>· Property tax estimated at $500/month and heating at $100/month.</div>
        <div>· Estimate only. Your lender decides.</div>
      </section>

      <Link href={`/?maxPrice=${r.maxPrice}`} className="k-btn" style={{ display: 'grid', placeItems: 'center', textDecoration: 'none' }}>Search homes up to {money(r.maxPrice)}</Link>
    </div>
  );
}

function Slider({ label, value, display, min, max, step, onChange }: { label: string; value: number; display: string; min: number; max: number; step: number; onChange: (v: number) => void }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span className="k-label">{label}</span><span style={{ fontWeight: 700 }}>{display}</span>
      </span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(Number(e.target.value))}
        aria-valuetext={display} style={{ accentColor: 'var(--brand)', width: '100%', minHeight: 32 }} />
    </label>
  );
}
