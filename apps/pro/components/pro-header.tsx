import Link from 'next/link';
import type { ProMe } from '@klyr/api-client';
import { SignOut } from './sign-out';

const TABS = [['/', 'visits', 'Visits'], ['/offers', 'offers', 'Offers'], ['/deals', 'deals', 'Deals'], ['/listings', 'listings', 'Listings'], ['/quotes', 'quotes', 'Quotes'], ['/clients', 'clients', 'Clients']] as const;

/** Wordmark and who is signed in, then an underlined tab row. Each page follows with its serif title. */
export function ProHeader({ me, current }: { me: ProMe; current: 'visits' | 'offers' | 'deals' | 'listings' | 'quotes' | 'clients' }) {
  const initials = me.name.split(' ').slice(0, 2).map(w => w[0]).join('');
  return (
    <header style={{ display: 'flex', flexDirection: 'column', gap: 18, marginBottom: 8 }}>
      <div className="p-top">
        <Link href="/" style={{ fontFamily: 'var(--serif)', fontSize: 26, fontWeight: 700, letterSpacing: '-.02em', color: 'var(--ink)', textDecoration: 'none' }}>
          Klyr <span style={{ fontWeight: 400, color: 'var(--brand)' }}>Pro</span>
        </Link>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontWeight: 600, fontSize: 14 }}>{me.name}</div>
            <div className="k-note">{me.title} · {me.brokerage}</div>
          </div>
          <span className="k-avatar" aria-hidden>{initials}</span>
          <SignOut />
        </div>
      </div>
      <nav className="k-tabs" aria-label="Klyr Pro">
        {TABS.map(([href, key, label]) => <Link key={key} href={href} aria-current={current === key ? 'page' : undefined}>{label}</Link>)}
      </nav>
    </header>
  );
}
