'use client';

import { Loader2 } from 'lucide-react';
import * as React from 'react';

import { addCollection, collectionCandidates, createCollectionNode } from '@/app/node/[id]/actions';
import { usePendingLock } from '@/components/hooks/usePendingLock';
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';

/** Add this node to a collection (curation, DESIGN §2) — same Command pattern
 *  as the parent picker, but the commit is a graph edge: no parent, no rank,
 *  no schema is touched. Same tap-commit lock too: from tap to settle the
 *  picker is inert and dismissal is a no-op; failure re-enables inline. */
export function CollectionPicker({
  nodeId,
  children,
}: {
  nodeId: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
  const [candidates, setCandidates] = React.useState<
    { id: string; title: string; path: string }[] | null
  >(null);
  const [error, setError] = React.useState<string | null>(null);
  const [query, setQuery] = React.useState('');
  const { pending, pendingKey, run } = usePendingLock();

  const onOpen = async (next: boolean) => {
    if (pending) return; // dismissal is a no-op while an add settles
    setOpen(next);
    if (next) setCandidates(await collectionCandidates(nodeId));
  };

  const finish = (result: { ok: true } | { ok: false; error: string }) => {
    setError(result.ok ? null : result.error);
    if (result.ok) setOpen(false);
  };

  const commit = (collectionId: string) =>
    run(collectionId, async () => {
      finish(await addCollection(nodeId, collectionId));
    });

  // create + add inside ONE gated run — a nested run would be dropped
  const createAndAdd = () =>
    run('create', async () => {
      const created = await createCollectionNode(query.trim());
      finish(await addCollection(nodeId, created.id)); // new collection is a confirmed root
    });

  const spinner = (key: string) =>
    pendingKey === key ? <Loader2 className="size-3.5 shrink-0 animate-spin" /> : null;

  return (
    <>
      <span onClick={() => onOpen(true)}>{children}</span>
      <CommandDialog
        open={open}
        onOpenChange={onOpen}
        title="Add to collection"
        description="Search a node"
      >
        <Command>
          <CommandInput
            placeholder="Search a collection…"
            value={query}
            onValueChange={setQuery}
            disabled={pending}
          />
          <CommandList>
            <CommandEmpty>{candidates === null ? 'Loading…' : 'No match.'}</CommandEmpty>
            <CommandGroup heading="Add to">
              {(candidates ?? []).map((c) => (
                <CommandItem
                  key={c.id}
                  value={`${c.title} ${c.path}`}
                  disabled={pending}
                  onSelect={() => commit(c.id)}
                >
                  {spinner(c.id)}
                  <span className="truncate">{c.title}</span>
                  {c.path && (
                    <span className="text-muted-foreground ml-auto truncate text-xs">{c.path}</span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
            {query.trim() !== '' && (
              <CommandGroup heading="New">
                <CommandItem
                  value={`${query} create-new`}
                  disabled={pending}
                  onSelect={createAndAdd}
                >
                  {spinner('create')}
                  {pendingKey === 'create'
                    ? 'Creating…'
                    : `+ Create collection “${query.trim()}”`}
                </CommandItem>
              </CommandGroup>
            )}
          </CommandList>
        </Command>
        {error && <p className="text-destructive px-3 pb-2 text-xs">blocked: {error}</p>}
      </CommandDialog>
    </>
  );
}
