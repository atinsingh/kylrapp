'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { errorText, klyr } from '@/lib/client';

const ROLES: [string, string][] = [['agent', 'Agent'], ['compliance_officer', 'Compliance officer'], ['privacy_officer', 'Privacy officer'], ['ops', 'Operations'], ['admin', 'Admin'], ['broker_of_record', 'Broker of record']];

export function RoleForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('agent');
  const [name, setName] = useState('');
  const [title, setTitle] = useState<'Salesperson' | 'Broker'>('Salesperson');
  const [reco, setReco] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function run(action: 'grant' | 'revoke') {
    setBusy(true); setError('');
    const r = await klyr.admin.changeRole({ email, role, action, ...(action === 'grant' && role === 'agent' ? { registeredName: name.trim() || undefined, title, recoNumber: reco.trim() || undefined } : {}) });
    setBusy(false);
    if (!r.ok) return setError(errorText(r.error));
    setEmail(''); setName(''); setReco(''); router.refresh();
  }
  return (
    <section className="k-card" aria-label="Change a role">
      <div className="k-label">ADD OR REMOVE A ROLE</div>
      <label className="k-field">Their account email<input type="email" value={email} onChange={e => setEmail(e.target.value)} /></label>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }} role="group" aria-label="Role">
        {ROLES.map(([k, l]) => <button key={k} className="k-chip" aria-pressed={role === k} onClick={() => setRole(k)}>{l}</button>)}
      </div>
      {role === 'agent' && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <label className="k-field" style={{ flex: 2, minWidth: 180 }}>RECO-registered name<input value={name} onChange={e => setName(e.target.value)} /></label>
          <label className="k-field" style={{ flex: 1, minWidth: 140 }}>RECO number<input value={reco} onChange={e => setReco(e.target.value)} /></label>
          <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end' }}>{(['Salesperson', 'Broker'] as const).map(t => <button key={t} className="k-chip" aria-pressed={title === t} onClick={() => setTitle(t)}>{t}</button>)}</div>
        </div>
      )}
      {error && <div className="k-error" role="alert">{error}</div>}
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="k-btn" style={{ width: 'auto', padding: '0 16px' }} disabled={busy || !email.includes('@')} onClick={() => run('grant')}>Add role</button>
        <button className="k-btn k-alt" style={{ width: 'auto', padding: '0 16px' }} disabled={busy || !email.includes('@')} onClick={() => run('revoke')}>Remove role</button>
      </div>
    </section>
  );
}
