'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Viewing } from '@klyr/api-client';
import { fromTorontoInput, torontoInputValue, torontoWhen } from '@klyr/core';
import { errorText, klyr } from '@/lib/client';
import { VisitFeedbackForm } from '../../visits/visit-feedback';

const STATUS: Record<Viewing['status'], string> = { requested: 'Waiting for your agent to confirm', confirmed: 'Confirmed', declined: 'Can’t go ahead', cancelled: 'Cancelled', completed: 'Viewed' };

/** Book a viewing; your agent confirms it and meets you there. After it, a few taps of feedback. */
export function Viewings({ listingId, viewings, canBook }: { listingId: string; viewings: Viewing[]; canBook: boolean }) {
  const router = useRouter();
  const tomorrow = new Date(Date.now() + 86_400_000); tomorrow.setUTCHours(22, 0, 0, 0);
  const [at, setAt] = useState(torontoInputValue(tomorrow));
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const upcoming = viewings.some(v => (v.status === 'requested' || v.status === 'confirmed') && Date.parse(v.at) > Date.now());

  async function book() {
    setBusy(true); setError('');
    const r = await klyr.bookViewing(listingId, fromTorontoInput(at).toISOString(), note.trim() || undefined);
    setBusy(false);
    if (!r.ok) return setError(errorText(r.error));
    setNote(''); router.refresh();
  }
  return (
    <section className="k-card" aria-label="Viewings">
      <div className="k-label">VIEWINGS</div>
      {viewings.map(v => (
        <div key={v.id} style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '6px 0', borderTop: '.5px solid var(--sep)' }}>
          <div><strong>{torontoWhen(v.at)}</strong> <span className="k-note">· {STATUS[v.status]}</span></div>
          {v.agentNote && <span className="k-note">Your agent: “{v.agentNote}”</span>}
          {v.status === 'completed' && <VisitFeedbackForm id={v.id} feedback={v.feedback} />}
        </div>
      ))}
      {canBook && !upcoming && (
        <>
          <span className="k-note">Your agent confirms the time with the landlord and meets you there. Tenant-occupied units need 24 hours’ written notice to the current tenant.</span>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <label className="k-field" style={{ flex: 1, minWidth: 200 }}>When<input type="datetime-local" value={at} onChange={e => setAt(e.target.value)} /></label>
            <label className="k-field" style={{ flex: 2, minWidth: 200 }}>Note for your agent (optional)<input value={note} onChange={e => setNote(e.target.value)} /></label>
          </div>
          {error && <div className="k-error" role="alert">{error}</div>}
          <button className="k-btn k-alt" style={{ width: 'auto', padding: '0 16px', alignSelf: 'flex-start' }} disabled={busy || !at} onClick={book}>Book a viewing</button>
        </>
      )}
      {!canBook && !viewings.length && <span className="k-note">Sign your tenant agreement ($0) to book viewings.</span>}
    </section>
  );
}
