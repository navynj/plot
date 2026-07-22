import type { FieldValue, Node, TypedFieldWrite } from '@/db/schema';
import { startOfDayInTz, monthBoundsInTz } from '@/lib/day';
import { displayName } from '@/lib/identity';
import { fieldValueRepo } from '@/repository/fieldValueRepo';
import { nodeRepo, type NodeRow } from '@/repository/nodeRepo';

import { aggregate } from './aggregation';
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

/* ================= A'' — During-style budget (total + editor) =========== */

/**
 * The MONTHLY TOTAL is the Budget node's OWN value (§8a "own field = target"),
 * distinct from the category child lines (the breakdown). Storage choice
 * (flagged): a month→amount map expressed as typed own field_values keyed
 * `total:YYYY-MM` (number), NOT a JSON blob — each month is one typed row,
 * queryable and clobber-safe, and it never collides with the ledger's
 * childSchema keys (an attached node wears no schema, so nothing else reads
 * these rows). The total is INDEPENDENT of the allocation sum — allocations
 * may exceed it, and that gap is the point (matching During).
 */
const totalKey = (month: string) => `total:${month}`;

export async function getMonthlyTotal(
  userId: string,
  budgetId: string,
  month: string
): Promise<number | null> {
  const rows = await fieldValueRepo.readByNode(userId, budgetId);
  const row = rows.find((r) => r.key === totalKey(month));
  return row?.numberValue != null ? Number(row.numberValue) : null;
}

export async function setMonthlyTotal(
  userId: string,
  budgetId: string,
  month: string,
  amount: number | null
): Promise<void> {
  if (amount === null || Number.isNaN(amount)) {
    await fieldValueRepo.deleteByKey(userId, budgetId, totalKey(month));
    return;
  }
  await fieldValueRepo.upsert(userId, budgetId, totalKey(month), {
    column: 'numberValue',
    value: amount,
  });
}

/** The Budget ledger's field keys — derived, not hardcoded (survives label
 *  edits): the link field is the category axis, the number field the amount,
 *  the date field the month stamp. Expenses share these keys by the
 *  shared-axis design (§8a), so the actual-spend aggregate uses them too. */
export function ledgerKeys(budget: Pick<Node, 'childSchema'>): {
  categoryKey: string | null;
  amountKey: string | null;
  dateKey: string | null;
  categoriesId: string | null;
} {
  const defs = budget.childSchema ?? [];
  const link = defs.find((d) => d.type === 'link');
  return {
    categoryKey: link?.key ?? null,
    amountKey: defs.find((d) => d.type === 'number')?.key ?? null,
    dateKey: defs.find((d) => d.type === 'date')?.key ?? null,
    categoriesId: link?.linkTargetParentId ?? null,
  };
}

/** The attached Budget ledger of an Expense node (the overlay holder), or
 *  null. Same identity as the view's overlay-holder lookup: an attached
 *  child that stamps months and carries a category link + amount. */
export async function getBudgetHolder(
  userId: string,
  expenseId: string
): Promise<NodeRow | null> {
  const attached = await nodeRepo.findAttachedChildren(userId, expenseId);
  return (
    attached.find(
      (a) => isMonthStampedLedger(a) && (a.childSchema ?? []).some((d) => d.type === 'link')
    ) ?? null
  );
}

export interface BudgetEditorRow {
  categoryId: string;
  name: string;
  icon: string | null;
  /** existing allocation for this month (null = none yet) */
  allocation: number | null;
  /** month's actual spending (current + scheduled) via the §8a engine */
  actual: number;
}

export interface BudgetEditorData {
  budgetId: string;
  expenseId: string;
  total: number | null;
  rows: BudgetEditorRow[];
}

/** Everything the editor needs for one month: the total, EVERY expense
 *  category (so unallocated ones can be given a target inline), each with its
 *  existing allocation and its §8a actual spend for the month. */
export async function getBudgetEditorData(
  userId: string,
  budgetId: string,
  month: string,
  tz: string
): Promise<BudgetEditorData | null> {
  const budget = await nodeRepo.byId(userId, budgetId);
  if (!budget || budget.parentId === null) return null;
  const expenseId = budget.parentId;
  const { categoryKey, amountKey, categoriesId } = ledgerKeys(budget);
  if (!categoryKey || !amountKey || !categoriesId) return null;

  const [categories, lines, total, spend] = await Promise.all([
    nodeRepo.findChildren(userId, categoriesId), // ALL categories, not just allocated
    getLedgerLines(userId, budget, month, tz),
    getMonthlyTotal(userId, budgetId, month),
    // §8a engine: actual (current + scheduled) per category for the month —
    // an unfiltered by-category sum equals the view's value + pendingValue.
    aggregate(userId, expenseId, {
      source: 'both',
      spec: { lens: amountKey, groupBy: categoryKey, op: 'sum', period: monthBoundsInTz(month, tz) },
    }),
  ]);

  const lineRows = await fieldValueRepo.readByNodes(
    userId,
    lines.map((l) => l.id)
  );
  const allocByCategory = new Map<string, number>();
  for (const line of lines) {
    const own = lineRows.filter((r) => r.nodeId === line.id);
    const cat = own.find((r) => r.key === categoryKey)?.linkValue ?? null;
    const amt = own.find((r) => r.key === amountKey)?.numberValue ?? null;
    if (cat !== null && amt !== null) allocByCategory.set(cat, Number(amt));
  }
  const actualByCategory = new Map(spend.map((s) => [s.group, s.value]));

  const rows: BudgetEditorRow[] = categories.map((c) => ({
    categoryId: c.id,
    name: displayName(c),
    icon: c.displayIcon ?? null,
    allocation: allocByCategory.get(c.id) ?? null,
    actual: actualByCategory.get(c.id) ?? 0,
  }));
  return { budgetId, expenseId, total, rows };
}

/** Read one month's total + allocations for prefill (the editor's "copy from
 *  previous month" fills the form client-side from this). */
export async function loadBudgetMonth(
  userId: string,
  budgetId: string,
  month: string,
  tz: string
): Promise<{ total: number | null; allocations: Record<string, number> }> {
  const data = await getBudgetEditorData(userId, budgetId, month, tz);
  if (!data) return { total: null, allocations: {} };
  const allocations: Record<string, number> = {};
  for (const r of data.rows) if (r.allocation !== null) allocations[r.categoryId] = r.allocation;
  return { total: data.total, allocations };
}

/**
 * Commit the whole editor form for one month. WRITE ORDER (no neon-http
 * transactions, CLAUDE.md §6): the monthly TOTAL first (one own row), THEN
 * per-category allocation lines. A partial failure therefore leaves a
 * harmless prefix — a valid total with some allocations set — and never a
 * line referencing a half-written total. Allocations cleared to null delete
 * their line; new amounts create a line, existing amounts update in place.
 */
export async function saveBudget(
  userId: string,
  budgetId: string,
  month: string,
  tz: string,
  form: { total: number | null; allocations: Record<string, number | null> }
): Promise<void> {
  const budget = await nodeRepo.byId(userId, budgetId);
  if (!budget) return;
  const { categoryKey, amountKey, dateKey } = ledgerKeys(budget);
  if (!categoryKey || !amountKey || !dateKey) return;

  // 1 — TOTAL first (single own row)
  await setMonthlyTotal(userId, budgetId, month, form.total);

  // 2 — allocation lines: one per category, keyed by the line's category link
  const lines = await getLedgerLines(userId, budget, month, tz);
  const lineRows = await fieldValueRepo.readByNodes(
    userId,
    lines.map((l) => l.id)
  );
  const lineByCategory = new Map<string, string>(); // categoryId → lineNodeId
  for (const line of lines) {
    const cat = lineRows.find((r) => r.nodeId === line.id && r.key === categoryKey)?.linkValue;
    if (cat) lineByCategory.set(cat, line.id);
  }
  const stamp = startOfDayInTz(`${month}-01`, tz);

  for (const [categoryId, amount] of Object.entries(form.allocations)) {
    const existing = lineByCategory.get(categoryId);
    if (amount === null || Number.isNaN(amount)) {
      if (existing) await nodeRepo.softDelete(userId, existing); // cleared → remove line
      continue;
    }
    if (existing) {
      await fieldValueRepo.upsert(userId, existing, amountKey, {
        column: 'numberValue',
        value: amount,
      });
    } else {
      const created = await nodeRepo.create({
        userId,
        title: 'budget line',
        origin: 'constructed',
        capturedAt: new Date(),
      });
      await reparent(userId, created.id, budgetId);
      await fieldValueRepo.upsert(userId, created.id, categoryKey, {
        column: 'linkValue',
        value: categoryId,
      });
      await fieldValueRepo.upsert(userId, created.id, amountKey, {
        column: 'numberValue',
        value: amount,
      });
      await fieldValueRepo.upsert(userId, created.id, dateKey, { column: 'dateValue', value: stamp });
    }
  }
}
