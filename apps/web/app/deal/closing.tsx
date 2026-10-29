'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Deal, DealTaskInput, DealTaskKey } from '@klyr/api-client';
import { torontoWhen } from '@klyr/core';
import { errorText, klyr } from '@/lib/client';

const STEPS: Record<DealTaskKey, [string, string]> = {
  lawyer: ['Choose your lawyer', 'They search title, hold the funds and register the home in your name.'],
  mortgage: ['Mortgage instructions', 'Your lender sends instructions to your lawyer once it has the agreement.'],
  insurance: ['Home insurance binder', 'Your lender needs proof of coverage about 10 days before closing.'],
  adjustments: ['Review the statement of adjustments', 'Your lawyer sends it about 5 days before closing, with the amount to bring.'],
  walkthrough: ['Final walk-through', 'Your agent books it for the day before closing.'],
};
const FIELDS: Partial<Record<DealTaskKey, [string, string][]>> = {
  lawyer: [['name', 'Lawyer’s name'], ['firm', 'Firm'], ['email', 'Email'], ['phone', 'Phone (optional)']],
  mortgage: [['lender', 'Lender']],
  insurance: [['insurer', 'Insurer'], ['policy', 'Policy number (optional)']],
};
const done = (k: DealTaskKey, d: Record<string, string>) =>
  k === 'lawyer' ? `${d.name}, ${d.firm}` : k === 'mortgage' ? d.lender : k === 'insurance' ? d.insurer : k === 'walkthrough' ? (d.note ?? 'Done') : 'Reviewed';

/** Steps from a firm deal to keys. The buyer does all but the walk-through. */
export function ClosingChecklist({ deal: d, agent }: { deal: Deal; agent: string }) {
  const router = useRouter();
  const [open, setOpen] = useState<DealTaskKey | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const finished = d.tasks.filter(t => t.doneAt).length;

  async function save(key: DealTaskKey) {
    setBusy(true); setError('');
    const clean = Object.fromEntries(Object.entries(form).filter(([, v]) => v.trim()));
    const r = await klyr.dealTask({ key, ...clean } as DealTaskInput);
    setBusy(false);
    if (!r.ok) return setError(errorText(r.error));
    setOpen(null); setForm({});
    router.refresh();
  }

  return (
    <section className="k-card" aria-label="Closing checklist">
      <div className="k-label">CLOSING · {finished} OF {d.tasks.length} DONE</div>
      {d.tasks.map((t, i) => {
        const [title, sub] = STEPS[t.key];
        return (
          <div key={t.key} style={{ display: 'flex', gap: 10, padding: '8px 0', borderTop: i ? '.5px solid var(--sep)' : 0 }} aria-label={title}>
            <span className="k-dot" aria-hidden style={t.doneAt ? { background: 'var(--money)', borderColor: 'var(--money)' } : undefined}>{t.doneAt ? '✓' : ''}</span>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div><strong>{title}</strong>{t.doneAt && <span className="k-note"> · {done(t.key, t.details)} · {torontoWhen(t.doneAt)}</span>}<div className="k-note">{t.key === 'walkthrough' ? `${agent} books it for the day before closing.` : sub}</div></div>
              {!t.doneAt && t.key !== 'walkthrough' && open !== t.key && (
                <button className="k-btn k-alt" style={{ width: 'auto', minHeight: 40, padding: '0 14px', alignSelf: 'flex-start' }} onClick={() => { setOpen(t.key); setForm({}); setError(''); }}>
                  {t.key === 'adjustments' ? 'I’ve reviewed it' : 'Add details'}
                </button>
              )}
              {open === t.key && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {(FIELDS[t.key] ?? []).map(([f, label]) => (
                    <label key={f} className="k-field">{label}<input value={form[f] ?? ''} onChange={e => setForm(x => ({ ...x, [f]: e.target.value }))} type={f === 'email' ? 'email' : 'text'} /></label>
                  ))}
                  {error && <div className="k-error" role="alert">{error}</div>}
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="k-btn" disabled={busy} onClick={() => save(t.key)}>{t.key === 'adjustments' ? 'Confirm' : 'Save'}</button>
                    <button className="k-btn k-alt" disabled={busy} onClick={() => setOpen(null)}>Back</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </section>
  );
}
