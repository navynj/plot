import { registerLayout } from '../registry';
import { bipolarDomain, scaleFrac } from '../scale';

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
  // shared axis, spanning zero: `hi` = the largest a single category reaches on
  // EITHER its committed spending or its budget target (≥1 floor); `lo` dips
  // below zero only when a signed field has negatives. For the budget case
  // (all non-negative) lo = 0 and the baseline sits at the bottom — unchanged.
  const committedOf = (b: (typeof view.buckets)[number]) => b.value + (b.pendingValue ?? 0);
  const { lo, hi } = bipolarDomain([
    ...view.buckets.map(committedOf),
    ...view.buckets.map((b) => b.overlayValue ?? 0),
    1,
  ]);
  const pct = (v: number) => scaleFrac(v, lo, hi) * 100;
  const zeroPct = pct(0); // baseline height from the bottom (0 unless negatives)
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
              spent {money.format(gt.spent)} of {money.format(gt.budget)} ·{' '}
              {overAll
                ? `over ${money.format(gt.spent - gt.budget)}`
                : `remaining ${money.format(gt.budget - gt.spent)}`}
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
          const committed = committedOf(b);
          const hasBudget = b.overlayValue !== null;
          const over = hasBudget && committed > b.overlayValue!;
          const budgetPct = hasBudget ? pct(b.overlayValue!) : 0;
          const actualPct = pct(committed);
          // black fills from the zero baseline; when under budget it caps at the
          // grey top, when over the overflow segment continues above. A negative
          // value draws DOWNWARD from the baseline instead.
          const blackTop = hasBudget ? Math.min(actualPct, budgetPct) : actualPct;
          const black =
            committed < 0
              ? { bottom: `${actualPct}%`, height: `${zeroPct - actualPct}%` }
              : { bottom: `${zeroPct}%`, height: `${blackTop - zeroPct}%` };
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
                {/* zero baseline (only visible when a signed field has negatives) */}
                {lo < 0 && (
                  <div
                    className="bg-border absolute inset-x-0 h-px"
                    style={{ bottom: `${zeroPct}%` }}
                  />
                )}
                {/* grey budget placeholder (target room), from the baseline up */}
                {hasBudget && (
                  <div
                    className="bg-muted absolute inset-x-0 rounded-t-sm"
                    style={{ bottom: `${zeroPct}%`, height: `${budgetPct - zeroPct}%` }}
                  />
                )}
                {/* black actual — up from the baseline, or down for a negative.
                    With a budget the top is SQUARE: under budget the grey's
                    rounded top caps it; over budget the red over-cap sits flush
                    on top, so black+red read as one continuous bar (not two
                    pills). Only a plain (budget-less) bar keeps a rounded top. */}
                <div
                  className={`bg-foreground absolute inset-x-0 ${committed < 0 ? 'rounded-b-sm' : hasBudget ? '' : 'rounded-t-sm'}`}
                  style={black}
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
              {/* actual, then a grey /goal STACKED BELOW it (keeps the column
                  narrow — no side-by-side width) */}
              <span className="text-center text-xs leading-tight tabular-nums">
                <span className={`block ${over ? 'text-destructive font-medium' : ''}`}>
                  {money.format(committed)}
                </span>
                {hasBudget && (
                  <span className="text-muted-foreground block">
                    /{money.format(b.overlayValue!)}
                  </span>
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
