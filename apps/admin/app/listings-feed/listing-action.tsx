'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { errorText, klyr } from '@/lib/client';

/** Suspend hides a listing from every client screen at once; restore brings it back. Both are logged. */
export function ListingAction({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function run(fn: () => Promise<{ ok: boolean; error?: { code?: string; message?: unknown } }>) {
    setBusy(true); setError('');
    const r = await fn();
    setBusy(false);
    if (!r.ok) return setError(errorText(r.error));
    setOpen(false); setReason(''); router.refresh();
  }
  if (status === 'suspended') return <button className="k-btn k-alt" style={{ width: 'auto', padding: '0 14px', minHeight: 40, alignSelf: 'flex-start' }} disabled={busy} onClick={() => run(() => klyr.admin.restoreListing(id))}>Restore</button>;
  if (status !== 'active') return null;
  return open ? (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <label className="k-field">Reason (logged)<input value={reason} onChange={e => setReason(e.target.value)} /></label>
      {error && <div className="k-error" role="alert">{error}</div>}
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="k-btn" disabled={busy || reason.trim().length < 5} onClick={() => run(() => klyr.admin.suspendListing(id, reason))}>Suspend listing</button>
        <button className="k-btn k-alt" onClick={() => setOpen(false)}>Back</button>
      </div>
    </div>
  ) : <button className="k-btn k-alt" style={{ width: 'auto', padding: '0 14px', minHeight: 40, alignSelf: 'flex-start' }} onClick={() => setOpen(true)}>Suspend…</button>;
}
