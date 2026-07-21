'use client';

import { CopyPlus, Loader2 } from 'lucide-react';
import * as React from 'react';
import { toast } from 'sonner';

import { copyBudgetMonthAction } from '@/app/node/[id]/actions';
import { usePendingLock } from '@/components/hooks/usePendingLock';
import { toastWithUndo } from '@/components/node/BulkBar';
import { Button } from '@/components/ui/button';

/** "Copy from previous month" on a Budget (ledger) children list. Tap-commit,
 *  so serial-gated like the other tap paths; a copy is one undoable op (undo
 *  deletes the copies). */
export function CopyMonthButton({
  ledgerId,
  fromMonth,
  toMonth,
  fromLabel,
}: {
  ledgerId: string;
  fromMonth: string;
  toMonth: string;
  fromLabel: string;
}) {
  const { pending, run } = usePendingLock();
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() =>
        run('copy', async () => {
          const result = await copyBudgetMonthAction(ledgerId, fromMonth, toMonth);
          if (!result.ok) {
            toast(`copy failed: ${result.error}`);
          } else if (result.copied === 0) {
            toast(`Nothing to copy from ${fromLabel}`);
          } else {
            toastWithUndo(`Copied ${result.copied} line${result.copied === 1 ? '' : 's'} from ${fromLabel}`);
          }
        })
      }
    >
      {pending ? <Loader2 className="size-3.5 animate-spin" /> : <CopyPlus className="size-3.5" />}
      Copy from {fromLabel}
    </Button>
  );
}
