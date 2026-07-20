'use client';

import { Loader2 } from 'lucide-react';
import * as React from 'react';

import { createParentNode, moveNodes, detachNodes, parentCandidates } from '@/app/triage/actions';
import { usePendingLock } from '@/components/hooks/usePendingLock';
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
 *  mirroring drag's physical exclusion.
 *
 *  The commit point is a TAP, not a form submit — so from tap to settle the
 *  whole picker locks (items inert, search inert, dismissal a no-op, the
 *  tapped item spinning): a 20-node move is slower than any single submit,
 *  and a second tap in that dead zone must not become a second move. Failure
 *  re-enables everything with the error inline. */
export function ParentPicker({ nodeIds, warning, onMoved, children }: ParentPickerProps) {
  const [open, setOpen] = React.useState(false);
  const [warningConfirmed, setWarningConfirmed] = React.useState(false);
  const [candidates, setCandidates] = React.useState<
    { id: string; title: string; path: string; icon: string | null }[] | null
  >(null);
  const [error, setError] = React.useState<string | null>(null);
  const [query, setQuery] = React.useState('');
  const { pending, pendingKey, run } = usePendingLock();

  const onOpen = async (next: boolean) => {
    if (pending) return; // dismissal is a no-op while a move settles
    setOpen(next);
    if (next) {
      setWarningConfirmed(false);
      setCandidates(await parentCandidates(nodeIds)); // fresh per open (batch changes)
    }
  };

  const finish = (result: { ok: true } | { ok: false; error: string }) => {
    setError(result.ok ? null : (FRIENDLY[result.error] ?? result.error));
    if (result.ok) {
      setOpen(false);
      onMoved?.();
    }
  };

  const commit = (key: string, parentId: string | null) =>
    run(key, async () => {
      finish(parentId === null ? await detachNodes(nodeIds) : await moveNodes(nodeIds, parentId));
    });

  const confirmRoot = () =>
    run('root', async () => {
      finish(await moveNodes(nodeIds, null));
    });

  // create + move inside ONE gated run — nesting a second run would be
  // dropped by the very gate that protects us
  const createAndMove = () =>
    run('create', async () => {
      const created = await createParentNode(query.trim());
      finish(await moveNodes(nodeIds, created.id)); // new node is a confirmed root
    });

  const spinner = (key: string) =>
    pendingKey === key ? <Loader2 className="size-3.5 shrink-0 animate-spin" /> : null;

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
            <CommandInput
              placeholder="Search a node…"
              value={query}
              onValueChange={setQuery}
              disabled={pending}
            />
            <CommandList>
              <CommandEmpty>{candidates === null ? 'Loading…' : 'No match.'}</CommandEmpty>
              <CommandGroup heading="Place">
                <CommandItem disabled={pending} onSelect={confirmRoot}>
                  {spinner('root')}
                  Root — confirmed top-level
                </CommandItem>
                <CommandItem disabled={pending} onSelect={() => commit('inbox', null)}>
                  {spinner('inbox')}
                  No parent — back to inbox
                </CommandItem>
              </CommandGroup>
              <CommandSeparator />
              <CommandGroup heading="Under">
                {(candidates ?? []).map((c) => (
                  <CommandItem
                    key={c.id}
                    value={`${c.title} ${c.path}`}
                    disabled={pending}
                    onSelect={() => commit(c.id, c.id)}
                  >
                    {spinner(c.id)}
                    {c.icon && <span className="shrink-0">{c.icon}</span>}
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
                    disabled={pending}
                    onSelect={createAndMove}
                  >
                    {spinner('create')}
                    {pendingKey === 'create'
                      ? 'Creating…'
                      : `+ Create “${query.trim()}” and move here`}
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
