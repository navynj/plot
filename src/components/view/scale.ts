/**
 * A bipolar value→plot-area scale for the numeric chart layouts. The domain
 * ALWAYS includes zero so the baseline is drawn at `value = 0`, and it stretches
 * to cover any negatives — a signed field (e.g. mood on a −5..+5 scale) renders
 * below the zero line but inside the viewport, never clipped at the bottom.
 */

/** The [lo, hi] domain: `lo = min(0, …values)`, `hi = max(0, …values)`, guarded
 *  so `hi > lo` even for an all-zero (or empty) dataset. */
export function bipolarDomain(values: number[]): { lo: number; hi: number } {
  const lo = Math.min(0, ...values);
  const hi = Math.max(0, ...values);
  return { lo, hi: hi > lo ? hi : lo + 1 };
}

/** Position of `v` within [lo, hi] as a fraction in [0, 1] (0 = lo, 1 = hi).
 *  Layouts map this onto pixels (line) or a percentage height (bar). */
export function scaleFrac(v: number, lo: number, hi: number): number {
  const span = hi - lo || 1;
  return (v - lo) / span;
}
