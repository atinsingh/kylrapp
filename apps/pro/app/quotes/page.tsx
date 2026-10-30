import type { QuoteRequest } from '@klyr/api-client';
import { ProHeader } from '@/components/pro-header';
import { api, requireAgent } from '@/lib/session';
import { QuoteBuilder } from './quote-builder';

export const metadata = { title: 'Quotes · Klyr Pro' };

export default async function QuotesPage() {
  const me = await requireAgent();
  const list = (await api<(QuoteRequest & { clientName: string | null; clientEmail: string })[]>('/pro/quotes')).data ?? [];
  const open = list.filter(r => r.status === 'open'), done = list.filter(r => r.status !== 'open');
  return (
    <main className="p-wrap">
      <ProHeader me={me} current="quotes" />
      <h1 className="k-h1">Quotes</h1>
      <p className="k-sub">
        Your clients asked these providers for quotes. Enter each quote from the provider’s own system. Klyr ranks them only by what the client pays,
        and shows any referral fee to the client before they choose. Lawyers can’t pay referral fees.
      </p>
      {!list.length && <section className="k-card"><strong>No quote requests</strong><span className="k-note">Requests from your clients show up here.</span></section>}
      {[['WAITING FOR QUOTES', open], ['CHOSEN OR CANCELLED', done]].map(([label, rs]) => (rs as typeof list).length > 0 && (
        <section key={label as string} aria-label={(label as string).toLowerCase()} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div className="k-label">{label as string} · {(rs as typeof list).length}</div>
          {(rs as typeof list).map(r => <QuoteBuilder key={r.id} r={r} />)}
        </section>
      ))}
    </main>
  );
}
