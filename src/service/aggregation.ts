import type { ViewFilter } from '@/db/schema';
import {
  fieldValueRepo,
  type RepoAggregateSpec,
  type StorageFilter,
} from '@/repository/fieldValueRepo';
import { linkRepo } from '@/repository/linkRepo';
import { nodeRepo } from '@/repository/nodeRepo';

import { UnsupportedFilterError } from './errors';

/**
 * ONE aggregation engine, two input sources (DESIGN §2): a node aggregates
 * over its TREE children, its GRAPH members, or both — same computation,
 * different id set. The math itself runs as one indexed SQL pass in the
 * repository; this service only resolves the set and shapes the spec.
 * Aggregation axes are number (sum/avg) and link (group-by); nodes lacking
 * the lens field silently drop out (DESIGN §5).
 */

export type AggregationSource = 'tree' | 'graph' | 'both';
export type AggregationOp = 'sum' | 'avg' | 'count';

export interface AggregationSpec {
  /** field key whose values are aggregated (the lens) */
  lens: string;
  /** field key to group by (link/option/date identity), or a date meta-axis */
  groupBy?: string;
  op: AggregationOp;
  /** user timezone for date meta-axes (day boundaries follow their calendar) */
  tz?: string;
  /** filters on sibling field values of the same node, resolved in SQL.
   *  A node without the filtered field does not match (no row to compare). */
  filters?: ViewFilter[];
}

export interface AggregateBucket {
  /** group identity: category node id, option text, or timestamp text */
  group: string | null;
  value: number;
  count: number;
}

async function sourceIds(
  userId: string,
  nodeId: string,
  source: AggregationSource
): Promise<string[]> {
  const [tree, graph] = await Promise.all([
    source === 'graph' ? Promise.resolve([]) : nodeRepo.findChildren(userId, nodeId),
    source === 'tree' ? Promise.resolve([]) : linkRepo.findTargets(userId, nodeId),
  ]);
  return [...new Set([...tree.map((n) => n.id), ...graph.map((n) => n.id)])];
}

function toStorageFilter(filter: ViewFilter): StorageFilter {
  if (filter.op === 'in' || filter.op === 'between') {
    throw new UnsupportedFilterError(`op "${filter.op}"`);
  }
  const { key, op, value } = filter;
  if (typeof value === 'boolean') return { key, op, column: 'boolValue', value };
  if (typeof value === 'number') return { key, op, column: 'numberValue', value };
  if (value instanceof Date) return { key, op, column: 'dateValue', value };
  if (typeof value === 'string') return { key, op, column: 'textOrLink', value };
  throw new UnsupportedFilterError(`value of type ${typeof value}`);
}

export async function aggregate(
  userId: string,
  nodeId: string,
  opts: { source: AggregationSource; spec: AggregationSpec }
): Promise<AggregateBucket[]> {
  const ids = await sourceIds(userId, nodeId, opts.source);
  if (ids.length === 0) return [];
  const repoSpec: RepoAggregateSpec = {
    valueKey: opts.spec.lens,
    groupByKey: opts.spec.groupBy,
    op: opts.spec.op,
    filters: opts.spec.filters?.map(toStorageFilter),
    tz: opts.spec.tz,
  };
  const rows = await fieldValueRepo.aggregate(userId, ids, repoSpec);
  return rows.map((r) => ({ group: r.groupId, value: r.value, count: r.count }));
}

export interface BudgetVsActualRow {
  /** the shared category axis — a category node id (or null bucket) */
  category: string | null;
  budget: number;
  actual: number;
  scheduled: number;
  /** budget − actual − scheduled (negative = over budget) */
  remaining: number;
}

/**
 * DESIGN §8a: goal vs actual with no cross-set join and no special node. The
 * two operands are the SAME "Σ value by category" aggregate over different
 * sources — budget lines are TREE children of `budgetNodeId`; actuals are
 * GRAPH members of `actualsNodeId`, split by the scheduled flag. Over/under/
 * scheduled-remaining fall out as subtractions of like-shaped aggregates.
 */
export async function budgetVsActual(
  userId: string,
  params: {
    budgetNodeId: string;
    actualsNodeId: string;
    valueKey: string;
    categoryKey: string;
    scheduledKey: string;
  }
): Promise<BudgetVsActualRow[]> {
  const byCategory = (filters?: ViewFilter[]) => ({
    lens: params.valueKey,
    groupBy: params.categoryKey,
    op: 'sum' as const,
    filters,
  });
  const [budget, actual, scheduled] = await Promise.all([
    aggregate(userId, params.budgetNodeId, { source: 'tree', spec: byCategory() }),
    aggregate(userId, params.actualsNodeId, {
      source: 'graph',
      spec: byCategory([{ key: params.scheduledKey, op: 'eq', value: false }]),
    }),
    aggregate(userId, params.actualsNodeId, {
      source: 'graph',
      spec: byCategory([{ key: params.scheduledKey, op: 'eq', value: true }]),
    }),
  ]);

  const categories = new Set<string | null>([
    ...budget.map((b) => b.group),
    ...actual.map((a) => a.group),
    ...scheduled.map((s) => s.group),
  ]);
  const valueOf = (buckets: AggregateBucket[], category: string | null) =>
    buckets.find((b) => b.group === category)?.value ?? 0;

  return [...categories].map((category) => {
    const b = valueOf(budget, category);
    const a = valueOf(actual, category);
    const s = valueOf(scheduled, category);
    return { category, budget: b, actual: a, scheduled: s, remaining: b - a - s };
  });
}
