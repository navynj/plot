'use client';

import { CornerLeftUp, Trash2, X } from 'lucide-react';
import * as React from 'react';
import { toast } from 'sonner';

import { deleteNodes, undoAction } from '@/app/triage/actions';
import { ParentPicker } from '@/components/node/ParentPicker';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

/** One-tap undo toast — the touch equivalent of Ctrl+Z. */
export function toastWithUndo(message: string) {
  toast(message, {
    action: {
      label: 'Undo',
      onClick: async () => {
        const result = await undoAction();
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
  onClear(): void;
}

/** The action bar for the primary triage surface: appears on selection with
 *  "Set parent…" (warns when moving already-placed nodes) and "Delete"
 *  (always confirms; notes the children-move-up rule). Both run through the
 *  existing triage service operations and record ONE undoable op. */
export function BulkBar({ selectedIds, parentedCount, withChildrenCount, onClear }: BulkBarProps) {
  const [confirmingDelete, setConfirmingDelete] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const count = selectedIds.length;
  if (count === 0) return null;

  const warning =
    parentedCount > 0
      ? `${parentedCount} of these already belong${parentedCount === 1 ? 's' : ''} somewhere — move ${parentedCount === 1 ? 'it' : 'them'} anyway?`
      : undefined;

  return (
    <div className="border-border bg-background sticky bottom-0 z-20 -mx-4 flex items-center gap-2 border-t px-4 py-2">
      <span className="text-sm font-medium">{count} selected</span>
      <ParentPicker
        nodeIds={selectedIds}
        warning={warning}
        onMoved={() => {
          toastWithUndo(`Moved ${count} item${count === 1 ? '' : 's'}`);
          onClear();
        }}
      >
        <Button size="sm" variant="outline">
          <CornerLeftUp className="size-3.5" /> Set parent…
        </Button>
      </ParentPicker>
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

      <Dialog open={confirmingDelete} onOpenChange={setConfirmingDelete}>
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
            <Button variant="ghost" onClick={() => setConfirmingDelete(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={deleting}
              onClick={async () => {
                setDeleting(true);
                try {
                  const result = await deleteNodes(selectedIds);
                  if (result.ok) {
                    toastWithUndo(`Deleted ${count} item${count === 1 ? '' : 's'}`);
                    onClear();
                    setConfirmingDelete(false);
                  } else {
                    toast(`delete failed: ${result.error}`);
                  }
                } finally {
                  setDeleting(false);
                }
              }}
            >
              {deleting ? 'Deleting…' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
