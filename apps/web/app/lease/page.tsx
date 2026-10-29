import { redirect } from 'next/navigation';
import type { Me } from '@klyr/contracts';
import type { Leasing } from '@klyr/api-client';
import { AppHeader } from '@/components/app-header';
import { api, sessionToken } from '@/lib/session';
import { LeaseFlow } from './lease-flow';

export const metadata = { title: 'Lease out your home · Klyr' };

/** Leasing out: first-year rent after fees, Form 210, then applicants compared on the same terms. */
export default async function LeasePage() {
  if (!(await sessionToken())) redirect('/welcome');
  const [me, l] = await Promise.all([api<Me>('/auth/me'), api<Leasing>('/leasing')]);
  if (me.status === 401) redirect('/welcome');
  return (
    <main style={{ maxWidth: 960, margin: '0 auto', padding: '24px 16px 48px' }}>
      <AppHeader me={me.data} current="lease" />
      <div style={{ maxWidth: 720, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <LeaseFlow leasing={l.data ?? null} legalName={me.data?.legalName ?? ''} />
      </div>
    </main>
  );
}
