import { CornerLeftUp, SlidersHorizontal } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import type { FieldPrimitive } from '@/db/schema';

import { requireUserId } from '@/app/_auth/requireUser';
import { ContextCaptureForm } from '@/components/capture/ContextCaptureForm';
import { ChildSchemaEditor } from '@/components/node/ChildSchemaEditor';
import { SelectableList } from '@/components/node/SelectableList';
import { CollectionsSection } from '@/components/node/CollectionsSection';
import { EventDateControl } from '@/components/node/EventDateControl';
import { NodeHeaderEdit } from '@/components/node/NodeHeaderEdit';
import { TimelineVisibilityControl } from '@/components/node/TimelineVisibilityControl';
import { FieldEditors } from '@/components/field/FieldEditors';
import { ParentPicker } from '@/components/node/ParentPicker';
import { ViewSpecDevEditor } from '@/components/node/ViewSpecDevEditor';
import { NodeView } from '@/components/view/NodeView';
import { PeriodNavigator } from '@/components/view/PeriodNavigator';
import { Button } from '@/components/ui/button';
import { getMembers, getMemberships } from '@/service/collection';
import { getOwnValues, getValueDisplays } from '@/service/field';
import { resolveSchema } from '@/service/inheritance';
import {
  getAttachedChildren,
  getChildren,
  getNode,
  getSchemaScopeTargets,
  nodeChildCounts,
} from '@/service/node';
import { resolveView } from '@/service/view';
import { getRequestTimezone } from '@/app/_ctx/timezone';
import {
  dayInTz,
  isValidMonth,
  monthBoundsInTz,
  monthLabel,
  thisMonthInTz,
  todayInTz,
} from '@/lib/day';
import { getBudgetHolder, getLedgerLines, isMonthStampedLedger } from '@/service/budget';
import { formatTimestamp } from '@/lib/formatTimestamp';
import { displayName } from '@/lib/identity';

import { saveFields, saveViewSpecDev } from './actions';

export const dynamic = 'force-dynamic';

/** ONE adaptive frame (DESIGN §6): header, then own values → view → children.
 *  Sections appear only when the node has that aspect — never branching on a
 *  node "type". */
export default async function NodeDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ period?: string }>;
}) {
  const { id } = await params;
  const { period: periodParam } = await searchParams;
  const userId = await requireUserId();
  const tz = await getRequestTimezone();
  const node = await getNode(userId, id);
  if (!node) notFound();

  // A2 period lens: no param = the current month; 'all' = zoomed out (no
  // bounds); a valid 'YYYY-MM' = that month. Bounds are the user's months
  // (tz-correct), computed at this entry point — services take instants.
  const thisMonth = thisMonthInTz(tz);
  const activeMonth =
    periodParam === 'all' ? null : isValidMonth(periodParam ?? '') ? periodParam! : thisMonth;
  const period = activeMonth ? monthBoundsInTz(activeMonth, tz) : undefined;

  // worn schema = direct parent's childSchema (depth-1); no parent → no fields
  const defs = await resolveSchema(userId, node);
  const [values, parent, memberships, members, children, attachedChildren, view] =
    await Promise.all([
      defs.length > 0
        ? getOwnValues(userId, id)
        : Promise.resolve<Record<string, FieldPrimitive>>({}),
      node.parentId ? getNode(userId, node.parentId) : Promise.resolve(null),
      getMemberships(userId, id),
      getMembers(userId, id),
      getChildren(userId, id),
      getAttachedChildren(userId, id),
      resolveView(userId, node, tz, period),
    ]);

  const displays = await getValueDisplays(userId, defs, values);
  // A'': an Expense-style aggregate view with an attached Budget can jump to
  // its editor from the overlay area
  const budgetHolder =
    view?.kind === 'aggregate' ? await getBudgetHolder(userId, node.id) : null;
  // A3: a month-stamped ledger (attached Budget) scopes its lines to the
  // navigated month; every other node shows all its record children.
  const isLedger = isMonthStampedLedger(node);
  const displayChildren = isLedger
    ? await getLedgerLines(userId, node, activeMonth, tz)
    : children;
  const grandchildCounts = await nodeChildCounts(
    userId,
    displayChildren.map((c) => c.id)
  );
  // the schema relationships, made navigable (nothing stored): the worn
  // schema's link scopes (for the fields-section editor) and this node's own
  // childSchema scopes (the "related" line)
  const [wornScopes, ownScopes] = await Promise.all([
    getSchemaScopeTargets(userId, defs),
    getSchemaScopeTargets(userId, node.childSchema ?? []),
  ]);
  const scopeLabelMap = (ts: typeof wornScopes) =>
    Object.fromEntries(ts.map((t) => [t.id, `${t.icon ? `${t.icon} ` : ''}${t.name}`]));
  const editorTitle = (n: { displayIcon?: string | null; title: string | null; body: string | null }) =>
    `Fields of ${n.displayIcon ? `${n.displayIcon} ` : ''}${displayName(n)}`;

  return (
    <div className="flex flex-col gap-6 py-6">
      <header className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <h1 className="flex-1 text-lg font-semibold">
            {node.displayIcon && <span className="mr-1">{node.displayIcon}</span>}
            {displayName(node)}
          </h1>
          <NodeHeaderEdit
            nodeId={node.id}
            title={node.title}
            icon={node.icon}
            body={node.body}
            childCount={children.length}
            parentLabel={parent ? displayName(parent) : null}
            pinned={node.pinned}
          />
        </div>
        <p className="text-muted-foreground text-xs">captured {formatTimestamp(node.capturedAt)}</p>
        {ownScopes.length > 0 && (
          <p className="text-muted-foreground flex flex-wrap items-center gap-x-2 text-xs">
            {ownScopes.map((t) => (
              <span key={t.id}>
                {t.fieldLabel}:{' '}
                <Link href={`/node/${t.id}`} className="hover:underline">
                  {t.icon && <span className="mr-0.5">{t.icon}</span>}
                  {t.name}
                </Link>
              </span>
            ))}
          </p>
        )}
        <div className="flex items-center justify-between">
          {/* the parent's NAME walks up the tree; the ↰ icon changes it */}
          <span className="-ml-2 flex items-center gap-0.5">
            {parent ? (
              <Button variant="ghost" size="sm" className="text-muted-foreground" asChild>
                <Link href={`/node/${parent.id}`}>
                  {parent.displayIcon && <span>{parent.displayIcon}</span>}
                  {displayName(parent)}
                </Link>
              </Button>
            ) : (
              <span className="text-muted-foreground px-3 text-sm">
                {node.rank !== null ? 'Root' : 'No parent'}
              </span>
            )}
            <ParentPicker nodeIds={[node.id]}>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="change parent"
                className="text-muted-foreground"
              >
                <CornerLeftUp className="size-3.5" />
              </Button>
            </ParentPicker>
          </span>
          <span className="flex items-center gap-3">
            <EventDateControl
              nodeId={node.id}
              value={node.eventDate ? dayInTz(node.eventDate, tz) : null}
            />
            <TimelineVisibilityControl nodeId={node.id} value={node.timelineVisibility} />
          </span>
        </div>
      </header>

      {/* contextual capture: position inherited from standing here (DESIGN §6) */}
      <ContextCaptureForm
        nodeId={node.id}
        contextLabel={node.title ?? 'this node'}
        defaultDay={todayInTz(tz)}
      />

      {/* own values */}
      {defs.length > 0 && (
        <section className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between">
            <h2 className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
              Fields
            </h2>
            <span className="flex items-center gap-3">
              {defs.some((d) => values[d.key] === undefined) && (
                <Link
                  href={`/triage/fields?node=${node.id}`}
                  className="text-muted-foreground text-xs hover:underline"
                >
                  fill fields
                </Link>
              )}
              {parent && (
                <ChildSchemaEditor
                  nodeId={parent.id}
                  childSchema={parent.childSchema ?? []}
                  title={editorTitle(parent)}
                  initialScopeLabels={scopeLabelMap(wornScopes)}
                />
              )}
            </span>
          </div>
          <FieldEditors
            defs={defs}
            values={values}
            displays={displays}
            action={saveFields.bind(null, node.id)}
          />
        </section>
      )}

      {/* view — iff the node holds a viewSpec. Date-capable = an aggregate
          (chart) view; its entries carry the event axis, so a month lens is
          meaningful. Items/collection views sort by a field and get no
          control (DESIGN §5's time-axis vs collection split). */}
      {view && (
        <section className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
              View
            </h2>
            {view.kind === 'aggregate' && (
              <div className="flex flex-wrap items-center gap-2">
                {budgetHolder && (
                  <Button variant="outline" size="sm" asChild className="text-muted-foreground">
                    <Link
                      href={`/node/${budgetHolder.id}/budget${activeMonth ? `?period=${activeMonth}` : ''}`}
                    >
                      <SlidersHorizontal className="size-3.5" /> Edit budget
                    </Link>
                  </Button>
                )}
                <PeriodNavigator
                  month={activeMonth}
                  thisMonth={thisMonth}
                  basePath={`/node/${node.id}`}
                />
              </div>
            )}
          </div>
          <NodeView view={view} />
        </section>
      )}

      {/* children — tree. For a month-stamped ledger (Budget), the list is the
          navigated month's lines, with a period lens and copy-forward. */}
      {(displayChildren.length > 0 || isLedger) && (
        <section className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
              {isLedger ? 'Lines' : 'Children'}
            </h2>
            {isLedger && (
              <div className="flex flex-wrap items-center gap-2">
                <PeriodNavigator
                  month={activeMonth}
                  thisMonth={thisMonth}
                  basePath={`/node/${node.id}`}
                />
                {/* A'': the single-form editor is the PRIMARY way to set
                    budgets; the per-line list below is a read reference (tap
                    a line for a one-off tweak). Copy-forward lives in the
                    editor now, not here. */}
                <Button variant="default" size="sm" asChild>
                  <Link href={`/node/${node.id}/budget${activeMonth ? `?period=${activeMonth}` : ''}`}>
                    <SlidersHorizontal className="size-3.5" /> Edit budget
                  </Link>
                </Button>
              </div>
            )}
          </div>
          {displayChildren.length === 0 ? (
            <p className="text-muted-foreground py-4 text-sm">
              No lines for {activeMonth ? monthLabel(activeMonth) : 'any month'} yet — use{' '}
              <Link
                href={`/node/${node.id}/budget${activeMonth ? `?period=${activeMonth}` : ''}`}
                className="underline"
              >
                Edit budget
              </Link>{' '}
              to set targets.
            </p>
          ) : (
            /* the FOURTH selection surface: same bulk bar, same ?ids= walk,
               rank order — a room's children share a schema, so "select the
               unfilled, walk them" is the flow at its best. Set parent skips
               the already-belongs warning here: everything selected belongs
               to this room by definition. */
            <SelectableList
              warnOnMove={false}
              groups={[
                {
                  key: 'children',
                  header: null,
                  rows: displayChildren.map((c) => ({
                    id: c.id,
                    label: displayName(c),
                    icon: c.displayIcon ?? null,
                    time: formatTimestamp(c.capturedAt),
                    parented: true,
                    childCount: grandchildCounts.get(c.id) ?? 0,
                  })),
                },
              ]}
            />
          )}
        </section>
      )}

      {/* attached — appendages (A1): structures that belong under this node
          but are not its records (Expense categories, Budget). Quiet, apart
          from the record list, never in aggregates or the grid. */}
      {attachedChildren.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
            Attached
          </h2>
          <div className="flex flex-wrap gap-2">
            {attachedChildren.map((a) => (
              <Link
                key={a.id}
                href={`/node/${a.id}`}
                className="border-border text-muted-foreground hover:bg-muted/50 flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm"
              >
                {a.displayIcon && <span>{a.displayIcon}</span>}
                {displayName(a)}
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* curation: membership chips always; the plain linked-member list only
          as the fallback when no viewSpec renders the set (Phase 6 scope) */}
      <CollectionsSection
        nodeId={node.id}
        memberships={memberships}
        members={view ? [] : members}
      />

      <ViewSpecDevEditor
        viewSpec={node.viewSpec ?? null}
        action={saveViewSpecDev.bind(null, node.id)}
      />
      <ChildSchemaEditor
        nodeId={node.id}
        childSchema={node.childSchema ?? []}
        title={editorTitle(node)}
        initialScopeLabels={scopeLabelMap(ownScopes)}
      />
    </div>
  );
}
