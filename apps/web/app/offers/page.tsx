import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { Me } from '@klyr/contracts';
import type { BuyingStatus, Offer } from '@klyr/api-client';
import { money, TORONTO, torontoWhen } from '@klyr/core';
import { AppHeader } from '@/components/app-header';
import { api, sessionToken } from '@/lib/session';
import { OfferActions } from './offer-actions';

export const metadata = { title: 'Your offers · Klyr' };

const when = (iso: string) => torontoWhen(iso);
const STATUS: Record<Offer['status'], [string, string, string]> = {
  draft: ['Draft · not sent', '#F2F2F7', '#5E5E63'],
  sent: ['With your agent', '#FBEBDD', '#A54B00'],
  returned: ['Sent back for changes', '#FBEBDD', '#A54B00'],
  registered: ['With the seller', '#FBEBDD', '#A54B00'],
  signed_back: ['Seller signed back', '#E8EEF9', '#2A4D8F'],
  accepted: ['Accepted', '#E3F2E8', '#2B7A4B'],
  rejected: ['Not accepted', '#F2F2F7', '#5E5E63'],
  expired: ['Expired', '#F2F2F7', '#5E5E63'],
  withdrawn: ['Withdrawn', '#F2F2F7', '#5E5E63'],
};

/** The steps of one offer, as in the design's Offer status. */
function steps(o: Offer, agent: string): [string, string, boolean][] {
  const accepted = o.status === 'accepted' || o.signBack?.status === 'accepted';
  const out: [string, string, boolean][] = [
    ['Signed by you', o.sentAt ? when(o.sentAt) : 'Not yet', !!o.sentAt],
    [`Reviewed by ${agent}`, o.status === 'returned' ? 'Sent back for changes' : o.registeredAt ? 'Sent to the listing brokerage' : '', !!o.registeredAt],
    [`Registered with ${o.listingBrokerage}`, o.registeredAt ? `Form 801 received · ${when(o.registeredAt)}` : '', !!o.registeredAt],
    [`Seller decides by ${when(o.irrevocableAt)}`, o.decidedAt ? when(o.decidedAt) : '', !!o.decidedAt],
  ];
  if (o.signBack) out.push([`Signed back at ${money(o.signBack.price)}`, o.signBack.status === 'signed_back' ? `Open until ${when(o.signBack.irrevocableAt)}` : o.signBack.status === 'accepted' ? 'You accepted' : o.signBack.status === 'rejected' ? 'You declined' : 'Expired', o.signBack.status !== 'signed_back']);
  out.push(['Accepted', accepted ? 'Deposit due within 24 hours' : '', accepted]);
  return out;
}

export default async function OffersPage({ searchParams }: { searchParams: Promise<{ sent?: string }> }) {
  if (!(await sessionToken())) redirect('/welcome');
  const sent = (await searchParams).sent === '1';
  const [me, res, buying] = await Promise.all([api<Me>('/auth/me'), api<Offer[]>('/offers'), api<BuyingStatus>('/buying')]);
  if (me.status === 401) redirect('/welcome');
  const list = res.data ?? [];
  const agent = buying.data?.agent?.name ?? 'Your agent';
  const hasDeal = list.some(o => o.status === 'accepted' || o.signBack?.status === 'accepted');

  return (
    <main style={{ maxWidth: 960, margin: '0 auto', padding: '24px 16px 48px' }}>
      <AppHeader me={me.data} current="offers" />
      <div style={{ maxWidth: 640, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <h1 className="k-h1" style={{ fontSize: 28 }}>Your offers</h1>
        {sent && <div className="k-card" role="status" style={{ background: 'var(--tint)', color: 'var(--brand)', fontWeight: 600 }}>Signed and sent to {agent} to review. We’ll email you at each step.</div>}
        {hasDeal && <Link href="/deal" className="k-btn" style={{ display: 'grid', placeItems: 'center', textDecoration: 'none' }}>Open your deal</Link>}
        {!list.length && (
          <section className="k-card" style={{ alignItems: 'flex-start' }}>
            <strong>No offers yet</strong>
            <span className="k-note">Open a home you’ve visited and tap “Make an offer”.</span>
            <Link href="/" className="k-btn" style={{ display: 'grid', placeItems: 'center', textDecoration: 'none', width: 'auto', padding: '0 24px' }}>Search homes</Link>
          </section>
        )}
        {list.map(o => {
          const [label, bg, fg] = STATUS[o.signBack?.status === 'accepted' ? 'accepted' : o.status];
          return (
            <article key={o.id} className="k-card" aria-label={`Offer on ${o.address}`}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                {o.photo && <img src={o.photo.url} alt={o.photo.alt} style={{ width: 72, height: 54, objectFit: 'cover', borderRadius: 8, flex: 'none' }} />}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Link href={`/listings/${o.listingId}`} style={{ fontWeight: 700, color: 'var(--text)' }}>{o.address}, {o.city}</Link>
                  <div className="k-note">{money(o.price)} · deposit {money(o.deposit)} · all-in {money(o.allIn)} · Form {o.form}</div>
                </div>
                <span style={{ borderRadius: 999, padding: '2px 9px', fontSize: 12, fontWeight: 700, background: bg, color: fg, whiteSpace: 'nowrap' }}>{label}</span>
              </div>
              {o.agentNote && <div className="k-note" style={{ color: 'var(--text)' }}>{agent}: “{o.agentNote}”</div>}
              {o.status !== 'draft' && (
                <ol style={{ listStyle: 'none', margin: 0, padding: 0 }} aria-label="Steps">
                  {steps(o, agent).map(([t, sub, done]) => (
                    <li key={t} style={{ display: 'flex', gap: 10, padding: '6px 0', alignItems: 'flex-start' }}>
                      <span className="k-dot" aria-hidden style={done ? { background: '#2B7A4B', borderColor: '#2B7A4B', width: 18, height: 18, fontSize: 10 } : { width: 18, height: 18 }}>{done ? '✓' : ''}</span>
                      <span style={{ fontSize: 14 }}><span style={{ fontWeight: done ? 600 : 400, color: done ? 'var(--text)' : 'var(--muted)' }}>{t}</span>{sub && <span className="k-note"> · {sub}</span>}</span>
                    </li>
                  ))}
                </ol>
              )}
              <OfferActions offer={o} legalName={me.data?.legalName ?? ''} />
            </article>
          );
        })}
        <p className="k-note" style={{ margin: 0, fontWeight: 700, color: 'var(--brand)' }}>
          ● Rule · multiple offers: the listing brokerage must tell every buyer agent how many offers it has. Other buyers’ terms stay private unless the seller directs otherwise in writing.
        </p>
      </div>
    </main>
  );
}
