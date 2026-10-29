'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { errorText, klyr } from '@/lib/client';

export function ReviewForm({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function decide(decision: 'approve' | 'reject') {
    setBusy(true); setError('');
    const r = await klyr.admin.reviewId(id, decision, note);
    setBusy(false);
    if (!r.ok) return setError(errorText(r.error));
    router.refresh();
  }

  const ready = note.trim().length >= 3;
  return (
    <>
      <label className="k-field a-field">Your reasoning (kept with the record)
        <textarea value={note} onChange={e => setNote(e.target.value)} maxLength={1000} placeholder="e.g. Former municipal councillor; savings confirmed from bank statements." />
      </label>
      {error && <div className="k-error" role="alert">{error}</div>}
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="k-btn" disabled={busy || !ready} onClick={() => decide('approve')} aria-label={`Approve ${name}`}>Approve</button>
        <button className="k-btn k-alt" disabled={busy || !ready} onClick={() => decide('reject')} aria-label={`Reject ${name}`} style={{ color: '#A11B1B' }}>Reject</button>
      </div>
    </>
  );
}
