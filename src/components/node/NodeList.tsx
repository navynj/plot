import Link from 'next/link';

import type { Node } from '@/db/schema';
import { formatTimestamp } from '@/lib/formatTimestamp';

interface NodeListProps {
  nodes: Node[];
  emptyMessage: string;
}

export function NodeList({ nodes, emptyMessage }: NodeListProps) {
  if (nodes.length === 0) {
    return <p className="text-muted-foreground py-8 text-center text-sm">{emptyMessage}</p>;
  }
  return (
    <ul className="divide-border divide-y">
      {nodes.map((n) => (
        <li key={n.id} className="flex items-baseline justify-between gap-4 py-3">
          <Link href={`/node/${n.id}`} className="text-sm hover:underline">
            {n.title ?? n.body}
          </Link>
          <time
            dateTime={n.capturedAt.toISOString()}
            className="text-muted-foreground shrink-0 text-xs"
          >
            {formatTimestamp(n.capturedAt)}
          </time>
        </li>
      ))}
    </ul>
  );
}
