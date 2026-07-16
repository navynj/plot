import type { Node } from '@/db/schema';
import { formatTimestamp } from '@/lib/formatTimestamp';

interface NodeListProps {
  nodes: Node[];
  emptyMessage: string;
}

export function NodeList({ nodes, emptyMessage }: NodeListProps) {
  if (nodes.length === 0) {
    return <p className="py-8 text-center text-sm text-neutral-500">{emptyMessage}</p>;
  }
  return (
    <ul className="divide-y divide-neutral-200 dark:divide-neutral-800">
      {nodes.map((n) => (
        <li key={n.id} className="flex items-baseline justify-between gap-4 py-3">
          <span className="text-sm">{n.title ?? n.body}</span>
          <time dateTime={n.capturedAt.toISOString()} className="shrink-0 text-xs text-neutral-500">
            {formatTimestamp(n.capturedAt)}
          </time>
        </li>
      ))}
    </ul>
  );
}
