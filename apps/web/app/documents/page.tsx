import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { Me } from '@klyr/contracts';
import type { DocumentSummary } from '@klyr/api-client';
import { AppHeader } from '@/components/app-header';
import { api, sessionToken } from '@/lib/session';

export const metadata = { title: 'Documents · Klyr' };

export default async function DocumentsPage() {
  if (!(await sessionToken())) redirect('/welcome');
  const [me, res] = await Promise.all([api<Me>('/auth/me'), api<DocumentSummary[]>('/documents')]);
  if (me.status === 401) redirect('/welcome');
  const docs = res.data ?? [];
  return (
    <main style={{ maxWidth: 960, margin: '0 auto', padding: '24px 16px 48px' }}>
      <AppHeader me={me.data} current="documents" />
      <div style={{ maxWidth: 600, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <h1 className="k-h1" style={{ fontSize: 28 }}>Documents</h1>
        {!docs.length ? (
          <section className="k-card"><strong>Nothing signed yet</strong><span className="k-note">Your buyer agreement and offers appear here once signed.</span></section>
        ) : (
          <section className="k-card">
            {docs.map((d, i) => (
              <Link key={d.id} href={`/documents/${d.id}`} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '10px 0', borderTop: i ? '.5px solid var(--sep)' : 0, color: 'var(--text)', textDecoration: 'none' }}>
                <span><strong>{d.title}</strong><span className="k-note" style={{ display: 'block' }}>Signed {new Date(d.createdAt).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })}</span></span>
                <span style={{ color: 'var(--brand)', fontWeight: 700 }}>View ›</span>
              </Link>
            ))}
          </section>
        )}
      </div>
    </main>
  );
}
