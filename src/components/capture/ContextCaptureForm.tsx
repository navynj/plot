'use client';

import { Inbox } from 'lucide-react';
import * as React from 'react';

import { captureHere } from '@/app/node/[id]/actions';
import { SubmitButton } from '@/components/ui/submit-button';

import { CaptureDateField } from './CaptureDateField';
import { CaptureTextInput } from './CaptureTextInput';

/** Contextual capture (DESIGN §6): position is inherited, not forced — the
 *  entry becomes a child of this node because that's where you're standing.
 *  "→ inbox" is the one-tap opt-out. Enter submits as "Add here" (the form's
 *  first submit button); the date control follows the same precedence ladder
 *  (no navigated context on a node page → defaults to today). */
export function ContextCaptureForm({
  nodeId,
  contextLabel,
  defaultDay,
}: {
  nodeId: string;
  contextLabel: string;
  defaultDay: string;
}) {
  const [resetSignal, setResetSignal] = React.useState(0);
  const [error, setError] = React.useState<string | null>(null);
  // controlled: survives React's post-action reset on failure, and success
  // won't wipe a next thought already being typed
  const [text, setText] = React.useState('');

  return (
    <form
      action={async (fd) => {
        const submitted = String(fd.get('text') ?? '');
        try {
          await captureHere(nodeId, fd);
        } catch {
          setError('capture failed — check the inbox before retrying');
          return;
        }
        setError(null);
        setText((current) => (current === submitted ? '' : current));
        setResetSignal((n) => n + 1);
      }}
      className="flex flex-col gap-2"
    >
      <div className="flex gap-2">
        <CaptureTextInput
          name="text"
          placeholder={`Add to ${contextLabel} — or throw it to the inbox`}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
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
      <CaptureDateField key={`${defaultDay}:${resetSignal}`} defaultDay={defaultDay} />
      {error && <p className="text-destructive text-xs">{error}</p>}
    </form>
  );
}
