import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { StaffMember } from '@klyr/api-client';
import { torontoWhen } from '@klyr/core';
import { api, sessionToken } from '@klyr/web-kit/session';
import { RoleForm } from './role-form';

export const metadata = { title: 'Users and roles · Klyr Admin' };
const ROLE: Record<string, string> = { agent: 'Agent', broker_of_record: 'Broker of record', compliance_officer: 'Compliance officer', privacy_officer: 'Privacy officer', ops: 'Operations', admin: 'Admin' };

export default async function UsersPage() {
  if (!(await sessionToken())) redirect('/signin');
  const [staff, audit] = await Promise.all([api<StaffMember[]>('/admin/users'), api<{ id: number; action: string; entity: string; entityId: string | null; actor: string | null; at: string }[]>('/admin/users/audit')]);
  if (!staff.data) redirect('/signin');
  return (
    <main className="a-wrap">
      <Link href="/" className="k-note">‹ Klyr Admin</Link>
      <h1 className="k-h1">Users and roles</h1>
      <p className="k-sub">Staff see clients’ personal information, so every role needs a second factor at sign-in. The brokerage always keeps a broker of record, and an agent with open deals is reassigned before the role is removed.</p>
      <section className="k-card" aria-label="Staff">
        <div className="k-label">STAFF · {staff.data.length}</div>
        {staff.data.map(s => (
          <div key={s.id} style={{ padding: '8px 0', borderTop: '.5px solid var(--sep)' }} aria-label={`Staff ${s.email}`}>
            <strong>{s.name ?? s.email}</strong> <span className="k-note">· {s.email}</span>
            <div className="k-note">
              {s.roles.map(r => ROLE[r] ?? r).join(', ')}
              {s.agent ? ` · ${s.agent.title}, RECO ${s.agent.recoNumber} · ${s.agent.openDeals} open deal(s)` : ''}
              {' · '}{s.mfa.authenticator || s.mfa.passkeys ? `second factor: ${[s.mfa.authenticator && 'authenticator', s.mfa.passkeys && `${s.mfa.passkeys} passkey(s)`].filter(Boolean).join(', ')}` : 'second factor set up at first sign-in'}
              {s.lastSeenAt ? ` · last seen ${torontoWhen(s.lastSeenAt)}` : ' · never signed in'}
            </div>
          </div>
        ))}
      </section>
      <RoleForm />
      <section className="k-card" aria-label="Audit log">
        <div className="k-label">AUDIT LOG · LATEST 200</div>
        {(audit.data ?? []).slice(0, 40).map(a => <div key={a.id} className="k-note" style={{ padding: '3px 0' }}>{torontoWhen(a.at)} · <strong style={{ color: 'var(--text)' }}>{a.action}</strong> · {a.entity}{a.actor ? ` · ${a.actor}` : ''}</div>)}
      </section>
    </main>
  );
}
