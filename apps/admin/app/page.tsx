import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { ADMIN_LINKS, AdminNav } from '@/components/admin-nav';

/** What each module is for. Klyr AI review waits on Klyr AI itself. */
const ABOUT: Record<string, string> = {
  'field-activity': 'Showings with GPS check-in, refused attempts and time on site, per agent.',
  'id-reviews': 'FINTRAC ID checks waiting for review: third-party and politically exposed determinations.',
  payouts: 'Commission received, then each buyer’s cash back by EFT.',
  'listings-feed': 'PropTx VOW status, display rules, Klyr exclusive listings, suspend and restore.',
  marketplace: 'Providers, referral fee disclosures, the quote audit and partner portal access.',
  privacy: 'Requests for a copy, a correction or deletion, answered within 30 days.',
  assumptions: 'The estimate defaults every client starts from, versioned and reviewed every 90 days.',
  users: 'Staff, their roles and second factor, and the audit log.',
};

/** Klyr Admin: the brokerage's back office. Served only on the corporate VPN / SSO, never to clients. */
export default function AdminHome() {
  const today = new Date().toLocaleDateString('en-CA', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'America/Toronto' });
  return (
    <main className="a-wrap">
      <AdminNav current="home" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span className="k-label">{today}</span>
        <h1 className="k-h1">Overview</h1>
        <p className="k-sub">Everything the broker of record, compliance and privacy officers sign off on.</p>
      </div>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>
        {ADMIN_LINKS.filter(([, key]) => key !== 'home').map(([href, key, label, Ico]) => (
          <li key={key}>
            <Link href={href} className="k-card a-tile" style={{ textDecoration: 'none', height: '100%' }} aria-label={label}>
              <span style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--fill)', display: 'grid', placeItems: 'center' }}><Ico size={22} aria-hidden /></span>
              <span className="k-h2">{label}</span>
              <span className="k-note" style={{ fontSize: 14 }}>{ABOUT[key]}</span>
              <span style={{ marginTop: 'auto', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>Open <ArrowRight size={16} aria-hidden /></span>
            </Link>
          </li>
        ))}
        <li>
          <div className="k-card" style={{ height: '100%', boxShadow: 'none', background: 'transparent', border: '2px dashed var(--line)' }}>
            <span className="k-label" style={{ color: 'var(--accent)' }}>Waiting</span>
            <span className="k-h2">Klyr AI review</span>
            <span className="k-note" style={{ fontSize: 14 }}>Conversations sent to an agent, sources, and blocked advice under Form 326. Waits on Klyr AI: a model provider agreement and a legally reviewed prompt.</span>
          </div>
        </li>
      </ul>
    </main>
  );
}
