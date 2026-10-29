import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { Me } from '@klyr/contracts';
import type { BuyingStatus, Deal } from '@klyr/api-client';
import { money, torontoWhen } from '@klyr/core';
import { AppHeader } from '@/components/app-header';
import { api, sessionToken } from '@/lib/session';
import { ConditionActions, ReleaseCard } from './deal-actions';

export const metadata = { title: 'Your deal · Klyr' };

const when = torontoWhen;
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

/** After acceptance: the deposit, each condition's notice and deadline, closing — or the release if it went void. */
export default async function DealPage() {
  if (!(await sessionToken())) redirect('/welcome');
  const [me, res, buying] = await Promise.all([api<Me>('/auth/me'), api<Deal>('/deal'), api<BuyingStatus>('/buying')]);
  if (me.status === 401) redirect('/welcome');
  const d = res.data, agent = buying.data?.agent?.name ?? 'Your agent', legalName = me.data?.legalName ?? '';
  const isVoid = d?.status === 'void';
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
            <section className="k-card" style={{ background: isVoid ? '#5E5E63' : 'var(--ink)', color: '#fff', borderRadius: 20, padding: 18 }}>
              <div className="k-label" style={{ color: isVoid ? '#E5E5EA' : '#8CC2B1' }}>{d.address.toUpperCase()}, {d.city.toUpperCase()} · {money(d.price)}</div>
              <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-.02em' }}>{isVoid ? 'Ended' : d.stage === 'firm' ? 'Firm' : 'Conditional'}</div>
              <div style={{ fontSize: 13, color: isVoid ? '#E5E5EA' : '#C9DDD6' }}>
                {isVoid ? 'A condition wasn’t met in time, so the agreement is void. Your deposit comes back in full.'
                  : `Accepted ${when(d.acceptedAt)} · closing ${longDate(d.closingDate)} · all-in ${money(d.allIn)} · cash back ${money(d.cashBack)}`}
              </div>
            </section>

            {isVoid && <ReleaseCard deal={d} legalName={legalName} agent={agent} />}

            {d.deposit && (
              <section className="k-card" aria-label="Deposit" style={d.deposit.receivedAt || isVoid ? undefined : { boxShadow: '0 0 0 2px #A54B00 inset' }}>
                <div className="k-label" style={d.deposit.receivedAt || isVoid ? undefined : { color: '#A54B00' }}>
                  {d.deposit.returnedAt ? 'DEPOSIT RETURNED' : d.deposit.receivedAt ? 'DEPOSIT RECEIVED' : isVoid ? 'DEPOSIT' : `DEPOSIT DUE · ${left(d.deposit.dueAt).toUpperCase()}`}
                </div>
                <strong style={{ fontSize: 26 }}>{money(d.deposit.amount)}</strong>
                <span style={{ fontSize: 14 }}>
                  {d.deposit.returnedAt ? `${d.deposit.holder} is returning it in full (${when(d.deposit.returnedAt)}).`
                    : d.deposit.receivedAt ? `${d.deposit.holder} confirmed receipt ${when(d.deposit.receivedAt)}. It’s held in trust and credited to the price at closing.`
                      : isVoid ? `Nothing to send now. If you already sent it to ${d.deposit.holder}, it comes back in full after the release.`
                      : `To ${d.deposit.holder} in trust, by ${when(d.deposit.dueAt)}, by bank draft or wire.`}
                </span>
                {d.deposit.trustVerifiedAt && (
                  <span className="k-note" style={{ color: '#2B7A4B', fontWeight: 600 }}>✓ Trust account details confirmed by phone · {when(d.deposit.trustVerifiedAt)} · {d.deposit.trustVerifiedBy}</span>
                )}
                {!d.deposit.receivedAt && !isVoid && (
                  <div className="k-error" style={{ background: '#FDECEC' }}>
                    <strong>Before you send money:</strong> {agent} gives you the trust account details{d.deposit.trustVerifiedAt ? ' and has confirmed them by phone' : ''}. Phone {d.deposit.holder} at a number you look up yourself to confirm them too. Klyr never changes payment details by email.
                  </div>
                )}
              </section>
            )}

            <section className="k-card" aria-label="Conditions">
              <div className="k-label">CONDITIONS</div>
              {!d.conditions.length && <span style={{ fontSize: 14 }}>None. Your deal is firm.</span>}
              {d.conditions.map((c, i) => {
                const [title, sub] = CONDITION[c.kind];
                const signed = c.waivedAt ?? c.fulfilledAt;
                const state = c.deliveredAt ? `${c.waivedAt ? 'Waived' : 'Fulfilled'} · delivered to the seller’s brokerage ${when(c.deliveredAt)}`
                  : c.lapsedAt ? 'Not met in time'
                    : isVoid ? 'Ended with the agreement'
                    : signed ? `${c.waivedAt ? 'Waiver' : 'Notice of fulfillment'} signed ${when(signed)} · ${agent} delivers it before ${when(c.dueAt)}`
                      : `Until ${when(c.dueAt)} · ${left(c.dueAt)}`;
                return (
                  <div key={c.id} style={{ display: 'flex', gap: 10, padding: '8px 0', borderTop: i ? '.5px solid var(--sep)' : 0 }} aria-label={title}>
                    <span className="k-dot" aria-hidden style={c.deliveredAt ? { background: '#2B7A4B', borderColor: '#2B7A4B' } : c.lapsedAt ? { background: '#A11B1B', borderColor: '#A11B1B' } : undefined}>{c.deliveredAt ? '✓' : c.lapsedAt ? '×' : ''}</span>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <div><strong>{title}</strong> <span className="k-note">· {state}</span><div className="k-note">{sub}</div></div>
                      {!isVoid && !signed && !c.lapsedAt && <ConditionActions id={c.id} title={title} legalName={legalName} />}
                    </div>
                  </div>
                );
              })}
              {d.conditions.length > 0 && !isVoid && <span className="k-note">Each condition ends at 11:59 pm on its last banking day. Your signed waiver or notice counts once {agent} delivers it to the seller’s brokerage before then; if not, the agreement ends and your deposit comes back.</span>}
            </section>

            {!isVoid && (
              <section className="k-card">
                <div className="k-label">NEXT</div>
                <span style={{ fontSize: 14 }}>Choose your lawyer, send your lender the agreement, and book the inspection. {agent} walks you through each one.</span>
                <Link href="/documents" style={{ fontWeight: 700, fontSize: 14 }}>Your signed documents ›</Link>
              </section>
            )}
          </>
        )}
      </div>
    </main>
  );
}
