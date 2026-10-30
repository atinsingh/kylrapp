import Link from 'next/link';
import { redirect } from 'next/navigation';
import { money } from '@klyr/core';
import type { Me } from '@klyr/contracts';
import type { Assumptions, ListingCard } from '@klyr/api-client';
import { AppHeader } from '@/components/app-header';
import { BROKERAGE_LINE, LISTING_DATA_LINE } from '@/lib/brand';
import { api, sessionToken } from '@/lib/session';
import { RemoveFromCompare } from './remove';

export const metadata = { title: 'Compare homes · Klyr' };

const ID = /^[0-9a-f-]{36}$/;

export default async function ComparePage({ searchParams }: { searchParams: Promise<{ ids?: string }> }) {
  if (!(await sessionToken())) redirect('/welcome');
  const ids = ((await searchParams).ids ?? '').split(',').filter(i => ID.test(i)).slice(0, 3);
  const [me, a, res] = await Promise.all([
    api<Me>('/auth/me'),
    api<Assumptions>('/me/assumptions'),
    ids.length ? api<{ results: ListingCard[] }>(`/listings?ids=${ids.join(',')}`) : Promise.resolve({ status: 200, data: { results: [] } }),
  ]);
  if (me.status === 401) redirect('/welcome');
  // Keep the order the buyer picked them in.
  const homes = ids.map(id => res.data?.results.find(h => h.id === id)).filter((h): h is ListingCard => !!h);
  const rows: [string, (h: ListingCard) => string, boolean?][] = [
    ['Price', h => money(h.price)],
    ['All-in to close', h => (h.allIn < 0 ? '−' : '') + money(Math.abs(h.allIn)), true],
    ['Cash back', h => money(h.cashBack)],
    ['Land transfer tax', h => money(h.landTransfer)],
    ['Monthly', h => money(h.monthlyTotal) + '/mo'],
    ['Beds · baths', h => `${h.beds} · ${h.baths}`],
    ['Size', h => (h.sqft ? `${h.sqft.toLocaleString('en-CA')} sq ft` : '—')],
    ['Built', h => (h.yearBuilt ? String(h.yearBuilt) : '—')],
    ['Offers', h => h.offerDate ?? '—'],
  ];
  // Highlight the lowest all-in and lowest monthly.
  const best = (f: (h: ListingCard) => number) => homes.length > 1 ? homes.reduce((b, h) => (f(h) < f(b) ? h : b)).id : null;
  const bestAllIn = best(h => h.allIn), bestMonthly = best(h => h.monthlyTotal);

  return (
    <main style={{ maxWidth: 960, margin: '0 auto', padding: '24px 16px 48px' }}>
      <AppHeader me={me.data} />
      <h1 className="k-h1" style={{ fontSize: 28 }}>Compare homes</h1>
      <p className="k-sub" style={{ margin: '6px 0 16px' }}>
        Same lawyer, down payment and first-time status applied to each{a.data ? ` (${Math.round(a.data.downPct * 100)}% down, ${(a.data.rate * 100).toFixed(2)}%)` : ''}. <Link href="/estimate">Change them</Link>
      </p>
      {homes.length < 2 ? (
        <div className="k-card" style={{ alignItems: 'flex-start' }}>
          <strong>Pick two or three homes</strong>
          <span className="k-note">Tap “+ Compare” on any home in Search or Saved.</span>
          <Link href="/" className="k-btn" style={{ display: 'grid', placeItems: 'center', textDecoration: 'none', width: 'auto', padding: '0 24px' }}>Search homes</Link>
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', minWidth: 160 + homes.length * 200, borderCollapse: 'separate', borderSpacing: 0, background: '#fff', borderRadius: 16, overflow: 'hidden' }}>
            <thead>
              <tr>
                <th scope="col" style={{ width: 160 }}><span className="k-label" style={{ position: 'absolute', left: -9999 }}>Detail</span></th>
                {homes.map(h => (
                  <th key={h.id} scope="col" style={{ textAlign: 'left', verticalAlign: 'top', padding: 12, fontWeight: 400 }}>
                    {h.photos[0] && <img src={h.photos[0].url} alt={h.photos[0].alt} style={{ width: '100%', aspectRatio: '3 / 2', objectFit: 'cover', borderRadius: 10, display: 'block' }} />}
                    <Link href={`/listings/${h.id}`} style={{ display: 'block', fontWeight: 700, color: 'var(--text)', marginTop: 8 }}>{h.address}</Link>
                    <div className="k-note">{h.city} · {h.style ?? h.type}</div>
                    <div className="k-note">Listing brokerage: {h.listingBrokerage}</div>
                    <RemoveFromCompare id={h.id} ids={ids} address={h.address} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(([label, f, hero]) => (
                <tr key={label}>
                  <th scope="row" style={{ textAlign: 'left', padding: '10px 12px', borderTop: '.5px solid var(--sep)', fontWeight: 600, fontSize: 13, color: 'var(--muted)' }}>{label}</th>
                  {homes.map(h => {
                    const win = (label === 'All-in to close' && h.id === bestAllIn) || (label === 'Monthly' && h.id === bestMonthly);
                    return (
                      <td key={h.id} style={{ padding: '10px 12px', borderTop: '.5px solid var(--sep)', fontWeight: hero ? 800 : 600, fontSize: hero ? 18 : 14, color: hero ? 'var(--brand)' : undefined, background: win ? 'var(--tint)' : undefined }}>
                        {f(h)}{win && <span className="k-note" style={{ display: 'block', fontWeight: 600 }}>Lowest</span>}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="k-note" style={{ marginTop: 16 }}>Monthly = mortgage over 25 years, plus property tax and condo fee. All-in uses your inputs from How we estimate.</p>
      <footer style={{ fontSize: 12, color: 'var(--muted)', marginTop: 16 }}>{BROKERAGE_LINE} · {LISTING_DATA_LINE}</footer>
    </main>
  );
}
