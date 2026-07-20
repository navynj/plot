import { Inbox, Plus } from 'lucide-react';
import Link from 'next/link';

import { addRoomAction } from '@/app/actions';
import { requireUserId } from '@/app/_auth/requireUser';
import { SubmitButton } from '@/components/ui/submit-button';
import { Input } from '@/components/ui/input';
import { getGridSections, getInbox } from '@/service/node';

export const dynamic = 'force-dynamic';

/** The grid home, one level down: roots as section headers, level-2 nodes as
 *  the tiles (real use lives there). Empty sections offer an inline add. The
 *  inbox tile stays muted — un-triaged is not debt. */
export default async function GridHomePage() {
  const userId = await requireUserId();
  const [sections, inbox] = await Promise.all([getGridSections(userId), getInbox(userId)]);

  return (
    <div className="flex flex-col gap-6 py-6">
      {sections.map(({ root, tiles }) => (
        <section key={root.id}>
          <Link
            href={`/node/${root.id}`}
            className="text-muted-foreground hover:text-foreground mb-2 block text-xs font-medium tracking-wider uppercase"
          >
            {root.icon && <span className="mr-1">{root.icon}</span>}
            {root.title ?? root.body}
          </Link>
          {tiles.length > 0 ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {tiles.map(({ node, count }) => (
                <Link
                  key={node.id}
                  href={`/node/${node.id}`}
                  className="border-border hover:bg-muted/50 flex aspect-square flex-col justify-between rounded-xl border p-4"
                >
                  <span className="text-2xl">{node.icon ?? '·'}</span>
                  <span>
                    <span className="block truncate text-sm font-medium">
                      {node.title ?? node.body}
                    </span>
                    <span className="text-muted-foreground text-xs">{count} inside</span>
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <form action={addRoomAction.bind(null, root.id)} className="flex max-w-xs gap-2">
              <Input name="title" placeholder={`Add a room to ${root.title}`} autoComplete="off" />
              <SubmitButton
                iconOnly
                variant="outline"
                size="icon"
                aria-label={`add room to ${root.title}`}
              >
                <Plus className="size-4" />
              </SubmitButton>
            </form>
          )}
        </section>
      ))}

      <Link
        href="/inbox"
        className="border-border/60 text-muted-foreground hover:bg-muted/30 flex max-w-48 items-center gap-3 rounded-xl border border-dashed p-4"
      >
        <Inbox className="size-5" />
        <span>
          <span className="block text-sm">Inbox</span>
          <span className="text-xs">{inbox.length} unplaced</span>
        </span>
      </Link>
    </div>
  );
}
