import { Suspense } from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { Me } from '@klyr/contracts';
import type { ListingCard } from '@klyr/api-client';
import { shortDate } from '@klyr/core';
import { AppHeader } from '@/components/app-header';
import { CompareBar } from '@/components/compare-controls';
import { FilterBar } from '@/components/filter-bar';
import { ListingCards } from '@/components/listing-cards';
import { ListingMap } from '@/components/listing-map';
import { BROKERAGE_LINE, LISTING_DATA_LINE } from '@/lib/brand';
import { api, sessionToken } from '@/lib/session';

const FILTERS = ['city', 'maxPrice', 'minBeds', 'type', 'sort'] as const;

/** Buyer search: the all-in cost to close is the hero number on every card. Signed-in only (VOW). */
export default async function SearchPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  if (!(await sessionToken())) redirect('/welcome');
  const sp = await searchParams;
  const query = new URLSearchParams();
  for (const k of FILTERS) { const v = sp[k]; if (typeof v === 'string' && v) query.set(k, v); }
  const [me, search] = await Promise.all([
    api<Me>('/auth/me'),
    api<{ results: ListingCard[]; capped: boolean; asOf: string }>(`/listings${query.size ? '?' + query : ''}`),
  ]);
  if (me.status === 401) redirect('/welcome');
  const data = search.data;
  const mapView = sp.view === 'map';
  const viewHref = (map: boolean) => {
    const p = new URLSearchParams(query);
    if (map) p.set('view', 'map');
    return `/${p.size ? '?' + p : ''}`;
  };
  return (
    <main style={{ maxWidth: 960, margin: '0 auto', padding: '24px 16px 48px' }}>
      <AppHeader me={me.data} current="search" />
      <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-.02em', margin: '0 0 4px' }}>Search</h1>
      <p style={{ color: 'var(--muted)', margin: '0 0 16px' }}>All-in cost to close after your cash back.{data ? ` Estimate as of ${shortDate(data.asOf)}.` : ''}</p>
      <Suspense><FilterBar /></Suspense>
      {!data && <p role="alert">Can’t load homes right now. Try again in a moment.</p>}
      {data && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '0 0 10px' }}>
          <p className="k-note" aria-live="polite" style={{ margin: 0 }}>{data.results.length} {data.results.length === 1 ? 'home' : 'homes'}</p>
          <nav className="k-view" aria-label="View">
            <Link href={viewHref(false)} aria-current={!mapView ? 'page' : undefined} scroll={false}>List</Link>
            <Link href={viewHref(true)} aria-current={mapView ? 'page' : undefined} scroll={false}>Map</Link>
          </nav>
        </div>
      )}
      {data && data.results.length === 0 && (
        <div className="k-card" style={{ alignItems: 'flex-start' }}>
          <strong>No homes match</strong>
          <span className="k-note">Try a higher budget or another home type.</span>
        </div>
      )}
      {data && data.results.length > 0 && (mapView ? <ListingMap homes={data.results} /> : <ListingCards homes={data.results} />)}
      {data?.capped && <p>Showing the first 100 homes. Refine your search to see more.</p>}
      <p className="k-note" style={{ marginTop: 24 }}>
        All-in = land transfer tax after first-time refunds + lawyer + inspection + title insurance + adjustments − your Klyr cash back, using <Link href="/estimate">your inputs</Link>. Down payment is shown on each listing. Up to 100 homes per search, as MLS® rules require.
      </p>
      <CompareBar />
      <footer style={{ fontSize: 12, color: 'var(--muted)', marginTop: 16 }}>{BROKERAGE_LINE} · {LISTING_DATA_LINE}</footer>
    </main>
  );
}
