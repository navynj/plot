import { Inbox, Plus } from 'lucide-react';
import Link from 'next/link';

import { addRoomAction } from '@/app/actions';
import { requireUserId } from '@/app/_auth/requireUser';
import { MainFieldChips } from '@/components/node/MainFieldChips';
import { SubmitButton } from '@/components/ui/submit-button';
import { Input } from '@/components/ui/input';
import { formatFieldValue } from '@/components/view/format';
import { displayName } from '@/lib/identity';
import { getMainFieldsByNode } from '@/service/field';
import { getGridSections, getInbox } from '@/service/node';

export const dynamic = 'force-dynamic';

/** The grid home, one level down: roots as section headers, level-2 nodes as
 *  the tiles (real use lives there). Empty sections offer an inline add. The
 *  inbox tile stays muted — un-triaged is not debt. */
export default async function GridHomePage() {
  const userId = await requireUserId();
  const [sections, inbox] = await Promise.all([getGridSections(userId), getInbox(userId)]);
  // show-on-main values for every tile node (level-2), batched across sections
  const mainFields = await getMainFieldsByNode(
    userId,
    sections.flatMap((s) => s.tiles.map((t) => t.node))
  );

  return (
    <div className="flex flex-col gap-5 py-4">
      {sections.map(({ root, tiles }) => (
        <section key={root.id} className="flex flex-col gap-1">
          {/* slim level-1 section header */}
          <Link
            href={`/node/${root.id}`}
            className="text-muted-foreground hover:text-foreground text-xs font-medium tracking-wider uppercase"
          >
            {root.displayIcon && <span className="mr-1">{root.displayIcon}</span>}
            {displayName(root)}
          </Link>
          {tiles.length > 0 ? (
            // compact rows: icon · name · count on one line, flowing 2–3 wide
            <div className="grid gap-x-3 gap-y-0.5 sm:grid-cols-2 lg:grid-cols-3">
              {tiles.map(({ node, count }) => {
                const fields = (mainFields.get(node.id) ?? []).map((f) => ({
                  icon: f.icon,
                  value: formatFieldValue(f.def, f.value, f.display),
                }));
                return (
                  <Link
                    key={node.id}
                    href={`/node/${node.id}`}
                    className="hover:bg-muted/50 flex items-center gap-2 rounded-md px-2 py-1.5"
                  >
                    <span className="w-5 shrink-0 text-center">{node.displayIcon ?? '·'}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm">{displayName(node)}</span>
                      {fields.length > 0 && <MainFieldChips fields={fields} />}
                    </span>
                    <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
                      {count}
                    </span>
                  </Link>
                );
              })}
            </div>
          ) : (
            <form action={addRoomAction.bind(null, root.id)} className="flex max-w-xs gap-2 px-2">
              <Input
                name="title"
                placeholder={`Add a room to ${root.title}`}
                autoComplete="off"
                className="h-8"
              />
              <SubmitButton
                iconOnly
                variant="outline"
                size="icon"
                className="size-8"
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
        className="border-border/60 text-muted-foreground hover:bg-muted/30 flex max-w-48 items-center gap-2 rounded-md border border-dashed px-3 py-2 text-sm"
      >
        <Inbox className="size-4" />
        <span className="flex-1">Inbox</span>
        <span className="text-xs tabular-nums">{inbox.length}</span>
      </Link>
    </div>
  );
}
