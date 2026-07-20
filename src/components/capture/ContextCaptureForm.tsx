'use client';

import { Inbox } from 'lucide-react';
import * as React from 'react';

import { captureHere } from '@/app/node/[id]/actions';
import { Button } from '@/components/ui/button';

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
  const formRef = React.useRef<HTMLFormElement>(null);

  return (
    <form
      ref={formRef}
      action={async (fd) => {
        await captureHere(nodeId, fd);
        formRef.current?.reset();
        setResetSignal((n) => n + 1);
      }}
      className="flex flex-col gap-2"
    >
      <div className="flex gap-2">
        <CaptureTextInput
          name="text"
          placeholder={`Add to ${contextLabel} — or throw it to the inbox`}
        />
        <Button type="submit" name="dest" value="here">
          Add here
        </Button>
        <Button
          type="submit"
          name="dest"
          value="inbox"
          variant="outline"
          aria-label="capture to inbox instead"
        >
          <Inbox className="size-4" /> inbox
        </Button>
      </div>
      <CaptureDateField key={`${defaultDay}:${resetSignal}`} defaultDay={defaultDay} />
    </form>
  );
}
