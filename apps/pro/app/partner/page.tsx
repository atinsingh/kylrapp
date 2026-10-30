import type { PartnerKey, PartnerRequest, QuoteKind } from '@klyr/api-client';
import { api, requirePartner } from '@/lib/session';
import { SignOut } from '@/components/sign-out';
import { Connect } from './connect';
import { PartnerQuote } from './partner-quote';

export const metadata = { title: 'Quote requests · Klyr Partners' };

/** A provider's own view: requests that named the firm, and its quotes. Clients see quotes ranked only by what they pay. */
export default async function PartnerPage() {
  const me = await requirePartner();
  const [reqs, keys] = await Promise.all([api<PartnerRequest[]>('/partner/requests'), api<PartnerKey[]>('/partner/keys')]);
  const list = reqs.data ?? [];
  const kind = ({ law_firm: 'lawyer', lender: 'lender', inspector: 'inspector', insurer: 'insurer' } as Record<string, QuoteKind>)[me.org.kind] ?? 'lender';
  const open = list.filter(r => r.status === 'open'), done = list.filter(r => r.status !== 'open');
  return (
    <main className="p-wrap">
      <header className="p-top">
        <div>
          <div style={{ fontWeight: 800, fontSize: 18, color: 'var(--brand)' }}>Klyr Partners</div>
          <div className="k-note">{me.name ?? me.email} · {me.org.name} · {me.org.registration}</div>
        </div>
        <nav className="p-tabs" aria-label="Klyr Partners"><SignOut to="/partner/signin" /></nav>
      </header>
      <h1 className="k-h1">Quote requests</h1>
      <p className="k-sub">
        Klyr clients who asked {me.org.name} for a quote. Klyr ranks quotes only by what the client pays{me.org.kind === 'lender' ? ' (for mortgages, interest and fees over 5 years)' : ''}, and shows them any referral fee before they choose.
        You see the client’s name and email once they choose you.{me.org.referralAgreement ? '' : ' Your firm has no referral agreement with Klyr, so referral fees are $0.'}
      </p>
      {!list.length && <section className="k-card"><strong>No requests yet</strong><span className="k-note">You’ll get an email when a client asks for a quote.</span></section>}
      {[['WAITING FOR YOUR QUOTE', open], ['DECIDED', done]].map(([label, rs]) => (rs as PartnerRequest[]).length > 0 && (
        <section key={label as string} aria-label={(label as string).toLowerCase()} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div className="k-label">{label as string} · {(rs as PartnerRequest[]).length}</div>
          {(rs as PartnerRequest[]).map(r => <PartnerQuote key={r.id} r={r} referral={me.org.referralAgreement} />)}
        </section>
      ))}
      <Connect keys={keys.data ?? []} kind={kind} />
    </main>
  );
}
