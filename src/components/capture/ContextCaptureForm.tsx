import { Inbox } from 'lucide-react';

import { captureHere } from '@/app/node/[id]/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

/** Contextual capture (DESIGN §6): position is inherited, not forced — the
 *  entry becomes a child of this node because that's where you're standing.
 *  The "→ inbox" button is the one-tap opt-out: same text, thrown raw.
 *  Values are never asked for; the child merely WEARS the schema. */
export function ContextCaptureForm({
  nodeId,
  contextLabel,
}: {
  nodeId: string;
  contextLabel: string;
}) {
  return (
    <form action={captureHere.bind(null, nodeId)} className="flex gap-2">
      <Input
        type="text"
        name="text"
        placeholder={`Add to ${contextLabel} — or throw it to the inbox`}
        autoComplete="off"
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
    </form>
  );
}
