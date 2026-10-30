import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import type { Me } from '@klyr/contracts';
import type { KlyrClient } from '@klyr/api-client';
import { AppHeader } from '@/components/app-header';
import { api, sessionToken } from '@/lib/session';

type Doc = Awaited<ReturnType<KlyrClient['document']>>['data'];

export default async function DocumentPage({ params }: { params: Promise<{ id: string }> }) {
  if (!(await sessionToken())) redirect('/welcome');
  const { id } = await params;
  const [me, res] = await Promise.all([api<Me>('/auth/me'), api<Doc>(`/documents/${encodeURIComponent(id)}`)]);
  if (me.status === 401) redirect('/welcome');
  if (!res.data) notFound();
  const d = res.data, r = d.record;
  return (
    <main style={{ maxWidth: 960, margin: '0 auto', padding: '24px 16px 48px' }}>
      <AppHeader me={me.data} current="documents" />
      <Link href="/documents" style={{ fontSize: 13, fontWeight: 700 }}>‹ Documents</Link>
      <div style={{ maxWidth: 600, display: 'flex', flexDirection: 'column', gap: 12, marginTop: 12 }}>
        <h1 className="k-h1" style={{ fontSize: 26 }}>{d.title}</h1>
        <section className="k-card">
          <dl style={{ margin: 0 }}>
            {(r.clauses ?? []).map(([h, p], i) => (
              <div key={h} style={{ padding: '10px 0', borderTop: i ? '.5px solid var(--sep)' : 0 }}>
                <dt style={{ fontWeight: 700 }}>{h}</dt><dd style={{ margin: '4px 0 0', fontSize: 14 }}>{p}</dd>
              </div>
            ))}
          </dl>
        </section>
        {r.signer && (
          <section className="k-card">
            <div className="k-label">SIGNED</div>
            <div style={{ fontFamily: 'cursive', fontSize: 24 }}>{r.signer.typedName}</div>
            <div className="k-note">{new Date(r.signer.signedAt).toLocaleString('en-CA', { timeZone: 'America/Toronto' })}</div>
            <div className="k-note" style={{ wordBreak: 'break-all' }}>Fingerprint (SHA-256): {d.sha256}</div>
          </section>
        )}
      </div>
    </main>
  );
}
