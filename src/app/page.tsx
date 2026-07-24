import { requireUserId } from '@/app/_auth/requireUser';
import { CaptureForm } from '@/components/capture/CaptureForm';
import { DayNavigator } from '@/components/capture/DayNavigator';
import { HabitEditorSheet } from '@/components/habit/HabitEditorSheet';
import { HabitToggleRow } from '@/components/habit/HabitToggleRow';
import { SelectableList, type SelectableGroup } from '@/components/node/SelectableList';
import { ScrollAnchor } from '@/components/ui/scroll-anchor';
import { mainFieldRow } from '@/components/view/format';
import { formatTimestamp } from '@/lib/formatTimestamp';
import { displayName } from '@/lib/identity';
import { getMainFieldsByNode } from '@/service/field';
import { getHabitChecks, listHabits } from '@/service/habit';
import { getCaptureChips, getTimeline, getTimelineVisible, nodeChildCounts } from '@/service/node';
import { getRequestTimezone } from '@/app/_ctx/timezone';
import { dayInTz, isValidDay, todayInTz } from '@/lib/day';

export const dynamic = 'force-dynamic';

/** The record river on the EVENT AXIS (coalesce(eventDate, capturedAt)). B2:
 *  Day / All are SEPARATE modes. Day mode (default) shows a single day (today
 *  unless navigated) — "today only" is finally reachable. All mode shows the
 *  full river with day headers, initial scroll anchored to today so future
 *  (scheduled) entries don't greet you first. */
export default async function TimelinePage({
  searchParams,
}: {
  searchParams: Promise<{ day?: string; mode?: string }>;
}) {
  const { day: rawDay, mode: rawMode } = await searchParams;
  const tz = await getRequestTimezone();
  const today = todayInTz(tz);
  const mode: 'day' | 'all' = rawMode === 'all' ? 'all' : 'day';
  const viewingDay = typeof rawDay === 'string' && isValidDay(rawDay) ? rawDay : today;
  // day mode filters to the single day; all mode is the whole river
  const filterDay = mode === 'day' ? viewingDay : undefined;

  const userId = await requireUserId();
  const [nodes, tiers, allNodes, habits] = await Promise.all([
    getTimelineVisible(userId, filterDay, tz),
    getCaptureChips(userId),
    getTimeline(userId), // for parent-chip lookup (B2 item 5)
    listHabits(userId), // the day's habit toggle row
  ]);
  const byId = new Map(allNodes.map((n) => [n.id, n]));

  // the visible days: the single day in day mode, or every day present in all
  // mode — the habit toggle row reflects on/off status for each
  const visibleDays =
    mode === 'day'
      ? [viewingDay]
      : [...new Set(nodes.map((n) => dayInTz(n.eventDate ?? n.capturedAt, tz)))];

  const [childCounts, mainFields, habitChecks] = await Promise.all([
    nodeChildCounts(
      userId,
      nodes.map((n) => n.id)
    ),
    getMainFieldsByNode(userId, nodes),
    getHabitChecks(userId, visibleDays),
  ]);
  const groups: SelectableGroup[] = [];
  for (const n of nodes) {
    const nodeDay = dayInTz(n.eventDate ?? n.capturedAt, tz);
    const p = n.parentId ? byId.get(n.parentId) : undefined;
    // show-on-main values: text chips + checkbox toggles (Task 2)
    const { fields, checks } = mainFieldRow(n.id, mainFields.get(n.id) ?? []);
    const row = {
      id: n.id,
      label: displayName(n),
      icon: n.displayIcon ?? null,
      time: formatTimestamp(n.capturedAt, tz),
      parented: n.parentId !== null,
      childCount: childCounts.get(n.id) ?? 0,
      // the current parent as a navigable chip (B2 item 5)
      parent: p ? { id: p.id, icon: p.displayIcon ?? null, name: displayName(p) } : null,
      fields,
      checks,
    };
    const last = groups[groups.length - 1];
    if (last?.key === nodeDay) last.rows.push(row);
    else
      groups.push({
        key: nodeDay,
        header: mode === 'all' ? (nodeDay === today ? 'Today' : nodeDay) : null,
        isToday: nodeDay === today,
        // all mode: each day carries its own habit toggle row under the header
        accessory:
          mode === 'all' && habits.length > 0 ? (
            <HabitToggleRow habits={habits} day={nodeDay} checkedIds={habitChecks[nodeDay] ?? []} />
          ) : undefined,
        rows: [row],
      });
  }

  return (
    <>
      <div className="border-border -mx-4 flex flex-col gap-1 border-b px-4 py-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <DayNavigator viewingDay={viewingDay} today={today} mode={mode} />
          <HabitEditorSheet habits={habits} />
        </div>
        {/* day mode: one habit toggle row for the viewed day (always visible,
            even on an empty day). All mode puts a row under each day header. */}
        {mode === 'day' && habits.length > 0 && (
          <HabitToggleRow habits={habits} day={viewingDay} checkedIds={habitChecks[viewingDay] ?? []} />
        )}
      </div>
      <ScrollAnchor
        className="min-h-0 flex-1 py-4"
        // all mode: anchor today near the top; day mode: chat-style bottom
        anchorSelector={mode === 'all' ? '[data-stream-today]' : undefined}
      >
        {groups.length === 0 && (
          <p className="text-muted-foreground py-8 text-center text-sm">
            {mode === 'day'
              ? viewingDay === today
                ? 'Nothing today yet.'
                : `Nothing on ${viewingDay}.`
              : 'Nothing captured yet.'}
          </p>
        )}
        <SelectableList groups={groups} />
      </ScrollAnchor>
      <div className="border-border -mx-4 border-t px-4 py-3">
        <CaptureForm tiers={tiers} defaultDay={mode === 'day' ? viewingDay : today} />
      </div>
    </>
  );
}
