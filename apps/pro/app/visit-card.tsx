'use client';

import { phone } from '@klyr/web-kit/styles';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Decision, ProShowing } from '@klyr/api-client';
import { GEOFENCE } from '@klyr/contracts';
import { fromTorontoInput, TORONTO, torontoInputValue, torontoTime, torontoWhen } from '@klyr/core';
import { errorText, klyr } from '@/lib/client';

const MIN = 60_000;
const time = (iso: string | number) => torontoTime(iso);
const when = (iso: string) => torontoWhen(iso);
const localValue = torontoInputValue;
const fromLocal = fromTorontoInput;
const metres = (m: number) => (m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${m} m`);

const STATUS: Record<ProShowing['status'], [string, string, string]> = {
  requested: ['Requested', '#FBEBDD', '#A54B00'],
  confirmed: ['Confirmed', '#E3F2E8', '#2B7A4B'],
  declined: ['Declined', '#F2F2F7', '#5E5E63'],
  cancelled: ['Cancelled by client', '#F2F2F7', '#5E5E63'],
  completed: ['Visited', '#E8EEF9', '#2A4D8F'],
};

type Mode = null | 'confirm' | 'move' | 'decline';

export function VisitCard({ v }: { v: ProShowing }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(null);
  const [note, setNote] = useState('');
  const [at, setAt] = useState(localValue(v.at));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const [label, bg, fg] = STATUS[v.status];
  const start = Date.parse(v.at);
  const opensAt = start - GEOFENCE.earlyMinutes * MIN;
  const completeFrom = v.checkInAt ? Date.parse(v.checkInAt) + GEOFENCE.minOnSiteMinutes * MIN : 0;

  async function decide() {
    if (!mode) return;
    setBusy(true); setError('');
    const d: Decision = mode === 'move' ? { action: 'move', at: fromLocal(at).toISOString(), note } : mode === 'decline' ? { action: 'decline', note } : { action: 'confirm', note: note || undefined };
    const r = await klyr.pro.decide(v.id, d);
    setBusy(false);
    if (!r.ok) return setError(errorText(r.error));
    setMode(null); setNote('');
    router.refresh();
  }

  const canChange = v.status === 'requested' || (v.status === 'confirmed' && !v.checkInAt);
  const directions = `https://www.google.com/maps/dir/?api=1&destination=${v.lat},${v.lng}`;

  return (
    <article className="k-card" aria-label={`${v.address} at ${time(v.at)}`}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <strong style={{ fontSize: 20 }}>{time(v.at)}</strong>
        <span className="k-note">{v.status === 'requested' ? when(v.at) : ''}</span>
        <span className="p-pill" style={{ background: bg, color: fg, marginLeft: 'auto' }}>{label}</span>
      </div>
      <div>
        <div style={{ fontWeight: 700 }}>{v.address}, {v.city}</div>
        <div className="k-note">Listed by {v.listingBrokerage}</div>
      </div>
      <div style={{ fontSize: 14 }}>
        {v.clientName ?? 'Client'}{v.clientPhone && <> · <a href={`tel:${v.clientPhone}`}>{phone(v.clientPhone)}</a></>}
        {v.note && <div className="k-note">Client: “{v.note}”</div>}
        {v.agentNote && <div className="k-note">You: “{v.agentNote}”</div>}
      </div>

      {v.status === 'confirmed' && !v.checkInAt && (
        <>
          <div className="p-fence">
            Check in with the Klyr Pro app on your phone when you arrive: it opens at {time(opensAt)} and needs you within {GEOFENCE.radiusM} m of the home.{' '}
            <a href={directions} target="_blank" rel="noreferrer">Directions</a>
          </div>
        </>
      )}
      {v.status === 'confirmed' && v.checkInAt && (
        <>
          <div className="p-fence" role="status">Checked in at {time(v.checkInAt)}, {metres(v.checkInDistanceM ?? 0)} from the home. Complete the visit in the app from {time(completeFrom)}, still at the property.</div>
        </>
      )}
      {v.status === 'completed' && v.checkInAt && v.checkOutAt && (
        <div className="k-note">Checked in {time(v.checkInAt)} ({metres(v.checkInDistanceM ?? 0)}) · completed {time(v.checkOutAt)} ({metres(v.checkOutDistanceM ?? 0)}) · {Math.round((Date.parse(v.checkOutAt) - Date.parse(v.checkInAt)) / MIN)} min on site</div>
      )}

      {error && <div className="k-error" role="alert">{error}</div>}

      {canChange && !mode && (
        <div className="p-row">
          {v.status === 'requested' && <button className="k-btn" onClick={() => setMode('confirm')}>Confirm</button>}
          <button className={v.status === 'requested' ? 'k-btn k-alt' : 'p-link'} onClick={() => setMode('move')}>New time</button>
          <button className={v.status === 'requested' ? 'k-btn k-alt' : 'p-link'} onClick={() => setMode('decline')}>{v.status === 'requested' ? 'Decline' : 'Cancel visit'}</button>
        </div>
      )}
      {mode && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {mode === 'move' && (
            <label className="k-field">New time (Toronto)
              <input type="datetime-local" value={at} onChange={e => setAt(e.target.value)} />
            </label>
          )}
          <label className="k-field">
            {mode === 'confirm' ? 'Note for your client (optional)' : 'Tell your client why'}
            <input value={note} onChange={e => setNote(e.target.value)} maxLength={500}
              placeholder={mode === 'confirm' ? 'e.g. Meet at the side door' : mode === 'move' ? 'e.g. The seller asked for later' : 'e.g. The home sold firm this morning'} />
          </label>
          <div className="p-row">
            <button className="k-btn" disabled={busy || (mode !== 'confirm' && note.trim().length < 3)} onClick={decide}>
              {mode === 'confirm' ? 'Confirm visit' : mode === 'move' ? 'Send new time' : v.status === 'requested' ? 'Decline visit' : 'Cancel visit'}
            </button>
            <button className="k-btn k-alt" disabled={busy} onClick={() => { setMode(null); setError(''); }}>Back</button>
          </div>
          <span className="k-note">Your client gets an email.</span>
        </div>
      )}
    </article>
  );
}
