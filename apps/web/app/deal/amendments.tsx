'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Amendment, Deal } from '@klyr/api-client';
import { calendarDate, torontoInputValue, torontoWhen } from '@klyr/core';
import { StepUp } from '@/components/step-up';
import { errorText, klyr } from '@/lib/client';

const NAME = { financing: 'Financing', inspection: 'Inspection', status_certificate: 'Status certificate', sale_of_buyer_home: 'Sale of your home', other: 'Other' } as const;
const STATUS: Record<Amendment['status'], string> = { signed: 'Waiting for the seller', accepted: 'Agreed by the seller', rejected: 'Not agreed', withdrawn: 'Withdrawn' };

/** Plain words for one amendment's changes. */
export function describeChanges(a: Amendment) {
  return [
    ...(a.changes.closingDate ? [`Closing moves to ${calendarDate(a.changes.closingDate)}`] : []),
    ...(a.changes.extend ?? []).map(e => `${NAME[e.kind]} extended to ${torontoWhen(e.until)}`),
  ].join(' · ');
}

/** Form 120: propose a new closing date or later condition deadlines; the seller has to agree. */
export function Amendments({ deal: d, legalName, agent }: { deal: Deal; legalName: string; agent: string }) {
  const router = useRouter();
  const open = d.conditions.filter(c => !c.deliveredAt && !c.lapsedAt);
  const pending = d.amendments.find(a => a.status === 'signed');
  const [editing, setEditing] = useState(false);
  const [closing, setClosing] = useState(d.closingDate);
  const [extend, setExtend] = useState<Record<string, string>>({});
  const [name, setName] = useState('');
  const [stepUp, setStepUp] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function sign() {
    setBusy(true); setError('');
    const r = await klyr.proposeAmendment({
      closingDate: closing !== d.closingDate ? closing : undefined,
      extend: Object.entries(extend).filter(([, until]) => until).map(([conditionId, until]) => ({ conditionId, until })),
    }, name);
    setBusy(false);
    if (r.status === 403 && r.error?.code === 'step_up_required') return setStepUp(true);
    if (!r.ok) return setError(errorText(r.error));
    setEditing(false); setName(''); setExtend({});
    router.refresh();
  }
  async function withdraw(id: string) {
    setBusy(true); setError('');
    const r = await klyr.withdrawAmendment(id);
    setBusy(false);
    if (!r.ok) return setError(errorText(r.error));
    router.refresh();
  }

  if (stepUp) return <StepUp reason="Signing an amendment needs a fresh check." onCancel={() => setStepUp(false)} onDone={() => { setStepUp(false); void sign(); }} />;
  return (
    <section className="k-card" aria-label="Changes to the agreement">
      <div className="k-label">CHANGES TO THE AGREEMENT · FORM 120</div>
      {d.amendments.map(a => (
        <div key={a.id} style={{ fontSize: 14, display: 'flex', flexDirection: 'column', gap: 2, borderBottom: '.5px solid var(--sep)', paddingBottom: 8 }}>
          <span><strong>{describeChanges(a)}</strong></span>
          <span className="k-note">{STATUS[a.status]} · signed {torontoWhen(a.createdAt)}{a.agentNote ? ` · ${agent}: “${a.agentNote}”` : ''}</span>
          {a.status === 'signed' && <button className="k-btn k-alt" style={{ width: 'auto', minHeight: 40, alignSelf: 'flex-start', padding: '0 14px' }} disabled={busy} onClick={() => withdraw(a.id)}>Withdraw</button>}
        </div>
      ))}
      {!pending && !editing && (
        <>
          <span className="k-note">Need more time for a condition, or a different closing date? Propose a change; it takes effect only if the seller agrees.</span>
          <button className="k-btn k-alt" onClick={() => setEditing(true)}>Propose a change</button>
        </>
      )}
      {editing && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <label className="k-field">Closing date
            <input type="date" value={closing} onChange={e => setClosing(e.target.value)} />
          </label>
          {open.map(c => (
            <label key={c.id} className="k-field">{NAME[c.kind]}: now ends {torontoWhen(c.dueAt)}. New last day (optional)
              <input type="date" min={torontoInputValue(c.dueAt).slice(0, 10)} value={extend[c.id] ?? ''} onChange={e => setExtend(x => ({ ...x, [c.id]: e.target.value }))} />
            </label>
          ))}
          <label className="k-field">Type your full name to sign ({legalName})
            <input value={name} onChange={e => setName(e.target.value)} autoComplete="name" />
          </label>
          {error && <div className="k-error" role="alert">{error}</div>}
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="k-btn" disabled={busy || name.trim().length < 2} onClick={sign}>Sign and send to {agent}</button>
            <button className="k-btn k-alt" disabled={busy} onClick={() => { setEditing(false); setError(''); }}>Back</button>
          </div>
        </div>
      )}
      {!editing && error && <div className="k-error" role="alert">{error}</div>}
    </section>
  );
}
