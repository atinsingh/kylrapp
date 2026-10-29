import { redirect } from 'next/navigation';
import type { Me } from '@klyr/contracts';
import type { Assumptions } from '@klyr/api-client';
import { AppHeader } from '@/components/app-header';
import { api, sessionToken } from '@/lib/session';
import { EstimateForm } from './estimate-form';

export const metadata = { title: 'How we estimate · Klyr' };

export default async function EstimatePage() {
  if (!(await sessionToken())) redirect('/welcome');
  const [me, a] = await Promise.all([api<Me>('/auth/me'), api<Assumptions & { custom: boolean }>('/me/assumptions')]);
  if (me.status === 401 || !a.data) redirect('/welcome');
  return (
    <main style={{ maxWidth: 960, margin: '0 auto', padding: '24px 16px 48px' }}>
      <AppHeader me={me.data} current="estimate" />
      <div style={{ maxWidth: 560 }}>
        <h1 className="k-h1" style={{ fontSize: 28 }}>How we estimate</h1>
        <p className="k-sub" style={{ margin: '6px 0 16px' }}>Every all-in and net figure in Klyr uses these inputs. Change them here and every figure updates.</p>
        <EstimateForm initial={a.data} />
      </div>
    </main>
  );
}
