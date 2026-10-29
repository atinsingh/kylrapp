import Link from 'next/link';
import { phone } from '@klyr/web-kit/styles';
import { notFound } from 'next/navigation';
import type { ProClientDetail } from '@klyr/api-client';
import { TORONTO } from '@klyr/core';
import { ProHeader } from '@/components/pro-header';
import { api, requireAgent } from '@/lib/session';
import { Progress } from '../progress';

export const metadata = { title: 'Client · Klyr Pro' };

const money = (n: number) => '$' + Math.round(n).toLocaleString('en-CA');
const date = (iso: string) => new Date(iso).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric', timeZone: TORONTO });
const when = (iso: string) => new Date(iso).toLocaleString('en-CA', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: TORONTO });

export default async function ClientPage({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireAgent();
  const { id } = await params;
  const c = (await api<ProClientDetail>(`/pro/clients/${encodeURIComponent(id)}`)).data;
  if (!c) notFound();
  return (
    <main className="p-wrap">
      <ProHeader me={me} current="clients" />
      <Link href="/clients" className="k-note">‹ Clients</Link>
      <h1 className="k-h1">{c.name ?? c.email}</h1>
      <p className="k-sub">{c.email}{c.phone && <> · <a href={`tel:${c.phone}`}>{phone(c.phone)}</a></>}</p>
      <Progress p={c} />
      {c.profile.map(plan => (
        <section key={plan.plan} className="k-card">
          <div className="k-label">PLAN · {String(plan.plan).toUpperCase()}</div>
          {Object.entries(plan.data).filter(([, v]) => v !== null && v !== '' && typeof v !== 'object').map(([k, v]) => (
            <span key={k} className="k-note">{k.replace(/([A-Z])/g, ' $1').toLowerCase()}: {String(v)}</span>
          ))}
        </section>
      ))}
      <section className="k-card">
        <div className="k-label">SAVED HOMES · {c.saved.length}</div>
        {c.saved.length ? c.saved.map(s => <span key={s.id}>{s.address}, {s.city} · {money(s.price)}</span>) : <span className="k-note">None yet</span>}
      </section>
      <section className="k-card">
        <div className="k-label">VISITS</div>
        {c.visits.length ? c.visits.map(v => <span key={v.id}>{when(v.at)} · {v.address} · <span className="k-note">{v.status}</span></span>) : <span className="k-note">None yet</span>}
      </section>
      <section className="k-card">
        <div className="k-label">DOCUMENTS</div>
        {c.documents.length ? c.documents.map(d => <span key={d.id}>{d.title} · <span className="k-note">{date(d.createdAt)}</span></span>) : <span className="k-note">None yet</span>}
      </section>
    </main>
  );
}
