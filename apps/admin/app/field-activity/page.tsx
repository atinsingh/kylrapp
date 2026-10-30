import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AdminNav } from '@/components/admin-nav';
import { describeFieldEvent, type FieldDay } from '@klyr/api-client';
import { TORONTO, torontoTime } from '@klyr/core';
import { api, sessionToken } from '@klyr/web-kit/session';

export const metadata = { title: 'Field activity · Klyr Admin' };

const time = (iso: string) => torontoTime(iso);
const ymd = (ms: number) => new Date(ms).toLocaleDateString('en-CA', { timeZone: TORONTO });
const PLATFORM: Record<string, string> = { ios: 'iPhone app', android: 'Android app', web: 'web preview (testing only)' };
const TONE = { ok: 'var(--money)', warn: 'var(--accent)', plain: 'var(--muted)' } as const;

/** Broker of record: each agent's showings for a day — decisions, GPS check-ins, completions and refused attempts. */
export default async function FieldActivityPage({ searchParams }: { searchParams: Promise<{ day?: string }> }) {
  if (!(await sessionToken())) redirect('/signin');
  const { day } = await searchParams;
  const res = await api<{ day: string; agents: FieldDay[] }>(`/admin/field-activity${day ? `?day=${encodeURIComponent(day)}` : ''}`);
  if (!res.data) redirect('/signin');
  const { agents } = res.data;
  const days = [0, 1, 2, 3, 4, 5, 6].map(i => ymd(Date.now() - i * 86_400_000));
  const totals = agents.reduce((t, a) => ({ done: t.done + a.summary.visitsCompleted, refused: t.refused + a.summary.refused }), { done: 0, refused: 0 });

  return (
    <main className="a-wrap">
      <AdminNav current="field-activity" />
      <h1 className="k-h1">Field activity</h1>
      <p className="k-sub">
        Showings by agent, from the Klyr Pro phone app. Check-ins and completions are accepted only at the home (GPS, within 150 m);
        refused attempts are listed in red. {totals.done} visit{totals.done === 1 ? '' : 's'} completed, {totals.refused} refused attempt{totals.refused === 1 ? '' : 's'}.
      </p>
      <nav style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }} aria-label="Day">
        {days.map((d, i) => (
          <Link key={d} href={`/field-activity?day=${d}`} className="k-chip" aria-current={d === res.data!.day ? 'page' : undefined}
            style={{ display: 'grid', placeItems: 'center', textDecoration: 'none', ...(d === res.data!.day ? { background: 'var(--brand)', color: '#fff' } : {}) }}>
            {i === 0 ? 'Today' : i === 1 ? 'Yesterday' : new Date(d + 'T12:00:00Z').toLocaleDateString('en-CA', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' })}
          </Link>
        ))}
      </nav>
      {agents.map(a => (
        <section key={a.agentId} className="k-card" aria-label={a.name}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
            <strong style={{ fontSize: 17 }}>{a.name}</strong>
            <span className="k-note">{a.summary.visitsCompleted} completed · {a.summary.minutesOnSite} min on site · {a.summary.checkIns} check-ins · {a.summary.decisions} decisions</span>
            {a.summary.refused > 0 && <span className="a-flag" style={{ background: 'var(--accent-tint)', color: 'var(--accent)' }}>{a.summary.refused} refused</span>}
          </div>
          {!a.events.length && <span className="k-note">Nothing recorded.</span>}
          {a.events.length > 0 && (
            <table className="a-table">
              <thead><tr><th>Time</th><th>What</th><th>Home</th><th>Detail</th></tr></thead>
              <tbody>
                {a.events.map((e, i) => {
                  const d = describeFieldEvent(e);
                  return (
                    <tr key={i}>
                      <td style={{ whiteSpace: 'nowrap' }}>{time(e.at)}</td>
                      <td style={{ color: TONE[d.tone], fontWeight: 600 }}>{d.title}</td>
                      <td>{e.address}{e.clientName ? <span className="k-note"> · {e.clientName}</span> : null}</td>
                      <td className="k-note">{[d.detail, e.platform ? PLATFORM[e.platform] ?? e.platform : ''].filter(Boolean).join(' · ')}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </section>
      ))}
    </main>
  );
}
