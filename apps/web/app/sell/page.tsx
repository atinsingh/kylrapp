import { redirect } from 'next/navigation';
import type { Me } from '@klyr/contracts';
import type { BuyingStatus, Selling } from '@klyr/api-client';
import { AppHeader } from '@/components/app-header';
import { api, sessionToken } from '@/lib/session';
import { SellFlow } from './sell-flow';

export const metadata = { title: 'Sell your home · Klyr' };

/** Selling with Klyr: your net, your plan, the listing agreement, prep, then live. */
export default async function SellPage() {
  if (!(await sessionToken())) redirect('/welcome');
  const [me, s, buying] = await Promise.all([api<Me>('/auth/me'), api<Selling>('/selling'), api<BuyingStatus>('/buying')]);
  if (me.status === 401) redirect('/welcome');
  return (
    <main style={{ maxWidth: 960, margin: '0 auto', padding: '24px 16px 48px' }}>
      <AppHeader me={me.data} current="sell" />
      <div style={{ maxWidth: 640, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <SellFlow selling={s.data ?? null} legalName={me.data?.legalName ?? ''} idVerified={buying.data?.idCheck.status === 'verified'} />
      </div>
    </main>
  );
}
