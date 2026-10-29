import type { ProShowing } from '@klyr/api-client';
import { GEOFENCE } from '@klyr/contracts';
import { TORONTO } from '@klyr/core';
import { ProHeader } from '@/components/pro-header';
import { api, requireAgent } from '@/lib/session';
import { VisitCard } from './visit-card';

export const metadata = { title: 'Visits · Klyr Pro' };

const dayOf = (iso: string) => new Date(iso).toLocaleDateString('en-CA', { timeZone: TORONTO });
function dayLabel(day: string) {
  const today = dayOf(new Date().toISOString());
  const tomorrow = dayOf(new Date(Date.now() + 86_400_000).toISOString());
  if (day === today) return 'TODAY';
  if (day === tomorrow) return 'TOMORROW';
  return new Date(day + 'T12:00:00Z').toLocaleDateString('en-CA', { weekday: 'long', month: 'short', day: 'numeric', timeZone: 'UTC' }).toUpperCase();
}

export default async function VisitsPage() {
  const me = await requireAgent();
  const visits = (await api<ProShowing[]>('/pro/showings')).data ?? [];
  const waiting = visits.filter(v => v.status === 'requested');
  const scheduled = visits.filter(v => v.status !== 'requested');
  const days = [...new Set(scheduled.map(v => dayOf(v.at)))];

  return (
    <main className="p-wrap">
      <ProHeader me={me} current="visits" />
      <h1 className="k-h1">Visits</h1>
      <p className="k-note" style={{ margin: 0 }}>
        Check in and complete each visit from the property: within {GEOFENCE.radiusM} m, from {GEOFENCE.earlyMinutes} minutes before the time,
        and at least {GEOFENCE.minOnSiteMinutes} minutes on site. Every attempt is recorded for the broker of record.
      </p>
      {!visits.length && <section className="k-card"><strong>No visits yet</strong><span className="k-note">When your clients book a visit, it shows up here for you to confirm.</span></section>}
      {waiting.length > 0 && (
        <section aria-label="Needs your answer" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div className="k-label">NEEDS YOUR ANSWER · {waiting.length}</div>
          {waiting.map(v => <VisitCard key={v.id} v={v} />)}
        </section>
      )}
      {days.map(day => (
        <section key={day} aria-label={dayLabel(day).toLowerCase()} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div className="k-label">{dayLabel(day)}</div>
          {scheduled.filter(v => dayOf(v.at) === day).map(v => <VisitCard key={v.id} v={v} />)}
        </section>
      ))}
    </main>
  );
}
