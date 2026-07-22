import { FieldTypeMismatchError } from '../errors';

/**
 * Parse a duration entry into MINUTES (shared by the `duration` and `computed`
 * field types — the latter uses it for its manual fallback). Accepts "8:30"
 * (HH:MM), "8h 30m" / "45m" / "8h", or plain minutes. Returns null for empty;
 * throws FieldTypeMismatchError on a value that is neither.
 */
export function parseDurationMinutes(raw: unknown, key: string): number | null {
  if (raw == null || raw === '') return null;
  if (typeof raw === 'number') return raw;
  if (typeof raw !== 'string') throw new FieldTypeMismatchError(key, 'duration', typeof raw);
  const text = raw.trim();
  const colon = text.match(/^(\d+):([0-5]?\d)$/);
  if (colon) return Number(colon[1]) * 60 + Number(colon[2]);
  const hm = text.match(/^(?:(\d+)\s*h)?\s*(?:(\d+)\s*m?)?$/i);
  if (hm && (hm[1] !== undefined || hm[2] !== undefined)) {
    return Number(hm[1] ?? 0) * 60 + Number(hm[2] ?? 0);
  }
  throw new FieldTypeMismatchError(key, 'duration (HH:MM, 8h 30m, or minutes)', text);
}
