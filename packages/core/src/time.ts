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

// ── Banking days (OREA Form 100: any day other than a Saturday, Sunday or Ontario statutory holiday) ──

const iso = (y: number, m: number, d: number) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
/** Day of week (0 = Sunday) of a calendar date, independent of time zone. */
const dow = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d)).getUTCDay();
/** The nth given weekday of a month (n = -1 for the last one before a day: used for Victoria Day). */
function nthWeekday(y: number, m: number, weekday: number, n: number): number {
  const first = dow(y, m, 1);
  return 1 + ((weekday - first + 7) % 7) + (n - 1) * 7;
}
/** Easter Sunday (anonymous Gregorian algorithm), as [month, day]. */
function easter(y: number): [number, number] {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
  return [month, day];
}

/**
 * Ontario statutory holidays for a year as "YYYY-MM-DD", including the weekday a holiday moves to when it
 * falls on a weekend. Counting a moved holiday too can only lengthen a deadline, never shorten it.
 */
export function ontarioHolidays(y: number): Set<string> {
  const out = new Set<string>();
  const add = (m: number, d: number) => out.add(iso(y, m, d));
  /** A fixed-date holiday, plus the next weekday when it lands on a weekend. */
  const fixed = (m: number, d: number, nextIfWeekend: number) => {
    add(m, d);
    const w = dow(y, m, d);
    if (w === 6) add(m, d + nextIfWeekend);
    if (w === 0) add(m, d + 1);
  };
  fixed(1, 1, 2); // New Year's Day
  add(2, nthWeekday(y, 2, 1, 3)); // Family Day: third Monday of February
  const [em, ed] = easter(y);
  const gf = new Date(Date.UTC(y, em - 1, ed - 2));
  add(gf.getUTCMonth() + 1, gf.getUTCDate()); // Good Friday
  add(5, 24 - ((dow(y, 5, 24) + 6) % 7)); // Victoria Day: the Monday before May 25
  fixed(7, 1, 2); // Canada Day
  add(9, nthWeekday(y, 9, 1, 1)); // Labour Day: first Monday of September
  add(10, nthWeekday(y, 10, 1, 2)); // Thanksgiving: second Monday of October
  // Christmas and Boxing Day: a weekend Christmas moves to the 27th, a weekend Boxing Day to the 28th.
  add(12, 25); add(12, 26);
  const xmas = dow(y, 12, 25);
  if (xmas === 6) { add(12, 27); add(12, 28); }
  if (xmas === 0) add(12, 27);
  if (xmas === 5) add(12, 28);
  return out;
}

/** Whether a Toronto calendar date is a banking day. */
export function isBankingDay(y: number, m: number, d: number): boolean {
  const w = dow(y, m, d);
  return w !== 0 && w !== 6 && !ontarioHolidays(y).has(iso(y, m, d));
}

/**
 * "11:59 p.m. on the Nth Banking Day following acceptance": the instant a condition expires,
 * counting from the day after the acceptance date in Toronto.
 */
export function bankingDayDeadline(acceptedAt: Date, n: number): Date {
  let [y, m, d] = torontoToday(acceptedAt);
  for (let count = 0; count < n;) {
    const next = new Date(Date.UTC(y, m - 1, d + 1));
    [y, m, d] = [next.getUTCFullYear(), next.getUTCMonth() + 1, next.getUTCDate()];
    if (isBankingDay(y, m, d)) count++;
  }
  return torontoInstant(y, m, d, 23, 59);
}

/** An instant as Toronto wall-clock "YYYY-MM-DDTHH:mm", for a datetime-local input. */
export function torontoInputValue(at: Date | string): string {
  return new Date(at).toLocaleString('sv-SE', { timeZone: TORONTO }).replace(' ', 'T').slice(0, 16);
}

/** A datetime-local value read as Toronto wall-clock time. */
export function fromTorontoInput(v: string): Date {
  const [d, t = '00:00'] = v.split('T') as [string, string?];
  const [y, m, day] = d.split('-').map(Number) as [number, number, number];
  const [h, min] = t.split(':').map(Number) as [number, number];
  return torontoInstant(y, m, day, h, min);
}

/** "YYYY-MM-DD" itself if it's a banking day, else the next one: closings need the land registry open. */
export function nextBankingDate(ymd: string): string {
  let [y, m, d] = ymd.split('-').map(Number) as [number, number, number];
  while (!isBankingDay(y, m, d)) {
    const next = new Date(Date.UTC(y, m - 1, d + 1));
    [y, m, d] = [next.getUTCFullYear(), next.getUTCMonth() + 1, next.getUTCDate()];
  }
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

const ampm = (s: string) => s.replace(/\s?a\.m\./g, ' am').replace(/\s?p\.m\./g, ' pm');
/** "Thu, Oct 29, 4:36 pm" in Toronto, the way Klyr writes dates and times. */
export const torontoWhen = (at: Date | string | number) =>
  ampm(new Date(at).toLocaleString('en-CA', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: TORONTO }));
/** "4:36 pm" in Toronto. */
export const torontoTime = (at: Date | string | number) =>
  ampm(new Date(at).toLocaleTimeString('en-CA', { hour: 'numeric', minute: '2-digit', timeZone: TORONTO }));

/** "YYYY-MM-DD" as "Tue, Jan 12, 2027" (a calendar date, no time zone involved). */
export const calendarDate = (ymd: string) =>
  new Date(ymd + 'T12:00:00Z').toLocaleDateString('en-CA', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
