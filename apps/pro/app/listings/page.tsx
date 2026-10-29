import type { ProListing, ProRental } from '@klyr/api-client';
import { ProHeader } from '@/components/pro-header';
import { api, requireAgent } from '@/lib/session';
import { ListingCard } from './listing-card';
import { RentalCard } from './rental-card';

export const metadata = { title: 'Listings · Klyr Pro' };

export default async function ListingsPage() {
  const me = await requireAgent();
  const [sales, leases] = await Promise.all([api<ProListing[]>('/pro/listings'), api<ProRental[]>('/pro/rentals')]);
  const list = sales.data ?? [], rentals = leases.data ?? [];
  const groups: [string, ProListing[]][] = [
    ['AGREEMENT TO SIGN', list.filter(l => !l.agreement)],
    ['PREPARING', list.filter(l => l.agreement && l.stage === 'preparing')],
    ['LIVE', list.filter(l => l.stage !== 'preparing')],
  ];
  return (
    <main className="p-wrap">
      <ProHeader me={me} current="listings" />
      <h1 className="k-h1">Listings</h1>
      <p className="k-note" style={{ margin: 0 }}>
        Sellers you represent. Book the photos, mark the inspection if one was done, and publish once the seller has signed the listing
        agreement and approved the listing. It goes live as a Klyr listing; the MLS® feed comes later.
      </p>
      {!list.length && !rentals.length && <section className="k-card"><strong>No sellers yet</strong><span className="k-note">Sellers who start with Klyr show up here.</span></section>}
      {groups.map(([label, ls]) => ls.length > 0 && (
        <section key={label} aria-label={label.toLowerCase()} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div className="k-label">{label} · {ls.length}</div>
          {ls.map(l => <ListingCard key={l.dealId} l={l} />)}
        </section>
      ))}
      {rentals.length > 0 && (
        <section aria-label="rentals" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div className="k-label">RENTALS · {rentals.length}</div>
          {rentals.map(l => <RentalCard key={l.dealId} l={l} />)}
        </section>
      )}
    </main>
  );
}
