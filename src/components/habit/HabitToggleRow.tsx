'use client';

import * as React from 'react';

import { toggleHabitAction } from '@/app/_habit/actions';
import type { HabitSummary } from '@/service/habit';
import { cn } from '@/lib/utils';

/** A day's habit toggle row on the stream: one emoji per habit (rank order),
 *  lit when checked for this day, dimmed when not. Tapping flips it optimistically
 *  and relies on revalidatePath('/'); on failure it reverts. A habit whose
 *  target parent was deleted is shown disabled rather than crashing. */
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

  if (habits.length === 0) return null;

  const flip = (set: Set<string>, id: string, on: boolean) => {
    const next = new Set(set);
    if (on) next.add(id);
    else next.delete(id);
    return next;
  };

  const toggle = async (h: HabitSummary) => {
    if (h.disabled || pending.has(h.id)) return;
    const wasOn = checked.has(h.id);
    setChecked((s) => flip(s, h.id, !wasOn)); // optimistic
    setPending((s) => new Set(s).add(h.id));
    const res = await toggleHabitAction(h.id, day);
    setPending((s) => {
      const n = new Set(s);
      n.delete(h.id);
      return n;
    });
    if (!res.ok) setChecked((s) => flip(s, h.id, wasOn)); // revert on failure
  };

  return (
    <div className="no-scrollbar flex items-center gap-1.5 overflow-x-auto py-1">
      {habits.map((h) => {
        const on = checked.has(h.id);
        return (
          <button
            key={h.id}
            type="button"
            disabled={h.disabled}
            onClick={() => void toggle(h)}
            aria-pressed={on}
            aria-label={`${h.title}${on ? ' — done' : ''}`}
            title={h.title}
            className={cn(
              'flex size-8 shrink-0 items-center justify-center rounded-full text-base transition',
              on
                ? 'bg-primary/15 ring-primary/40 ring-1'
                : 'opacity-40 hover:opacity-75',
              h.disabled && 'cursor-not-allowed opacity-20'
            )}
          >
            {h.icon || '•'}
          </button>
        );
      })}
    </div>
  );
}
