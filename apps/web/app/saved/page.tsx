import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { Me } from '@klyr/contracts';
import type { ListingCard, SavedSearch } from '@klyr/api-client';
import { AppHeader } from '@/components/app-header';
import { CompareBar } from '@/components/compare-controls';
import { ListingCards } from '@/components/listing-cards';
import { BROKERAGE_LINE, LISTING_DATA_LINE } from '@/lib/brand';
import { api, sessionToken } from '@/lib/session';
import { SavedSearches } from './saved-searches';

export const metadata = { title: 'Saved · Klyr' };

export default async function SavedPage() {
  if (!(await sessionToken())) redirect('/welcome');
  const [me, saved, searches] = await Promise.all([api<Me>('/auth/me'), api<{ results: ListingCard[] }>('/listings?saved=true'), api<SavedSearch[]>('/me/searches')]);
  if (me.status === 401) redirect('/welcome');
  const homes = saved.data?.results ?? [];
  return (
    <main style={{ maxWidth: 960, margin: '0 auto', padding: '24px 16px 48px' }}>
      <AppHeader me={me.data} current="saved" />
      <h1 className="k-h1" style={{ margin: '0 0 16px' }}>Saved</h1>
      <SavedSearches list={searches.data ?? []} />
      <h2 className="k-label" style={{ margin: '0 0 8px' }}>SAVED HOMES</h2>
      {homes.length === 0 ? (
        <div className="k-card" style={{ alignItems: 'flex-start' }}>
          <strong>No saved homes yet</strong>
          <span className="k-note">Tap Save on any listing to track its price and all-in cost.</span>
          <Link href="/" className="k-btn" style={{ display: 'grid', placeItems: 'center', textDecoration: 'none', width: 'auto', padding: '0 24px' }}>Search homes</Link>
        </div>
      ) : <ListingCards homes={homes} />}
      <CompareBar />
      <footer style={{ fontSize: 12, color: 'var(--muted)', marginTop: 32 }}>{BROKERAGE_LINE} · {LISTING_DATA_LINE}</footer>
    </main>
  );
}
