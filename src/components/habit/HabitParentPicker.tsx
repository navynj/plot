'use client';

import * as React from 'react';

import { parentCandidates } from '@/app/triage/actions';
import type { NodeCandidate } from '@/service/candidates';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

/** Pick the tree parent a habit's generated logs belong under (which is what
 *  gives them their schema). Reuses the reparent candidate list + the same
 *  command palette as the link-scope picker. */
export function HabitParentPicker({
  label,
  onPick,
}: {
  label: string | null;
  onPick(id: string, label: string): void;
}) {
  const [open, setOpen] = React.useState(false);
  const [candidates, setCandidates] = React.useState<NodeCandidate[] | null>(null);

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next && candidates === null) void parentCandidates([]).then(setCandidates);
      }}
    >
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" className="justify-start font-normal">
          {label ?? 'Pick a target parent…'}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-0">
        <Command>
          <CommandInput placeholder="Search a node…" />
          <CommandList>
            <CommandEmpty>{candidates === null ? 'Loading…' : 'No match.'}</CommandEmpty>
            <CommandGroup heading="Logs belong under">
              {(candidates ?? []).map((c) => (
                <CommandItem
                  key={c.id}
                  value={`${c.title} ${c.path}`}
                  onSelect={() => {
                    onPick(c.id, c.title);
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
      </PopoverContent>
    </Popover>
  );
}
