'use client';

import * as React from 'react';

import { createParentNode, moveNodes, detachNodes, parentCandidates } from '@/app/triage/actions';
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
  /** the trigger element; the picker adds the dialog + search behavior */
  children: React.ReactNode;
}

/** Third input surface for triage (DESIGN §6): search a node by name (with
 *  its tree path) and pick it as the new parent. Same triage.reparent() as
 *  drag and keyboard; the node's own subtree is excluded server-side,
 *  mirroring drag's physical exclusion. */
export function ParentPicker({ nodeIds, children }: ParentPickerProps) {
  const [open, setOpen] = React.useState(false);
  const [candidates, setCandidates] = React.useState<
    { id: string; title: string; path: string }[] | null
  >(null);
  const [error, setError] = React.useState<string | null>(null);
  const [query, setQuery] = React.useState('');
  const [creating, setCreating] = React.useState(false);

  const onOpen = async (next: boolean) => {
    setOpen(next);
    if (next && candidates === null) {
      setCandidates(await parentCandidates(nodeIds));
    }
  };

  const commit = async (parentId: string | null) => {
    const result =
      parentId === null ? await detachNodes(nodeIds) : await moveNodes(nodeIds, parentId);
    setError(result.ok ? null : result.error);
    if (result.ok) setOpen(false);
  };

  const confirmRoot = async () => {
    const result = await moveNodes(nodeIds, null);
    setError(result.ok ? null : result.error);
    if (result.ok) setOpen(false);
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
        {/* this shadcn variant's CommandDialog does NOT wrap children in a
            Command root — cmdk's Input crashes without one */}
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
                    <span className="text-muted-foreground ml-auto truncate text-xs">{c.path}</span>
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
        {error && <p className="text-destructive px-3 pb-2 text-xs">blocked: {error}</p>}
      </CommandDialog>
    </>
  );
}
