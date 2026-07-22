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

interface OptionFieldPickerProps {
  name: string;
  value: string | undefined;
  options: string[];
  /** the field key + its schema owner (parent) — present enables "+ Add"
   *  create-in-place; absent means pick-only (no owner to append to) */
  fieldKey: string;
  schemaOwnerId?: string;
}

/** Editor for option fields (B1): the search + create-in-place picker,
 *  replacing the plain Select so a new choice can be added without leaving.
 *  Typing a value not in the list offers "+ Add", which appends it to the
 *  parent's childSchema (validated) so it persists and the value saves (the
 *  option parse rejects values that aren't declared — the append must land
 *  first). Selection lands in a hidden input; saving stays part of the one
 *  fields form. */
export function OptionFieldPicker({
  name,
  value,
  options: initialOptions,
  fieldKey,
  schemaOwnerId,
}: OptionFieldPickerProps) {
  const [open, setOpen] = React.useState(false);
  const [options, setOptions] = React.useState(initialOptions);
  const [selected, setSelected] = React.useState<string | undefined>(value);
  const [cleared, setCleared] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const { pending, run } = usePendingLock();

  const current = cleared ? '' : (selected ?? '');
  const label = current === '' ? 'Pick…' : current;
  const q = query.trim();
  const canAdd =
    schemaOwnerId !== undefined && q !== '' && !options.some((o) => o.toLowerCase() === q.toLowerCase());

  const addOption = () =>
    run('add', async () => {
      const { addOptionAction } = await import('@/app/node/[id]/actions');
      const result = await addOptionAction(schemaOwnerId!, fieldKey, q);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setOptions(result.options);
      setSelected(q);
      setCleared(false);
      setError(null);
      setOpen(false);
    });

  return (
    <div className="flex items-center gap-1">
      <input type="hidden" name={name} value={current} />
      <Button
        type="button"
        variant="outline"
        onClick={() => setOpen(true)}
        className="text-muted-foreground min-w-0 flex-1 justify-between font-normal"
      >
        <span className="truncate">{label}</span>
        <ChevronsUpDown className="size-3.5 shrink-0" />
      </Button>
      {current !== '' && (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="clear"
          onClick={() => {
            setSelected(undefined);
            setCleared(true);
          }}
        >
          <X className="size-3.5" />
        </Button>
      )}
      <CommandDialog
        open={open}
        onOpenChange={(next) => {
          if (pending) return;
          setOpen(next);
        }}
        title="Pick an option"
        description="Search or add"
      >
        <Command>
          <CommandInput
            placeholder="Search or type to add…"
            value={query}
            onValueChange={setQuery}
            disabled={pending}
          />
          <CommandList>
            <CommandEmpty>{canAdd ? 'Enter to add.' : 'No match.'}</CommandEmpty>
            <CommandGroup>
              {options.map((o) => (
                <CommandItem
                  key={o}
                  value={o}
                  disabled={pending}
                  onSelect={() => {
                    setSelected(o);
                    setCleared(false);
                    setOpen(false);
                  }}
                >
                  {o}
                </CommandItem>
              ))}
            </CommandGroup>
            {canAdd && (
              <CommandGroup heading="New">
                <CommandItem value={`${q} add-new`} disabled={pending} onSelect={addOption}>
                  {pending && <Loader2 className="size-3.5 shrink-0 animate-spin" />}
                  {pending ? 'Adding…' : `+ Add “${q}”`}
                </CommandItem>
              </CommandGroup>
            )}
          </CommandList>
        </Command>
        {error && <p className="text-destructive px-3 pb-2 text-xs">blocked: {error}</p>}
      </CommandDialog>
    </div>
  );
}
