import Link from 'next/link';
import { Building2, CalendarDays, Calculator, FileText, FolderOpen, Heart, KeyRound, Search, ShieldCheck, Tag, Wallet } from 'lucide-react';
import type { Me } from '@klyr/contracts';
import { SignOut } from './sign-out';

type Page = 'search' | 'saved' | 'afford' | 'estimate' | 'visits' | 'offers' | 'documents' | 'sell' | 'rent' | 'lease' | 'quotes' | 'security';
const GROUPS: [string, [string, Page, string, typeof Search][]][] = [
  ['Buy', [['/', 'search', 'Search', Search], ['/saved', 'saved', 'Saved', Heart], ['/afford', 'afford', 'Afford', Wallet], ['/visits', 'visits', 'Visits', CalendarDays], ['/offers', 'offers', 'Offers', FileText]]],
  ['Sell and rent', [['/sell', 'sell', 'Sell', Tag], ['/rent', 'rent', 'Rent', KeyRound], ['/lease', 'lease', 'Lease out', Building2]]],
  ['Account', [['/quotes', 'quotes', 'Quotes', Calculator], ['/documents', 'documents', 'Documents', FolderOpen], ['/security', 'security', 'Security', ShieldCheck]]],
];

/** The signed-in sidebar: the same shell as Klyr Pro and Admin, with sections grouped the way people use them. */
export function AppHeader({ me, current }: { me: Me | null; current?: Page }) {
  const name = me?.legalName ?? me?.email ?? '';
  const initials = name.split(/[\s@]/).filter(Boolean).slice(0, 2).map(w => w[0]!.toUpperCase()).join('');
  return (
    <aside className="k-side" aria-label="Klyr">
      <div className="k-side-in">
        <Link href="/" className="k-brand"><img src="/klyr-mark.png" alt="" width={26} height={26} style={{ borderRadius: 6 }} />klyr</Link>
        <nav aria-label="Main">
          {GROUPS.map(([group, links]) => (
            <div key={group} className="k-side-group">
              <div className="k-side-title">{group}</div>
              {links.map(([href, key, label, Ico]) => (
                <Link key={key} href={href} aria-current={current === key ? 'page' : undefined}><Ico size={18} strokeWidth={current === key ? 2.4 : 2} aria-hidden />{label}</Link>
              ))}
            </div>
          ))}
        </nav>
        <div className="k-me">
          <span className="k-avatar" aria-hidden>{initials}</span>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</div>
          </div>
          <SignOut />
        </div>
      </div>
    </aside>
  );
}
