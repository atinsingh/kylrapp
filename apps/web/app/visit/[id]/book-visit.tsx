'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { TORONTO, visitSlots } from '@klyr/core';
import { errorText, klyr } from '@/lib/client';

const TIMES: [number, number][] = [[10, 0], [13, 0], [16, 0], [18, 30]];

/** The next five days with a few times each, in Toronto time; your agent arranges it with the listing brokerage and confirms. */
function slots() {
  return visitSlots(5, TIMES).map(at => ({
    at,
    day: at.toLocaleDateString('en-CA', { weekday: 'short', month: 'short', day: 'numeric', timeZone: TORONTO }),
    time: at.toLocaleTimeString('en-CA', { hour: 'numeric', minute: '2-digit', timeZone: TORONTO }),
  }));
}

export function BookVisit({ listingId, enabled, openHouse, agent }: { listingId: string; enabled: boolean; openHouse: string | null; agent: string }) {
  const router = useRouter();
  const all = useMemo(slots, []);
  const days = [...new Set(all.map(s => s.day))];
  const [day, setDay] = useState(days[0]!);
  const [pick, setPick] = useState<Date | null>(null);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function book() {
    if (!pick) return;
    setBusy(true); setError('');
    const r = await klyr.bookShowing(listingId, pick.toISOString(), note || undefined);
    setBusy(false);
    if (!r.ok) return setError(errorText(r.error));
    router.push('/visits?booked=1');
  }

  return (
    <section className="k-card" aria-label="Pick a time" style={enabled ? undefined : { opacity: 0.6 }}>
      <div className="k-label">PICK A TIME · YOUR AGENT CONFIRMS</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }} role="group" aria-label="Day">
        {days.map(d => <button key={d} className="k-chip" disabled={!enabled} aria-pressed={d === day} onClick={() => { setDay(d); setPick(null); }}>{d}</button>)}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }} role="group" aria-label="Time">
        {all.filter(s => s.day === day).map(s => (
          <button key={s.at.toISOString()} className="k-chip" disabled={!enabled} aria-pressed={pick?.getTime() === s.at.getTime()} onClick={() => setPick(s.at)}>{s.time}</button>
        ))}
      </div>
      <label className="k-field">Anything the agent should know? (optional)
        <input value={note} onChange={e => setNote(e.target.value)} maxLength={500} disabled={!enabled} />
      </label>
      <p className="k-note" style={{ margin: 0 }}>{agent} meets you there.{openHouse ? ` Or join the open house: ${openHouse}.` : ''}</p>
      {error && <div className="k-error" role="alert">{error}</div>}
      <button className="k-btn" disabled={!enabled || !pick || busy} onClick={book}>{enabled ? 'Book visit' : 'Finish the steps above to book'}</button>
    </section>
  );
}
