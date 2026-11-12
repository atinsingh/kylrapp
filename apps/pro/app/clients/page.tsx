import Link from 'next/link';
import type { ProClient } from '@klyr/api-client';
import { phone } from '@klyr/web-kit/styles';
import { ProHeader } from '@/components/pro-header';
import { api, requireAgent } from '@/lib/session';
import { Progress } from './progress';

export const metadata = { title: 'Clients · Klyr Pro' };

export default async function ClientsPage() {
  const me = await requireAgent();
  const clients = (await api<ProClient[]>('/pro/clients')).data ?? [];
  return (
    <main className="p-wrap">
      <ProHeader me={me} current="clients" />
      <h1 className="k-h1">Clients</h1>
      {!clients.length && <section className="k-card"><strong>No clients yet</strong><span className="k-note">Buyers are assigned to you when they sign the Buyer Representation Agreement.</span></section>}
      {clients.map(c => (
        <Link key={c.dealId} href={`/clients/${c.userId}`} className="k-card" style={{ textDecoration: 'none', color: 'var(--text)' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <strong>{c.name ?? c.email}</strong>
            <span className="k-note" style={{ marginLeft: 'auto' }}>since {new Date(c.since).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })}</span>
          </div>
          <span className="k-note">{c.email}{c.phone ? ` · ${phone(c.phone)}` : ''}</span>
          <Progress p={c} />
        </Link>
      ))}
    </main>
  );
}
