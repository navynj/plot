import Link from 'next/link';

import { formatLens } from '../format';
import { registerLayout } from '../registry';

registerLayout('grid', ({ view }) => {
  if (view.kind !== 'items') return null;
  if (view.items.length === 0) {
    return <p className="text-muted-foreground py-4 text-sm">Nothing to show.</p>;
  }
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {view.items.map((item) => (
        <Link
          key={item.id}
          href={`/node/${item.id}`}
          className="border-border hover:bg-muted/50 flex flex-col gap-1 rounded-lg border p-3"
        >
          <span className="truncate text-sm font-medium">{item.label}</span>
          {item.lensValue !== null && (
            <span className="text-muted-foreground text-xs tabular-nums">
              {formatLens(item.lensValue)}
            </span>
          )}
        </Link>
      ))}
    </div>
  );
});
