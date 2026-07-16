import { requireUserId } from '@/app/_auth/requireUser';
import { NodeList } from '@/components/node/NodeList';
import { getInbox } from '@/service/node';

export const dynamic = 'force-dynamic';

/** The inbox is not a container — it is the `parentId IS NULL` slice of the
 *  timeline (DESIGN §6). Un-triaged is not debt. */
export default async function InboxPage() {
  const userId = await requireUserId();
  const nodes = await getInbox(userId);
  return (
    <section className="pb-6">
      <h1 className="mb-2 text-xs font-medium uppercase tracking-wider text-neutral-500">
        Inbox — not yet attached
      </h1>
      <NodeList nodes={nodes} emptyMessage="Inbox is empty — nothing is waiting on you." />
    </section>
  );
}
