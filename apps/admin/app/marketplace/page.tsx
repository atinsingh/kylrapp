import { redirect } from 'next/navigation';
import { AdminNav } from '@/components/admin-nav';
import type { MarketplaceAudit } from '@klyr/api-client';
import { money, torontoWhen } from '@klyr/core';
import { api, sessionToken } from '@klyr/web-kit/session';
import { PartnerForm } from './partner-form';

export const metadata = { title: 'Marketplace · Klyr Admin' };
const KIND: Record<string, string> = { law_firm: 'Lawyer', lender: 'Lender', inspector: 'Inspector', insurer: 'Insurer' };

/** Referral fee audit: every chosen quote, what Klyr earns, and whether the client acknowledged it in writing. */
export default async function MarketplacePage() {
  if (!(await sessionToken())) redirect('/signin');
  const [res, people] = await Promise.all([api<MarketplaceAudit>('/admin/marketplace'), api<{ email: string; name: string | null; orgId: string | null; role: string }[]>('/admin/partners')]);
  if (!res.data) redirect('/signin');
  const m = res.data, partners = people.data ?? [];
  const total = m.chosen.reduce((t, c) => t + c.referralFee, 0);
  return (
    <main className="a-wrap">
      <AdminNav current="marketplace" />
      <h1 className="k-h1">Marketplace</h1>
      <p className="k-sub">Providers, their quotes, and referral fees. Quotes are ranked by the client’s cost only; every fee is disclosed before the client chooses. {money(total)} in referral fees from chosen quotes.</p>
      <section className="k-card" aria-label="Checks">
        {[...m.checks, { name: 'Every referral fee acknowledged in writing', ok: m.chosen.every(c => c.acknowledged), detail: `${m.chosen.filter(c => c.referralFee > 0).length} chosen quote(s) with a fee.` }].map(c => (
          <div key={c.name}><strong style={{ color: c.ok ? 'var(--money)' : 'var(--accent)' }}>{c.ok ? '✓' : '✗'} {c.name}</strong><div className="k-note">{c.detail}</div></div>
        ))}
      </section>
      <section className="k-card" aria-label="Providers">
        <div className="k-label">PROVIDERS · {m.providers.length}</div>
        {m.providers.map(p => (
          <div key={p.id} style={{ padding: '6px 0', borderTop: '.5px solid var(--sep)' }}>
            <strong>{p.name}</strong> <span className="k-note">· {KIND[p.kind]} · {p.registration} · {p.referralAgreement ? 'referral agreement' : 'no referral fees'} · {p.quoted} quoted · {p.chosen} chosen{p.referralFees ? ` · ${money(p.referralFees)} in fees` : ''}</span>
            <div className="k-note">Portal: {partners.filter(x => x.orgId === p.id).map(x => x.name ?? x.email).join(', ') || 'nobody linked; your agents enter its quotes'}</div>
          </div>
        ))}
      </section>
      <PartnerForm providers={m.providers.map(p => ({ id: p.id, name: p.name }))} />
      <section className="k-card" aria-label="Chosen quotes">
        <div className="k-label">CHOSEN QUOTES · {m.chosen.length}</div>
        {m.chosen.length === 0 && <span className="k-note">None yet.</span>}
        {m.chosen.map(c => (
          <div key={c.id} style={{ padding: '6px 0', borderTop: '.5px solid var(--sep)' }}>
            <strong>{c.client}</strong> chose <strong>{c.provider}</strong> <span className="k-note">· {c.kind} · client pays {money(c.clientCost)} · referral fee {money(c.referralFee)}{c.referralFee ? (c.acknowledged ? ' · acknowledged' : ' · NOT acknowledged') : ''} · {torontoWhen(c.acceptedAt)}</span>
          </div>
        ))}
      </section>
    </main>
  );
}
