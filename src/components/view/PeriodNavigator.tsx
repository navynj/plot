import { ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { monthLabel, shiftMonth } from '@/lib/day';

/** Month/all-time navigator for a date-capable (aggregate) view — the
 *  DayNavigator grammar at month granularity. `month === null` is the
 *  zoomed-out "all time" state. Nothing is stored: it only writes a `?period`
 *  search param the node page reads back into date bounds. Forward is
 *  unbounded (budgets are often set for future months). */
export function PeriodNavigator({
  month,
  basePath,
}: {
  month: string | null;
  thisMonth: string;
  basePath: string;
}) {
  const href = (period: string) => `${basePath}?period=${period}`;

  if (month === null) {
    return (
      <div className="flex items-center gap-2 text-sm">
        <span className="font-medium">All time</span>
        <Button variant="ghost" size="sm" asChild className="text-muted-foreground">
          <Link href={basePath}>this month</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <Button variant="ghost" size="icon-sm" asChild aria-label="previous month">
        <Link href={href(shiftMonth(month, -1))}>
          <ChevronLeft className="size-4" />
        </Link>
      </Button>
      <span className="min-w-32 text-center text-sm font-medium tabular-nums">
        {monthLabel(month)}
      </span>
      <Button variant="ghost" size="icon-sm" asChild aria-label="next month">
        <Link href={href(shiftMonth(month, 1))}>
          <ChevronRight className="size-4" />
        </Link>
      </Button>
      <Button variant="ghost" size="sm" asChild className="text-muted-foreground ml-1">
        <Link href={href('all')}>all time</Link>
      </Button>
    </div>
  );
}
