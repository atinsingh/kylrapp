import { redirect } from 'next/navigation';
import { AdminNav } from '@/components/admin-nav';
import type { Payout } from '@klyr/api-client';
import { money, torontoWhen } from '@klyr/core';
import { api, sessionToken } from '@klyr/web-kit/session';
import { PayoutActions } from './payout-actions';

export const metadata = { title: 'Cash-back payouts · Klyr Admin' };

const STATUS: Record<Payout['status'], string> = { pending_commission: 'Waiting for commission', ready: 'Ready to pay', sent: 'Paid', failed: 'Failed', reduced: 'Reduced' };

/** Broker of record: commission received from the listing brokerage, then the buyer's cash back by EFT. */
export default async function PayoutsPage() {
  if (!(await sessionToken())) redirect('/signin');
  const res = await api<Payout[]>('/admin/payouts');
  if (!res.data) redirect('/signin');
  const list = res.data;
  const due = list.filter(p => p.status !== 'sent').reduce((t, p) => t + p.amount, 0);
  return (
    <main className="a-wrap">
      <AdminNav current="payouts" />
      <h1 className="k-h1">Cash-back payouts</h1>
      <p className="k-sub">
        Each closed deal’s cash back is the buyer’s plan share of the commission Klyr actually receives. Record the commission when the listing
        brokerage pays it, then the EFT reference once the payment leaves Klyr Realty’s account. Klyr doesn’t move money; this is the record. {money(due)} still to pay.
      </p>
      {!list.length && <section className="k-card"><strong>Nothing yet</strong><span className="k-note">Payouts appear when an agent records a closing.</span></section>}
      {list.map(p => (
        <article key={p.id} className="k-card" aria-label={`Cash back for ${p.client ?? p.email}`}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
            <strong style={{ fontSize: 17 }}>{p.client ?? p.email}</strong>
            <span className="k-note">{p.address} · {money(p.price)} · listed by {p.listingBrokerage}</span>
            <span className="a-flag" style={p.status === 'sent' ? { background: '#E3F2E8', color: '#2B7A4B' } : undefined}>{STATUS[p.status]}</span>
          </div>
          <div className="a-grid">
            <span><span className="k-note">Closed</span><br />{p.closedAt ? torontoWhen(p.closedAt) : '—'}</span>
            <span><span className="k-note">Commission expected ({(Number(p.coop ?? 0) * 100).toFixed(1)}%)</span><br />{money(Math.round(p.price * Number(p.coop ?? 0)))}</span>
            <span><span className="k-note">Commission received</span><br />{p.commissionReceived !== null ? money(p.commissionReceived) : '—'}</span>
            <span><span className="k-note">Cash back ({p.pct}%)</span><br /><strong>{money(p.amount)}</strong>{p.status === 'pending_commission' ? ' (estimate)' : ''}</span>
            {p.paidAt && <span><span className="k-note">Paid</span><br />{torontoWhen(p.paidAt)} · {p.reference}</span>}
          </div>
          <PayoutActions p={p} />
        </article>
      ))}
    </main>
  );
}
