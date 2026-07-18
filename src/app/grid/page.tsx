import { Inbox } from 'lucide-react';
import Link from 'next/link';

import { requireUserId } from '@/app/_auth/requireUser';
import { getGridTiles, getInbox } from '@/service/node';

export const dynamic = 'force-dynamic';

/** The top-node grid home (DESIGN §6): confirmed roots tiled as rooms you
 *  enter. The inbox tile is deliberately muted — un-triaged is not debt. */
export default async function GridHomePage() {
  const userId = await requireUserId();
  const [tiles, inbox] = await Promise.all([getGridTiles(userId), getInbox(userId)]);

  return (
    <div className="py-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {tiles.map(({ node, count }) => (
          <Link
            key={node.id}
            href={`/node/${node.id}`}
            className="border-border hover:bg-muted/50 flex aspect-square flex-col justify-between rounded-xl border p-4"
          >
            <span className="text-2xl">{node.icon ?? '·'}</span>
            <span>
              <span className="block truncate text-sm font-medium">{node.title ?? node.body}</span>
              <span className="text-muted-foreground text-xs">{count} inside</span>
            </span>
          </Link>
        ))}
        <Link
          href="/inbox"
          className="border-border/60 text-muted-foreground hover:bg-muted/30 flex aspect-square flex-col justify-between rounded-xl border border-dashed p-4"
        >
          <Inbox className="size-5" />
          <span>
            <span className="block text-sm">Inbox</span>
            <span className="text-xs">{inbox.length} unplaced</span>
          </span>
        </Link>
      </div>
      {tiles.length === 0 && (
        <p className="text-muted-foreground py-8 text-center text-sm">
          No rooms yet — confirm a node as root in triage and it appears here.
        </p>
      )}
    </div>
  );
}
