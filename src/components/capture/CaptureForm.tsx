'use client';

import * as React from 'react';

import { capture } from '@/app/actions';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import { CaptureDateField } from './CaptureDateField';
import { CaptureTextInput } from './CaptureTextInput';

export interface CaptureChip {
  id: string;
  icon: string | null;
  title: string;
}

interface CaptureFormProps {
  /** pinned first, then level-2 rooms (service dedupes) */
  chips: CaptureChip[];
  /** navigated day ?? today, in the user's timezone — seeds the date control */
  defaultDay: string;
}

/** Raw capture with one-tap context: a chip sets the pending parent
 *  (inheriting childSchema; values never forced), the date control sets
 *  eventDate (explicit > navigated > today; ✕ = dateless). Chips and date
 *  compose independently; both reset after submit. */
export function CaptureForm({ chips, defaultDay }: CaptureFormProps) {
  const [parent, setParent] = React.useState<CaptureChip | null>(null);
  const [resetSignal, setResetSignal] = React.useState(0);
  const formRef = React.useRef<HTMLFormElement>(null);

  const hint = parent
    ? `→ ${parent.icon ?? ''} ${parent.title}`
    : 'Throw it in — organize later, or never';

  return (
    <form
      ref={formRef}
      action={async (fd) => {
        await capture(fd);
        formRef.current?.reset();
        setParent(null);
        setResetSignal((n) => n + 1);
      }}
      className="flex flex-col gap-2"
    >
      <div className="flex gap-2">
        <input type="hidden" name="parentId" value={parent?.id ?? ''} />
        <CaptureTextInput name="text" placeholder={hint} />
        <Button type="submit">Capture</Button>
      </div>
      <div className="flex items-center justify-between gap-2">
        {chips.length > 0 ? (
          <div className="no-scrollbar flex gap-1.5 overflow-x-auto">
            {chips.map((chip) => (
              <button
                key={chip.id}
                type="button"
                onClick={() => setParent((p) => (p?.id === chip.id ? null : chip))}
                className={cn(
                  'border-border text-muted-foreground shrink-0 rounded-full border px-2.5 py-0.5 text-xs whitespace-nowrap',
                  parent?.id === chip.id && 'border-primary text-foreground ring-primary/30 ring-1'
                )}
              >
                {chip.icon && <span className="mr-1">{chip.icon}</span>}
                {chip.title}
              </button>
            ))}
          </div>
        ) : (
          <span />
        )}
        <CaptureDateField key={`${defaultDay}:${resetSignal}`} defaultDay={defaultDay} />
      </div>
    </form>
  );
}
