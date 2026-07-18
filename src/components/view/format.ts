/** Shared display formatting for layout renderers. Round every displayed
 *  number (CLAUDE.md §6); values wear text tokens, never mark colors. */
const number = new Intl.NumberFormat('en', { maximumFractionDigits: 1 });

export function formatValue(value: number): string {
  return number.format(value);
}

export function formatLens(value: unknown): string {
  if (value instanceof Date) {
    return new Intl.DateTimeFormat('en', { dateStyle: 'medium' }).format(value);
  }
  if (typeof value === 'number') return number.format(value);
  if (typeof value === 'boolean') return value ? '✓' : '—';
  if (value === null || value === undefined) return '';
  return String(value);
}
