'use client';

import { ChevronsUpDown, Loader2, X } from 'lucide-react';
import * as React from 'react';

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
} from '@/components/ui/command';

interface LinkFieldPickerProps {
  name: string;
  /** children of this node are the only legal targets (FieldDef.linkTargetParentId) */
  scopeParentId: string | null;
  value: string | undefined;
  /** server-resolved icon+title of the current target — never show a raw id */
  display?: string;
}

/** Editor for link-type fields: a searchable picker scoped to the declared
 *  target parent's children (unscoped when the def declares none). Selection
 *  lands in a hidden input — saving stays part of the one fields form. */
export function LinkFieldPicker({ name, scopeParentId, value, display }: LinkFieldPickerProps) {
  const [open, setOpen] = React.useState(false);
  const [candidates, setCandidates] = React.useState<
    { id: string; title: string; path: string; icon: string | null }[] | null
  >(null);
  const [selected, setSelected] = React.useState<{ id: string; title: string } | null>(null);
  const [query, setQuery] = React.useState('');
  const [cleared, setCleared] = React.useState(false);
  // picking a candidate is LOCAL state (the fields form saves it later) — only
  // create-in-place hits the server, so only it needs the tap-commit lock
  const { pending, pendingKey, run } = usePendingLock();

  const currentId = cleared ? '' : (selected?.id ?? value ?? '');
  const label =
    selected?.title ??
    (cleared || !value
      ? 'Pick a node…'
      : (display ?? candidates?.find((c) => c.id === value)?.title ?? value));

  const onOpen = async (next: boolean) => {
    if (pending) return; // dismissal is a no-op while a create settles
    setOpen(next);
    if (next && candidates === null) {
      // lazy import: keeps the field-type registry importable outside Next
      // (the actions module pulls in the auth stack)
      const { linkCandidates } = await import('@/app/node/[id]/actions');
      setCandidates(await linkCandidates(scopeParentId));
    }
  };

  return (
    <div className="flex items-center gap-1">
      <input type="hidden" name={name} value={currentId} />
      <Button
        type="button"
        variant="outline"
        onClick={() => onOpen(true)}
        className="text-muted-foreground min-w-0 flex-1 justify-between font-normal"
      >
        <span className="truncate">{label}</span>
        <ChevronsUpDown className="size-3.5 shrink-0" />
      </Button>
      {currentId !== '' && (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="clear"
          onClick={() => {
            setSelected(null);
            setCleared(true);
          }}
        >
          <X className="size-3.5" />
        </Button>
      )}
      <CommandDialog open={open} onOpenChange={onOpen} title="Pick a node" description="Search">
        <Command>
          <CommandInput
            placeholder="Search…"
            value={query}
            onValueChange={setQuery}
            disabled={pending}
          />
          <CommandList>
            <CommandEmpty>{candidates === null ? 'Loading…' : 'No candidates.'}</CommandEmpty>
            <CommandGroup>
              {(candidates ?? []).map((c) => (
                <CommandItem
                  key={c.id}
                  value={`${c.title} ${c.path}`}
                  disabled={pending}
                  onSelect={() => {
                    setSelected({ id: c.id, title: c.title });
                    setCleared(false);
                    setOpen(false);
                  }}
                >
                  {c.icon && <span className="shrink-0">{c.icon}</span>}
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
                  onSelect={() =>
                    run('create', async () => {
                      const { createLinkTargetNode } = await import('@/app/node/[id]/actions');
                      const created = await createLinkTargetNode(query.trim(), scopeParentId);
                      setSelected(created); // created inside the scope → a valid candidate
                      setCandidates(null); // refresh on next open
                      setCleared(false);
                      setOpen(false);
                    })
                  }
                >
                  {pendingKey === 'create' && (
                    <Loader2 className="size-3.5 shrink-0 animate-spin" />
                  )}
                  {pendingKey === 'create'
                    ? 'Creating…'
                    : `+ Create “${query.trim()}”${scopeParentId ? ' in scope' : ''}`}
                </CommandItem>
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </CommandDialog>
    </div>
  );
}
