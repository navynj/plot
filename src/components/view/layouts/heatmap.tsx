import { formatValue } from '../format';
import { registerLayout } from '../registry';

/** Sequential intensity: ONE hue light→dark via primary at stepped opacity.
 *  Identity/value ride the title tooltip and caption — never color alone. */
registerLayout('heatmap', ({ view }) => {
  if (view.kind !== 'aggregate') return null;
  if (view.buckets.length === 0) {
    return <p className="text-muted-foreground py-4 text-sm">Nothing to aggregate yet.</p>;
  }
  const max = Math.max(...view.buckets.map((b) => b.value), 1);
  const step = (v: number) => 0.15 + 0.85 * Math.ceil((v / max) * 4) * 0.25;

  return (
    <figure>
      <div className="flex flex-wrap gap-1">
        {view.buckets.map((b) => (
          <div
            key={b.group ?? b.label}
            title={`${b.label}: ${formatValue(b.value)}`}
            className="bg-primary size-6 rounded-sm"
            style={{ opacity: b.value === 0 ? 0.08 : step(b.value) }}
          />
        ))}
      </div>
      <figcaption className="text-muted-foreground mt-1 flex items-center gap-1 text-xs">
        less
        {[0.15, 0.4, 0.65, 1].map((o) => (
          <span
            key={o}
            className="bg-primary inline-block size-2.5 rounded-xs"
            style={{ opacity: o }}
          />
        ))}
        more · {view.buckets.length} cells, max {formatValue(max)}
      </figcaption>
    </figure>
  );
});
