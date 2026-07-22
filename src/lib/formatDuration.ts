/** Render MINUTES as a compact duration ("8h 30m", "8h", "45m"). Shared by the
 *  duration and computed field types and the main-surface value formatter. */
export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}
