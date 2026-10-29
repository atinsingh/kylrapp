import type { ProDeal } from '@klyr/api-client';
import { ProHeader } from '@/components/pro-header';
import { api, requireAgent } from '@/lib/session';
import { DealCard } from './deal-card';

export const metadata = { title: 'Deals · Klyr Pro' };

export default async function DealsPage() {
  const me = await requireAgent();
  const deals = (await api<ProDeal[]>('/pro/deals')).data ?? [];
  const groups: [string, ProDeal[]][] = [
    ['CONDITIONAL', deals.filter(d => d.status === 'accepted' && d.stage === 'conditional')],
    ['FIRM · TO CLOSE', deals.filter(d => d.status === 'accepted' && d.stage === 'firm')],
    ['CLOSED', deals.filter(d => d.stage === 'closed')],
    ['ENDED · RELEASE AND DEPOSIT', deals.filter(d => d.status === 'void' && !d.deposit?.returnedAt)],
    ['CLOSED OUT', deals.filter(d => d.status === 'void' && !!d.deposit?.returnedAt)],
  ];
  return (
    <main className="p-wrap">
      <ProHeader me={me} current="deals" />
      <h1 className="k-h1">Deals</h1>
      <p className="k-note" style={{ margin: 0 }}>
        Accepted offers. Confirm the trust account by phone before your client sends the deposit, deliver each signed waiver or notice
        to the listing brokerage before its deadline, and record the deposit’s return if a deal ends.
      </p>
      {!deals.length && <section className="k-card"><strong>No deals yet</strong><span className="k-note">Accepted offers show up here.</span></section>}
      {groups.map(([label, list]) => list.length > 0 && (
        <section key={label} aria-label={label.toLowerCase()} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div className="k-label">{label} · {list.length}</div>
          {list.map(d => <DealCard key={d.dealId} d={d} />)}
        </section>
      ))}
    </main>
  );
}
