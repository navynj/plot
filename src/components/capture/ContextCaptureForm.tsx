'use client';

import { Inbox } from 'lucide-react';
import * as React from 'react';

import { captureHere } from '@/app/node/[id]/actions';
import type { FieldDef } from '@/db/schema';
import { SubmitButton } from '@/components/ui/submit-button';

import { CaptureDateField } from './CaptureDateField';
import { CaptureFields } from './CaptureFields';
import { CaptureTitleBody } from './CaptureTitleBody';

/** Contextual capture (DESIGN §6): position is inherited — the entry becomes a
 *  child of this node. "→ inbox" is the one-tap opt-out. Enter submits as "Add
 *  here" (the form's first submit button). When this node declares a
 *  childSchema, its fields render inline (optional; ignored on the inbox
 *  opt-out, where the entry wears no schema). */
export function ContextCaptureForm({
  nodeId,
  contextLabel,
  childSchema,
  defaultDay,
}: {
  nodeId: string;
  contextLabel: string;
  childSchema: FieldDef[];
  defaultDay: string;
}) {
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
          await captureHere(nodeId, fd);
        } catch {
          setError('capture failed — check the inbox before retrying');
          return;
        }
        setError(null);
        setTitle((c) => (c === t ? '' : c));
        setBody((c) => (c === b ? '' : c));
        setIcon('');
        setResetSignal((n) => n + 1);
      }}
      className="flex flex-col gap-2"
    >
      <div className="flex items-start gap-2">
        <div className="flex-1">
          <CaptureTitleBody
            icon={icon}
            onIconChange={setIcon}
            title={title}
            onTitleChange={setTitle}
            titlePlaceholder={`Add to ${contextLabel}`}
            body={body}
            onBodyChange={setBody}
          />
        </div>
        <div className="flex flex-col gap-1">
          <SubmitButton name="dest" value="here">
            Add here
          </SubmitButton>
          <SubmitButton
            name="dest"
            value="inbox"
            variant="outline"
            aria-label="capture to inbox instead"
          >
            <Inbox className="size-4" /> inbox
          </SubmitButton>
        </div>
      </div>

      {childSchema.length > 0 && <CaptureFields parentId={nodeId} childSchema={childSchema} />}

      <CaptureDateField key={`${defaultDay}:${resetSignal}`} defaultDay={defaultDay} />
      {error && <p className="text-destructive text-xs">{error}</p>}
    </form>
  );
}
