import { describe, expect, it } from 'vitest';

import { calculateRemainingTime, splitRemainingTime } from './registration-status.js';

describe('registration deadline countdown', () => {
  it('calculates remaining time from server time, not the browser clock', () => {
    expect(calculateRemainingTime('2026-10-10T00:00:00+06:00', '2026-10-06T18:30:00+06:00')).toBe(279_000_000);
  });

  it('accounts for monotonic elapsed time after synchronization', () => {
    expect(calculateRemainingTime('2026-10-10T00:00:00+06:00', '2026-10-09T23:59:50+06:00', 3_000)).toBe(7_000);
  });

  it('never returns negative remaining time', () => {
    expect(calculateRemainingTime('2026-10-10T00:00:00+06:00', '2026-10-10T00:00:01+06:00')).toBe(0);
    expect(calculateRemainingTime('2026-10-10T00:00:00+06:00', '2026-10-09T23:59:59+06:00', 5_000)).toBe(0);
  });

  it('splits a duration into stable countdown units', () => {
    expect(splitRemainingTime(279_043_000)).toEqual({ days: 3, hours: 5, minutes: 30, seconds: 43 });
    expect(splitRemainingTime(-1)).toEqual({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  });
});
