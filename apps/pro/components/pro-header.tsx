import Link from 'next/link';
import { Briefcase, Calculator, CalendarDays, FileText, House, Users } from 'lucide-react';
import type { ProMe } from '@klyr/api-client';
import { SignOut } from './sign-out';

const TABS = [
  ['/', 'visits', 'Visits', CalendarDays], ['/offers', 'offers', 'Offers', FileText], ['/deals', 'deals', 'Deals', Briefcase],
  ['/listings', 'listings', 'Listings', House], ['/quotes', 'quotes', 'Quotes', Calculator], ['/clients', 'clients', 'Clients', Users],
] as const;

/** The sidebar every Pro page starts with: icon navigation, and who is signed in at the bottom. */
export function ProHeader({ me, current }: { me: ProMe; current: 'visits' | 'offers' | 'deals' | 'listings' | 'quotes' | 'clients' }) {
  const initials = me.name.split(' ').slice(0, 2).map(w => w[0]).join('');
  return (
    <aside className="k-side" aria-label="Klyr Pro">
      <div className="k-side-in">
      <Link href="/" className="k-brand"><img src="/klyr-mark.png" alt="" width={26} height={26} style={{ borderRadius: 6 }} />Klyr <span>Pro</span></Link>
      <nav aria-label="Klyr Pro">
        {TABS.map(([href, key, label, Ico]) => (
          <Link key={key} href={href} aria-current={current === key ? 'page' : undefined}><Ico size={20} strokeWidth={current === key ? 2.4 : 2} aria-hidden />{label}</Link>
        ))}
      </nav>
      <div className="k-me">
        <span className="k-avatar" aria-hidden>{initials}</span>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{me.name}</div>
          <div className="k-note" style={{ fontSize: 12 }}>{me.title}</div>
        </div>
        <SignOut />
      </div>
      </div>
    </aside>
  );
}
