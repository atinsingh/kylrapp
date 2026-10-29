'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ProOffer } from '@klyr/api-client';
import { fromTorontoInput, money, TORONTO, torontoInputValue, torontoWhen } from '@klyr/core';
import { errorText, klyr } from '@/lib/client';

const when = (iso: string) => torontoWhen(iso);
const longDate = (ymd: string) => new Date(ymd + 'T12:00:00Z').toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
type Mode = null | 'register' | 'return' | 'accepted' | 'signed_back' | 'rejected';

export function OfferCard({ o }: { o: ProOffer }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(null);
  const [note, setNote] = useState('');
  const [price, setPrice] = useState(o.price);
  const [until, setUntil] = useState(torontoInputValue(new Date(Date.now() + 6 * 3_600_000)));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const run = async (fn: () => Promise<{ ok: boolean; error?: { code?: string; message?: unknown } }>) => {
    setBusy(true); setError('');
    const r = await fn();
    setBusy(false);
    if (!r.ok) return setError(errorText(r.error));
    setMode(null); setNote('');
    router.refresh();
  };
  const submit = () => {
    if (mode === 'register' || mode === 'return') return run(() => klyr.pro.reviewOffer(o.id, mode === 'return' ? { action: 'return', note } : { action: 'register', note: note || undefined }));
    if (mode === 'signed_back') return run(() => klyr.pro.offerResult(o.id, { result: 'signed_back', price, irrevocableAt: fromTorontoInput(until).toISOString(), note: note || undefined }));
    if (mode) return run(() => klyr.pro.offerResult(o.id, { result: mode, note: note || undefined }));
  };

  const t = o.terms;
  const conds = [t.financingDays && `financing ${t.financingDays} days`, t.inspectionDays && `inspection ${t.inspectionDays} days`, t.statusCertificateDays && `status certificate ${t.statusCertificateDays} days`].filter(Boolean);
  const diff = o.price - o.askingPrice;
  const dep = o.depositStatus;
  return (
    <article className="k-card" aria-label={`Offer on ${o.address} from ${o.clientName ?? o.clientEmail}`}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
        <strong style={{ fontSize: 20 }}>{money(o.price)}</strong>
        <span className="k-note">{diff === 0 ? 'at asking' : `${diff > 0 ? '+' : '−'}${money(Math.abs(diff))} vs asking ${money(o.askingPrice)}`}</span>
        <span className="k-note" style={{ marginLeft: 'auto' }}>Form {o.form}</span>
      </div>
      <div><strong>{o.address}, {o.city}</strong><div className="k-note">Listed by {o.listingBrokerage} · client {o.clientName ?? o.clientEmail}</div></div>
      <div style={{ fontSize: 14 }}>
        Deposit {money(o.deposit)} · {conds.length ? conds.join(', ') : 'no conditions (firm)'} · closing {longDate(t.closingDate)} · open until {when(o.irrevocableAt)}
      </div>
      {t.inclusions && <div className="k-note">Included: {t.inclusions}{t.exclusions ? ` · Excluded: ${t.exclusions}` : ''}</div>}
      {t.noteToAgent && <div className="k-note" style={{ color: 'var(--text)' }}>Client: “{t.noteToAgent}”</div>}
      {o.agentNote && <div className="k-note">You: “{o.agentNote}”</div>}
      {o.signBack && <div className="p-fence">Seller signed back at {money(o.signBack.price)}, open until {when(o.signBack.irrevocableAt)} · {o.signBack.status === 'signed_back' ? 'waiting for your client' : o.signBack.status === 'accepted' ? 'your client accepted' : o.signBack.status === 'rejected' ? 'your client declined' : 'expired'}</div>}
      {dep && (
        <div className="p-fence" style={dep.receivedAt ? undefined : { background: '#FBEBDD', color: '#A54B00' }}>
          {dep.receivedAt ? `Deposit ${money(dep.amount)} received by ${dep.holder} · ${when(dep.receivedAt)}` : `Deposit ${money(dep.amount)} to ${dep.holder} due by ${when(dep.dueAt)}`}
        </div>
      )}

      {!mode && (
        <div className="p-row">
          {o.status === 'sent' && <>
            <button className="k-btn" onClick={() => setMode('register')}>Registered with listing brokerage</button>
            <button className="k-btn k-alt" onClick={() => setMode('return')}>Send back to client</button>
          </>}
          {o.status === 'registered' && <>
            <button className="k-btn" onClick={() => setMode('accepted')}>Seller accepted</button>
            <button className="k-btn k-alt" onClick={() => setMode('signed_back')}>Seller signed back</button>
            <button className="k-btn k-alt" onClick={() => setMode('rejected')}>Not accepted</button>
          </>}
          {dep && !dep.receivedAt && <button className="k-btn" disabled={busy} onClick={() => run(() => klyr.pro.depositReceived(o.dealId))}>Deposit receipt received</button>}
        </div>
      )}
      {mode && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {mode === 'register' && <span className="k-note">Confirm {o.listingBrokerage} received the offer and you have their Form 801 confirmation of registration.</span>}
          {mode === 'accepted' && <span className="k-note">Your client’s deposit falls due 24 hours from now and each condition’s deadline starts counting.</span>}
          {mode === 'signed_back' && <>
            <label className="k-field">Seller’s price
              <input inputMode="numeric" value={price.toLocaleString('en-CA')} onChange={e => setPrice(Number(e.target.value.replace(/\D/g, '')) || 0)} />
            </label>
            <label className="k-field">Open for your client until (Toronto)
              <input type="datetime-local" value={until} onChange={e => setUntil(e.target.value)} />
            </label>
          </>}
          <label className="k-field">{mode === 'return' ? 'What should your client change?' : 'Note for your client (optional)'}
            <input value={note} onChange={e => setNote(e.target.value)} maxLength={1000} />
          </label>
          {error && <div className="k-error" role="alert">{error}</div>}
          <div className="p-row">
            <button className="k-btn" disabled={busy || (mode === 'return' && note.trim().length < 3)} onClick={submit}>
              {{ register: 'Mark registered', return: 'Send back', accepted: 'Record acceptance', signed_back: 'Send sign-back to client', rejected: 'Record not accepted' }[mode]}
            </button>
            <button className="k-btn k-alt" disabled={busy} onClick={() => { setMode(null); setError(''); }}>Back</button>
          </div>
        </div>
      )}
      {!mode && error && <div className="k-error" role="alert">{error}</div>}
    </article>
  );
}
