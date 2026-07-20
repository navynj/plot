import { ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { shiftDay, todayString } from '@/lib/day';

/** Lightweight day navigation over the event axis. No day = the full river
 *  (capturing to today); a selected day filters the river to it and becomes
 *  the capture's eventDate — the temporal twin of contextual capture. */
export function DayNavigator({ day }: { day?: string }) {
  const viewing = day ?? todayString();
  const back = shiftDay(viewing, -1);
  const forward = shiftDay(viewing, 1);
  const forwardIsToday = forward === todayString();

  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon-sm" asChild aria-label="previous day">
          <Link href={`/?day=${back}`}>
            <ChevronLeft className="size-4" />
          </Link>
        </Button>
        <span className="text-sm font-medium tabular-nums">
          {day ?? 'Today'}
          {!day && <span className="text-muted-foreground font-normal"> · all days</span>}
        </span>
        {day && (
          <Button variant="ghost" size="icon-sm" asChild aria-label="next day">
            <Link href={forwardIsToday ? '/' : `/?day=${forward}`}>
              <ChevronRight className="size-4" />
            </Link>
          </Button>
        )}
      </div>
      <form action="/" className="flex items-center gap-1">
        <input
          type="date"
          name="day"
          defaultValue={day ?? ''}
          aria-label="jump to day"
          className="border-input bg-background h-7 rounded-md border px-2 text-xs"
        />
        <Button type="submit" variant="outline" size="sm">
          Go
        </Button>
        {day && (
          <Button variant="ghost" size="sm" asChild>
            <Link href="/">today</Link>
          </Button>
        )}
      </form>
    </div>
  );
}
