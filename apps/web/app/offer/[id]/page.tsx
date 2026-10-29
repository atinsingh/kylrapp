import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import type { Me } from '@klyr/contracts';
import type { Assumptions, BuyingStatus, ListingDetail, Offer, OfferTermsInput } from '@klyr/api-client';
import { AppHeader } from '@/components/app-header';
import { api, sessionToken } from '@/lib/session';
import { OfferBuilder } from './offer-builder';

export const metadata = { title: 'Make an offer · Klyr' };

export default async function OfferPage({ params }: { params: Promise<{ id: string }> }) {
  if (!(await sessionToken())) redirect('/welcome');
  const { id } = await params;
  const [me, listing, buying, start, mine] = await Promise.all([
    api<Me>('/auth/me'), api<ListingDetail>(`/listings/${encodeURIComponent(id)}`), api<BuyingStatus>('/buying'),
    api<{ draft: Offer | null; defaults: OfferTermsInput | null }>(`/offers/start?listingId=${encodeURIComponent(id)}`),
    api<Assumptions>('/me/assumptions'),
  ]);
  if (me.status === 401) redirect('/welcome');
  if (!listing.data || !buying.data || !start.data || !mine.data) notFound();
  const l = listing.data, b = buying.data, here = `/offer/${l.id}`;
  const d = start.data.draft;
  const initial: OfferTermsInput = d
    ? { listingId: l.id, price: d.price, deposit: d.deposit, irrevocableAt: d.irrevocableAt, ...d.terms }
    : start.data.defaults!;

  return (
    <main style={{ maxWidth: 960, margin: '0 auto', padding: '24px 16px 48px' }}>
      <AppHeader me={me.data} current="offers" />
      <Link href={`/listings/${l.id}`} style={{ fontSize: 13, fontWeight: 700 }}>‹ Back to the listing</Link>
      <div style={{ maxWidth: 640, display: 'flex', flexDirection: 'column', gap: 12, marginTop: 12 }}>
        <div>
          <h1 className="k-h1" style={{ fontSize: 26 }}>Make an offer</h1>
          <p className="k-sub" style={{ marginTop: 6 }}>{l.address}, {l.city} · listed by {l.listingBrokerage}{l.offerDate ? ` · offers ${l.offerDate}` : ''}</p>
        </div>
        {!b.canBookVisits && (
          <section className="k-card">
            <div className="k-label">● RULE · BEFORE AN OFFER</div>
            <strong>{!b.agreement.signed ? 'Sign your buyer agreement first' : 'Verify your ID first'}</strong>
            <span className="k-note">RECO requires a signed buyer agreement and FINTRAC requires an ID check before any offer.</span>
            {!b.agreement.signed
              ? <Link href={`/sign/300?next=${here}`} className="k-btn" style={btnLink}>Review and sign Form 300</Link>
              : b.idCheck.status !== 'needs_review' && <Link href={`/id-check?next=${here}`} className="k-btn" style={btnLink}>Verify my ID</Link>}
          </section>
        )}
        {d?.status === 'returned' && d.agentNote && (
          <section className="k-card" role="status" style={{ background: '#FBEBDD' }}>
            <strong style={{ color: '#A54B00' }}>Your agent sent this back</strong>
            <span style={{ color: '#A54B00', fontSize: 14 }}>“{d.agentNote}”</span>
          </section>
        )}
        <OfferBuilder
          listing={{ id: l.id, price: l.price, city: l.city, type: l.type as 'House' | 'Townhouse' | 'Condo', coop: l.coop, tax: l.annualTax ?? 0, fee: l.condoFee ?? undefined, brokerage: l.listingBrokerage }}
          assumptions={mine.data} initial={initial} enabled={b.canBookVisits}
          agent={b.agent ? b.agent.name : 'your agent'} legalName={me.data?.legalName ?? ''} />
      </div>
    </main>
  );
}

const btnLink = { display: 'grid', placeItems: 'center', textDecoration: 'none' } as const;
