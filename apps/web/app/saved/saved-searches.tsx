'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { SavedSearch } from '@klyr/api-client';
import { errorText, klyr } from '@/lib/client';

/** Saved searches: open one, change its alert, or delete it. */
export function SavedSearches({ list }: { list: SavedSearch[] }) {
  const router = useRouter();
  const [error, setError] = useState('');
  const act = async (fn: () => Promise<{ ok: boolean; error?: { code?: string; message?: unknown } }>) => {
    setError('');
    const r = await fn();
    if (!r.ok) return setError(errorText(r.error));
    router.refresh();
  };
  const href = (s: SavedSearch) => '/?' + new URLSearchParams(Object.entries(s.filters).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)])).toString();
  return (
    <section className="k-card" aria-label="Saved searches" style={{ marginBottom: 16 }}>
      <div className="k-label">SAVED SEARCHES</div>
      {!list.length && <span className="k-note">Set filters on Search, then “Save this search” to hear about new listings and price drops.</span>}
      {list.map((s, i) => (
        <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '8px 0', borderTop: i ? '.5px solid var(--sep)' : 0 }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <Link href={href(s)} style={{ fontWeight: 700, color: 'var(--text)' }}>{s.name}</Link>
            <div className="k-note">{s.matches} home{s.matches === 1 ? '' : 's'} now</div>
          </div>
          <select className="k-select" aria-label={`Alerts for ${s.name}`} value={s.alert} onChange={e => act(() => klyr.setSearchAlert(s.id, e.target.value as SavedSearch['alert']))}>
            <option value="instant">Alert me right away</option>
            <option value="daily">Daily email</option>
            <option value="off">No alerts</option>
          </select>
          <button onClick={() => act(() => klyr.deleteSearch(s.id))} aria-label={`Delete ${s.name}`} style={{ border: 0, background: 'none', color: 'var(--accent)', fontWeight: 700, fontSize: 13, minHeight: 44 }}>Delete</button>
        </div>
      ))}
      {error && <div className="k-error" role="alert">{error}</div>}
    </section>
  );
}
