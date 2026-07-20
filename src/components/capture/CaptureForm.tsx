'use client';

import * as React from 'react';

import { capture } from '@/app/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export interface CaptureChip {
  id: string;
  icon: string | null;
  title: string;
}

interface CaptureFormProps {
  /** pinned first, then level-2 rooms (service dedupes) */
  chips: CaptureChip[];
  /** the viewed day ('' / today = no stamping) — the temporal context */
  day?: string;
}

/** Raw capture, one text box — now with one-tap context: a chip sets the
 *  pending capture's parent (inheriting childSchema; values never forced),
 *  the viewed day sets its eventDate. No chip = raw to inbox, unchanged. */
export function CaptureForm({ chips, day }: CaptureFormProps) {
  const [parent, setParent] = React.useState<CaptureChip | null>(null);
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
        setParent(null); // chip resets after submit
      }}
      className="flex flex-col gap-2"
    >
      <div className="flex gap-2">
        <input type="hidden" name="parentId" value={parent?.id ?? ''} />
        <input type="hidden" name="day" value={day ?? ''} />
        <Input type="text" name="text" placeholder={hint} autoComplete="off" />
        <Button type="submit">Capture</Button>
      </div>
      {chips.length > 0 && (
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
      )}
    </form>
  );
}
