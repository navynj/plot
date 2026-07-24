// one formatter per timezone (constructing Intl.DateTimeFormat is not free)
const cache = new Map<string | undefined, Intl.DateTimeFormat>();

/**
 * Render an instant on the USER's wall clock. `tz` is the IANA zone resolved at
 * the server entry point (the same `getRequestTimezone()` the day helpers use) —
 * without it the server renders in the runtime zone (UTC on Vercel), showing the
 * wrong time. Omit `tz` only on the client, where the runtime zone already IS
 * the user's.
 */
export function formatTimestamp(date: Date, tz?: string): string {
  let formatter = cache.get(tz);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: tz,
    });
    cache.set(tz, formatter);
  }
  return formatter.format(date);
}
