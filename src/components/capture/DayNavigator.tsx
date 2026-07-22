'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { isValidDay, shiftDay } from '@/lib/day';
import { cn } from '@/lib/utils';

/**
 * B2 day/all navigation. Day and All are SEPARATE modes (a toggle), not
 * conflated with which day. Day mode navigates a single day (‹ › / jump);
 * All mode shows the full river. The date jump navigates IMMEDIATELY on a
 * complete valid date — no "Go" button.
 *
 * Picker choice (flagged): the native date input (firing only on a complete
 * date) over a shadcn Calendar popover — the app has no Calendar component and
 * adding react-day-picker for one field isn't warranted; onChange is guarded
 * so partial dates never navigate.
 */
export function DayNavigator({
  viewingDay,
  today,
  mode,
}: {
  viewingDay: string;
  today: string;
  mode: 'day' | 'all';
}) {
  const router = useRouter();
  const dayHref = (d: string) => (d === today ? '/' : `/?day=${d}`);

  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-1">
        {mode === 'day' ? (
          <>
            <Button variant="ghost" size="icon-sm" asChild aria-label="previous day">
              <Link href={dayHref(shiftDay(viewingDay, -1))}>
                <ChevronLeft className="size-4" />
              </Link>
            </Button>
            <span className="text-sm font-medium tabular-nums">
              {viewingDay === today ? 'Today' : viewingDay}
            </span>
            <Button variant="ghost" size="icon-sm" asChild aria-label="next day">
              <Link href={dayHref(shiftDay(viewingDay, 1))}>
                <ChevronRight className="size-4" />
              </Link>
            </Button>
          </>
        ) : (
          <span className="text-sm font-medium">
            All <span className="text-muted-foreground font-normal">· the whole river</span>
          </span>
        )}
      </div>

      <div className="flex items-center gap-1">
        {/* Day / All mode toggle (persists across navigation) */}
        <div className="border-border flex overflow-hidden rounded-md border text-xs">
          <Link
            href={dayHref(viewingDay)}
            className={cn('px-2 py-1', mode === 'day' ? 'bg-muted font-medium' : 'text-muted-foreground')}
          >
            Day
          </Link>
          <Link
            href="/?mode=all"
            className={cn('px-2 py-1', mode === 'all' ? 'bg-muted font-medium' : 'text-muted-foreground')}
          >
            All
          </Link>
        </div>
        {/* immediate date jump (day mode) — navigates on a complete valid date */}
        {mode === 'day' && (
          <Input
            type="date"
            defaultValue={viewingDay}
            aria-label="jump to day"
            onChange={(e) => {
              const v = e.target.value;
              if (isValidDay(v)) router.push(dayHref(v));
            }}
            className="h-7 w-auto px-2 text-xs"
          />
        )}
      </div>
    </div>
  );
}
