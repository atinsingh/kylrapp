import Link from 'next/link';

/**
 * Klyr Admin: the brokerage's back office. Modules follow the Launch Checklist owners. Served only on the
 * corporate VPN / SSO, never to clients.
 */
const MODULES: [string, string, string | null, string | null][] = [
  ['Broker of record', 'Field activity: showings with GPS check-in, refused attempts and time on site.', '/field-activity', null],
  ['Compliance (FINTRAC)', 'ID checks waiting for review: third-party and politically exposed determinations, 5-year retention.', '/id-reviews', null],
  ['Trust and payouts', 'Commission received, then each buyer’s cash back by EFT.', '/payouts', null],
  ['Listings feed', 'PropTx VOW status, display rules, Klyr exclusive listings, suspend and restore.', '/listings-feed', null],
  ['Marketplace', 'Providers, referral fee disclosures, the quote audit and partner portal access.', '/marketplace', null],
  ['Privacy', 'Requests for a copy, a correction or deletion, answered within 30 days.', '/privacy', null],
  ['Content and assumptions', 'The estimate defaults every client starts from, versioned and reviewed every 90 days.', '/assumptions', null],
  ['Users and roles', 'Staff, their roles and second factor, and the audit log.', '/users', null],
  ['Klyr AI review', 'Conversations sent to an agent, sources, and blocked advice under Form 326.', null, 'Waits on Klyr AI: a model provider agreement and a legally reviewed prompt.'],
];

export default function AdminHome() {
  const today = new Date().toLocaleDateString('en-CA', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'America/Toronto' });
  return (
    <main className="a-wrap">
      <header style={{ display: 'flex', alignItems: 'baseline', gap: 12, borderBottom: '1px solid var(--line)', paddingBottom: 14 }}>
        <span style={{ fontFamily: 'var(--serif)', fontSize: 26, fontWeight: 700, letterSpacing: '-.02em', color: 'var(--ink)' }}>Klyr <span style={{ fontWeight: 400, color: 'var(--brand)' }}>Admin</span></span>
        <span className="k-note" style={{ marginLeft: 'auto' }}>Klyr Realty Inc., Brokerage · internal</span>
      </header>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, margin: '20px 0 12px' }}>
        <span className="k-label">{today}</span>
        <h1 className="k-h1" style={{ fontSize: 48 }}>The back office.</h1>
        <p className="k-sub">Everything the broker of record, compliance and privacy officers sign off on. Every action here is logged.</p>
      </div>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
        {MODULES.map(([title, desc, href, blocked]) => {
          const body = (
            <>
              <span className="k-label" style={{ color: blocked ? 'var(--accent)' : 'var(--brand)' }}>{blocked ? 'Waiting' : 'Live'}</span>
              <span className="k-h2">{title}</span>
              <span className="k-note" style={{ fontSize: 14 }}>{desc}</span>
              {blocked && <span className="k-note" style={{ color: 'var(--accent)' }}>{blocked}</span>}
            </>
          );
          return (
            <li key={title}>
              {href
                ? <Link href={href} className="k-card a-tile" style={{ color: 'var(--text)', textDecoration: 'none', height: '100%' }}>{body}<span style={{ marginTop: 'auto', fontWeight: 600, color: 'var(--ink)' }}>Open →</span></Link>
                : <div className="k-card" style={{ height: '100%', background: 'transparent', borderStyle: 'dashed' }}>{body}</div>}
            </li>
          );
        })}
      </ul>
    </main>
  );
}
