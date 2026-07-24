'use client';

import { createElement } from 'react';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { LUCIDE_DEFAULT_ICON, LUCIDE_ICON_NAMES, resolveLucideIcon } from '@/lib/lucideIcon';
import { cn } from '@/lib/utils';

// a common default set shown before the user types (lucide ships ~1500 icons —
// the rest are one search away)
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
  'circle',
];

const CAP = 80;

/** Rank matches so exact then prefix hits come before mere substring hits — so
 *  searching "check" surfaces plain `check` (and `check-*`) at the top instead
 *  of burying it under `alarm-clock-check`, `badge-check`, … The input list is
 *  already alphabetical, so each group stays sorted. */
function rankMatches(query: string): string[] {
  const exact: string[] = [];
  const prefix: string[] = [];
  const substr: string[] = [];
  for (const name of LUCIDE_ICON_NAMES) {
    if (name === query) exact.push(name);
    else if (name.startsWith(query)) prefix.push(name);
    else if (name.includes(query)) substr.push(name);
  }
  return [...exact, ...prefix, ...substr];
}

/** Searchable lucide icon picker (any icon). A natively-scrollable list (not a
 *  cmdk list, whose scroll misbehaves inside a popover), capped for perf. */
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
  const matches = q === '' ? DEFAULT_SET : rankMatches(q);
  const shown = matches.slice(0, CAP);
  const more = matches.length - shown.length;

  const pick = (name: string) => {
    onChange(name);
    setOpen(false);
    setQuery('');
  };

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
      <PopoverContent
        align="start"
        // bound to the viewport space Radix leaves, so the popover never
        // collides/jitters (which ate the wheel and made the scrollbar blink)
        className="flex max-h-(--radix-popover-content-available-height) w-64 flex-col p-2"
      >
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search icons…"
          aria-label="search icons"
          autoComplete="off"
          className="mb-2 h-8 shrink-0"
        />
        {/* stop the wheel/touch reaching Radix's reposition listeners so the
            list scrolls natively (drag-only scroll = Radix was hijacking it);
            min-h-0 lets this flex child actually shrink and scroll */}
        <div
          onWheelCapture={(e) => e.stopPropagation()}
          onTouchMoveCapture={(e) => e.stopPropagation()}
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
        >
          {shown.length === 0 ? (
            <p className="text-muted-foreground py-4 text-center text-xs">No icon matches.</p>
          ) : (
            shown.map((name) => (
              <button
                key={name}
                type="button"
                onClick={() => pick(name)}
                title={name}
                className={cn(
                  'hover:bg-muted flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm',
                  current === name && 'bg-muted'
                )}
              >
                {createElement(resolveLucideIcon(name), { className: 'size-4 shrink-0' })}
                <span className="truncate">{name}</span>
              </button>
            ))
          )}
          {more > 0 && (
            <p className="text-muted-foreground px-2 py-1.5 text-xs">
              +{more} more — refine your search
            </p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
