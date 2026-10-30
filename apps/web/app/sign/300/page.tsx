import { redirect } from 'next/navigation';
import type { Me } from '@klyr/contracts';
import type { AgreementTerms, BuyingStatus } from '@klyr/api-client';
import { AppHeader } from '@/components/app-header';
import { api, sessionToken } from '@/lib/session';
import { SignForm } from './sign-form';

export const metadata = { title: 'Buyer agreement · Klyr' };

/** Only relative paths inside the app are allowed as the place to return to. */
const safeNext = (n?: string) => (n && /^\/[a-z0-9/_-]*$/i.test(n) ? n : '/visits');

export default async function SignPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  if (!(await sessionToken())) redirect('/welcome');
  const next = safeNext((await searchParams).next);
  const [me, terms, buying] = await Promise.all([api<Me>('/auth/me'), api<AgreementTerms>('/agreements/300'), api<BuyingStatus>('/buying')]);
  if (me.status === 401 || !terms.data) redirect('/welcome');
  if (buying.data?.agreement.signed) redirect(next);
  const t = terms.data;
  return (
    <main style={{ maxWidth: 960, margin: '0 auto', padding: '24px 16px 48px' }}>
      <AppHeader me={me.data} />
      <div style={{ maxWidth: 600, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div>
          <h1 className="k-h1" style={{ fontSize: 26 }}>{t.title}</h1>
          <p className="k-sub" style={{ marginTop: 6 }}>Between: {t.buyer} and {t.brokerage}. Plain-language summary of the terms you’re agreeing to.</p>
        </div>
        <section className="k-card">
          <dl style={{ margin: 0 }}>
            {t.clauses.map(([h, p], i) => (
              <div key={h} style={{ padding: '10px 0', borderTop: i ? '.5px solid var(--sep)' : 0 }}>
                <dt style={{ fontWeight: 700 }}>{h}</dt><dd style={{ margin: '4px 0 0', fontSize: 14 }}>{p}</dd>
              </div>
            ))}
          </dl>
        </section>
        <div className="k-note" style={{ fontWeight: 700, color: 'var(--brand)' }}>● Rule · RECO requires a written buyer agreement before any visit or offer.</div>
        <p className="k-note" style={{ margin: 0 }}>
          The full OREA form will be attached here once Klyr’s OREA forms licence is in place. Until then this summary is a draft for legal review and should not be relied on as the agreement.
        </p>
        <SignForm legalName={t.buyer} next={next} />
      </div>
    </main>
  );
}
