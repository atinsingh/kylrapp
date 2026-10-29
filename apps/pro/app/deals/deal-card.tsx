'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ProDeal } from '@klyr/api-client';
import { money, torontoWhen } from '@klyr/core';
import { errorText, klyr } from '@/lib/client';

const LABEL = { financing: 'Financing', inspection: 'Inspection', status_certificate: 'Status certificate', sale_of_buyer_home: 'Sale of buyer’s home', other: 'Other' } as const;
const left = (iso: string) => { const h = Math.floor((Date.parse(iso) - Date.now()) / 3_600_000); return h <= 0 ? 'due now' : h >= 48 ? `${Math.floor(h / 24)} days left` : `${h} h left`; };

export function DealCard({ d }: { d: ProDeal }) {
  const router = useRouter();
  const [note, setNote] = useState('');
  const [trustOpen, setTrustOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const run = async (fn: () => Promise<{ ok: boolean; error?: { code?: string; message?: unknown } }>) => {
    setBusy(true); setError('');
    const r = await fn();
    setBusy(false);
    if (!r.ok) return setError(errorText(r.error));
    setTrustOpen(false); setNote('');
    router.refresh();
  };
  const dep = d.deposit, isVoid = d.status === 'void';

  return (
    <article className="k-card" aria-label={`Deal on ${d.address} for ${d.clientName ?? d.clientEmail}`}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
        <strong style={{ fontSize: 18 }}>{d.address}, {d.city}</strong>
        <span className="k-note" style={{ marginLeft: 'auto' }}>{money(d.price)} · {d.clientName ?? d.clientEmail}</span>
      </div>
      <div className="k-note">Accepted {torontoWhen(d.acceptedAt)} · {isVoid ? 'void: a condition lapsed' : `closing ${d.closingDate}`} · listed by {d.listingBrokerage}</div>

      {dep && (
        <div className="p-fence" style={dep.receivedAt || isVoid ? undefined : { background: '#FBEBDD', color: '#A54B00' }}>
          <strong>Deposit {money(dep.amount)}</strong> · {dep.returnedAt ? `returned ${torontoWhen(dep.returnedAt)}` : isVoid && !dep.receivedAt ? 'not received; return it if it arrives' : dep.receivedAt ? `received ${torontoWhen(dep.receivedAt)}` : `due ${torontoWhen(dep.dueAt)} (${left(dep.dueAt)})`}
          <div style={{ marginTop: 4 }}>{dep.trustVerifiedAt ? `✓ Trust account confirmed by phone ${torontoWhen(dep.trustVerifiedAt)} · ${dep.trustVerifiedBy}` : !dep.receivedAt && !isVoid ? 'Trust account not yet confirmed by phone.' : ''}</div>
        </div>
      )}
      {dep && !dep.receivedAt && !isVoid && !dep.trustVerifiedAt && (trustOpen ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <label className="k-field">Who did you speak to, and which number did you call? (look it up yourself; never use one from an email)
            <input value={note} onChange={e => setNote(e.target.value)} maxLength={500} placeholder="e.g. Jo in accounting, 905-555-0100 from their website" />
          </label>
          <div className="p-row">
            <button className="k-btn" disabled={busy || note.trim().length < 3} onClick={() => run(() => klyr.pro.trustVerified(d.dealId, note))}>Record the call</button>
            <button className="k-btn k-alt" onClick={() => setTrustOpen(false)}>Back</button>
          </div>
        </div>
      ) : <button className="k-btn k-alt" onClick={() => setTrustOpen(true)}>I confirmed the trust account by phone</button>)}
      {dep && !dep.receivedAt && !isVoid && <button className="k-btn" disabled={busy} onClick={() => run(() => klyr.pro.depositReceived(d.dealId))}>Deposit receipt received</button>}

      {d.conditions.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {d.conditions.map(c => {
            const signed = c.waivedAt ?? c.fulfilledAt;
            return (
              <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', borderTop: '.5px solid var(--sep)', paddingTop: 6 }}>
                <strong style={{ fontSize: 14 }}>{LABEL[c.kind]}</strong>
                <span className="k-note" style={{ flex: 1 }}>
                  {c.deliveredAt ? `✓ ${c.waivedAt ? 'Waiver' : 'Fulfillment'} delivered ${torontoWhen(c.deliveredAt)}`
                    : c.lapsedAt ? '× Lapsed' : isVoid ? 'Ended with the agreement' : signed ? `Client signed ${c.waivedAt ? 'a waiver' : 'a notice of fulfillment'} · deliver before ${torontoWhen(c.dueAt)}` : `Open until ${torontoWhen(c.dueAt)} (${left(c.dueAt)})`}
                </span>
                {signed && !c.deliveredAt && !c.lapsedAt && !isVoid && (
                  <button className="k-btn" style={{ width: 'auto', minHeight: 40, padding: '0 14px' }} disabled={busy} onClick={() => run(() => klyr.pro.delivered(c.id))}>Delivered to {d.listingBrokerage.split(',')[0]}</button>
                )}
              </div>
            );
          })}
        </div>
      )}
      {isVoid && (
        <div className="p-fence">
          {d.release ? `Client signed the mutual release ${torontoWhen(d.release.signedAt)}.` : 'Waiting for your client to sign the mutual release (Form 122).'}
          {d.release && dep && !dep.returnedAt && ' Once the seller signs and the listing brokerage releases the deposit, record it here.'}
        </div>
      )}
      {isVoid && d.release && dep && !dep.returnedAt && <button className="k-btn" disabled={busy} onClick={() => run(() => klyr.pro.depositReturned(d.dealId))}>Deposit returned to client</button>}
      {error && <div className="k-error" role="alert">{error}</div>}
    </article>
  );
}
