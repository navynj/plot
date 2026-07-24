'use client';

import { createElement } from 'react';
import * as React from 'react';

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
import {
  LUCIDE_DEFAULT_ICON,
  LUCIDE_ICON_NAMES,
  isKnownLucideIcon,
  resolveLucideIcon,
} from '@/lib/lucideIcon';

// every renderable lucide name (kebab), from the SAME `icons` source the
// resolver uses — so search can never be empty while the default set shows
const ALL_NAMES = LUCIDE_ICON_NAMES;

// a common default set shown before the user types (lucide ships ~1500 icons —
// we never render them all)
const DEFAULT_SET = [
  'list',
  'clock',
  'timer',
  'calendar',
  'hash',
  'tag',
  'dollar-sign',
  'map-pin',
  'star',
  'heart',
  'flag',
  'moon',
  'sun',
  'activity',
  'music',
  'book-open',
  'zap',
  'droplet',
  'ruler',
  'gauge',
  'bell',
  'bookmark',
  'check',
  'square-check',
  'circle-check',
  'list-todo',
  'list-checks',
  'circle',
].filter(isKnownLucideIcon);

const CAP = 60;

/** Searchable lucide icon picker (any icon, not a curated set). Trigger shows
 *  the current icon; opening it searches names and renders the matching icons.
 *  Results are capped ({@link CAP}) — lucide's full set is never mounted. */
export function LucideIconPicker({
  value,
  onChange,
  defaultName = LUCIDE_DEFAULT_ICON,
}: {
  value: string | null;
  onChange(name: string): void;
  defaultName?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const current = value ?? defaultName;

  const q = query.trim().toLowerCase();
  const matches = q === '' ? DEFAULT_SET : ALL_NAMES.filter((n) => n.includes(q));
  const shown = matches.slice(0, CAP);
  const more = matches.length - shown.length;

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setQuery('');
      }}
    >
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="h-7 px-2" aria-label="field icon">
          {createElement(resolveLucideIcon(current), { className: 'size-3.5' })}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-0">
        {/* self-filtered: we control the query and cap results, so cmdk's own
            filtering (which would mount every item) stays off */}
        <Command shouldFilter={false}>
          <CommandInput placeholder="Search icons…" value={query} onValueChange={setQuery} />
          <CommandList>
            <CommandEmpty>No icon matches.</CommandEmpty>
            <CommandGroup>
              {shown.map((name) => (
                <CommandItem
                  key={name}
                  value={name}
                  onSelect={() => {
                    onChange(name);
                    setOpen(false);
                    setQuery('');
                  }}
                >
                  {createElement(resolveLucideIcon(name), { className: 'size-4' })}
                  <span className="truncate">{name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
            {more > 0 && (
              <p className="text-muted-foreground px-3 py-1.5 text-xs">
                +{more} more — refine your search
              </p>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
