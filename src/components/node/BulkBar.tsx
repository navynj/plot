'use client';

import { CornerLeftUp, Link2, ListChecks, Loader2, Trash2, X } from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';
import { toast } from 'sonner';

import { deleteNodes, linkNodesTo, linkTargetCandidates } from '@/app/triage/actions';
import { usePendingLock } from '@/components/hooks/usePendingLock';
import { GraphLinkPicker } from '@/components/node/GraphLinkPicker';
import { ParentPicker } from '@/components/node/ParentPicker';
import { runUndo } from '@/components/undoRunner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

/** One-tap undo toast — the touch equivalent of Ctrl+Z. Runs through the
 *  shared undo gate: a tap that overlaps an in-flight undo (from any entry
 *  point) is dropped, never a second pop. */
export function toastWithUndo(message: string) {
  toast(message, {
    action: {
      label: 'Undo',
      onClick: async () => {
        const result = await runUndo();
        if (!result) return; // gate dropped an overlapping tap — one is applying
        toast(result.ok ? (result.description ?? 'undone') : 'nothing to undo');
      },
    },
  });
}

interface BulkBarProps {
  selectedIds: string[];
  /** how many of the selected already have a tree parent */
  parentedCount: number;
  /** how many of the selected have live children */
  withChildrenCount: number;
  /** false on the children-list surface: everything selected belongs to the
   *  room by definition, so moving is unambiguously intentional — warning on
   *  every use would be noise */
  warnOnMove?: boolean;
  onClear(): void;
}

/** The action bar for the primary triage surface: appears on selection with
 *  "Set parent…" (warns when moving already-placed nodes) and "Delete"
 *  (always confirms; notes the children-move-up rule). Both run through the
 *  existing triage service operations and record ONE undoable op. */
export function BulkBar({
  selectedIds,
  parentedCount,
  withChildrenCount,
  warnOnMove = true,
  onClear,
}: BulkBarProps) {
  const [confirmingDelete, setConfirmingDelete] = React.useState(false);
  const { pending: deleting, run: runDelete } = usePendingLock();
  const count = selectedIds.length;
  if (count === 0) return null;

  const warning =
    warnOnMove && parentedCount > 0
      ? `${parentedCount} of these already belong${parentedCount === 1 ? 's' : ''} somewhere — move ${parentedCount === 1 ? 'it' : 'them'} anyway?`
      : undefined;

  return (
    <div className="border-border bg-background sticky bottom-0 z-20 -mx-4 flex items-center gap-2 border-t px-4 py-2">
      <span className="text-sm font-medium">{count} selected</span>
      <ParentPicker
        nodeIds={selectedIds}
        warning={warning}
        // selection SURVIVES a move (rows that left the surface prune
        // automatically) so parenting chains straight into "Fill fields"
        onMoved={() => toastWithUndo(`Moved ${count} item${count === 1 ? '' : 's'}`)}
      >
        <Button size="sm" variant="outline">
          <CornerLeftUp className="size-3.5" /> Set parent…
        </Button>
      </ParentPicker>
      {/* second queue source for the field walk: these ids, in displayed
          order, carried entirely in the URL (nothing persists) */}
      <Button size="sm" variant="outline" asChild>
        <Link href={`/triage/fields?ids=${selectedIds.join(',')}`}>
          <ListChecks className="size-3.5" /> Fill fields
        </Link>
      </Button>
      {/* A4 reference link: link the selected as members of one target (e.g.
          same-receipt expenses under a Tax line). Graph link — no move. */}
      <GraphLinkPicker
        loadCandidates={() => linkTargetCandidates(selectedIds)}
        onPick={(targetId) => linkNodesTo(selectedIds, targetId)}
        closeOnPick
        title="Link to"
        placeholder="Search a node to link into…"
        onLinked={() => {
          toast(`Linked ${count} item${count === 1 ? '' : 's'}`);
          onClear();
        }}
      >
        <Button size="sm" variant="outline">
          <Link2 className="size-3.5" /> Link to…
        </Button>
      </GraphLinkPicker>
      <Button size="sm" variant="outline" onClick={() => setConfirmingDelete(true)}>
        <Trash2 className="size-3.5" /> Delete
      </Button>
      <Button
        size="sm"
        variant="ghost"
        className="ml-auto"
        onClick={onClear}
        aria-label="clear selection"
      >
        <X className="size-3.5" />
      </Button>

      <Dialog
        open={confirmingDelete}
        // dismissal (overlay, Escape) is a no-op while the delete settles
        onOpenChange={(next) => {
          if (deleting && !next) return;
          setConfirmingDelete(next);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Delete {count} item{count === 1 ? '' : 's'}?
            </DialogTitle>
            <DialogDescription>
              {withChildrenCount > 0 &&
                `${withChildrenCount} of them ${withChildrenCount === 1 ? 'has' : 'have'} children — those move up one level, they aren't deleted. `}
              Collection links to the deleted items are removed. Are you sure?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" disabled={deleting} onClick={() => setConfirmingDelete(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={deleting}
              onClick={() =>
                runDelete('delete', async () => {
                  const result = await deleteNodes(selectedIds);
                  if (result.ok) {
                    toastWithUndo(`Deleted ${count} item${count === 1 ? '' : 's'}`);
                    onClear();
                    setConfirmingDelete(false);
                  } else {
                    toast(`delete failed: ${result.error}`);
                  }
                })
              }
            >
              {deleting && <Loader2 className="size-3.5 animate-spin" />}
              {deleting ? 'Deleting…' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
