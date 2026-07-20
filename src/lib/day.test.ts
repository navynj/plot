import { describe, expect, it } from 'vitest';

import { resolveCaptureEventDate, shiftDay, todayString } from './day';

describe('resolveCaptureEventDate — day context stamps eventDate only off-today', () => {
  it('today, absent, and garbage all yield undefined (eventDate stays null)', () => {
    expect(resolveCaptureEventDate(undefined)).toBeUndefined();
    expect(resolveCaptureEventDate(todayString())).toBeUndefined();
    expect(resolveCaptureEventDate('not-a-day')).toBeUndefined();
    expect(resolveCaptureEventDate('2026-13-99')).toBeUndefined();
  });

  it('a past day yields that day as a Date', () => {
    const yesterday = shiftDay(todayString(), -1);
    const resolved = resolveCaptureEventDate(yesterday);
    expect(resolved).toBeInstanceOf(Date);
    expect(resolved!.getDate()).toBe(new Date(`${yesterday}T00:00:00`).getDate());
  });
});

describe('shiftDay crosses month boundaries', () => {
  it('steps correctly', () => {
    expect(shiftDay('2026-08-01', -1)).toBe('2026-07-31');
    expect(shiftDay('2026-07-31', 1)).toBe('2026-08-01');
    expect(shiftDay('2026-03-01', -1)).toBe('2026-02-28');
  });
});
