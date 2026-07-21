'use client';

import { Link2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { toast } from 'sonner';

import { linkItem, memberCandidates } from '@/app/node/[id]/actions';
import { GraphLinkPicker } from '@/components/node/GraphLinkPicker';
import { Button } from '@/components/ui/button';

/** "Link receipt items" (A4) on a node's detail: add other nodes as graph
 *  members of THIS node (a Tax line collecting the same-receipt expenses).
 *  Multi: the picker stays open so several can be added; each render both
 *  ways. */
export function LinkItemsButton({ nodeId }: { nodeId: string }) {
  const router = useRouter();
  return (
    <GraphLinkPicker
      loadCandidates={() => memberCandidates(nodeId)}
      onPick={(memberId) => linkItem(nodeId, memberId)}
      closeOnPick={false}
      title="Link items"
      placeholder="Search an item to link…"
      onLinked={() => {
        toast('Linked');
        router.refresh(); // reflect the new member list
      }}
    >
      <Button variant="outline" size="sm" className="text-muted-foreground">
        <Link2 className="size-3.5" /> Link items
      </Button>
    </GraphLinkPicker>
  );
}
