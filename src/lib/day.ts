/** Pure day-string helpers for the timeline's day navigator. All in the
 *  server's local calendar; a day is 'YYYY-MM-DD'. */

export function toDayString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function todayString(): string {
  return toDayString(new Date());
}

export function isValidDay(day: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(day) && !Number.isNaN(new Date(`${day}T00:00:00`).getTime());
}

export function shiftDay(day: string, delta: number): string {
  const date = new Date(`${day}T00:00:00`);
  date.setDate(date.getDate() + delta);
  return toDayString(date);
}

/**
 * The capture-day rule: a viewed day becomes the new node's eventDate ONLY
 * when it isn't today — capturing on "today" stays zero-cost (eventDate null,
 * capturedAt speaks for it). Returns undefined for absent/invalid/today.
 */
export function resolveCaptureEventDate(day: string | undefined): Date | undefined {
  if (!day || !isValidDay(day) || day === todayString()) return undefined;
  return new Date(`${day}T00:00:00`);
}
