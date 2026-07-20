'use client';

import * as React from 'react';

import { createParentNode, moveNodes, detachNodes, parentCandidates } from '@/app/triage/actions';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';

interface ParentPickerProps {
  /** one node, or a multi-selected batch — all move together */
  nodeIds: string[];
  /** shown once before the picker when the move needs a confirm (bulk moves
   *  of already-placed nodes); proceeding requires the explicit tap */
  warning?: string;
  /** fires after a successful move (bulk bar toasts undo here) */
  onMoved?(): void;
  /** the trigger element; the picker adds the dialog + search behavior */
  children: React.ReactNode;
}

/** typed service codes → words a person can act on */
const FRIENDLY: Record<string, string> = {
  CYCLE: 'that target sits inside one of the selected items — pick another',
  NODE_NOT_FOUND: 'that node no longer exists — refresh and retry',
};

/** Third input surface for triage (DESIGN §6): search a node by name (with
 *  its tree path) and pick it as the new parent. Same triage.reparent() as
 *  drag and keyboard; the node's own subtree is excluded server-side,
 *  mirroring drag's physical exclusion. */
export function ParentPicker({ nodeIds, warning, onMoved, children }: ParentPickerProps) {
  const [open, setOpen] = React.useState(false);
  const [warningConfirmed, setWarningConfirmed] = React.useState(false);
  const [candidates, setCandidates] = React.useState<
    { id: string; title: string; path: string }[] | null
  >(null);
  const [error, setError] = React.useState<string | null>(null);
  const [query, setQuery] = React.useState('');
  const [creating, setCreating] = React.useState(false);

  const onOpen = async (next: boolean) => {
    setOpen(next);
    if (next) {
      setWarningConfirmed(false);
      setCandidates(await parentCandidates(nodeIds)); // fresh per open (batch changes)
    }
  };

  const commit = async (parentId: string | null) => {
    const result =
      parentId === null ? await detachNodes(nodeIds) : await moveNodes(nodeIds, parentId);
    setError(result.ok ? null : (FRIENDLY[result.error] ?? result.error));
    if (result.ok) {
      setOpen(false);
      onMoved?.();
    }
  };

  const confirmRoot = async () => {
    const result = await moveNodes(nodeIds, null);
    setError(result.ok ? null : (FRIENDLY[result.error] ?? result.error));
    if (result.ok) {
      setOpen(false);
      onMoved?.();
    }
  };

  return (
    <>
      <span onClick={() => onOpen(true)}>{children}</span>
      <CommandDialog
        open={open}
        onOpenChange={onOpen}
        title="Set parent"
        description="Search a node"
      >
        {/* the warning gate: proceed only on an explicit confirm */}
        {warning && !warningConfirmed ? (
          <div className="flex flex-col gap-3 p-4">
            <p className="text-sm">{warning}</p>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => onOpen(false)}>
                Cancel
              </Button>
              <Button size="sm" onClick={() => setWarningConfirmed(true)}>
                Move anyway
              </Button>
            </div>
          </div>
        ) : (
          <Command>
            <CommandInput placeholder="Search a node…" value={query} onValueChange={setQuery} />
            <CommandList>
              <CommandEmpty>{candidates === null ? 'Loading…' : 'No match.'}</CommandEmpty>
              <CommandGroup heading="Place">
                <CommandItem onSelect={confirmRoot}>Root — confirmed top-level</CommandItem>
                <CommandItem onSelect={() => commit(null)}>No parent — back to inbox</CommandItem>
              </CommandGroup>
              <CommandSeparator />
              <CommandGroup heading="Under">
                {(candidates ?? []).map((c) => (
                  <CommandItem
                    key={c.id}
                    value={`${c.title} ${c.path}`}
                    onSelect={() => commit(c.id)}
                  >
                    <span className="truncate">{c.title}</span>
                    {c.path && (
                      <span className="text-muted-foreground ml-auto truncate text-xs">
                        {c.path}
                      </span>
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
              {query.trim() !== '' && (
                <CommandGroup heading="New">
                  <CommandItem
                    value={`${query} create-new`}
                    disabled={creating}
                    onSelect={async () => {
                      if (creating) return;
                      setCreating(true);
                      try {
                        const created = await createParentNode(query.trim());
                        await commit(created.id); // new node is a confirmed root
                      } finally {
                        setCreating(false);
                      }
                    }}
                  >
                    {creating ? 'Creating…' : `+ Create “${query.trim()}” and move here`}
                  </CommandItem>
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        )}
        {error && <p className="text-destructive px-3 pb-2 text-xs">blocked: {error}</p>}
      </CommandDialog>
    </>
  );
}
