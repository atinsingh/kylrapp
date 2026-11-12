'use client';

import Link from 'next/link';
import { COMPARE_MAX, useCompare } from '@/lib/compare';

export function CompareToggle({ id, address }: { id: string; address: string }) {
  const c = useCompare();
  const on = c.has(id);
  return (
    <button onClick={() => c.toggle(id)} aria-pressed={on} aria-label={`${on ? 'Remove' : 'Add'} ${address} ${on ? 'from' : 'to'} compare`}
      style={{ border: 0, background: 'none', color: on ? 'var(--brand)' : 'var(--muted)', fontWeight: 700, fontSize: 13, minHeight: 44, minWidth: 44 }}>
      {on ? '✓ Compare' : '+ Compare'}
    </button>
  );
}

/** Floating bar once two or more homes are picked. */
export function CompareBar() {
  const c = useCompare();
  if (c.ids.length < 2) return null;
  return (
    <div role="region" aria-label="Compare" style={{ position: 'fixed', left: 16, right: 16, bottom: 16, maxWidth: 560, margin: '0 auto', background: 'var(--ink)', color: '#fff', borderRadius: 16, padding: '10px 10px 10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, boxShadow: '0 8px 24px rgba(0,0,0,.25)' }}>
      <span style={{ fontWeight: 600 }}>{c.ids.length} of {COMPARE_MAX} homes picked</span>
      <Link href={`/compare?ids=${c.ids.join(',')}`} className="k-btn" style={{ width: 'auto', minHeight: 44, display: 'grid', placeItems: 'center', textDecoration: 'none', background: '#fff', color: 'var(--ink)' }}>Compare</Link>
    </div>
  );
}
