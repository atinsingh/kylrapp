'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { errorText, klyr } from '@/lib/client';

/** Move every open deal from one agent to another, so an agent who is leaving can be removed. */
export function ReassignForm({ agents }: { agents: { email: string; name: string | null; openDeals: number }[] }) {
  const router = useRouter();
  const [from, setFrom] = useState(agents.find(a => a.openDeals)?.email ?? '');
  const [to, setTo] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');
  async function run() {
    setBusy(true); setError(''); setDone('');
    const r = await klyr.admin.reassignDeals(from, to);
    setBusy(false);
    if (!r.ok) return setError(errorText(r.error));
    setDone(`Moved ${r.data.moved} open deal(s). Each client was told who their agent is now.`);
    router.refresh();
  }
  const label = (a: { email: string; name: string | null; openDeals: number }) => `${a.name ?? a.email} · ${a.openDeals} open`;
  return (
    <section className="k-card" aria-label="Reassign open deals">
      <div className="k-label">Reassign open deals</div>
      <span className="k-note">Before removing an agent, move their open deals to another agent. Clients get an email and a notification with their new agent’s name.</span>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <label className="k-field" style={{ flex: 1, minWidth: 220 }}>From<select value={from} onChange={e => setFrom(e.target.value)}>{agents.map(a => <option key={a.email} value={a.email}>{label(a)}</option>)}</select></label>
        <label className="k-field" style={{ flex: 1, minWidth: 220 }}>To<select value={to} onChange={e => setTo(e.target.value)}><option value="">Choose an agent</option>{agents.filter(a => a.email !== from).map(a => <option key={a.email} value={a.email}>{label(a)}</option>)}</select></label>
      </div>
      {error && <div className="k-error" role="alert">{error}</div>}
      {done && <div className="k-note" role="status" style={{ color: 'var(--money)', fontWeight: 600 }}>{done}</div>}
      <button className="k-btn" style={{ width: 'auto', padding: '0 18px', alignSelf: 'flex-start' }} disabled={busy || !from || !to} onClick={run}>Reassign</button>
    </section>
  );
}
