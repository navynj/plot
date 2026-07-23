import { formatValue } from '../format';
import { registerLayout } from '../registry';
import { bipolarDomain, scaleFrac } from '../scale';

const W = 560;
const H = 160;
const PAD = 24;

/** One series over an ordered (typically date) axis: 2px line, ≥8px markers
 *  with a surface ring, endpoint labels in text ink. The y-scale spans zero and
 *  covers negatives (mood on a signed scale), so points below zero render below
 *  the baseline but inside the viewport, never clipped at the bottom. */
registerLayout('line', ({ view }) => {
  if (view.kind !== 'aggregate') return null;
  const buckets = view.buckets;
  if (buckets.length === 0) {
    return <p className="text-muted-foreground py-4 text-sm">Nothing to aggregate yet.</p>;
  }
  const values = buckets.map((b) => b.value);
  const { lo, hi } = bipolarDomain(values);
  const max = Math.max(...values);
  const x = (i: number) =>
    buckets.length === 1 ? W / 2 : PAD + (i * (W - PAD * 2)) / (buckets.length - 1);
  const y = (v: number) => H - PAD - scaleFrac(v, lo, hi) * (H - PAD * 2);
  const zeroY = y(0); // the baseline — the bottom only when there are no negatives
  const points = buckets.map((b, i) => ({ ...b, px: x(i), py: y(b.value) }));
  const labelled = new Set([0, buckets.length - 1, buckets.findIndex((b) => b.value === max)]);

  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="line chart">
        <line x1={PAD} y1={zeroY} x2={W - PAD} y2={zeroY} className="stroke-border" />
        <polyline
          points={points.map((p) => `${p.px},${p.py}`).join(' ')}
          fill="none"
          strokeWidth="2"
          className="stroke-primary"
        />
        {points.map((p, i) => (
          <g key={p.group ?? i}>
            <circle
              cx={p.px}
              cy={p.py}
              r="4"
              className="fill-primary stroke-background"
              strokeWidth="2"
            >
              <title>{`${p.label}: ${formatValue(p.value)}`}</title>
            </circle>
            {labelled.has(i) && (
              <text
                x={p.px}
                y={p.py - 8}
                textAnchor="middle"
                className="fill-foreground text-[10px] tabular-nums"
              >
                {formatValue(p.value)}
              </text>
            )}
          </g>
        ))}
      </svg>
      <figcaption className="text-muted-foreground flex justify-between text-xs">
        <span>{points[0]?.label}</span>
        <span>{points[points.length - 1]?.label}</span>
      </figcaption>
    </figure>
  );
});
