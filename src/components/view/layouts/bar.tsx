import { formatValue } from '../format';
import { registerLayout } from '../registry';

/** money display for the overall bar — keep decimals (Canadian amounts like
 *  6.99), never round (unlike the per-category axis labels). */
const money = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 });
const clampPct = (v: number, max: number) => `${Math.max(0, Math.min(100, (v / max) * 100))}%`;

/** VERTICAL bars, one column per category, on ONE SHARED SCALE: 100% height =
 *  the single largest budget-or-spending across all categories, so heights are
 *  comparable across categories (not per-category normalized). The overlay
 *  (budget) is a reference tick on that same axis; the §8a pending split
 *  (scheduled) stacks above the solid actual with a 2px surface gap. Over-budget
 *  columns switch to the status color AND say "over" — never color alone.
 *  Above the columns, an OVERALL bar of total spending vs the month's total
 *  budget (A''). */
registerLayout('bar', ({ view }) => {
  if (view.kind !== 'aggregate') return null;
  if (view.buckets.length === 0) {
    return <p className="text-muted-foreground py-4 text-sm">Nothing to aggregate yet.</p>;
  }
  // the shared axis maximum: the largest value any single category reaches on
  // either series (spending-with-pending, or its budget tick)
  const max = Math.max(
    ...view.buckets.map((b) => Math.max(b.value + (b.pendingValue ?? 0), b.overlayValue ?? 0)),
    1
  );
  const h = (v: number) => clampPct(v, max);
  const hasPending = view.buckets.some((b) => (b.pendingValue ?? 0) > 0);
  const gt = view.grandTotal;
  const overAll = gt !== null && gt.spent > gt.budget;

  return (
    <div className="flex flex-col gap-4">
      {/* OVERALL: total spending vs the month's total budget (the A'' own value) */}
      {gt && (
        <div className="flex flex-col gap-1">
          <div className="flex items-baseline justify-between gap-2 text-xs">
            <span className="text-muted-foreground font-medium tracking-wide uppercase">Total</span>
            <span
              className={`tabular-nums ${overAll ? 'text-destructive font-medium' : 'text-muted-foreground'}`}
            >
              spent {money.format(gt.spent)} of {money.format(gt.budget)}
              {overAll && ' — over'}
            </span>
          </div>
          <div className="bg-muted relative h-3 rounded-sm">
            <div
              className={`absolute inset-y-0 left-0 rounded-sm ${overAll ? 'bg-destructive' : 'bg-primary'}`}
              style={{ width: gt.budget > 0 ? clampPct(gt.spent, gt.budget) : '0%' }}
            />
          </div>
        </div>
      )}

      {/* per-category VERTICAL bars on the shared scale */}
      <div className="flex items-end gap-3 overflow-x-auto pb-1">
        {view.buckets.map((b) => {
          const pending = b.pendingValue ?? 0;
          const committed = b.value + pending;
          const over = b.overlayValue !== null && committed > b.overlayValue;
          return (
            <div
              key={b.group ?? '(total)'}
              className="flex min-w-12 flex-1 flex-col items-center gap-1.5"
            >
              <div
                className="bg-muted relative h-32 w-full max-w-14 rounded-sm"
                title={
                  b.overlayValue !== null
                    ? `${b.label}: ${formatValue(b.value)}${pending > 0 ? ` + ${formatValue(pending)} pending` : ''} of ${formatValue(b.overlayValue)}`
                    : `${b.label}: ${formatValue(b.value)} (${b.count})`
                }
              >
                {/* actual, from the baseline up (rounded data-end) */}
                <div
                  className={`absolute inset-x-0 bottom-0 rounded-t-sm ${over ? 'bg-destructive' : 'bg-primary'}`}
                  style={{ height: h(b.value) }}
                />
                {/* pending, stacked above with a 2px surface gap (faded) */}
                {pending > 0 && (
                  <div
                    className={`border-background absolute inset-x-0 rounded-t-sm border-b-2 opacity-40 ${over ? 'bg-destructive' : 'bg-primary'}`}
                    style={{ bottom: h(b.value), height: h(pending) }}
                  />
                )}
                {/* budget tick — reference on the SAME shared axis */}
                {b.overlayValue !== null && (
                  <div
                    className="bg-foreground absolute inset-x-0 h-0.5"
                    style={{ bottom: h(b.overlayValue) }}
                    aria-hidden
                  />
                )}
              </div>
              <span
                className="text-muted-foreground w-full truncate text-center text-xs"
                title={b.label}
              >
                {b.label}
              </span>
              <span className="text-center text-xs tabular-nums">{formatValue(b.value)}</span>
              {over && (
                <span className="text-destructive text-center text-[10px] font-medium">over</span>
              )}
            </div>
          );
        })}
      </div>

      {view.hasOverlay && (
        <p className="text-muted-foreground text-xs">
          bar = actual{hasPending && ' · faded = pending'} · tick = {view.spec.overlayOwnField}
        </p>
      )}
    </div>
  );
});
