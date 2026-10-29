'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ProListing, SellTaskKey } from '@klyr/api-client';
import { money, torontoWhen } from '@klyr/core';
import { errorText, klyr } from '@/lib/client';

const STEP: Record<SellTaskKey, string> = { payout: 'Mortgage payout', photos: 'Photos', inspection: 'Inspection', rules: 'Showings and offer date', approve: 'Seller approved the listing' };

export function ListingCard({ l }: { l: ProListing }) {
  const router = useRouter();
  const [note, setNote] = useState('');
  const [publishing, setPublishing] = useState(false);
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [photos, setPhotos] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const run = async (fn: () => Promise<{ ok: boolean; error?: { code?: string; message?: unknown } }>) => {
    setBusy(true); setError('');
    const r = await fn();
    setBusy(false);
    if (!r.ok) return setError(errorText(r.error));
    setNote(''); setPublishing(false);
    router.refresh();
  };
  const live = l.stage !== 'preparing';
  const task = (k: SellTaskKey) => l.tasks.find(t => t.key === k)!;
  const ready = !!l.agreement && !!task('approve').doneAt && !!task('photos').doneAt;
  const p = l.property;

  return (
    <article className="k-card" aria-label={`Listing ${p.address} for ${l.clientName ?? l.clientEmail}`}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
        <strong style={{ fontSize: 17 }}>{p.address}{p.unit ? ` #${p.unit}` : ''}, {p.city}</strong>
        <span className="k-note">{l.clientName ?? l.clientEmail} · {money(l.listPrice)} · {p.beds} bd · {p.baths} ba · {p.type}</span>
      </div>
      <div className="k-note">
        {l.plan === 'flat' ? 'Self-directed (seller hosts showings)' : 'Assisted (you run showings)'} · {(l.coop * 100).toFixed(1)}% to the buyer’s brokerage
        {l.agreement ? ` · Form 200 signed ${torontoWhen(l.agreement.signedAt)}` : ' · Form 200 not signed yet'}
        {live && l.publishedAt ? ` · live ${torontoWhen(l.publishedAt)}` : ''}
      </div>
      <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 4 }} aria-label="Prep">
        {l.tasks.map(t => (
          <li key={t.key}>
            <strong>{STEP[t.key]}</strong>{' '}
            <span className="k-note">{t.doneAt ? `✓ ${torontoWhen(t.doneAt)}${t.details.note ? ` · ${t.details.note}` : ''}${t.key === 'rules' ? ` · ${t.details.showings}` : ''}` : 'to do'}</span>
            {t.key === 'approve' && t.doneAt && <div className="k-note" style={{ whiteSpace: 'pre-wrap' }}>“{t.details.description}” Included: {t.details.inclusions}</div>}
          </li>
        ))}
      </ul>
      {!live && (
        <>
          <label className="k-field">Note (optional)<input value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. Shot Oct 30, 24 photos + floor plan" /></label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="k-btn k-alt" style={{ width: 'auto', padding: '0 16px' }} disabled={busy} onClick={() => run(() => klyr.pro.listingTask(l.dealId, { key: 'photos', ...(note.trim() ? { note: note.trim() } : {}) }))}>Photos done</button>
            <button className="k-btn k-alt" style={{ width: 'auto', padding: '0 16px' }} disabled={busy} onClick={() => run(() => klyr.pro.listingTask(l.dealId, { key: 'inspection', ...(note.trim() ? { note: note.trim() } : {}) }))}>Inspection done</button>
            {!publishing && <button className="k-btn" style={{ width: 'auto', padding: '0 16px' }} disabled={busy || !ready} onClick={() => setPublishing(true)}>Publish…</button>}
          </div>
          {!ready && <span className="k-note">Publishing needs the signed agreement, the seller’s approval and the photos.</span>}
          {publishing && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <label className="k-field" style={{ flex: 1 }}>Latitude<input value={lat} onChange={e => setLat(e.target.value)} inputMode="decimal" placeholder="43.65" /></label>
                <label className="k-field" style={{ flex: 1 }}>Longitude<input value={lng} onChange={e => setLng(e.target.value)} inputMode="decimal" placeholder="-79.38" /></label>
              </div>
              <label className="k-field">Photo URLs, one per line<textarea rows={3} value={photos} onChange={e => setPhotos(e.target.value)} /></label>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="k-btn" disabled={busy || !Number(lat) || !Number(lng)} onClick={() => run(() => klyr.pro.publish(l.dealId, { lat: Number(lat), lng: Number(lng), photos: photos.split('\n').map(s => s.trim()).filter(Boolean) }))}>Publish as a Klyr listing</button>
                <button className="k-btn k-alt" disabled={busy} onClick={() => setPublishing(false)}>Back</button>
              </div>
            </div>
          )}
        </>
      )}
      {error && <div className="k-error" role="alert">{error}</div>}
    </article>
  );
}
