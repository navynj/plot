import { CornerLeftUp } from 'lucide-react';
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
import { Button } from '@/components/ui/button';
import { getMembers, getMemberships } from '@/service/collection';
import { getOwnValues, getValueDisplays } from '@/service/field';
import { resolveSchema } from '@/service/inheritance';
import { getChildren, getNode, getSchemaScopeTargets, nodeChildCounts } from '@/service/node';
import { resolveView } from '@/service/view';
import { getRequestTimezone } from '@/app/_ctx/timezone';
import { dayInTz, todayInTz } from '@/lib/day';
import { formatTimestamp } from '@/lib/formatTimestamp';
import { displayName } from '@/lib/identity';

import { saveFields, saveViewSpecDev } from './actions';

export const dynamic = 'force-dynamic';

/** ONE adaptive frame (DESIGN §6): header, then own values → view → children.
 *  Sections appear only when the node has that aspect — never branching on a
 *  node "type". */
export default async function NodeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await requireUserId();
  const tz = await getRequestTimezone();
  const node = await getNode(userId, id);
  if (!node) notFound();

  // worn schema = direct parent's childSchema (depth-1); no parent → no fields
  const defs = await resolveSchema(userId, node);
  const [values, parent, memberships, members, children, view] = await Promise.all([
    defs.length > 0
      ? getOwnValues(userId, id)
      : Promise.resolve<Record<string, FieldPrimitive>>({}),
    node.parentId ? getNode(userId, node.parentId) : Promise.resolve(null),
    getMemberships(userId, id),
    getMembers(userId, id),
    getChildren(userId, id),
    resolveView(userId, node, tz),
  ]);

  const displays = await getValueDisplays(userId, defs, values);
  const grandchildCounts = await nodeChildCounts(
    userId,
    children.map((c) => c.id)
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

      {/* view — iff the node holds a viewSpec */}
      {view && (
        <section className="flex flex-col gap-3">
          <h2 className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
            View
          </h2>
          <NodeView view={view} />
        </section>
      )}

      {/* children — tree */}
      {children.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
            Children
          </h2>
          {/* the FOURTH selection surface: same bulk bar, same ?ids= walk,
              rank order — a room's children share a schema, so "select the
              unfilled, walk them" is the flow at its best. Set parent skips
              the already-belongs warning here: everything selected belongs
              to this room by definition. */}
          <SelectableList
            warnOnMove={false}
            groups={[
              {
                key: 'children',
                header: null,
                rows: children.map((c) => ({
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
