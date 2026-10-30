'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { errorText, klyr } from '@/lib/client';

export function PublishForm({ current }: { current: { rate: number; downPct: number; lawyerFee: number } }) {
  const router = useRouter();
  const [rate, setRate] = useState((current.rate * 100).toFixed(2));
  const [down, setDown] = useState(String(Math.round(current.downPct * 100)));
  const [fee, setFee] = useState(String(current.lawyerFee));
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function publish() {
    setBusy(true); setError('');
    const r = await klyr.admin.publishAssumptions({ rate: Math.round(Number(rate) * 100) / 10_000, downPct: Math.round(Number(down)) / 100, lawyerFee: Number(fee), note });
    setBusy(false);
    if (!r.ok) return setError(errorText(r.error));
    setNote(''); router.refresh();
  }
  return (
    <section className="k-card" aria-label="Publish">
      <div className="k-label">PUBLISH A NEW VERSION</div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <label className="k-field" style={{ flex: 1, minWidth: 140 }}>5-year fixed rate, %<input inputMode="decimal" value={rate} onChange={e => setRate(e.target.value)} /></label>
        <label className="k-field" style={{ flex: 1, minWidth: 140 }}>Down payment, %<input inputMode="numeric" value={down} onChange={e => setDown(e.target.value)} /></label>
        <label className="k-field" style={{ flex: 1, minWidth: 140 }}>Lawyer’s fee before HST, $<input inputMode="numeric" value={fee} onChange={e => setFee(e.target.value)} /></label>
      </div>
      <label className="k-field">Why it changed (shown in the history)<input value={note} onChange={e => setNote(e.target.value)} /></label>
      {error && <div className="k-error" role="alert">{error}</div>}
      <button className="k-btn" disabled={busy || note.trim().length < 10} onClick={publish}>Publish</button>
    </section>
  );
}
