'use client';

import * as React from 'react';

import { moveNodes, detachNodes, parentCandidates } from '@/app/triage/actions';
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
  nodeId: string;
  /** the trigger element; the picker adds the dialog + search behavior */
  children: React.ReactNode;
}

/** Third input surface for triage (DESIGN §6): search a node by name (with
 *  its tree path) and pick it as the new parent. Same triage.reparent() as
 *  drag and keyboard; the node's own subtree is excluded server-side,
 *  mirroring drag's physical exclusion. */
export function ParentPicker({ nodeId, children }: ParentPickerProps) {
  const [open, setOpen] = React.useState(false);
  const [candidates, setCandidates] = React.useState<
    { id: string; title: string; path: string }[] | null
  >(null);
  const [error, setError] = React.useState<string | null>(null);

  const onOpen = async (next: boolean) => {
    setOpen(next);
    if (next && candidates === null) {
      setCandidates(await parentCandidates(nodeId));
    }
  };

  const commit = async (parentId: string | null) => {
    const result =
      parentId === null ? await detachNodes([nodeId]) : await moveNodes([nodeId], parentId);
    setError(result.ok ? null : result.error);
    if (result.ok) setOpen(false);
  };

  const confirmRoot = async () => {
    const result = await moveNodes([nodeId], null);
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
          <CommandInput placeholder="Search a node…" />
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
          </CommandList>
        </Command>
        {error && <p className="text-destructive px-3 pb-2 text-xs">blocked: {error}</p>}
      </CommandDialog>
    </>
  );
}
