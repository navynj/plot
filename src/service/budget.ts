import type { FieldValue, Node, TypedFieldWrite } from '@/db/schema';
import { startOfDayInTz, monthBoundsInTz } from '@/lib/day';
import { fieldValueRepo } from '@/repository/fieldValueRepo';
import { nodeRepo, type NodeRow } from '@/repository/nodeRepo';

import { recordCreate } from './history';
import { reparent } from './triage';

/**
 * Month-stamped ledgers (A3): an ATTACHED appendage whose childSchema declares
 * a `date` field (the month stamp) — the Budget node. Its children (budget
 * lines) live there permanently; there is NO monthly node creation. The
 * period lens scopes which month's lines you see and aggregate; "copy from
 * previous month" duplicates a month's lines forward with amounts intact.
 *
 * This is a thin, targeted policy over ordinary nodes — no new relation kind,
 * no stored month container. The `month` field IS the only per-month state.
 */

/** A ledger = an attached node that stamps its children with a date field. */
export function isMonthStampedLedger(node: Pick<Node, 'attached' | 'childSchema'>): boolean {
  return node.attached && (node.childSchema ?? []).some((d) => d.type === 'date');
}

/** The month-stamp field key (the first date field of the ledger's schema). */
export function ledgerDateKey(node: Pick<Node, 'childSchema'>): string | null {
  return (node.childSchema ?? []).find((d) => d.type === 'date')?.key ?? null;
}

/** A ledger's children whose month-stamp falls in `month` (user tz), rank
 *  order. `month === null` (all time) returns every line. */
export async function getLedgerLines(
  userId: string,
  ledger: Pick<Node, 'id' | 'childSchema'>,
  month: string | null,
  tz: string
): Promise<NodeRow[]> {
  const children = await nodeRepo.findChildren(userId, ledger.id);
  if (month === null) return children;
  const dateKey = ledgerDateKey(ledger);
  if (!dateKey) return children;
  const { start, end } = monthBoundsInTz(month, tz);
  const rows = await fieldValueRepo.readByNodes(
    userId,
    children.map((c) => c.id)
  );
  const inMonth = new Set(
    rows
      .filter((r) => r.key === dateKey && r.dateValue !== null && r.dateValue >= start && r.dateValue < end)
      .map((r) => r.nodeId)
  );
  return children.filter((c) => inMonth.has(c.id));
}

/** The populated typed column of a row, as a write — for copying values
 *  verbatim (already validated when first saved). */
function rowToWrite(row: FieldValue): TypedFieldWrite | null {
  if (row.textValue !== null) return { column: 'textValue', value: row.textValue };
  if (row.numberValue !== null) return { column: 'numberValue', value: Number(row.numberValue) };
  if (row.boolValue !== null) return { column: 'boolValue', value: row.boolValue };
  if (row.dateValue !== null) return { column: 'dateValue', value: row.dateValue };
  if (row.linkValue !== null) return { column: 'linkValue', value: row.linkValue };
  return null;
}

export interface CopyMonthResult {
  copied: number;
}

/**
 * Duplicate `fromMonth`'s lines into `toMonth`, month-stamp advanced, every
 * other value intact. Recorded as ONE create op (undo deletes exactly the
 * copies). Does not dedupe against lines already in `toMonth` — the workflow
 * copies into an empty month; a re-copy stacks (registered, flagged).
 */
export async function copyMonth(
  userId: string,
  ledger: Pick<Node, 'id' | 'childSchema'>,
  fromMonth: string,
  toMonth: string,
  tz: string
): Promise<CopyMonthResult> {
  const dateKey = ledgerDateKey(ledger);
  if (!dateKey) return { copied: 0 };
  const sources = await getLedgerLines(userId, ledger, fromMonth, tz);
  if (sources.length === 0) return { copied: 0 };

  const newStamp = startOfDayInTz(`${toMonth}-01`, tz);
  const createdIds: string[] = [];
  for (const line of sources) {
    const created = await nodeRepo.create({
      userId,
      title: line.title,
      icon: line.icon,
      origin: 'constructed', // a budget line is structure, not a captured record
      capturedAt: new Date(),
    });
    await reparent(userId, created.id, ledger.id);
    const rows = await fieldValueRepo.readByNode(userId, line.id);
    for (const row of rows) {
      const write =
        row.key === dateKey
          ? ({ column: 'dateValue', value: newStamp } as TypedFieldWrite)
          : rowToWrite(row);
      if (write) await fieldValueRepo.upsert(userId, created.id, row.key, write);
    }
    createdIds.push(created.id);
  }
  await recordCreate(userId, { nodeIds: createdIds });
  return { copied: createdIds.length };
}
