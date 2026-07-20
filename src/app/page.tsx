import { requireUserId } from '@/app/_auth/requireUser';
import { CaptureForm, type CaptureChip } from '@/components/capture/CaptureForm';
import { DayNavigator } from '@/components/capture/DayNavigator';
import { SelectableList, type SelectableGroup } from '@/components/node/SelectableList';
import { ScrollAnchor } from '@/components/ui/scroll-anchor';
import { formatTimestamp } from '@/lib/formatTimestamp';
import { displayName } from '@/lib/identity';
import { nodeChildCounts } from '@/service/node';
import { getRequestTimezone } from '@/app/_ctx/timezone';
import { dayInTz, isValidDay, todayInTz } from '@/lib/day';
import { getCaptureChips, getTimelineVisible } from '@/service/node';

export const dynamic = 'force-dynamic';

/** The record river on the EVENT AXIS: sorted and sectioned by
 *  coalesce(eventDate, capturedAt) — when it happened, not when it was
 *  typed. A selected day filters the river and stamps captures. */
export default async function TimelinePage({
  searchParams,
}: {
  searchParams: Promise<{ day?: string }>;
}) {
  const { day: rawDay } = await searchParams;
  const tz = await getRequestTimezone();
  const today = todayInTz(tz);
  const day =
    typeof rawDay === 'string' && isValidDay(rawDay) && rawDay !== today ? rawDay : undefined;

  const userId = await requireUserId();
  const [nodes, chipNodes] = await Promise.all([
    getTimelineVisible(userId, day, tz),
    getCaptureChips(userId),
  ]);
  const chips: CaptureChip[] = chipNodes.map((n) => ({
    id: n.id,
    icon: n.displayIcon ?? null,
    title: displayName(n),
  }));

  // section the river by event-axis day (presentation grouping only)
  const childCounts = await nodeChildCounts(
    userId,
    nodes.map((n) => n.id)
  );
  const groups: SelectableGroup[] = [];
  for (const n of nodes) {
    const nodeDay = dayInTz(n.eventDate ?? n.capturedAt, tz);
    const row = {
      id: n.id,
      label: displayName(n),
      icon: n.displayIcon ?? null,
      time: formatTimestamp(n.capturedAt),
      parented: n.parentId !== null,
      childCount: childCounts.get(n.id) ?? 0,
    };
    const last = groups[groups.length - 1];
    if (last?.key === nodeDay) last.rows.push(row);
    else groups.push({ key: nodeDay, header: nodeDay === today ? 'Today' : nodeDay, rows: [row] });
  }

  return (
    <>
      <div className="border-border -mx-4 border-b px-4 py-2">
        <DayNavigator day={day} today={today} />
      </div>
      <ScrollAnchor className="min-h-0 flex-1 py-4">
        {groups.length === 0 && (
          <p className="text-muted-foreground py-8 text-center text-sm">
            {day ? `Nothing on ${day}.` : 'Nothing captured yet.'}
          </p>
        )}
        <SelectableList groups={groups} />
      </ScrollAnchor>
      <div className="border-border -mx-4 border-t px-4 py-3">
        <CaptureForm chips={chips} defaultDay={day ?? today} />
      </div>
    </>
  );
}
