import { describe, expect, it } from 'vitest';

import {
  DEFAULT_TIMEZONE,
  dayInTz,
  explicitEventDate,
  isValidMonth,
  monthBoundsInTz,
  monthLabel,
  resolveTimezone,
  shiftDay,
  shiftMonth,
  startOfDayInTz,
  todayInTz,
} from './day';

describe('the rollover pin — one instant, two calendars', () => {
  // 23:30 UTC = 08:30 KST the NEXT day
  const instant = new Date('2026-07-18T23:30:00Z');

  it('a KST user sees the next day; a UTC user sees the same day', () => {
    expect(dayInTz(instant, 'Asia/Seoul')).toBe('2026-07-19');
    expect(dayInTz(instant, 'UTC')).toBe('2026-07-18');
  });

  it('and westward: 00:30 UTC is still the previous day in New York', () => {
    const after = new Date('2026-07-19T00:30:00Z');
    expect(dayInTz(after, 'America/New_York')).toBe('2026-07-18');
    expect(dayInTz(after, 'UTC')).toBe('2026-07-19');
  });
});

describe('resolveTimezone — cookie-absent fallback', () => {
  it('absent or garbage falls back to Asia/Seoul; valid zones pass through', () => {
    expect(resolveTimezone(undefined)).toBe(DEFAULT_TIMEZONE);
    expect(resolveTimezone('Not/AZone')).toBe(DEFAULT_TIMEZONE);
    expect(resolveTimezone('America/New_York')).toBe('America/New_York');
  });

  it('THE REGRESSION: a percent-encoded cookie value resolves to the real zone (Vercel does not decode; local servers do)', () => {
    expect(resolveTimezone('America%2FVancouver')).toBe('America/Vancouver');
    expect(resolveTimezone('America%2FNew_York')).toBe('America/New_York');
    expect(resolveTimezone('Bad%2')).toBe(DEFAULT_TIMEZONE); // malformed escape stays graceful
  });
});

describe('startOfDayInTz — day boundaries as UTC instants', () => {
  it('KST midnight is 15:00 UTC the day before; UTC midnight is itself', () => {
    expect(startOfDayInTz('2026-07-18', 'Asia/Seoul').toISOString()).toBe(
      '2026-07-17T15:00:00.000Z'
    );
    expect(startOfDayInTz('2026-07-18', 'UTC').toISOString()).toBe('2026-07-18T00:00:00.000Z');
  });

  it('round-trips: the boundary instant reads as its own day in that tz', () => {
    for (const tz of ['Asia/Seoul', 'UTC', 'America/New_York']) {
      expect(dayInTz(startOfDayInTz('2026-03-08', tz), tz)).toBe('2026-03-08'); // US DST eve
    }
  });
});

describe('capture-day rule — the shown date stamps, clear means dateless', () => {
  it('explicit day (today included) stamps its tz midnight; cleared/invalid yields nothing', () => {
    const tz = 'UTC';
    const today = todayInTz(tz);
    expect(explicitEventDate(today, tz)?.toISOString()).toBe(
      startOfDayInTz(today, tz).toISOString()
    );
    expect(explicitEventDate('2026-07-18', 'Asia/Seoul')?.toISOString()).toBe(
      '2026-07-17T15:00:00.000Z'
    );
    expect(explicitEventDate(undefined, tz)).toBeUndefined();
    expect(explicitEventDate('garbage', tz)).toBeUndefined();
  });
});

describe('shiftDay crosses month boundaries (pure string math)', () => {
  it('steps correctly', () => {
    expect(shiftDay('2026-08-01', -1)).toBe('2026-07-31');
    expect(shiftDay('2026-07-31', 1)).toBe('2026-08-01');
    expect(shiftDay('2026-03-01', -1)).toBe('2026-02-28');
  });
});

describe('A2 month granularity — labels, stepping, validation', () => {
  it('validates and formats', () => {
    expect(isValidMonth('2026-08')).toBe(true);
    expect(isValidMonth('2026-13')).toBe(false);
    expect(isValidMonth('2026-08-01')).toBe(false);
    expect(monthLabel('2026-08')).toBe('August 2026');
    expect(monthLabel('2026-12')).toBe('December 2026');
  });
  it('steps across the year boundary', () => {
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
    expect(shiftMonth('2026-08', -3)).toBe('2026-05');
  });
});

describe('A2 month bounds respect the USER timezone — a month-edge instant lands in different months', () => {
  it('a KST month and a UTC month of the same label cover different UTC instants', () => {
    // August in KST begins at 2026-07-31T15:00Z; in UTC at 2026-08-01T00:00Z
    const kst = monthBoundsInTz('2026-08', 'Asia/Seoul');
    const utc = monthBoundsInTz('2026-08', 'UTC');
    expect(kst.start.toISOString()).toBe('2026-07-31T15:00:00.000Z');
    expect(utc.start.toISOString()).toBe('2026-08-01T00:00:00.000Z');
    expect(kst.end.toISOString()).toBe('2026-08-31T15:00:00.000Z');
    expect(utc.end.toISOString()).toBe('2026-09-01T00:00:00.000Z');

    // THE EDGE INSTANT: 2026-07-31T18:00Z is Aug 1 03:00 in KST but still
    // Jul 31 in UTC — so it is INSIDE the KST August window, OUTSIDE the UTC one
    const edge = new Date('2026-07-31T18:00:00Z');
    expect(edge >= kst.start && edge < kst.end).toBe(true); // KST user: August
    expect(edge >= utc.start && edge < utc.end).toBe(false); // UTC user: July
  });
  it('half-open [start, end): the last instant of the month is in, the next month start is out', () => {
    const { start, end } = monthBoundsInTz('2026-02', 'UTC');
    expect(start.toISOString()).toBe('2026-02-01T00:00:00.000Z');
    expect(end.toISOString()).toBe('2026-03-01T00:00:00.000Z'); // 2026 is not a leap year
  });
});
