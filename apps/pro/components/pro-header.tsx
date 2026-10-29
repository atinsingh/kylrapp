import Link from 'next/link';
import type { ProMe } from '@klyr/api-client';
import { SignOut } from './sign-out';

export function ProHeader({ me, current }: { me: ProMe; current: 'visits' | 'offers' | 'deals' | 'listings' | 'quotes' | 'clients' }) {
  return (
    <header className="p-top">
      <div>
        <div style={{ fontWeight: 800, fontSize: 18, color: 'var(--brand)' }}>Klyr Pro</div>
        <div className="k-note">{me.name}, {me.title} · {me.brokerage}</div>
      </div>
      <nav className="p-tabs" aria-label="Klyr Pro">
        <Link href="/" aria-current={current === 'visits' ? 'page' : undefined}>Visits</Link>
        <Link href="/offers" aria-current={current === 'offers' ? 'page' : undefined}>Offers</Link>
        <Link href="/deals" aria-current={current === 'deals' ? 'page' : undefined}>Deals</Link>
        <Link href="/listings" aria-current={current === 'listings' ? 'page' : undefined}>Listings</Link>
        <Link href="/quotes" aria-current={current === 'quotes' ? 'page' : undefined}>Quotes</Link>
        <Link href="/clients" aria-current={current === 'clients' ? 'page' : undefined}>Clients</Link>
        <SignOut />
      </nav>
    </header>
  );
}
