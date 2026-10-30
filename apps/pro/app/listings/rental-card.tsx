'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ProRental } from '@klyr/api-client';
import { money, torontoWhen } from '@klyr/core';
import { errorText, klyr } from '@/lib/client';

export function RentalCard({ l }: { l: ProRental }) {
  const router = useRouter();
  const [publishing, setPublishing] = useState(false);
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [photos, setPhotos] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const p = l.property;
  const leased = l.applications.find(a => a.status === 'accepted');

  async function publish() {
    setBusy(true); setError('');
    const r = await klyr.pro.publishRental(l.dealId, { lat: Number(lat), lng: Number(lng), photos: photos.split('\n').map(s => s.trim()).filter(Boolean) });
    setBusy(false);
    if (!r.ok) return setError(errorText(r.error));
    setPublishing(false); router.refresh();
  }
  return (
    <article className="k-card" aria-label={`Rental ${p.address} for ${l.clientName ?? l.clientEmail}`}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
        <strong style={{ fontSize: 17 }}>{p.address}{p.unit ? ` #${p.unit}` : ''}, {p.city}</strong>
        <span className="k-note">{l.clientName ?? l.clientEmail} · {money(l.rent)}/month · {p.beds} bd · {p.baths} ba · {p.type} · {l.rentControlled ? 'rent-controlled' : 'not rent-controlled'}</span>
      </div>
      <div className="k-note">
        Tenant’s brokerage: {l.tenantSidePct ? `${l.tenantSidePct === 1 ? 'one month' : 'half a month'}` : 'none'} · available {l.availableFrom}
        {l.agreement ? ` · Form 210 signed ${torontoWhen(l.agreement.signedAt)}` : ' · Form 210 not signed yet'}
        {l.publishedAt ? ` · live ${torontoWhen(l.publishedAt)}` : ''}
      </div>
      {l.publishedAt && (
        <div className="k-note" style={{ color: 'var(--text)' }}>
          {leased ? `Leased to ${leased.name} at ${money(leased.rent)} from ${leased.startDate}: prepare the Ontario Standard Lease (2229E).` : `${l.applications.filter(a => a.status === 'submitted').length} application(s) waiting for the landlord`}
          {l.consents.some(c => !c.sellerSignedAt) ? ` · Form 326: ${l.consents.filter(c => !c.sellerSignedAt).length} waiting for the landlord` : ''}
        </div>
      )}
      {!l.publishedAt && (publishing ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <label className="k-field" style={{ flex: 1 }}>Latitude<input value={lat} onChange={e => setLat(e.target.value)} inputMode="decimal" /></label>
            <label className="k-field" style={{ flex: 1 }}>Longitude<input value={lng} onChange={e => setLng(e.target.value)} inputMode="decimal" /></label>
          </div>
          <label className="k-field">Photo URLs, one per line<textarea rows={3} value={photos} onChange={e => setPhotos(e.target.value)} /></label>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="k-btn" disabled={busy || !Number(lat) || !Number(lng)} onClick={publish}>Publish rental</button>
            <button className="k-btn k-alt" disabled={busy} onClick={() => setPublishing(false)}>Back</button>
          </div>
        </div>
      ) : (
        <button className="k-btn" style={{ width: 'auto', padding: '0 16px', alignSelf: 'flex-start' }} disabled={!l.agreement} onClick={() => setPublishing(true)}>Publish…</button>
      ))}
      {error && <div className="k-error" role="alert">{error}</div>}
    </article>
  );
}
