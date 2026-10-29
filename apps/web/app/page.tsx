import { redirect } from 'next/navigation';
import { money } from '@klyr/core';
import type { Me } from '@klyr/contracts';
import { BROKERAGE_LINE, LISTING_DATA_LINE } from '@/lib/brand';
import { api, sessionToken } from '@/lib/session';
import { PhotoStrip } from './photo-strip';
import { SignOut } from './sign-out';

import type { ListingCard as Card } from '@klyr/api-client';

/** Buyer search: the all-in cost to close is the hero number on every card. Signed-in only (VOW). */
export default async function SearchPage() {
  if (!(await sessionToken())) redirect('/welcome');
  const [me, search] = await Promise.all([api<Me>('/auth/me'), api<{ results: Card[]; capped: boolean }>('/listings')]);
  if (me.status === 401) redirect('/welcome');
  const data = search.data;
  return (
    <main style={{ maxWidth: 960, margin: '0 auto', padding: '24px 16px 48px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <img src="/klyr-mark.png" alt="" width={30} height={30} style={{ borderRadius: 8 }} />
          <span style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-.02em' }}>klyr</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 13, color: 'var(--muted)' }}>
          <span>{me.data?.legalName ?? me.data?.email}</span>
          <a href="/security" style={{ fontWeight: 700, fontSize: 13 }}>Security</a>
          <SignOut />
        </div>
      </div>
      <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-.02em', margin: '0 0 4px' }}>Search</h1>
      <p style={{ color: 'var(--muted)', margin: '0 0 20px' }}>All-in cost to close after your cash back. Estimate as of Oct 27, 2026.</p>
      {!data && <p role="alert">Can’t load homes right now. Try again in a moment.</p>}
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))' }}>
        {data?.results.map(l => (
          <li key={l.id} style={{ background: '#fff', borderRadius: 12, overflow: 'hidden', boxShadow: '0 0 0 .5px var(--sep)' }}>
            <PhotoStrip photos={l.photos} address={l.address} sample={l.samplePhotos} />
            <div style={{ padding: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', letterSpacing: '.04em' }}>{l.allIn < 0 ? 'YOU GET BACK AT CLOSING' : 'ALL-IN TO CLOSE'}</div>
              <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--brand)' }}>{money(Math.abs(l.allIn))}</div>
              <div style={{ fontWeight: 600, marginTop: 8 }}>{l.address}, {l.city}</div>
              <div style={{ color: 'var(--muted)' }}>{money(l.price)} · {l.beds} bed · {l.baths} bath · {l.type}</div>
              <div style={{ color: 'var(--muted)' }}>{money(l.cashBack)} cash back · {money(l.monthly)}/mo</div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 8 }}>Listing brokerage: {l.listingBrokerage}</div>
            </div>
          </li>
        ))}
      </ul>
      {data?.capped && <p>Showing the first 100 homes. Refine your search to see more.</p>}
      <footer style={{ fontSize: 12, color: 'var(--muted)', marginTop: 32 }}>{BROKERAGE_LINE} · {LISTING_DATA_LINE}</footer>
    </main>
  );
}
