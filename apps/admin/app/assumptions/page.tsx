import { redirect } from 'next/navigation';
import { AdminNav } from '@/components/admin-nav';
import type { AssumptionsAdmin } from '@klyr/api-client';
import { money, torontoWhen } from '@klyr/core';
import { api, sessionToken } from '@klyr/web-kit/session';
import { PublishForm } from './publish-form';

export const metadata = { title: 'Assumptions · Klyr Admin' };
const pct = (n: number) => `${(n * 100).toFixed(2)}%`;

/** The estimate defaults every client starts from, versioned with who changed them and why. */
export default async function AssumptionsPage() {
  if (!(await sessionToken())) redirect('/signin');
  const res = await api<AssumptionsAdmin>('/admin/assumptions');
  if (!res.data) redirect('/signin');
  const { current: c, history } = res.data;
  return (
    <main className="a-wrap">
      <AdminNav current="assumptions" />
      <h1 className="k-h1">Content and assumptions</h1>
      <p className="k-sub">The defaults behind every all-in estimate. A client who changes their own inputs keeps theirs. Review at least every 90 days so the “as of” date stays honest.</p>
      <section className="k-card" aria-label="In force" style={c.overdue ? { boxShadow: '0 0 0 2px var(--accent)' } : undefined}>
        <div className="k-label">IN FORCE · AS OF {c.asOf}{c.overdue ? ' · REVIEW OVERDUE' : ` · REVIEW BY ${c.reviewBy}`}</div>
        <div><strong>Rate {pct(c.rate)}</strong> · down payment {pct(c.downPct)} · lawyer’s fee {money(c.lawyerFee)} before HST</div>
        <span className="k-note">{c.note}</span>
      </section>
      <PublishForm current={{ rate: c.rate, downPct: c.downPct, lawyerFee: c.lawyerFee }} />
      <section className="k-card" aria-label="History">
        <div className="k-label">HISTORY</div>
        {history.length === 0 && <span className="k-note">Nothing published yet: the shipped defaults apply.</span>}
        {history.map(h => <div key={h.id} style={{ padding: '6px 0', borderTop: '.5px solid var(--sep)' }}><strong>{pct(h.value.rate)} · {pct(h.value.downPct)} · {money(h.value.lawyerFee)}</strong> <span className="k-note">· {h.by} · {torontoWhen(h.at)} · “{h.note}”</span></div>)}
      </section>
    </main>
  );
}
