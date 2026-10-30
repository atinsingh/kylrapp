import { redirect } from 'next/navigation';
import type { Me } from '@klyr/contracts';
import type { Assumptions } from '@klyr/api-client';
import { AppHeader } from '@/components/app-header';
import { api, sessionToken } from '@/lib/session';
import { AffordCalculator } from './afford-calculator';

export const metadata = { title: 'What you can afford · Klyr' };

export default async function AffordPage() {
  if (!(await sessionToken())) redirect('/welcome');
  const [me, a] = await Promise.all([api<Me>('/auth/me'), api<Assumptions>('/me/assumptions')]);
  if (me.status === 401 || !a.data) redirect('/welcome');
  return (
    <main style={{ maxWidth: 960, margin: '0 auto', padding: '24px 16px 48px' }}>
      <AppHeader me={me.data} current="afford" />
      <div style={{ maxWidth: 560 }}>
        <h1 className="k-h1" style={{ fontSize: 28 }}>What you can afford</h1>
        <p className="k-sub" style={{ margin: '6px 0 16px' }}>An estimate from your income and down payment, using the federal stress test. Your lender decides.</p>
        <AffordCalculator rate={a.data.rate} initialDownPct={a.data.downPct} />
      </div>
    </main>
  );
}
