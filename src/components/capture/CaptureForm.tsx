'use client';

import * as React from 'react';

import { capture } from '@/app/actions';
import type { FieldDef } from '@/db/schema';
import { SubmitButton } from '@/components/ui/submit-button';
import { cn } from '@/lib/utils';

import { CaptureDateField } from './CaptureDateField';
import { CaptureFields } from './CaptureFields';
import { CaptureTitleBody } from './CaptureTitleBody';

export interface CaptureChip {
  id: string;
  icon: string | null;
  title: string;
  /** the room's childSchema — its fields render inline on selection (B1) */
  childSchema: FieldDef[];
}

interface CaptureFormProps {
  /** pinned first, then level-2 rooms (service dedupes) */
  chips: CaptureChip[];
  /** navigated day ?? today, in the user's timezone — seeds the date control */
  defaultDay: string;
}

const EMPTY: FieldDef[] = [];

/** Raw capture with one-tap context: a chip sets the pending parent
 *  (inheriting childSchema; values never forced) and, if that room declares
 *  fields, renders them inline (optional). The date control sets eventDate
 *  (explicit > navigated > today; ✕ = dateless). All reset after submit. */
export function CaptureForm({ chips, defaultDay }: CaptureFormProps) {
  const [parent, setParent] = React.useState<CaptureChip | null>(null);
  const [resetSignal, setResetSignal] = React.useState(0);
  const [error, setError] = React.useState<string | null>(null);
  // controlled: opts the fields out of React's automatic post-action reset,
  // so a failed submit keeps them and a success won't wipe a next thought
  const [icon, setIcon] = React.useState('');
  const [title, setTitle] = React.useState('');
  const [body, setBody] = React.useState('');

  const clear = () => {
    setIcon('');
    setTitle('');
    setBody('');
  };

  return (
    <form
      action={async (fd) => {
        const t = String(fd.get('title') ?? '');
        const b = String(fd.get('body') ?? '');
        try {
          await capture(fd);
        } catch {
          setError('capture failed — check the inbox before retrying');
          return; // text + chip/date state intact for the retry
        }
        setError(null);
        // clear only if unchanged since submit (keep a next thought)
        setTitle((c) => (c === t ? '' : c));
        setBody((c) => (c === b ? '' : c));
        setIcon('');
        // the chip PERSISTS — repeated captures into the same room are the
        // rhythm; deselect stays an explicit re-tap. Date resets as before.
        setResetSignal((n) => n + 1);
      }}
      className="flex flex-col gap-2"
    >
      <input type="hidden" name="parentId" value={parent?.id ?? ''} />
      <div className="flex items-start gap-2">
        <div className="flex-1">
          <CaptureTitleBody
            icon={icon}
            onIconChange={setIcon}
            iconPlaceholder={parent?.icon ?? undefined}
            title={title}
            onTitleChange={setTitle}
            titlePlaceholder={
              parent ? `→ ${parent.icon ?? ''} ${parent.title}` : 'Throw it in — organize later'
            }
            body={body}
            onBodyChange={setBody}
          />
        </div>
        <SubmitButton>Capture</SubmitButton>
      </div>

      {/* inline fields for the selected room (optional; never blocks) */}
      {parent && parent.childSchema.length > 0 && (
        <CaptureFields
          key={parent.id}
          parentId={parent.id}
          childSchema={parent.childSchema ?? EMPTY}
        />
      )}

      {error && <p className="text-destructive text-xs">{error}</p>}
      <div className="flex items-center justify-between gap-2">
        {chips.length > 0 ? (
          <div className="no-scrollbar flex gap-1.5 overflow-x-auto">
            {chips.map((chip) => (
              <button
                key={chip.id}
                type="button"
                onClick={() => {
                  setParent((p) => (p?.id === chip.id ? null : chip));
                  clear();
                }}
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
