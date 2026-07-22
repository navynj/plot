'use client';

import * as React from 'react';

import { capture } from '@/app/actions';
import type { CaptureChipTiers, ChipItem } from '@/service/node';
import { SubmitButton } from '@/components/ui/submit-button';

import { CaptureChips } from './CaptureChips';
import { CaptureDateField } from './CaptureDateField';
import { CaptureFields } from './CaptureFields';
import { CaptureTitleBody } from './CaptureTitleBody';

interface CaptureFormProps {
  /** three-tier chips (favorites / ongoing / top-level) with drill-down */
  tiers: CaptureChipTiers;
  /** navigated day ?? today, in the user's timezone — seeds the date control */
  defaultDay: string;
}

/** Raw capture with one-tap context (B2): the chip tiers drill down to a
 *  target; selecting it sets the pending parent (inheriting childSchema) and,
 *  if that room declares fields, renders them inline (optional). The date
 *  control sets eventDate; all reset after submit. */
export function CaptureForm({ tiers, defaultDay }: CaptureFormProps) {
  const [parent, setParent] = React.useState<ChipItem | null>(null);
  const [resetSignal, setResetSignal] = React.useState(0);
  const [error, setError] = React.useState<string | null>(null);
  const [icon, setIcon] = React.useState('');
  const [title, setTitle] = React.useState('');
  const [body, setBody] = React.useState('');

  return (
    <form
      action={async (fd) => {
        const t = String(fd.get('title') ?? '');
        const b = String(fd.get('body') ?? '');
        try {
          await capture(fd);
        } catch {
          setError('capture failed — check the inbox before retrying');
          return;
        }
        setError(null);
        setTitle((c) => (c === t ? '' : c));
        setBody((c) => (c === b ? '' : c));
        setIcon('');
        // the target PERSISTS — repeated captures into the same room are the
        // rhythm; deselect stays an explicit re-tap.
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
        <CaptureFields key={parent.id} parentId={parent.id} childSchema={parent.childSchema} />
      )}

      {error && <p className="text-destructive text-xs">{error}</p>}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <CaptureChips
            tiers={tiers}
            selectedId={parent?.id ?? null}
            onSelect={(chip) => {
              setParent(chip);
              setIcon('');
            }}
          />
        </div>
        <CaptureDateField key={`${defaultDay}:${resetSignal}`} defaultDay={defaultDay} />
      </div>
    </form>
  );
}
