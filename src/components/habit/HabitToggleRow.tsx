'use client';

import * as React from 'react';

import { toggleHabitAction } from '@/app/_habit/actions';
import type { HabitSummary } from '@/service/habit';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

/** A day's habit toggle row on the stream: one emoji per habit (rank order),
 *  lit when checked for this day, dimmed when not. Checking ON is instant
 *  (optimistic, relies on revalidatePath('/')). Un-checking OFF always asks for
 *  confirmation first, since it deletes the generated log — cancel deletes
 *  nothing. A habit whose target parent was deleted is shown disabled. */
export function HabitToggleRow({
  habits,
  day,
  checkedIds,
}: {
  habits: HabitSummary[];
  day: string;
  checkedIds: string[];
}) {
  const [checked, setChecked] = React.useState<Set<string>>(() => new Set(checkedIds));
  // re-sync when the server sends fresh status (after a toggle / navigation)
  const key = checkedIds.join(',');
  const [prevKey, setPrevKey] = React.useState(key);
  if (key !== prevKey) {
    setPrevKey(key);
    setChecked(new Set(checkedIds));
  }
  const [pending, setPending] = React.useState<Set<string>>(new Set());
  // the habit awaiting an un-check confirmation (null = no dialog)
  const [confirming, setConfirming] = React.useState<HabitSummary | null>(null);

  if (habits.length === 0) return null;

  const flip = (set: Set<string>, id: string, on: boolean) => {
    const next = new Set(set);
    if (on) next.add(id);
    else next.delete(id);
    return next;
  };

  /** Fire the toggle action for the given transition, with optimistic paint and
   *  revert-on-failure. Only called for ON directly, or for OFF after confirm. */
  const run = async (h: HabitSummary, turnOn: boolean) => {
    setChecked((s) => flip(s, h.id, turnOn)); // optimistic
    setPending((s) => new Set(s).add(h.id));
    const res = await toggleHabitAction(h.id, day);
    setPending((s) => {
      const n = new Set(s);
      n.delete(h.id);
      return n;
    });
    if (!res.ok) setChecked((s) => flip(s, h.id, !turnOn)); // revert on failure
  };

  const tap = (h: HabitSummary) => {
    if (h.disabled || pending.has(h.id)) return;
    if (checked.has(h.id)) {
      setConfirming(h); // OFF → confirm first, delete nothing until confirmed
    } else {
      void run(h, true); // ON → instant
    }
  };

  const confirmOff = async () => {
    const h = confirming;
    setConfirming(null);
    if (h) await run(h, false);
  };

  return (
    <>
      <div className="no-scrollbar flex items-center gap-1.5 overflow-x-auto py-1">
        {habits.map((h) => {
          const on = checked.has(h.id);
          return (
            <button
              key={h.id}
              type="button"
              disabled={h.disabled}
              onClick={() => tap(h)}
              aria-pressed={on}
              aria-label={`${h.title}${on ? ' — done' : ''}`}
              title={h.title}
              className={cn(
                'flex size-8 shrink-0 items-center justify-center rounded-full text-base transition',
                // ON: a solid primary (black) chip — unmistakably "on"; OFF: dimmed
                on
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'opacity-40 hover:opacity-75',
                h.disabled && 'cursor-not-allowed opacity-20'
              )}
            >
              {h.icon || '•'}
            </button>
          );
        })}
      </div>

      <Dialog open={confirming !== null} onOpenChange={(o) => !o && setConfirming(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove “{confirming?.title}” for {day}?</DialogTitle>
            <DialogDescription>
              Un-checking deletes the log this habit created for {day}. This can’t be undone here.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirming(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => void confirmOff()}>
              Remove log
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
