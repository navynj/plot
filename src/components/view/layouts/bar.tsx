import { registerLayout } from '../registry';

/** money display — keeps decimals (Canadian amounts like 6.99), never rounds. */
const money = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 });
const clampPct = (v: number, max: number) => Math.max(0, Math.min(100, (v / max) * 100));

/** VERTICAL bars, one column per category, on ONE SHARED SCALE: 100% height =
 *  the single largest budget-or-spending across all categories, so heights are
 *  comparable across categories.
 *
 *  Visual grammar (same as the top total bar: grey track + black fill):
 *  - the budget renders as a GREY placeholder column at the budget height
 *    (grey = target / room to spend);
 *  - the actual (current + scheduled) fills it BLACK from the bottom (remaining
 *    grey = what's left);
 *  - over budget: the black passes the grey and the OVERFLOW takes the status
 *    color — no tick line.
 *  Columns are labelled by the category's icon (icon ladder); the name stays
 *  accessible via title. Under each: the actual, then a grey /goal. */
registerLayout('bar', ({ view }) => {
  if (view.kind !== 'aggregate') return null;
  if (view.buckets.length === 0) {
    return <p className="text-muted-foreground py-4 text-sm">Nothing to aggregate yet.</p>;
  }
  // shared axis maximum: the largest a single category reaches on EITHER its
  // committed spending or its budget target
  const max = Math.max(
    ...view.buckets.map((b) => Math.max(b.value + (b.pendingValue ?? 0), b.overlayValue ?? 0)),
    1
  );
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
              className={`absolute inset-y-0 left-0 rounded-sm ${overAll ? 'bg-destructive' : 'bg-foreground'}`}
              style={{ width: `${gt.budget > 0 ? clampPct(gt.spent, gt.budget) : 0}%` }}
            />
          </div>
        </div>
      )}

      {/* per-category VERTICAL bars on the shared scale */}
      <div className="flex items-end gap-2 overflow-x-auto pb-1">
        {view.buckets.map((b) => {
          const committed = b.value + (b.pendingValue ?? 0);
          const hasBudget = b.overlayValue !== null;
          const over = hasBudget && committed > b.overlayValue!;
          const budgetPct = hasBudget ? clampPct(b.overlayValue!, max) : 0;
          const actualPct = clampPct(committed, max);
          // black fills the grey from the bottom; when over, it caps at the
          // grey top and the overflow segment (status color) continues above
          const blackTop = hasBudget ? Math.min(actualPct, budgetPct) : actualPct;
          return (
            <div
              key={b.group ?? '(total)'}
              className="flex min-w-9 flex-1 flex-col items-center gap-1.5"
            >
              <div
                className="relative h-32 w-full max-w-6"
                title={
                  hasBudget
                    ? `${b.label}: ${money.format(committed)} of ${money.format(b.overlayValue!)}${over ? ' — over' : ''}`
                    : `${b.label}: ${money.format(committed)} (${b.count})`
                }
              >
                {/* grey budget placeholder (target room) */}
                {hasBudget && (
                  <div
                    className="bg-muted absolute inset-x-0 bottom-0 rounded-t-sm"
                    style={{ height: `${budgetPct}%` }}
                  />
                )}
                {/* black actual, from the baseline up */}
                <div
                  className={`bg-foreground absolute inset-x-0 bottom-0 ${hasBudget && !over ? '' : 'rounded-t-sm'}`}
                  style={{ height: `${blackTop}%` }}
                />
                {/* overflow above the grey (over budget) in the status color */}
                {over && (
                  <div
                    className="bg-destructive absolute inset-x-0 rounded-t-sm"
                    style={{ bottom: `${budgetPct}%`, height: `${actualPct - budgetPct}%` }}
                  />
                )}
              </div>
              {/* icon by default (name stays accessible via title) */}
              <span className="text-center text-base leading-none" title={b.label}>
                {b.icon ?? (
                  <span className="text-muted-foreground block max-w-12 truncate text-xs">
                    {b.label}
                  </span>
                )}
              </span>
              {/* actual, then a grey /goal (no /goal when the category has none) */}
              <span className="text-center text-xs tabular-nums">
                <span className={over ? 'text-destructive font-medium' : ''}>
                  {money.format(committed)}
                </span>
                {hasBudget && (
                  <span className="text-muted-foreground"> /{money.format(b.overlayValue!)}</span>
                )}
              </span>
            </div>
          );
        })}
      </div>

      {view.hasOverlay && (
        <p className="text-muted-foreground text-xs">grey = budget · black = actual · red = over</p>
      )}
    </div>
  );
});
