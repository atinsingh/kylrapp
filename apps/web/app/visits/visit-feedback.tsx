'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { VisitFeedback } from '@klyr/api-client';
import { errorText, klyr } from '@/lib/client';

export const INTEREST = { yes: 'I’d consider an offer', maybe: 'Maybe', no: 'Not for me' } as const;
export const PRICE = { low: 'Priced low', fair: 'Priced fairly', high: 'Priced high' } as const;

/** After a visit: a few taps of feedback. The seller sees it without your name. */
export function VisitFeedbackForm({ id, feedback }: { id: string; feedback: VisitFeedback | null }) {
  const router = useRouter();
  const [f, setF] = useState<Partial<VisitFeedback>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if (feedback) return <div className="k-note">Your feedback: {INTEREST[feedback.interest]} · {PRICE[feedback.price]}{feedback.comment ? ` · “${feedback.comment}”` : ''}</div>;

  async function send() {
    setBusy(true); setError('');
    const r = await klyr.visitFeedback(id, f as VisitFeedback);
    setBusy(false);
    if (!r.ok) return setError(errorText(r.error));
    router.refresh();
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }} aria-label="Visit feedback">
      <div className="k-label">HOW WAS IT? THE SELLER SEES THIS WITHOUT YOUR NAME</div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }} role="group" aria-label="Interest">
        {(Object.keys(INTEREST) as VisitFeedback['interest'][]).map(k => <button key={k} className="k-chip" aria-pressed={f.interest === k} onClick={() => setF(x => ({ ...x, interest: k }))}>{INTEREST[k]}</button>)}
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }} role="group" aria-label="Price">
        {(Object.keys(PRICE) as VisitFeedback['price'][]).map(k => <button key={k} className="k-chip" aria-pressed={f.price === k} onClick={() => setF(x => ({ ...x, price: k }))}>{PRICE[k]}</button>)}
      </div>
      <label className="k-field">Comment (optional)<input value={f.comment ?? ''} onChange={e => setF(x => ({ ...x, comment: e.target.value || undefined }))} maxLength={500} /></label>
      {error && <div className="k-error" role="alert">{error}</div>}
      <button className="k-btn k-alt" style={{ width: 'auto', padding: '0 16px', alignSelf: 'flex-start' }} disabled={busy || !f.interest || !f.price} onClick={send}>Send feedback</button>
    </div>
  );
}
