import { CornerLeftUp } from 'lucide-react';
import Link from 'next/link';

import type { Node } from '@/db/schema';
import { ParentPicker } from '@/components/node/ParentPicker';
import { Button } from '@/components/ui/button';
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
        <li key={n.id} className="group flex items-center justify-between gap-2 py-2">
          <Link href={`/node/${n.id}`} className="flex-1 truncate text-sm hover:underline">
            {n.title ?? n.body}
          </Link>
          <ParentPicker nodeIds={[n.id]}>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="set parent"
              className="text-muted-foreground opacity-0 group-focus-within:opacity-100 group-hover:opacity-100"
            >
              <CornerLeftUp className="size-3.5" />
            </Button>
          </ParentPicker>
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
