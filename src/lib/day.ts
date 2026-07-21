/**
 * THE day module: every "what day is this instant" and "day boundaries for
 * day D" question in the app comes here, always in an explicit IANA timezone.
 * Storage stays pure UTC timestamps; timezone is a display/boundary LENS
 * resolved per request (cookie at the entry point, like the session) and
 * passed down as a parameter — services never read cookies.
 */

/** Cookie-absent / cookie-invalid fallback (the pre-(b) behavior as safety net). */
export const DEFAULT_TIMEZONE = 'Asia/Seoul';

export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/**
 * Raw cookie value → usable IANA timezone. Cookie parsers DIFFER on
 * percent-decoding (the local Next server decodes; the deployed Vercel
 * runtime does not — the bug that pinned a Vancouver user to the Seoul
 * fallback for days), so both the raw and decoded forms are accepted.
 * A present-but-invalid value falls back loudly outside production —
 * silent fallback is what hid this.
 */
export function resolveTimezone(raw: string | undefined): string {
  if (!raw) return DEFAULT_TIMEZONE;
  const candidates = [raw];
  try {
    const decoded = decodeURIComponent(raw);
    if (decoded !== raw) candidates.push(decoded);
  } catch {
    // malformed escape — fall through to validation of the raw form
  }
  for (const candidate of candidates) {
    if (isValidTimeZone(candidate)) return candidate;
  }
  if (process.env.NODE_ENV !== 'production') {
    console.warn(
      `[tz] present-but-invalid tz cookie ${JSON.stringify(raw)} — falling back to ${DEFAULT_TIMEZONE}`
    );
  }
  return DEFAULT_TIMEZONE;
}

/** 'YYYY-MM-DD' of an instant, as read on the wall clock of `tz`. */
export function dayInTz(instant: Date, tz: string): string {
  // en-CA formats as YYYY-MM-DD
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(instant);
}

export function todayInTz(tz: string): string {
  return dayInTz(new Date(), tz);
}

export function isValidDay(day: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(day) && !Number.isNaN(Date.parse(`${day}T00:00:00Z`));
}

/** Pure calendar step — timezone-free string math. */
export function shiftDay(day: string, delta: number): string {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + delta);
  return date.toISOString().slice(0, 10);
}

function tzOffsetMs(tz: string, at: Date): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(at);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const asUtc = Date.UTC(
    get('year'),
    get('month') - 1,
    get('day'),
    get('hour') % 24,
    get('minute'),
    get('second')
  );
  return asUtc - at.getTime();
}

/** The UTC instant at which day D begins on tz's wall clock (DST-safe via
 *  the standard two-pass offset correction). */
export function startOfDayInTz(day: string, tz: string): Date {
  const guess = Date.parse(`${day}T00:00:00Z`);
  const offset = tzOffsetMs(tz, new Date(guess));
  let instant = guess - offset;
  const check = tzOffsetMs(tz, new Date(instant));
  if (check !== offset) instant = guess - check;
  return new Date(instant);
}

/** The EXPLICIT-day capture rule: a date the user deliberately picked always
 *  stamps, today included — explicit beats implicit. */
export function explicitEventDate(day: string | undefined, tz: string): Date | undefined {
  if (!day || !isValidDay(day)) return undefined;
  return startOfDayInTz(day, tz);
}

/* ---------------- month granularity (A2 period navigator) --------------- */

export function isValidMonth(month: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(month);
}

/** 'YYYY-MM' of an instant on the wall clock of `tz`. */
export function monthInTz(instant: Date, tz: string): string {
  return dayInTz(instant, tz).slice(0, 7);
}

export function thisMonthInTz(tz: string): string {
  return monthInTz(new Date(), tz);
}

/** Pure calendar-month step — timezone-free string math. */
export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number);
  const date = new Date(Date.UTC(y!, m! - 1 + delta, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** 'August 2026' — a human month label from 'YYYY-MM' (UTC-noon anchor keeps
 *  the label from slipping a month under any display timezone). */
export function monthLabel(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'long', timeZone: 'UTC' }).format(
    new Date(Date.UTC(y!, m! - 1, 1, 12))
  );
}

/**
 * The UTC instant bounds [start, end) of a calendar month as it falls on the
 * USER's wall clock — a KST month and a UTC month of the same 'YYYY-MM' cover
 * different instants, which is exactly the point (A2 tz-correctness). Built on
 * `startOfDayInTz`, so DST month edges are handled.
 */
export function monthBoundsInTz(month: string, tz: string): { start: Date; end: Date } {
  const start = startOfDayInTz(`${month}-01`, tz);
  const end = startOfDayInTz(`${shiftMonth(month, 1)}-01`, tz);
  return { start, end };
}
