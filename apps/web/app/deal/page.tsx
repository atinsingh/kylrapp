import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { Me } from '@klyr/contracts';
import type { BuyingStatus, Deal } from '@klyr/api-client';
import { money, TORONTO, torontoWhen } from '@klyr/core';
import { AppHeader } from '@/components/app-header';
import { api, sessionToken } from '@/lib/session';

export const metadata = { title: 'Your deal · Klyr' };

const when = (iso: string) => torontoWhen(iso);
const longDate = (ymd: string) => new Date(ymd + 'T12:00:00Z').toLocaleDateString('en-CA', { weekday: 'short', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
const left = (iso: string) => {
  const ms = Date.parse(iso) - Date.now();
  if (ms <= 0) return 'passed';
  const h = Math.floor(ms / 3_600_000);
  return h >= 48 ? `${Math.floor(h / 24)} days left` : h >= 1 ? `${h} h left` : `${Math.ceil(ms / 60_000)} min left`;
};
const CONDITION: Record<Deal['conditions'][number]['kind'], [string, string]> = {
  financing: ['Financing', 'Your lender approves the mortgage and the appraisal.'],
  inspection: ['Inspection', 'Book the inspector; decide if you’re satisfied.'],
  status_certificate: ['Status certificate', 'Your lawyer reviews it within the days after it arrives.'],
  sale_of_buyer_home: ['Sale of your home', ''],
  other: ['Other condition', ''],
};

/** After acceptance: the deposit, each condition's deadline, and closing. */
export default async function DealPage() {
  if (!(await sessionToken())) redirect('/welcome');
  const [me, res, buying] = await Promise.all([api<Me>('/auth/me'), api<Deal>('/deal'), api<BuyingStatus>('/buying')]);
  if (me.status === 401) redirect('/welcome');
  const d = res.data, agent = buying.data?.agent?.name ?? 'Your agent';
  return (
    <main style={{ maxWidth: 960, margin: '0 auto', padding: '24px 16px 48px' }}>
      <AppHeader me={me.data} current="offers" />
      <div style={{ maxWidth: 640, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {!d ? (
          <section className="k-card" style={{ alignItems: 'flex-start' }}>
            <strong style={{ fontSize: 20 }}>No accepted offer yet</strong>
            <span className="k-note">When a seller accepts, this becomes your checklist from deposit to keys.</span>
            <Link href="/offers" className="k-btn" style={{ display: 'grid', placeItems: 'center', textDecoration: 'none', width: 'auto', padding: '0 24px' }}>Offer status</Link>
          </section>
        ) : (
          <>
            <section className="k-card" style={{ background: 'var(--ink)', color: '#fff', borderRadius: 20, padding: 18 }}>
              <div className="k-label" style={{ color: '#8CC2B1' }}>{d.address.toUpperCase()}, {d.city.toUpperCase()} · {money(d.price)}</div>
              <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-.02em' }}>{d.stage === 'firm' ? 'Firm' : 'Conditional'}</div>
              <div style={{ fontSize: 13, color: '#C9DDD6' }}>Accepted {when(d.acceptedAt)} · closing {longDate(d.closingDate)} · all-in {money(d.allIn)} · cash back {money(d.cashBack)}</div>
            </section>

            {d.deposit && (
              <section className="k-card" aria-label="Deposit" style={d.deposit.receivedAt ? undefined : { boxShadow: '0 0 0 2px #A54B00 inset' }}>
                <div className="k-label" style={d.deposit.receivedAt ? undefined : { color: '#A54B00' }}>{d.deposit.receivedAt ? 'DEPOSIT RECEIVED' : `DEPOSIT DUE · ${left(d.deposit.dueAt).toUpperCase()}`}</div>
                <strong style={{ fontSize: 26 }}>{money(d.deposit.amount)}</strong>
                <span style={{ fontSize: 14 }}>
                  {d.deposit.receivedAt
                    ? `${d.deposit.holder} confirmed receipt ${when(d.deposit.receivedAt)}. It’s held in trust and credited to the price at closing.`
                    : `To ${d.deposit.holder} in trust, by ${when(d.deposit.dueAt)}, by bank draft or wire.`}
                </span>
                {!d.deposit.receivedAt && (
                  <div className="k-error" style={{ background: '#FDECEC' }}>
                    <strong>Before you send money:</strong> {agent} gives you the trust account details. Phone {d.deposit.holder} at a number you look up yourself to confirm them. Klyr never changes payment details by email.
                  </div>
                )}
              </section>
            )}

            <section className="k-card" aria-label="Conditions">
              <div className="k-label">CONDITIONS</div>
              {!d.conditions.length && <span style={{ fontSize: 14 }}>None. Your deal is firm.</span>}
              {d.conditions.map((c, i) => {
                const [title, sub] = CONDITION[c.kind];
                const done = c.waivedAt || c.fulfilledAt;
                return (
                  <div key={c.id} style={{ display: 'flex', gap: 10, padding: '8px 0', borderTop: i ? '.5px solid var(--sep)' : 0 }}>
                    <span className="k-dot" aria-hidden style={done ? { background: '#2B7A4B', borderColor: '#2B7A4B' } : undefined}>{done ? '✓' : ''}</span>
                    <div style={{ flex: 1 }}>
                      <strong>{title}</strong> <span className="k-note">· until {when(c.dueAt)} · {left(c.dueAt)}</span>
                      <div className="k-note">{sub}</div>
                    </div>
                  </div>
                );
              })}
              {d.conditions.length > 0 && <span className="k-note">Each condition ends at 11:59 pm on its last banking day (weekends and Ontario holidays don’t count). If it isn’t met or waived in writing by then, the deal ends and your deposit is returned. {agent} confirms these dates against your signed agreement.</span>}
            </section>

            <section className="k-card">
              <div className="k-label">NEXT</div>
              <span style={{ fontSize: 14 }}>Choose your lawyer, send your lender the agreement, and book the inspection. {agent} walks you through each one.</span>
              <Link href="/documents" style={{ fontWeight: 700, fontSize: 14 }}>Your signed offer is in Documents ›</Link>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
