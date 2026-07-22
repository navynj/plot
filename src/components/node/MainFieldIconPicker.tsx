'use client';

import * as React from 'react';

import { MAIN_FIELD_ICON_NAMES, MainFieldIcon } from '@/components/field/mainFieldIcons';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

/** Pick the lucide icon a show-on-main field wears, from the curated set. Icons
 *  render filled where it reads well. Composes ui/ primitives only. */
export function MainFieldIconPicker({
  value,
  onChange,
}: {
  value: string | undefined;
  onChange(name: string): void;
}) {
  const [open, setOpen] = React.useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 px-2"
          aria-label="field icon"
        >
          <MainFieldIcon name={value} className="size-3.5 fill-current" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto">
        <div className="grid grid-cols-6 gap-1">
          {MAIN_FIELD_ICON_NAMES.map((name) => (
            <Button
              key={name}
              type="button"
              variant={value === name ? 'default' : 'ghost'}
              size="icon-sm"
              aria-label={name}
              onClick={() => {
                onChange(name);
                setOpen(false);
              }}
            >
              <MainFieldIcon name={name} className="size-4 fill-current" />
            </Button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
