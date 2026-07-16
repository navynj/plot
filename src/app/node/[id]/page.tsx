import { notFound } from 'next/navigation';

import { requireUserId } from '@/app/_auth/requireUser';
import { ChildSchemaDevEditor } from '@/components/node/ChildSchemaDevEditor';
import { FieldEditors } from '@/components/field/FieldEditors';
import { getOwnValues } from '@/service/field';
import { resolveSchema } from '@/service/inheritance';
import { getNode } from '@/service/node';
import { formatTimestamp } from '@/lib/formatTimestamp';

import { saveChildSchemaDev, saveFields } from './actions';

export const dynamic = 'force-dynamic';

export default async function NodeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await requireUserId();
  const node = await getNode(userId, id);
  if (!node) notFound();

  // the schema this node WEARS = its direct parent's childSchema (depth-1);
  // no parent → no field section
  const defs = await resolveSchema(userId, node);
  const values = defs.length > 0 ? await getOwnValues(userId, id) : {};

  return (
    <div className="flex flex-col gap-6 py-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-lg font-semibold">{node.title ?? node.body}</h1>
        <p className="text-muted-foreground text-xs">captured {formatTimestamp(node.capturedAt)}</p>
      </header>

      {defs.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
            Fields
          </h2>
          <FieldEditors defs={defs} values={values} action={saveFields.bind(null, node.id)} />
        </section>
      )}

      <ChildSchemaDevEditor
        childSchema={node.childSchema ?? []}
        action={saveChildSchemaDev.bind(null, node.id)}
      />
    </div>
  );
}
