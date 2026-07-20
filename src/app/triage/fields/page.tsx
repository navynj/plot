import Link from 'next/link';

import { requireUserId } from '@/app/_auth/requireUser';
import { ChildSchemaEditor } from '@/components/node/ChildSchemaEditor';
import { FieldWalkStep } from '@/components/triage/FieldWalkStep';
import { Button } from '@/components/ui/button';
import { displayName } from '@/lib/identity';
import type { NodeRow } from '@/repository/nodeRepo';
import { getOwnValues, getValueDisplays } from '@/service/field';
import { getFieldTriageQueue, getUnfilledFields } from '@/service/fieldTriage';
import { resolveSchema } from '@/service/inheritance';
import { getNode, getSchemaScopeTargets } from '@/service/node';

import { saveAndAdvance, saveAndAdvanceSelection } from './actions';

/** The worn schema's editor, mounted against the PARENT: schema gaps become
 *  visible exactly while filling ("Store should've been required"), so the
 *  fix must not require leaving the walk. Same sheet, same validated save
 *  path as everywhere else — the title names whose schema is edited. */
async function wornSchemaEditor(userId: string, parent: NodeRow | null) {
  if (!parent) return undefined;
  const targets = await getSchemaScopeTargets(userId, parent.childSchema ?? []);
  return (
    <ChildSchemaEditor
      nodeId={parent.id}
      childSchema={parent.childSchema ?? []}
      title={`Fields of ${parent.displayIcon ? `${parent.displayIcon} ` : ''}${displayName(parent)}`}
      initialScopeLabels={Object.fromEntries(
        targets.map((t) => [t.id, `${t.icon ? `${t.icon} ` : ''}${t.name}`])
      )}
    />
  );
}

export const dynamic = 'force-dynamic';

/** Field triage (DESIGN §6): one node at a time — body visible for reference,
 *  fields via the registry editors. ONE flow implementation (FieldWalkStep),
 *  TWO queue sources:
 *  - derived: the required-missing queue (`?after=` is the skip cursor;
 *    `?node=` scopes to one node) — unfilled fields only, required first;
 *  - selection: `?ids=` + `?i=` from the bulk "Fill fields" action — the
 *    selected nodes in displayed order, ALL worn fields (revisits correct
 *    existing values). The queue lives entirely in the URL: nothing persists,
 *    leaving simply stops, re-selection recreates it. */
export default async function FieldTriagePage({
  searchParams,
}: {
  searchParams: Promise<{ node?: string; after?: string; ids?: string; i?: string }>;
}) {
  const { node: scopedId, after, ids: idsParam, i: iParam } = await searchParams;
  const userId = await requireUserId();

  if (idsParam !== undefined) {
    const ids = idsParam.split(',').filter(Boolean);
    const index = Math.max(0, Number.parseInt(iParam ?? '0', 10) || 0);
    const total = ids.length;

    if (index >= total) {
      return (
        <div className="flex flex-col items-center gap-3 py-16">
          <p className="text-muted-foreground text-sm">
            Done — walked {total} item{total === 1 ? '' : 's'}.
          </p>
          <Button variant="outline" size="sm" asChild>
            <Link href="/">Back to the stream</Link>
          </Button>
        </div>
      );
    }

    const current = await getNode(userId, ids[index]!);
    const parent = current?.parentId ? await getNode(userId, current.parentId) : null;
    // ALL worn fields, in schema order — a selected node may be revisited to
    // correct values, so filled fields render too (pre-populated)
    const defs = current ? await resolveSchema(userId, current) : [];
    const values = current && defs.length > 0 ? await getOwnValues(userId, current.id) : {};
    const displays =
      current && defs.length > 0 ? await getValueDisplays(userId, defs, values) : undefined;
    const nextHref = `/triage/fields?ids=${idsParam}&i=${index + 1}`;

    return (
      <div className="flex flex-col gap-6 py-6">
        <header className="flex items-baseline justify-between">
          <h1 className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
            Fill fields
          </h1>
          <span className="text-muted-foreground text-xs">
            {index + 1} of {total}
          </span>
        </header>
        <FieldWalkStep
          node={current}
          defs={defs}
          values={values}
          displays={displays}
          emptyMessage={
            current?.parentId
              ? 'No fields — its room declares none.'
              : "No fields — this isn't in a room yet; set a parent first."
          }
          action={defs.length > 0 ? saveAndAdvanceSelection.bind(null, ids, index) : null}
          skipHref={nextHref}
          schemaEditor={await wornSchemaEditor(userId, parent)}
        />
      </div>
    );
  }

  const queue = await getFieldTriageQueue(userId);
  let current = scopedId ? await getNode(userId, scopedId) : null;
  if (!scopedId) {
    // skip cursor: next queue entry after `after` (a saved node has already
    // left the queue, so findIndex misses and we naturally restart at 0)
    const afterIndex = after ? queue.findIndex((i) => i.node.id === after) : -1;
    current = queue[afterIndex + 1]?.node ?? null;
  }

  const defs = current ? await getUnfilledFields(userId, current.id) : [];
  const values = current ? await getOwnValues(userId, current.id) : {};

  return (
    <div className="flex flex-col gap-6 py-6">
      <header className="flex items-baseline justify-between">
        <h1 className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
          Field triage
        </h1>
        {/* a count, never a nag — muted by rule (DESIGN §6) */}
        <span className="text-muted-foreground text-xs">
          {queue.length === 0 ? 'nothing waiting' : `${queue.length} with empty required fields`}
        </span>
      </header>

      {!current || defs.length === 0 ? (
        <p className="text-muted-foreground py-10 text-center text-sm">
          {scopedId ? 'This node has no unfilled fields.' : 'All caught up — nothing needs values.'}
        </p>
      ) : (
        <FieldWalkStep
          node={current}
          defs={defs}
          values={values}
          emptyMessage="This node has no unfilled fields."
          action={saveAndAdvance.bind(null, current.id)}
          skipHref={scopedId ? null : `/triage/fields?after=${current.id}`}
          schemaEditor={await wornSchemaEditor(
            userId,
            current.parentId ? await getNode(userId, current.parentId) : null
          )}
        />
      )}
    </div>
  );
}
