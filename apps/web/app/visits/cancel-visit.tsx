'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { errorText, klyr } from '@/lib/client';

export function CancelVisit({ id, address }: { id: string; address: string }) {
  const router = useRouter();
  const [ask, setAsk] = useState(false);
  const [error, setError] = useState('');
  async function cancel() {
    const r = await klyr.cancelShowing(id);
    if (!r.ok) return setError(errorText(r.error));
    router.refresh();
  }
  const link = { border: 0, background: 'none', fontWeight: 700, fontSize: 13, minHeight: 44 } as const;
  if (error) return <span className="k-note" role="alert">{error}</span>;
  return ask ? (
    <span style={{ display: 'flex', gap: 4 }}>
      <button onClick={cancel} style={{ ...link, color: '#A11B1B' }} aria-label={`Confirm cancelling the visit to ${address}`}>Cancel visit</button>
      <button onClick={() => setAsk(false)} style={{ ...link, color: 'var(--muted)' }}>Keep</button>
    </span>
  ) : <button onClick={() => setAsk(true)} style={{ ...link, color: 'var(--brand)' }} aria-label={`Cancel the visit to ${address}`}>Cancel</button>;
}
