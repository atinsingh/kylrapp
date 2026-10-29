import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { FeedStatus } from '@klyr/api-client';
import { money } from '@klyr/core';
import { api, sessionToken } from '@klyr/web-kit/session';
import { ListingAction } from './listing-action';

export const metadata = { title: 'Listings feed · Klyr Admin' };

export default async function FeedPage() {
  if (!(await sessionToken())) redirect('/signin');
  const res = await api<FeedStatus>('/admin/listings-feed');
  if (!res.data) redirect('/signin');
  const s = res.data;
  return (
    <main className="a-wrap">
      <Link href="/" className="k-note">‹ Klyr Admin</Link>
      <h1 className="k-h1">Listings feed</h1>
      <section className="k-card" style={{ background: s.feed.connected ? undefined : '#FBEBDD' }}>
        <strong>{s.feed.name} · {s.feed.connected ? 'Connected' : 'Not connected'}</strong>
        <span className="k-note">{s.feed.note}</span>
      </section>
      <section className="k-card" aria-label="Checks">
        <div className="k-label">VOW RULES</div>
        {s.checks.map(c => <div key={c.name}><strong style={{ color: c.ok ? '#2B7A4B' : '#A11B1B' }}>{c.ok ? '✓' : '✗'} {c.name}</strong><div className="k-note">{c.detail}</div></div>)}
      </section>
      <section className="k-card" aria-label="Inventory">
        <div className="k-label">INVENTORY BY SOURCE</div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead><tr style={{ textAlign: 'left', color: 'var(--muted)', fontSize: 12 }}>{['Source', 'Kind', 'Status', 'Listings', 'Last listed'].map(h => <th key={h} style={{ padding: '4px 8px 4px 0' }}>{h}</th>)}</tr></thead>
          <tbody>{s.counts.map(c => <tr key={`${c.source}${c.kind}${c.status}`} style={{ borderTop: '.5px solid var(--sep)' }}><td style={{ padding: '6px 8px 6px 0' }}>{c.source}</td><td>{c.kind}</td><td>{c.status}</td><td>{c.n}</td><td>{c.last ?? '—'}</td></tr>)}</tbody>
        </table>
      </section>
      <section className="k-card" aria-label="Klyr exclusive listings">
        <div className="k-label">KLYR EXCLUSIVE LISTINGS · {s.klyr.length}</div>
        {s.klyr.length === 0 && <span className="k-note">None yet.</span>}
        {s.klyr.map(l => (
          <div key={l.id} style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '8px 0', borderTop: '.5px solid var(--sep)' }} aria-label={`Listing ${l.address}`}>
            <div><strong>{l.address}, {l.city}</strong> <span className="k-note">· {l.mls} · {l.kind === 'lease' ? `${money(l.price)}/month` : money(l.price)} · {l.status}</span></div>
            <ListingAction id={l.id} status={l.status} />
          </div>
        ))}
      </section>
    </main>
  );
}
