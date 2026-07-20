import { CornerLeftUp } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import type { FieldPrimitive } from '@/db/schema';

import { requireUserId } from '@/app/_auth/requireUser';
import { ContextCaptureForm } from '@/components/capture/ContextCaptureForm';
import { ChildSchemaEditor } from '@/components/node/ChildSchemaEditor';
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
import { getOwnValues } from '@/service/field';
import { resolveSchema } from '@/service/inheritance';
import { getChildren, getNode } from '@/service/node';
import { resolveView } from '@/service/view';
import { getRequestTimezone } from '@/app/_ctx/timezone';
import { dayInTz, todayInTz } from '@/lib/day';
import { formatTimestamp } from '@/lib/formatTimestamp';

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

  // link-type values render as their target's icon+title, never a raw id
  const displays: Record<string, string> = {};
  for (const def of defs) {
    const value = values[def.key];
    if (def.type === 'link' && typeof value === 'string') {
      const target = await getNode(userId, value);
      if (target) {
        displays[def.key] =
          `${target.icon ? `${target.icon} ` : ''}${target.title ?? target.body ?? value}`;
      }
    }
  }

  return (
    <div className="flex flex-col gap-6 py-6">
      <header className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <h1 className="flex-1 text-lg font-semibold">
            {node.icon && <span className="mr-1">{node.icon}</span>}
            {node.title ?? node.body}
          </h1>
          <NodeHeaderEdit
            nodeId={node.id}
            title={node.title}
            icon={node.icon}
            body={node.body}
            childCount={children.length}
            parentLabel={parent ? (parent.title ?? parent.body) : null}
            pinned={node.pinned}
          />
        </div>
        <p className="text-muted-foreground text-xs">captured {formatTimestamp(node.capturedAt)}</p>
        <div className="flex items-center justify-between">
          {/* the parent's NAME walks up the tree; the ↰ icon changes it */}
          <span className="-ml-2 flex items-center gap-0.5">
            {parent ? (
              <Button variant="ghost" size="sm" className="text-muted-foreground" asChild>
                <Link href={`/node/${parent.id}`}>
                  {parent.icon && <span>{parent.icon}</span>}
                  {parent.title ?? parent.body}
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
            {defs.some((d) => values[d.key] === undefined) && (
              <Link
                href={`/triage/fields?node=${node.id}`}
                className="text-muted-foreground text-xs hover:underline"
              >
                fill fields
              </Link>
            )}
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
          <ul className="divide-border divide-y">
            {children.map((c) => (
              <li key={c.id} className="py-2">
                <Link href={`/node/${c.id}`} className="text-sm hover:underline">
                  {c.title ?? c.body}
                </Link>
              </li>
            ))}
          </ul>
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
      <ChildSchemaEditor nodeId={node.id} childSchema={node.childSchema ?? []} />
    </div>
  );
}
