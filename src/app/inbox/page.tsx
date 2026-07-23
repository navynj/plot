import Link from 'next/link';

import { requireUserId } from '@/app/_auth/requireUser';
import { SelectableList } from '@/components/node/SelectableList';
import { ScrollAnchor } from '@/components/ui/scroll-anchor';
import { mainFieldChip } from '@/components/view/format';
import { formatTimestamp } from '@/lib/formatTimestamp';
import { displayName } from '@/lib/identity';
import { getMainFieldsByNode } from '@/service/field';
import { getInbox, nodeChildCounts } from '@/service/node';

export const dynamic = 'force-dynamic';

/** The inbox is not a container — it is the parentId IS NULL slice of the
 *  timeline (DESIGN §6). Bulk actions are the primary triage surface; the
 *  drag board stays dormant behind the low-key link below. */
export default async function InboxPage() {
  const userId = await requireUserId();
  const nodes = await getInbox(userId);
  const [childCounts, mainFields] = await Promise.all([
    nodeChildCounts(
      userId,
      nodes.map((n) => n.id)
    ),
    getMainFieldsByNode(userId, nodes),
  ]);

  return (
    <ScrollAnchor className="min-h-0 flex-1 py-4">
      <h1 className="text-muted-foreground mb-2 text-xs font-medium tracking-wider uppercase">
        Inbox — not yet attached
      </h1>
      {nodes.length === 0 ? (
        <p className="text-muted-foreground py-8 text-center text-sm">
          Inbox is empty — nothing is waiting on you.
        </p>
      ) : (
        <SelectableList
          groups={[
            {
              key: 'inbox',
              header: null,
              rows: nodes.map((n) => ({
                id: n.id,
                label: displayName(n),
                icon: n.displayIcon ?? null,
                time: formatTimestamp(n.capturedAt),
                parented: false,
                childCount: childCounts.get(n.id) ?? 0,
                fields: (mainFields.get(n.id) ?? []).map((f) =>
                  mainFieldChip(f.def, f.value, f.display, f.icon)
                ),
              })),
            },
          ]}
        />
      )}
      <p className="mt-8 text-right">
        <Link href="/triage" className="text-muted-foreground text-xs hover:underline">
          drag board →
        </Link>
      </p>
    </ScrollAnchor>
  );
}
