import { redirect } from 'next/navigation';
import type { Me } from '@klyr/contracts';
import type { Provider, QuoteRequest } from '@klyr/api-client';
import { AppHeader } from '@/components/app-header';
import { api, sessionToken } from '@/lib/session';
import { QuotesBoard } from './quotes-board';

export const metadata = { title: 'Quotes · Klyr' };

/** The provider marketplace: ask, compare on what you pay, see what Klyr earns, then choose. */
export default async function QuotesPage() {
  if (!(await sessionToken())) redirect('/welcome');
  const [me, mine, ...dirs] = await Promise.all([
    api<Me>('/auth/me'), api<QuoteRequest[]>('/quotes'),
    ...(['lender', 'lawyer', 'inspector', 'insurer'] as const).map(k => api<Provider[]>(`/providers?kind=${k}`)),
  ]);
  if (me.status === 401) redirect('/welcome');
  return (
    <main style={{ maxWidth: 960, margin: '0 auto', padding: '24px 16px 48px' }}>
      <AppHeader me={me.data} current="quotes" />
      <div style={{ maxWidth: 720, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div>
          <h1 className="k-h1" style={{ fontSize: 26 }}>Quotes</h1>
          <p className="k-sub" style={{ marginTop: 6 }}>Ask up to four providers. Quotes are ranked only by what you pay, and every quote shows what Klyr earns if you choose it.</p>
        </div>
        <QuotesBoard requests={mine.data ?? []} providers={dirs.flatMap(d => (d.data ?? []) as Provider[])} />
      </div>
    </main>
  );
}
