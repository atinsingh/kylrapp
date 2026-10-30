'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { errorText, klyr } from '@/lib/client';

/** Link a person to a provider firm so they can send quotes from the partner portal, or remove them. */
export function PartnerForm({ providers }: { providers: { id: string; name: string }[] }) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [orgId, setOrgId] = useState(providers[0]?.id ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function run(action: 'grant' | 'revoke') {
    setBusy(true); setError('');
    const r = await klyr.admin.changePartner(email, orgId, action);
    setBusy(false);
    if (!r.ok) return setError(errorText(r.error));
    setEmail(''); router.refresh();
  }
  return (
    <section className="k-card" aria-label="Partner portal access">
      <div className="k-label">PARTNER PORTAL ACCESS</div>
      <span className="k-note">The person signs up first, then you link them to their firm. They sign in at Klyr Pro → /partner with an emailed code and an authenticator app.</span>
      <label className="k-field">Their account email<input type="email" value={email} onChange={e => setEmail(e.target.value)} /></label>
      <label className="k-field">Firm<select value={orgId} onChange={e => setOrgId(e.target.value)} style={{ height: 50, borderRadius: 12, border: 0, boxShadow: '0 0 0 .5px var(--sep)', padding: '0 12px', fontSize: 15 }}>
        {providers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select></label>
      {error && <div className="k-error" role="alert">{error}</div>}
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="k-btn" style={{ width: 'auto', padding: '0 16px' }} disabled={busy || !email.includes('@')} onClick={() => run('grant')}>Link to firm</button>
        <button className="k-btn k-alt" style={{ width: 'auto', padding: '0 16px' }} disabled={busy || !email.includes('@')} onClick={() => run('revoke')}>Remove</button>
      </div>
    </section>
  );
}
