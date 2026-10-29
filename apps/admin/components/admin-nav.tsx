import Link from 'next/link';
import { Activity, BadgeCheck, Calculator, ClipboardList, Landmark, LayoutGrid, Lock, Rss, SlidersHorizontal, Users } from 'lucide-react';

export const ADMIN_LINKS = [
  ['/', 'home', 'Overview', LayoutGrid],
  ['/field-activity', 'field-activity', 'Field activity', Activity],
  ['/id-reviews', 'id-reviews', 'ID reviews', BadgeCheck],
  ['/payouts', 'payouts', 'Trust and payouts', Landmark],
  ['/listings-feed', 'listings-feed', 'Listings feed', Rss],
  ['/marketplace', 'marketplace', 'Marketplace', Calculator],
  ['/privacy', 'privacy', 'Privacy', Lock],
  ['/assumptions', 'assumptions', 'Assumptions', SlidersHorizontal],
  ['/users', 'users', 'Users and roles', Users],
] as const;
export type AdminPage = (typeof ADMIN_LINKS)[number][1];

/** The back office's sidebar, on every Admin page. */
export function AdminNav({ current }: { current: AdminPage }) {
  return (
    <aside className="k-side" aria-label="Klyr Admin">
      <Link href="/" className="k-brand"><img src="/klyr-mark.png" alt="" width={26} height={26} style={{ borderRadius: 6 }} />Klyr <span>Admin</span></Link>
      <nav aria-label="Klyr Admin">
        {ADMIN_LINKS.map(([href, key, label, Ico]) => (
          <Link key={key} href={href} aria-current={current === key ? 'page' : undefined}><Ico size={20} strokeWidth={current === key ? 2.4 : 2} aria-hidden />{label}</Link>
        ))}
      </nav>
      <div className="k-me"><ClipboardList size={18} aria-hidden /><span className="k-note" style={{ fontSize: 12 }}>Klyr Realty Inc., Brokerage · internal, every action logged</span></div>
    </aside>
  );
}
