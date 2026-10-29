import Link from 'next/link';

/**
 * Klyr Admin: internal back office for the brokerage. Not yet designed; modules follow the
 * Launch Checklist owners. Served only on the corporate VPN / SSO, never to clients.
 */
const MODULES = [
  ['Broker of record', 'Deal review queue, agent registrations and titles, complaint escalations, multiple-representation consents'],
  ['Compliance (FINTRAC)', 'ID verification results, third-party and PEP determinations, receipt-of-funds records, 5-year retention'],
  ['Trust and payouts', 'Deposits due and received, call-back verification log, monthly reconciliation, cash-back payouts'],
  ['Listings feed', 'PropTx VOW sync status, no-display flags, Klyr exclusive listings'],
  ['Marketplace', 'Provider onboarding and licence checks, referral fee disclosures, quote audit'],
  ['Klyr AI review', 'Conversations flagged “Send to agent”, sources, blocked advice under Form 326'],
  ['Privacy', 'Data access and deletion requests, consent history, credit-check approvals'],
  ['Content and assumptions', 'All-in assumptions with their review date, rule notes, form templates'],
  ['Users and roles', 'Staff accounts, roles, MFA status, audit log'],
] as const;

/** Built so far: the FINTRAC ID review queue. */
const LIVE: Record<string, string> = { 'Compliance (FINTRAC)': '/id-reviews' };

export default function AdminHome() {
  return (
    <main style={{ maxWidth: 960, margin: '0 auto', padding: '24px 16px' }}>
      <h1 style={{ fontSize: 28, fontWeight: 800 }}>Klyr Admin</h1>
      <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: 12 }}>
        {MODULES.map(([t, d]) => (
          <li key={t} style={{ background: '#fff', borderRadius: 12, padding: 16 }}>
            {LIVE[t] ? <Link href={LIVE[t]}><strong>{t}</strong></Link> : <strong>{t}</strong>}
            <div style={{ color: 'var(--muted)' }}>{d}</div>
          </li>
        ))}
      </ul>
    </main>
  );
}
