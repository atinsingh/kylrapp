import { describe, expect, it } from 'vitest';
import { bankingDayDeadline, fromTorontoInput, nextBankingDate, torontoTime, torontoWhen, ontarioHolidays, torontoInputValue, torontoInstant, visitSlots } from './time.js';

describe('Toronto time', () => {
  it('handles daylight and standard time', () => {
    expect(torontoInstant(2026, 7, 15, 10).toISOString()).toBe('2026-07-15T14:00:00.000Z'); // EDT, UTC−4
    expect(torontoInstant(2026, 12, 15, 10).toISOString()).toBe('2026-12-15T15:00:00.000Z'); // EST, UTC−5
    // Across the Nov 1, 2026 change: 10 am on Nov 2 is EST.
    expect(torontoInstant(2026, 11, 2, 10).toISOString()).toBe('2026-11-02T15:00:00.000Z');
  });
  it('builds slots from Toronto’s date, not the device’s', () => {
    // 11:30 pm Oct 29 in Toronto is already Oct 30 in UTC; tomorrow is still Oct 30 in Toronto.
    const now = new Date('2026-10-30T03:30:00Z');
    const [first] = visitSlots(1, [[10, 0]], now);
    expect(first!.toISOString()).toBe('2026-10-30T14:00:00.000Z');
  });
});

describe('banking days', () => {
  it('knows Ontario statutory holidays, including moved ones', () => {
    const h2026 = [...ontarioHolidays(2026)].sort();
    expect(h2026).toEqual(['2026-01-01', '2026-02-16', '2026-04-03', '2026-05-18', '2026-07-01', '2026-09-07', '2026-10-12', '2026-12-25', '2026-12-26', '2026-12-28']);
    // 2027: Christmas on Saturday, Boxing Day on Sunday → the 27th and 28th too; Canada Day on Thursday.
    expect([...ontarioHolidays(2027)].filter(d => d.startsWith('2027-12'))).toEqual(['2027-12-25', '2027-12-26', '2027-12-27', '2027-12-28']);
    expect(ontarioHolidays(2027).has('2027-03-26')).toBe(true); // Good Friday 2027
    expect(ontarioHolidays(2028).has('2028-01-03')).toBe(true); // New Year's Day 2028 is a Saturday, so Monday is off
    expect(ontarioHolidays(2028).has('2028-01-01')).toBe(true);
  });

  it('moves a closing date off weekends and holidays', () => {
    expect(nextBankingDate('2026-12-25')).toBe('2026-12-29'); // Christmas, Boxing Day (Sat), Sunday, moved Boxing Day
    expect(nextBankingDate('2026-10-31')).toBe('2026-11-02'); // Saturday
    expect(nextBankingDate('2026-11-03')).toBe('2026-11-03');
  });

  it('puts a condition deadline at 11:59 pm Toronto on the Nth banking day after acceptance', () => {
    // Accepted Thu Oct 29 2026, 9 pm Toronto → 5 banking days: Fri 30, Mon 2, Tue 3, Wed 4, Thu 5 Nov.
    expect(bankingDayDeadline(torontoInstant(2026, 10, 29, 21, 0), 5).toISOString()).toBe(torontoInstant(2026, 11, 5, 23, 59).toISOString());
    // Accepted Fri Oct 9 2026 → Thanksgiving Mon Oct 12 is skipped: Tue 13 … Mon 19.
    expect(bankingDayDeadline(torontoInstant(2026, 10, 9, 12, 0), 5).toISOString()).toBe(torontoInstant(2026, 10, 19, 23, 59).toISOString());
    // Accepted Wed Dec 23 2026: Thu 24, then Christmas (Fri), the weekend and moved Boxing Day (Mon 28) are skipped: Tue 29, Wed 30, Thu 31, and New Year's Day → Mon Jan 4.
    expect(bankingDayDeadline(torontoInstant(2026, 12, 23, 10, 0), 5).toISOString()).toBe(torontoInstant(2027, 1, 4, 23, 59).toISOString());
    // The time of day of acceptance doesn't matter; late at night in Toronto is still that Toronto day.
    expect(bankingDayDeadline(new Date('2026-10-30T03:30:00Z'), 1).toISOString()).toBe(torontoInstant(2026, 10, 30, 23, 59).toISOString());
  });
});

describe('Toronto date-time inputs', () => {
  it('round-trips through wall-clock time in both seasons', () => {
    expect(torontoInputValue('2026-07-01T16:30:00Z')).toBe('2026-07-01T12:30');
    expect(torontoInputValue('2026-12-01T17:30:00Z')).toBe('2026-12-01T12:30');
    expect(fromTorontoInput('2026-12-01T12:30').toISOString()).toBe('2026-12-01T17:30:00.000Z');
    expect(fromTorontoInput(torontoInputValue('2026-07-01T16:30:00Z')).toISOString()).toBe('2026-07-01T16:30:00.000Z');
    expect(torontoWhen('2026-10-29T20:36:00Z')).toBe('Thu, Oct 29, 4:36 pm');
    expect(torontoTime('2026-10-29T13:05:00Z')).toBe('9:05 am');
  });
});
