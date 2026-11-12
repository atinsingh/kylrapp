import { redirect } from 'next/navigation';
import type { Me } from '@klyr/contracts';
import { AppHeader } from '@/components/app-header';
import { api, sessionToken } from '@/lib/session';
import { IdCheckForm } from './id-check-form';

export const metadata = { title: 'Verify your identity · Klyr' };

const safeNext = (n?: string) => (n && /^\/[a-z0-9/_-]*$/i.test(n) ? n : '/visits');

export default async function IdCheckPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  if (!(await sessionToken())) redirect('/welcome');
  const next = safeNext((await searchParams).next);
  const [me, status] = await Promise.all([api<Me>('/auth/me'), api<{ status: string }>('/id-check')]);
  if (me.status === 401) redirect('/welcome');
  if (status.data?.status === 'verified') redirect(next);
  return (
    <main style={{ maxWidth: 960, margin: '0 auto', padding: '24px 16px 48px' }}>
      <AppHeader me={me.data} />
      <div style={{ maxWidth: 600, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div>
          <h1 className="k-h1" style={{ fontSize: 26 }}>Verify your identity</h1>
          <p className="k-sub" style={{ marginTop: 6 }}>Required once by FINTRAC before your first visit, listing or offer. About 4 minutes.</p>
        </div>
        {status.data?.status === 'needs_review'
          ? <section className="k-card"><strong>With our compliance officer</strong><span className="k-note">Your answers need a quick review before your first visit. We’ll let you know, usually within one business day.</span></section>
          : <IdCheckForm next={next} />}
      </div>
    </main>
  );
}
