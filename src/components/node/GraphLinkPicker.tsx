'use client';

import { Loader2 } from 'lucide-react';
import * as React from 'react';

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

interface Candidate {
  id: string;
  title: string;
  path: string;
  icon: string | null;
}

interface GraphLinkPickerProps {
  /** loads pick targets when the dialog opens */
  loadCandidates: () => Promise<Candidate[]>;
  /** commit one pick; return ok=false with an error to show it inline */
  onPick: (id: string) => Promise<{ ok: boolean; error?: string }>;
  /** single-select (bulk "Link to…") closes on success; multi (detail "Link
   *  items") stays open so several can be added in a row */
  closeOnPick: boolean;
  title: string;
  placeholder: string;
  /** fires after each successful pick (toasts live in the caller) */
  onLinked?(id: string): void;
  children: React.ReactNode;
}

/** Reference graph link (A4) via the same command-palette grammar as the
 *  parent/collection pickers — tap-commit, so serial-gated and inert while a
 *  link settles. Used both ways: link selected nodes INTO a target, or add
 *  members TO a node. */
export function GraphLinkPicker({
  loadCandidates,
  onPick,
  closeOnPick,
  title,
  placeholder,
  onLinked,
  children,
}: GraphLinkPickerProps) {
  const [open, setOpen] = React.useState(false);
  const [candidates, setCandidates] = React.useState<Candidate[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [query, setQuery] = React.useState('');
  const { pending, pendingKey, run } = usePendingLock();

  const onOpen = async (next: boolean) => {
    if (pending) return; // dismissal is a no-op while a link settles
    setOpen(next);
    if (next) {
      setError(null);
      setCandidates(await loadCandidates());
    }
  };

  const pick = (id: string) =>
    run(id, async () => {
      const result = await onPick(id);
      if (!result.ok) {
        setError(result.error ?? 'link failed');
        return;
      }
      setError(null);
      onLinked?.(id);
      if (closeOnPick) setOpen(false);
      else setCandidates((cs) => cs?.filter((c) => c.id !== id) ?? null); // added → drop it
    });

  return (
    <>
      <span onClick={() => onOpen(true)}>{children}</span>
      <CommandDialog open={open} onOpenChange={onOpen} title={title} description="Search a node">
        <Command>
          <CommandInput
            placeholder={placeholder}
            value={query}
            onValueChange={setQuery}
            disabled={pending}
          />
          <CommandList>
            <CommandEmpty>{candidates === null ? 'Loading…' : 'No match.'}</CommandEmpty>
            <CommandGroup>
              {(candidates ?? []).map((c) => (
                <CommandItem
                  key={c.id}
                  value={`${c.title} ${c.path}`}
                  disabled={pending}
                  onSelect={() => pick(c.id)}
                >
                  {pendingKey === c.id ? (
                    <Loader2 className="size-3.5 shrink-0 animate-spin" />
                  ) : (
                    c.icon && <span className="shrink-0">{c.icon}</span>
                  )}
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
