'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { errorText, klyr } from '@/lib/client';

export function PrivacyAction({ id, kind }: { id: string; kind: 'access' | 'correction' | 'deletion' }) {
  const router = useRouter();
  const [response, setResponse] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function run(result: 'completed' | 'denied') {
    if (result === 'completed' && kind === 'deletion' && !confirm('Close this account now? This can’t be undone.')) return;
    setBusy(true); setError('');
    const r = await klyr.admin.decidePrivacy(id, result, response);
    setBusy(false);
    if (!r.ok) return setError(errorText(r.error));
    router.refresh();
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <label className="k-field">Answer to the person (emailed)<textarea rows={2} value={response} onChange={e => setResponse(e.target.value)} /></label>
      {error && <div className="k-error" role="alert">{error}</div>}
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="k-btn" style={{ width: 'auto', padding: '0 16px' }} disabled={busy || response.trim().length < 3} onClick={() => run('completed')}>{kind === 'access' ? 'Complete: release their copy' : kind === 'deletion' ? 'Complete: close the account' : 'Complete: corrected'}</button>
        <button className="k-btn k-alt" style={{ width: 'auto', padding: '0 16px' }} disabled={busy || response.trim().length < 3} onClick={() => run('denied')}>Deny with reason</button>
      </div>
    </div>
  );
}
