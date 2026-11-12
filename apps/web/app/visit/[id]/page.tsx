import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import type { Me } from '@klyr/contracts';
import type { BuyingStatus, ListingDetail } from '@klyr/api-client';
import { AppHeader } from '@/components/app-header';
import { api, sessionToken } from '@/lib/session';
import { BookVisit } from './book-visit';

export const metadata = { title: 'Book a visit · Klyr' };

export default async function VisitPage({ params }: { params: Promise<{ id: string }> }) {
  if (!(await sessionToken())) redirect('/welcome');
  const { id } = await params;
  const [me, listing, buying] = await Promise.all([api<Me>('/auth/me'), api<ListingDetail>(`/listings/${encodeURIComponent(id)}`), api<BuyingStatus>('/buying')]);
  if (me.status === 401) redirect('/welcome');
  if (!listing.data || !buying.data) notFound();
  const l = listing.data, b = buying.data, here = `/visit/${l.id}`;
  const idDone = b.idCheck.status === 'verified', idReview = b.idCheck.status === 'needs_review';

  return (
    <main style={{ maxWidth: 960, margin: '0 auto', padding: '24px 16px 48px' }}>
      <AppHeader me={me.data} />
      <Link href={`/listings/${l.id}`} style={{ fontSize: 13, fontWeight: 700 }}>‹ Back to the listing</Link>
      <div style={{ maxWidth: 600, display: 'flex', flexDirection: 'column', gap: 12, marginTop: 12 }}>
        <div>
          <h1 className="k-h1" style={{ fontSize: 26 }}>Book a visit</h1>
          <p className="k-sub" style={{ marginTop: 6 }}>{l.address}, {l.city} · Listing brokerage: {l.listingBrokerage}</p>
        </div>

        <Step done={b.agreement.signed} title={b.agreement.signed ? 'Buyer agreement signed' : 'Sign your buyer agreement once'}
          sub={b.agreement.signed ? `Form 300 · until ${b.agreement.endsOn} · copy in Documents` : 'OREA Form 300 covers every visit and offer, not just this home.'}
          rule="● Rule · before your first visit">
          {!b.agreement.signed && <Link href={`/sign/300?next=${here}`} className="k-btn" style={btnLink}>Review and sign Form 300</Link>}
        </Step>

        <Step done={idDone} title={idDone ? 'ID verified' : idReview ? 'ID check with our compliance officer' : 'Verify your ID'}
          sub={idDone ? 'Kept by Klyr Realty for 5 years' : idReview ? 'We’ll let you know when you can book, usually within one business day.' : 'FINTRAC rules: photo ID, occupation and where your deposit comes from.'}
          rule="ALSO REQUIRED ONCE">
          {!idDone && !idReview && <Link href={`/id-check?next=${here}`} className="k-btn k-alt" style={btnLink}>Verify my ID</Link>}
        </Step>

        <BookVisit listingId={l.id} enabled={b.canBookVisits} openHouse={l.openHouse} agent={b.agent ? `${b.agent.name}, ${b.agent.title}` : 'Your agent'} />
      </div>
    </main>
  );
}

const btnLink = { display: 'grid', placeItems: 'center', textDecoration: 'none' } as const;

function Step({ done, title, sub, rule, children }: { done: boolean; title: string; sub: string; rule: string; children?: React.ReactNode }) {
  return (
    <section className="k-card" aria-label={title}>
      <div className="k-label">{rule}</div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <span className="k-dot" aria-hidden style={done ? { background: 'var(--money)', borderColor: 'var(--money)' } : undefined}>{done ? '✓' : ''}</span>
        <div><strong>{title}</strong><div className="k-note">{sub}</div></div>
      </div>
      {children}
    </section>
  );
}
