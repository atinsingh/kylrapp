'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { StepUp } from '@/components/step-up';
import { errorText, klyr } from '@/lib/client';

export function SignForm({ legalName, next }: { legalName: string; next: string }) {
  const router = useRouter();
  const [read, setRead] = useState(false);
  const [name, setName] = useState('');
  const [stepUp, setStepUp] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function sign() {
    setBusy(true); setError('');
    const r = await klyr.signAgreement(name);
    setBusy(false);
    if (r.status === 403 && r.error?.code === 'step_up_required') return setStepUp(true);
    if (!r.ok) return setError(errorText(r.error));
    router.replace(`${next}${next.includes('?') ? '&' : '?'}signed=1`);
    router.refresh();
  }

  if (stepUp) {
    return <StepUp reason="Signing a legal agreement needs a fresh check." onCancel={() => setStepUp(false)} onDone={() => { setStepUp(false); void sign(); }} />;
  }
  return (
    <section className="k-card">
      <button className="k-check" role="checkbox" aria-checked={read} onClick={() => setRead(!read)}>
        <span className="k-dot" aria-hidden>{read ? '✓' : ''}</span><span>I’ve read this agreement</span>
      </button>
      <label className="k-field">Type your full name to sign ({legalName})
        <input value={name} onChange={e => setName(e.target.value)} autoComplete="name" />
      </label>
      {error && <div className="k-error" role="alert">{error}</div>}
      <button className="k-btn" disabled={busy || !read || name.trim().length < 2} onClick={sign}>Sign</button>
    </section>
  );
}
