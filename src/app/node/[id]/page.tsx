import { CornerLeftUp } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { requireUserId } from '@/app/_auth/requireUser';
import { ChildSchemaDevEditor } from '@/components/node/ChildSchemaDevEditor';
import { CollectionsSection } from '@/components/node/CollectionsSection';
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
import { formatTimestamp } from '@/lib/formatTimestamp';

import { saveChildSchemaDev, saveFields, saveViewSpecDev } from './actions';

export const dynamic = 'force-dynamic';

/** ONE adaptive frame (DESIGN §6): header, then own values → view → children.
 *  Sections appear only when the node has that aspect — never branching on a
 *  node "type". */
export default async function NodeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await requireUserId();
  const node = await getNode(userId, id);
  if (!node) notFound();

  // worn schema = direct parent's childSchema (depth-1); no parent → no fields
  const defs = await resolveSchema(userId, node);
  const [values, parent, memberships, members, children, view] = await Promise.all([
    defs.length > 0 ? getOwnValues(userId, id) : Promise.resolve({}),
    node.parentId ? getNode(userId, node.parentId) : Promise.resolve(null),
    getMemberships(userId, id),
    getMembers(userId, id),
    getChildren(userId, id),
    resolveView(userId, node),
  ]);

  return (
    <div className="flex flex-col gap-6 py-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-lg font-semibold">{node.title ?? node.body}</h1>
        <p className="text-muted-foreground text-xs">captured {formatTimestamp(node.capturedAt)}</p>
        {/* parent row = picker entry point (DESIGN §6 third surface) */}
        <ParentPicker nodeId={node.id}>
          <Button variant="ghost" size="sm" className="text-muted-foreground -ml-2 self-start">
            <CornerLeftUp className="size-3.5" />
            {parent
              ? (parent.title ?? parent.body)
              : node.rank !== null
                ? 'Root — change parent'
                : 'No parent — set one'}
          </Button>
        </ParentPicker>
      </header>

      {/* own values */}
      {defs.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
            Fields
          </h2>
          <FieldEditors defs={defs} values={values} action={saveFields.bind(null, node.id)} />
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
      <ChildSchemaDevEditor
        childSchema={node.childSchema ?? []}
        action={saveChildSchemaDev.bind(null, node.id)}
      />
    </div>
  );
}
