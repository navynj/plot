import { requireUserId } from '@/app/_auth/requireUser';
import { CaptureForm, type CaptureChip } from '@/components/capture/CaptureForm';
import { DayNavigator } from '@/components/capture/DayNavigator';
import { NodeList } from '@/components/node/NodeList';
import { ScrollAnchor } from '@/components/ui/scroll-anchor';
import { isValidDay, toDayString, todayString } from '@/lib/day';
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
  const day =
    typeof rawDay === 'string' && isValidDay(rawDay) && rawDay !== todayString()
      ? rawDay
      : undefined;

  const userId = await requireUserId();
  const [nodes, chipNodes] = await Promise.all([
    getTimelineVisible(userId, day),
    getCaptureChips(userId),
  ]);
  const chips: CaptureChip[] = chipNodes.map((n) => ({
    id: n.id,
    icon: n.icon,
    title: n.title ?? n.body ?? '(untitled)',
  }));

  // section the river by event-axis day (presentation grouping only)
  const groups: { day: string; nodes: typeof nodes }[] = [];
  for (const n of nodes) {
    const nodeDay = toDayString(n.eventDate ?? n.capturedAt);
    const last = groups[groups.length - 1];
    if (last?.day === nodeDay) last.nodes.push(n);
    else groups.push({ day: nodeDay, nodes: [n] });
  }

  return (
    <>
      <div className="border-border -mx-4 border-b px-4 py-2">
        <DayNavigator day={day} />
      </div>
      <ScrollAnchor className="min-h-0 flex-1 py-4">
        {groups.length === 0 && (
          <p className="text-muted-foreground py-8 text-center text-sm">
            {day ? `Nothing on ${day}.` : 'Nothing captured yet.'}
          </p>
        )}
        {groups.map((group) => (
          <section key={group.day}>
            <h2 className="text-muted-foreground bg-background sticky top-0 py-1 text-xs font-medium tracking-wider uppercase">
              {group.day === todayString() ? 'Today' : group.day}
            </h2>
            <NodeList nodes={group.nodes} emptyMessage="" />
          </section>
        ))}
      </ScrollAnchor>
      <div className="border-border -mx-4 border-t px-4 py-3">
        <CaptureForm chips={chips} day={day} />
      </div>
    </>
  );
}
