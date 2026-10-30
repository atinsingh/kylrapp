'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Deal } from '@klyr/api-client';
import { money, torontoWhen } from '@klyr/core';
import { StepUp } from '@/components/step-up';
import { errorText, klyr } from '@/lib/client';

type R = { ok: boolean; status: number; error?: { code?: string; message?: unknown } };

/** Sign with a fresh check and the legal name; shared by Form 123 notices and the Form 122 release. */
function useSign(fn: (name: string) => Promise<R>) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [stepUp, setStepUp] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function sign() {
    setBusy(true); setError('');
    const r = await fn(name);
    setBusy(false);
    if (r.status === 403 && r.error?.code === 'step_up_required') return setStepUp(true);
    if (!r.ok) return setError(errorText(r.error));
    router.refresh();
  }
  return { name, setName, stepUp, setStepUp, busy, error, sign };
}

export function ConditionActions({ id, title, legalName }: { id: string; title: string; legalName: string }) {
  const [action, setAction] = useState<null | 'waive' | 'fulfil'>(null);
  const s = useSign(name => klyr.conditionNotice(id, action!, name));
  if (s.stepUp) return <StepUp reason="Waiving a condition is a signature and needs a fresh check." onCancel={() => s.setStepUp(false)} onDone={() => { s.setStepUp(false); void s.sign(); }} />;
  if (!action) return (
    <div style={{ display: 'flex', gap: 8 }}>
      <button className="k-btn" style={{ width: 'auto', padding: '0 16px', minHeight: 44 }} onClick={() => setAction('fulfil')} aria-label={`${title}: it's fulfilled`}>It’s fulfilled</button>
      <button className="k-btn k-alt" style={{ width: 'auto', padding: '0 16px', minHeight: 44 }} onClick={() => setAction('waive')} aria-label={`Waive ${title}`}>Waive it</button>
    </div>
  );
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, background: 'var(--bg)', borderRadius: 12, padding: 12 }}>
      <strong style={{ fontSize: 14 }}>{action === 'waive' ? `Waive the ${title.toLowerCase()} condition` : `Confirm the ${title.toLowerCase()} condition is fulfilled`} · Form 123</strong>
      <span className="k-note">{action === 'waive' ? 'You give up the right to end the deal over this condition.' : 'You confirm the condition is met.'} Once your agent delivers it, you can’t take it back.</span>
      <label className="k-field">Type your full name to sign ({legalName})
        <input value={s.name} onChange={e => s.setName(e.target.value)} autoComplete="name" />
      </label>
      {s.error && <div className="k-error" role="alert">{s.error}</div>}
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="k-btn" disabled={s.busy || s.name.trim().length < 2} onClick={s.sign}>Sign</button>
        <button className="k-btn k-alt" disabled={s.busy} onClick={() => setAction(null)}>Back</button>
      </div>
    </div>
  );
}

export function ReleaseCard({ deal: d, legalName, agent }: { deal: Deal; legalName: string; agent: string }) {
  const s = useSign(name => klyr.signRelease(name));
  if (d.release) return (
    <section className="k-card" aria-label="Mutual release">
      <div className="k-label">MUTUAL RELEASE · FORM 122</div>
      <span style={{ fontSize: 14 }}>✓ You signed {torontoWhen(d.release.signedAt)}. {d.deposit?.returnedAt ? 'Your deposit is on its way back.' : `${agent} gets the seller’s signature, then your deposit comes back.`}</span>
    </section>
  );
  if (s.stepUp) return <StepUp reason="Signing the release needs a fresh check." onCancel={() => s.setStepUp(false)} onDone={() => { s.setStepUp(false); void s.sign(); }} />;
  return (
    <section className="k-card" aria-label="Mutual release" style={{ boxShadow: '0 0 0 2px var(--brand) inset' }}>
      <div className="k-label">NEXT · MUTUAL RELEASE · FORM 122</div>
      <strong>Sign the release to get your deposit back</strong>
      <span style={{ fontSize: 14 }}>You and the seller release each other from the agreement{d.deposit ? `, and ${d.deposit.holder} returns your ${money(d.deposit.amount)} deposit in full` : ''}. Neither brokerage claims commission.</span>
      <label className="k-field">Type your full name to sign ({legalName})
        <input value={s.name} onChange={e => s.setName(e.target.value)} autoComplete="name" />
      </label>
      {s.error && <div className="k-error" role="alert">{s.error}</div>}
      <button className="k-btn" disabled={s.busy || s.name.trim().length < 2} onClick={s.sign}>Sign the release</button>
    </section>
  );
}
