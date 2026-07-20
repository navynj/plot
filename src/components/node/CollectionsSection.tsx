import { Plus, X } from 'lucide-react';
import Link from 'next/link';

import type { Node } from '@/db/schema';
import { removeMembership } from '@/app/node/[id]/actions';
import { CollectionPicker } from '@/components/node/CollectionPicker';
import { Button } from '@/components/ui/button';
import { SubmitButton } from '@/components/ui/submit-button';

interface CollectionsSectionProps {
  nodeId: string;
  memberships: Node[]; // collections this node sits in
  members: Node[]; // nodes linked INTO this node (it reads as a collection)
}

/** Curation surface on node detail (DESIGN §2): membership chips + add
 *  affordance; a member list when this node collects others. Links never
 *  inherit — nothing here touches tree state. */
export function CollectionsSection({ nodeId, memberships, members }: CollectionsSectionProps) {
  return (
    <>
      <section className="flex flex-col gap-2">
        <h2 className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
          Collections
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          {memberships.map((m) => (
            <span
              key={m.id}
              className="border-border flex items-center gap-1 rounded-full border py-0.5 pr-1 pl-3 text-sm"
            >
              <Link href={`/node/${m.id}`} className="hover:underline">
                {m.title ?? m.body}
              </Link>
              <form action={removeMembership.bind(null, m.id, nodeId, nodeId)}>
                <SubmitButton
                  iconOnly
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`remove from ${m.title ?? 'collection'}`}
                >
                  <X className="size-3" />
                </SubmitButton>
              </form>
            </span>
          ))}
          <CollectionPicker nodeId={nodeId}>
            <Button variant="outline" size="sm" className="text-muted-foreground">
              <Plus className="size-3.5" /> Add to collection
            </Button>
          </CollectionPicker>
        </div>
      </section>

      {members.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
            Contains (linked)
          </h2>
          <ul className="divide-border divide-y">
            {members.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-2 py-2">
                <Link href={`/node/${m.id}`} className="flex-1 truncate text-sm hover:underline">
                  {m.title ?? m.body}
                </Link>
                <form action={removeMembership.bind(null, nodeId, m.id, nodeId)}>
                  <SubmitButton iconOnly variant="ghost" size="icon-sm" aria-label="unlink">
                    <X className="size-3.5" />
                  </SubmitButton>
                </form>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
