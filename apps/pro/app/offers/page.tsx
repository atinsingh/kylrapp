import type { ProOffer } from '@klyr/api-client';
import { ProHeader } from '@/components/pro-header';
import { api, requireAgent } from '@/lib/session';
import { OfferCard } from './offer-card';

export const metadata = { title: 'Offers · Klyr Pro' };

const GROUPS: [string, (o: ProOffer) => boolean][] = [
  ['NEEDS YOUR REVIEW', o => o.status === 'sent'],
  ['WITH THE SELLER', o => o.status === 'registered'],
  ['SIGNED BACK · WAITING FOR YOUR CLIENT', o => o.signBack?.status === 'signed_back'],
  ['ACCEPTED', o => o.status === 'accepted' || o.signBack?.status === 'accepted'],
  ['SENT BACK TO YOUR CLIENT', o => o.status === 'returned'],
  ['CLOSED', o => ['rejected', 'expired', 'withdrawn', 'void'].includes(o.status) || (o.status === 'signed_back' && !!o.signBack && ['rejected', 'expired'].includes(o.signBack.status))],
];

export default async function OffersPage() {
  const me = await requireAgent();
  const offers = (await api<ProOffer[]>('/pro/offers')).data ?? [];
  return (
    <main className="p-wrap">
      <ProHeader me={me} current="offers" />
      <h1 className="k-h1">Offers</h1>
      <p className="k-sub">
        Review each offer your client signs, then register it with the listing brokerage and record its Form 801 confirmation.
        Record the seller’s answer here: your client is emailed at every step.
      </p>
      {!offers.length && <section className="k-card"><strong>No offers yet</strong><span className="k-note">When a client signs an offer, it appears here for your review.</span></section>}
      {GROUPS.map(([label, test]) => {
        const list = offers.filter(test);
        return list.length > 0 && (
          <section key={label} aria-label={label.toLowerCase()} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div className="k-label">{label} · {list.length}</div>
            {list.map(o => <OfferCard key={o.id} o={o} />)}
          </section>
        );
      })}
    </main>
  );
}
