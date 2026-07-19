'use client';

import * as React from 'react';

import { addCollection, collectionCandidates, createCollectionNode } from '@/app/node/[id]/actions';
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
 *  no schema is touched. */
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

  const onOpen = async (next: boolean) => {
    setOpen(next);
    if (next) setCandidates(await collectionCandidates(nodeId));
  };

  const commit = async (collectionId: string) => {
    const result = await addCollection(nodeId, collectionId);
    setError(result.ok ? null : result.error);
    if (result.ok) setOpen(false);
  };

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
          <CommandInput placeholder="Search a collection…" value={query} onValueChange={setQuery} />
          <CommandList>
            <CommandEmpty>{candidates === null ? 'Loading…' : 'No match.'}</CommandEmpty>
            <CommandGroup heading="Add to">
              {(candidates ?? []).map((c) => (
                <CommandItem
                  key={c.id}
                  value={`${c.title} ${c.path}`}
                  onSelect={() => commit(c.id)}
                >
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
                  onSelect={async () => {
                    const created = await createCollectionNode(query.trim());
                    await commit(created.id); // new collection is a confirmed root
                  }}
                >
                  + Create collection “{query.trim()}”
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
