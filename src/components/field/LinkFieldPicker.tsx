'use client';

import { ChevronsUpDown, X } from 'lucide-react';
import * as React from 'react';

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
}

/** Editor for link-type fields: a searchable picker scoped to the declared
 *  target parent's children (unscoped when the def declares none). Selection
 *  lands in a hidden input — saving stays part of the one fields form. */
export function LinkFieldPicker({ name, scopeParentId, value }: LinkFieldPickerProps) {
  const [open, setOpen] = React.useState(false);
  const [candidates, setCandidates] = React.useState<
    { id: string; title: string; path: string }[] | null
  >(null);
  const [selected, setSelected] = React.useState<{ id: string; title: string } | null>(null);
  const [cleared, setCleared] = React.useState(false);

  const currentId = cleared ? '' : (selected?.id ?? value ?? '');
  const label =
    selected?.title ??
    (cleared || !value
      ? 'Pick a node…'
      : (candidates?.find((c) => c.id === value)?.title ?? value));

  const onOpen = async (next: boolean) => {
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
          <CommandInput placeholder="Search…" />
          <CommandList>
            <CommandEmpty>{candidates === null ? 'Loading…' : 'No candidates.'}</CommandEmpty>
            <CommandGroup>
              {(candidates ?? []).map((c) => (
                <CommandItem
                  key={c.id}
                  value={`${c.title} ${c.path}`}
                  onSelect={() => {
                    setSelected({ id: c.id, title: c.title });
                    setCleared(false);
                    setOpen(false);
                  }}
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
      </CommandDialog>
    </div>
  );
}
