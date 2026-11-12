'use client';

import { useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import type { IdCheckAnswers } from '@klyr/api-client';
import { errorText, klyr } from '@/lib/client';

const SOURCES: [IdCheckAnswers['sourceOfFunds'][number], string][] = [
  ['savings', 'Savings'], ['employment', 'Employment income'], ['sale_of_property', 'Sale of a property'],
  ['gift', 'Gift from family'], ['investments', 'Investments'], ['other', 'Other'],
];

export function IdCheckForm({ next }: { next: string }) {
  const router = useRouter();
  const [scanned, setScanned] = useState(false);
  const [a, setA] = useState<Omit<IdCheckAnswers, 'vendorRef'>>({ occupation: '', sourceOfFunds: [], actingForThirdParty: false, politicallyExposed: false, buyingAs: 'self' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const toggleSource = (s: IdCheckAnswers['sourceOfFunds'][number]) =>
    setA({ ...a, sourceOfFunds: a.sourceOfFunds.includes(s) ? a.sourceOfFunds.filter(x => x !== s) : [...a.sourceOfFunds, s] });

  async function submit() {
    setBusy(true); setError('');
    const r = await klyr.submitIdCheck({ ...a, vendorRef: 'sandbox' });
    setBusy(false);
    if (!r.ok) return setError(errorText(r.error));
    if (r.data.status === 'verified') { router.replace(next); router.refresh(); } else router.refresh();
  }

  return (
    <>
      <Step n={1} title="Photo ID" done={scanned}>
        <p className="k-note" style={{ margin: 0 }}>Driver’s licence or passport, plus a selfie. Handled by our ID verification partner.</p>
        <div className="k-note" style={{ background: 'var(--warn-tint)', color: 'var(--warn)', borderRadius: 10, padding: '8px 10px' }}>
          Test mode: the ID partner isn’t connected yet, so this step is simulated and no document is checked.
        </div>
        {!scanned && <button className="k-btn k-alt" onClick={() => setScanned(true)}>Scan my ID (test)</button>}
      </Step>
      <Step n={2} title="About you">
        <label className="k-field">Occupation<input value={a.occupation} onChange={e => setA({ ...a, occupation: e.target.value })} autoComplete="organization-title" /></label>
      </Step>
      <Step n={3} title="Source of funds" note="Where will your deposit and down payment come from?">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {SOURCES.map(([k, l]) => <button key={k} className="k-chip" aria-pressed={a.sourceOfFunds.includes(k)} onClick={() => toggleSource(k)}>{l}</button>)}
        </div>
      </Step>
      <Step n={4} title="Third party" note="Are you acting for someone else? For example, buying for a relative or using someone else’s money.">
        <YesNo value={a.actingForThirdParty} set={v => setA({ ...a, actingForThirdParty: v })} />
        {a.actingForThirdParty && <p className="k-note" style={{ margin: 0 }}>Your agent will ask for their name, address, date of birth, occupation and your relationship.</p>}
      </Step>
      <Step n={5} title="Politically exposed person" note="Have you, a family member or a close associate held senior public office or led an international organization?">
        <YesNo value={a.politicallyExposed} set={v => setA({ ...a, politicallyExposed: v })} />
        {a.politicallyExposed && <p className="k-note" style={{ margin: 0 }}>A few more questions follow, and a senior Klyr officer approves the file.</p>}
      </Step>
      <Step n={6} title="Buying as">
        <div style={{ display: 'flex', gap: 6 }}>
          <button className="k-chip" style={{ flex: 1 }} aria-pressed={a.buyingAs === 'self'} onClick={() => setA({ ...a, buyingAs: 'self' })}>Myself</button>
          <button className="k-chip" style={{ flex: 1 }} aria-pressed={a.buyingAs === 'company'} onClick={() => setA({ ...a, buyingAs: 'company' })}>A company or trust</button>
        </div>
        {a.buyingAs === 'company' && <p className="k-note" style={{ margin: 0 }}>Your agent will collect everyone who owns or controls 25% or more, and the articles of incorporation or trust deed.</p>}
      </Step>
      <p className="k-note" style={{ margin: 0 }}>● Rule · FINTRAC. Klyr Realty Inc., Brokerage keeps this record for 5 years and uses it only to meet FINTRAC requirements.</p>
      {error && <div className="k-error" role="alert">{error}</div>}
      <button className="k-btn" disabled={busy || !scanned || a.occupation.trim().length < 2 || !a.sourceOfFunds.length} onClick={submit}>Submit</button>
    </>
  );
}

function Step({ n, title, note, done, children }: { n: number; title: string; note?: string; done?: boolean; children: ReactNode }) {
  return (
    <section className="k-card" aria-label={title}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span className="k-dot" aria-hidden style={done ? { background: 'var(--money)', borderColor: 'var(--money)' } : undefined}>{done ? '✓' : n}</span>
        <strong>{title}</strong>
      </div>
      {note && <p className="k-note" style={{ margin: 0 }}>{note}</p>}
      {children}
    </section>
  );
}

function YesNo({ value, set }: { value: boolean; set: (v: boolean) => void }) {
  return (
    <div style={{ display: 'flex', gap: 6 }}>
      <button className="k-chip" style={{ flex: 1 }} aria-pressed={!value} onClick={() => set(false)}>No</button>
      <button className="k-chip" style={{ flex: 1 }} aria-pressed={value} onClick={() => set(true)}>Yes</button>
    </div>
  );
}
