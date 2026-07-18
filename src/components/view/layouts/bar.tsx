import { formatValue } from '../format';
import { registerLayout } from '../registry';

/** Horizontal bars, one row per group. The overlay (e.g. a budget line) is a
 *  reference tick in foreground ink — not a second series. The §8a pending
 *  split (scheduled) renders as a hatched-opacity segment stacked after the
 *  solid actual, separated by a 2px surface gap. Over-overlay rows switch to
 *  the status color AND say "over" in text — never color alone. */
registerLayout('bar', ({ view }) => {
  if (view.kind !== 'aggregate') return null;
  if (view.buckets.length === 0) {
    return <p className="text-muted-foreground py-4 text-sm">Nothing to aggregate yet.</p>;
  }
  const max = Math.max(
    ...view.buckets.map((b) => Math.max(b.value + (b.pendingValue ?? 0), b.overlayValue ?? 0)),
    1
  );
  const pct = (v: number) => `${Math.max(0, Math.min(100, (v / max) * 100))}%`;
  const hasPending = view.buckets.some((b) => (b.pendingValue ?? 0) > 0);

  return (
    <div className="flex flex-col gap-2">
      {view.buckets.map((b) => {
        const pending = b.pendingValue ?? 0;
        const committed = b.value + pending;
        const over = b.overlayValue !== null && committed > b.overlayValue;
        return (
          <div
            key={b.group ?? '(total)'}
            className="grid grid-cols-[7rem_1fr_auto] items-center gap-3"
          >
            <span className="text-muted-foreground truncate text-right text-sm" title={b.label}>
              {b.label}
            </span>
            <div
              className="bg-muted relative h-4 rounded-sm"
              title={
                b.overlayValue !== null
                  ? `${b.label}: ${formatValue(b.value)}${pending > 0 ? ` + ${formatValue(pending)} pending` : ''} of ${formatValue(b.overlayValue)}`
                  : `${b.label}: ${formatValue(b.value)} (${b.count})`
              }
            >
              <div
                className={`absolute inset-y-0 left-0 rounded-r-sm ${over ? 'bg-destructive' : 'bg-primary'}`}
                style={{ width: pct(b.value) }}
              />
              {pending > 0 && (
                <div
                  className={`border-background absolute inset-y-0 rounded-r-sm border-l-2 opacity-40 ${over ? 'bg-destructive' : 'bg-primary'}`}
                  style={{ left: pct(b.value), width: pct(pending) }}
                />
              )}
              {b.overlayValue !== null && (
                <div
                  className="bg-foreground absolute inset-y-0 w-0.5"
                  style={{ left: pct(b.overlayValue) }}
                  aria-hidden
                />
              )}
            </div>
            <span className="text-sm tabular-nums">
              {formatValue(b.value)}
              {pending > 0 && (
                <span className="text-muted-foreground"> +{formatValue(pending)}</span>
              )}
              {b.overlayValue !== null && (
                <span className="text-muted-foreground"> / {formatValue(b.overlayValue)}</span>
              )}
              {over && <span className="text-destructive text-xs font-medium"> over</span>}
            </span>
          </div>
        );
      })}
      {view.hasOverlay && (
        <p className="text-muted-foreground text-xs">
          solid = actual{hasPending && ' · faded = pending'} · tick = {view.spec.overlayOwnField}
        </p>
      )}
    </div>
  );
});
