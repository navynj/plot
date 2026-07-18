import Link from 'next/link';

import { requireUserId } from '@/app/_auth/requireUser';
import { FieldEditors } from '@/components/field/FieldEditors';
import { Button } from '@/components/ui/button';
import { getOwnValues } from '@/service/field';
import { getFieldTriageQueue, getUnfilledFields } from '@/service/fieldTriage';
import { getNode } from '@/service/node';

import { saveAndAdvance } from './actions';

export const dynamic = 'force-dynamic';

/** Field triage (DESIGN §6): one node at a time — body visible for reference,
 *  unfilled fields via the registry editors (required first). Save-partial
 *  and skip are both one tap; nothing gates. `?node=` scopes the same flow to
 *  one node (the detail-page entry point); `?after=` is the skip cursor. */
export default async function FieldTriagePage({
  searchParams,
}: {
  searchParams: Promise<{ node?: string; after?: string }>;
}) {
  const { node: scopedId, after } = await searchParams;
  const userId = await requireUserId();

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
        <section className="flex flex-col gap-4">
          <div className="border-border rounded-lg border p-4">
            <Link href={`/node/${current.id}`} className="text-sm font-medium hover:underline">
              {current.title ?? '(untitled)'}
            </Link>
            {current.body && (
              <p className="text-muted-foreground mt-1 text-sm whitespace-pre-wrap">
                {current.body}
              </p>
            )}
          </div>
          <FieldEditors
            defs={defs}
            values={values}
            action={saveAndAdvance.bind(null, current.id)}
          />
          {!scopedId && (
            <Button variant="ghost" size="sm" className="text-muted-foreground self-start" asChild>
              <Link href={`/triage/fields?after=${current.id}`}>Skip</Link>
            </Button>
          )}
        </section>
      )}
    </div>
  );
}
