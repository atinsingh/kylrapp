'use client';

import { useEffect, useState } from 'react';
import type { PrivacyRequest } from '@klyr/api-client';
import { torontoWhen } from '@klyr/core';
import { errorText, klyr } from '@/lib/client';

const KIND = { access: 'A copy of my information', correction: 'Correct my information', deletion: 'Delete my account' } as const;
const STATUS = { open: 'Open', completed: 'Done', denied: 'Answered' } as const;

/** PIPEDA rights: a copy, a correction, or deletion. Klyr’s privacy officer answers within 30 days. */
export function PrivacyRequests() {
  const [list, setList] = useState<PrivacyRequest[]>([]);
  const [kind, setKind] = useState<PrivacyRequest['kind'] | null>(null);
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { void klyr.privacyRequests().then(r => r.ok && setList(r.data)); }, []);

  async function send() {
    if (!kind) return;
    setBusy(true); setError('');
    const r = await klyr.requestPrivacy(kind, details.trim() || undefined);
    setBusy(false);
    if (!r.ok) return setError(errorText(r.error));
    setList(r.data); setKind(null); setDetails('');
  }
  async function download(id: string) {
    const r = await klyr.privacyExport(id);
    if (!r.ok) return setError(errorText(r.error));
    const url = URL.createObjectURL(new Blob([JSON.stringify(r.data, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a'); a.href = url; a.download = 'klyr-my-information.json'; a.click(); URL.revokeObjectURL(url);
  }

  return (
    <section className="k-card" aria-label="Your privacy">
      <div className="k-label">YOUR PRIVACY</div>
      <span className="k-note">Ask for a copy of what Klyr holds about you, a correction, or deletion. We answer within 30 days. Deleting keeps only what the law requires: identity records for 5 years (FINTRAC) and trade records for 6 years.</span>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }} role="group" aria-label="Request">
        {(Object.keys(KIND) as PrivacyRequest['kind'][]).map(k => <button key={k} className="k-chip" aria-pressed={kind === k} onClick={() => setKind(k)}>{KIND[k]}</button>)}
      </div>
      {kind && (
        <>
          <label className="k-field">{kind === 'correction' ? 'What should we correct?' : 'Anything we should know (optional)'}<input value={details} onChange={e => setDetails(e.target.value)} /></label>
          {error && <div className="k-error" role="alert">{error}</div>}
          <button className="k-btn" disabled={busy || (kind === 'correction' && details.trim().length < 5)} onClick={send}>Send request</button>
        </>
      )}
      {list.map(r => (
        <div key={r.id} style={{ padding: '6px 0', borderTop: '.5px solid var(--sep)' }}>
          <strong>{KIND[r.kind]}</strong> <span className="k-note">· {STATUS[r.status]} · sent {torontoWhen(r.createdAt)}{r.status === 'open' ? ` · answer by ${torontoWhen(r.dueAt)}` : ''}</span>
          {r.response && <div className="k-note">“{r.response}”</div>}
          {r.kind === 'access' && r.status === 'completed' && <button className="k-btn k-alt" style={{ width: 'auto', padding: '0 14px', minHeight: 40, marginTop: 6 }} onClick={() => download(r.id)}>Download my information</button>}
        </div>
      ))}
    </section>
  );
}
