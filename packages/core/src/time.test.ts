import { describe, expect, it } from 'vitest';
import { torontoInstant, visitSlots } from './time.js';

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
