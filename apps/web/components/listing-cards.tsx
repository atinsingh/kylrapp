import Link from 'next/link';
import { money } from '@klyr/core';
import type { ListingCard } from '@klyr/api-client';
import { CompareToggle } from './compare-controls';
import { PhotoStrip } from './photo-strip';
import { SaveButton } from './save-button';

const viewed = (iso: string) => 'Viewed ' + new Date(iso).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' });

/** Search result cards: photos, the all-in hero, key facts, brokerage, save. */
export function ListingCards({ homes }: { homes: ListingCard[] }) {
  return (
    <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))' }}>
      {homes.map(l => (
        <li key={l.id} style={{ background: '#fff', borderRadius: 12, overflow: 'hidden', boxShadow: '0 0 0 .5px var(--sep)', display: 'flex', flexDirection: 'column' }}>
          <PhotoStrip photos={l.photos} address={l.address} sample={l.samplePhotos} href={`/listings/${l.id}`} />
          <Link href={`/listings/${l.id}`} style={{ padding: '14px 16px 0', color: 'inherit', textDecoration: 'none', flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', letterSpacing: '.04em' }}>{l.allIn < 0 ? 'YOU GET BACK AT CLOSING' : 'ALL-IN TO CLOSE'}</span>
              {l.viewedAt && <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)' }}>{viewed(l.viewedAt)}</span>}
            </div>
            <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--brand)' }}>{money(Math.abs(l.allIn))}</div>
            <div style={{ fontWeight: 600, marginTop: 8 }}>{l.address}, {l.city}</div>
            <div style={{ color: 'var(--muted)' }}>{money(l.price)} · {l.beds} bed · {l.baths} bath · {l.type}</div>
            <div style={{ color: 'var(--muted)' }}>{money(l.cashBack)} cash back · {money(l.monthly)}/mo</div>
          </Link>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 8px 6px 16px', gap: 8 }}>
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>Listing brokerage: {l.listingBrokerage}</span>
            <span style={{ display: 'flex', flex: 'none' }}>
              <CompareToggle id={l.id} address={l.address} />
              <SaveButton id={l.id} saved={l.saved} address={l.address} />
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}
