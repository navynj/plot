import Link from 'next/link';

import { formatTimestamp } from '@/lib/formatTimestamp';

import { formatLens } from '../format';
import { registerLayout } from '../registry';

registerLayout('list', ({ view, tz }) => {
  if (view.kind !== 'items') return null;
  if (view.items.length === 0) {
    return <p className="text-muted-foreground py-4 text-sm">Nothing to show.</p>;
  }
  return (
    <ul className="divide-border divide-y">
      {view.items.map((item) => (
        <li key={item.id} className="flex items-baseline justify-between gap-3 py-2">
          <Link href={`/node/${item.id}`} className="flex-1 truncate text-sm hover:underline">
            {item.label}
          </Link>
          {item.lensValue !== null && (
            <span className="text-sm tabular-nums">{formatLens(item.lensValue)}</span>
          )}
          <time className="text-muted-foreground shrink-0 text-xs">
            {formatTimestamp(item.capturedAt, tz)}
          </time>
        </li>
      ))}
    </ul>
  );
});
