/** Ontario homes, Ontario time: visit slots and deadlines are in America/Toronto whatever the device's zone. */
export const TORONTO = 'America/Toronto';

/** Minutes east of UTC for Toronto at an instant (−240 in summer, −300 in winter). */
function offsetMinutes(at: Date): number {
  // Read Toronto's wall clock for this instant and compare; works on every JS engine with Intl time zones.
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: TORONTO, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  }).formatToParts(at).map(x => [x.type, x.value]));
  const wall = Date.UTC(+p.year!, +p.month! - 1, +p.day!, +p.hour!, +p.minute!);
  return Math.round((wall - Math.floor(at.getTime() / 60_000) * 60_000) / 60_000);
}

/** The instant of a Toronto wall-clock time (month is 1–12). */
export function torontoInstant(year: number, month: number, day: number, hour: number, minute = 0): Date {
  const guess = Date.UTC(year, month - 1, day, hour, minute);
  const first = guess - offsetMinutes(new Date(guess)) * 60_000;
  // Re-check at the result in case the guess fell on the other side of a DST change.
  return new Date(guess - offsetMinutes(new Date(first)) * 60_000);
}

/** Today's date in Toronto as [year, month, day]. */
export function torontoToday(now = new Date()): [number, number, number] {
  const [y, m, d] = now.toLocaleDateString('en-CA', { timeZone: TORONTO }).split('-').map(Number) as [number, number, number];
  return [y, m, d];
}

/** Visit slots: the next `days` days in Toronto at the given wall-clock times. */
export function visitSlots(days: number, times: [number, number][], now = new Date()) {
  const [y, m, d] = torontoToday(now);
  const out: Date[] = [];
  for (let i = 1; i <= days; i++) for (const [h, min] of times) out.push(torontoInstant(y, m, d + i, h, min));
  return out;
}
