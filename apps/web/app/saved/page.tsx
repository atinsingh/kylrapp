import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { Me } from '@klyr/contracts';
import type { ListingCard } from '@klyr/api-client';
import { AppHeader } from '@/components/app-header';
import { ListingCards } from '@/components/listing-cards';
import { BROKERAGE_LINE, LISTING_DATA_LINE } from '@/lib/brand';
import { api, sessionToken } from '@/lib/session';

export const metadata = { title: 'Saved homes · Klyr' };

export default async function SavedPage() {
  if (!(await sessionToken())) redirect('/welcome');
  const [me, saved] = await Promise.all([api<Me>('/auth/me'), api<{ results: ListingCard[] }>('/listings?saved=true')]);
  if (me.status === 401) redirect('/welcome');
  const homes = saved.data?.results ?? [];
  return (
    <main style={{ maxWidth: 960, margin: '0 auto', padding: '24px 16px 48px' }}>
      <AppHeader me={me.data} current="saved" />
      <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-.02em', margin: '0 0 16px' }}>Saved homes</h1>
      {homes.length === 0 ? (
        <div className="k-card" style={{ alignItems: 'flex-start' }}>
          <strong>No saved homes yet</strong>
          <span className="k-note">Tap Save on any listing to track its price and all-in cost.</span>
          <Link href="/" className="k-btn" style={{ display: 'grid', placeItems: 'center', textDecoration: 'none', width: 'auto', padding: '0 24px' }}>Search homes</Link>
        </div>
      ) : <ListingCards homes={homes} />}
      <footer style={{ fontSize: 12, color: 'var(--muted)', marginTop: 32 }}>{BROKERAGE_LINE} · {LISTING_DATA_LINE}</footer>
    </main>
  );
}
