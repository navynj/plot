import { requireUserId } from '@/app/_auth/requireUser';
import { NodeList } from '@/components/node/NodeList';
import { ScrollAnchor } from '@/components/ui/scroll-anchor';
import { getInbox } from '@/service/node';

export const dynamic = 'force-dynamic';

/** The inbox is not a container — it is the `parentId IS NULL` slice of the
 *  timeline (DESIGN §6). Same chat ordering and anchoring as the timeline. */
export default async function InboxPage() {
  const userId = await requireUserId();
  const nodes = await getInbox(userId);
  return (
    <ScrollAnchor className="min-h-0 flex-1 py-4">
      <h1 className="text-muted-foreground mb-2 text-xs font-medium tracking-wider uppercase">
        Inbox — not yet attached
      </h1>
      <NodeList nodes={nodes} emptyMessage="Inbox is empty — nothing is waiting on you." />
    </ScrollAnchor>
  );
}
