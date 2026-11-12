import { redirect } from 'next/navigation';
import { AdminNav } from '@/components/admin-nav';
import type { PrivacyRequest } from '@klyr/api-client';
import { torontoWhen } from '@klyr/core';
import { api, sessionToken } from '@klyr/web-kit/session';
import { PrivacyAction } from './privacy-action';

export const metadata = { title: 'Privacy requests · Klyr Admin' };
const KIND = { access: 'Copy of their information', correction: 'Correction', deletion: 'Delete account' } as const;

/** PIPEDA requests, answered within 30 days. Deletion keeps what the law requires. */
export default async function PrivacyPage() {
  if (!(await sessionToken())) redirect('/signin');
  const res = await api<(PrivacyRequest & { email: string; name: string | null; overdue: boolean })[]>('/admin/privacy');
  if (!res.data) redirect('/signin');
  const list = res.data;
  return (
    <main className="a-wrap">
      <AdminNav current="privacy" />
      <h1 className="k-h1">Privacy requests</h1>
      <p className="k-sub">Answer within 30 days (PIPEDA). Completing an access request lets the person download their copy. Completing a deletion closes the account and removes sign-in, contact and preference data; FINTRAC records (5 years), trade records (6 years) and the audit log stay.</p>
      {!list.length && <section className="k-card"><strong>No requests</strong></section>}
      {list.map(r => (
        <article key={r.id} className="k-card" aria-label={`${KIND[r.kind]} for ${r.email}`} style={r.overdue ? { boxShadow: '0 0 0 2px var(--accent)' } : undefined}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
            <strong>{KIND[r.kind]} · {r.name ?? r.email}</strong>
            <span className="k-note">{r.status === 'open' ? `due ${torontoWhen(r.dueAt)}${r.overdue ? ' · OVERDUE' : ''}` : `${r.status} ${torontoWhen(r.decidedAt!)}`}</span>
          </div>
          <span className="k-note">{r.email} · received {torontoWhen(r.createdAt)}{r.details ? ` · “${r.details}”` : ''}</span>
          {r.response && <span className="k-note">Answer: {r.response}</span>}
          {r.status === 'open' && <PrivacyAction id={r.id} kind={r.kind} />}
        </article>
      ))}
    </main>
  );
}
