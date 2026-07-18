import type { FieldPrimitive, Node, ViewFilter, ViewSpec } from '@/db/schema';
import { fieldValueRepo } from '@/repository/fieldValueRepo';
import { linkRepo } from '@/repository/linkRepo';
import { nodeRepo } from '@/repository/nodeRepo';

import { aggregate, type AggregateBucket, type AggregationOp } from './aggregation';
import { labelOf } from './candidates';
import { extractValue } from './field';

/**
 * THE viewSpec interpreter (DESIGN §5): resolves a node's spec into
 * renderer-ready data. Layout renderers are dumb — data + spec in, markup
 * out — so every rule lives here once:
 * - the view's set is always the node's aggregate set: tree children AND
 *   graph members (DESIGN §2 "one shared aggregation engine"); nodes lacking
 *   the lens silently drop out, which also excludes structural children like
 *   §8a's Budget holder from the member aggregate.
 * - chart layouts (bar/line/calendar/heatmap) aggregate via Phase 5's engine;
 *   list/grid are item listings.
 * - overlayOwnField: the node's own value when it has one; otherwise the §8a
 *   budget-lines pattern — the first tree child whose childSchema declares
 *   BOTH the lens and the groupBy is the overlay holder, and the overlay is
 *   the same-shaped aggregate over ITS children (tree side).
 */

export interface ViewBucket {
  group: string | null;
  label: string;
  value: number;
  count: number;
  overlayValue: number | null;
  /** §8a: when the spec has an overlay AND a single boolean eq filter, the
   *  filter reads as a SPLIT — this is the excluded complement (e.g. the
   *  scheduled sum). Over-ness is value + pending vs overlay. */
  pendingValue: number | null;
}

export interface ViewItem {
  id: string;
  label: string;
  lensValue: FieldPrimitive | null;
  capturedAt: Date;
}

export type ResolvedView =
  | { kind: 'aggregate'; spec: ViewSpec; buckets: ViewBucket[]; hasOverlay: boolean }
  | { kind: 'items'; spec: ViewSpec; items: ViewItem[] };

const CHART_LAYOUTS = new Set(['bar', 'line', 'calendar', 'heatmap']);

export async function resolveView(userId: string, node: Node): Promise<ResolvedView | null> {
  const spec = node.viewSpec;
  if (!spec) return null;
  return CHART_LAYOUTS.has(spec.layout)
    ? resolveAggregateView(userId, node, spec)
    : resolveItemsView(userId, node, spec);
}

/* ---------------- aggregate path (bar / line / calendar / heatmap) ------- */

async function resolveAggregateView(
  userId: string,
  node: Node,
  spec: ViewSpec
): Promise<ResolvedView> {
  const op: AggregationOp = spec.aggregate && spec.aggregate !== 'none' ? spec.aggregate : 'sum';
  const main = await aggregate(userId, node.id, {
    source: 'both',
    spec: { lens: spec.lens, groupBy: spec.groupBy, op, filters: spec.filter },
  });
  const overlay = spec.overlayOwnField ? await resolveOverlay(userId, node, spec) : null;

  // §8a split: with an overlay AND exactly one boolean eq filter, the filter
  // partitions the set (actual vs scheduled) — also aggregate the complement
  // so over-ness against the overlay counts the not-yet-counted side.
  const splitFilter =
    overlay !== null && spec.filter?.length === 1 && typeof spec.filter[0]!.value === 'boolean'
      ? spec.filter[0]!
      : null;
  const pending =
    splitFilter && splitFilter.op === 'eq'
      ? await aggregate(userId, node.id, {
          source: 'both',
          spec: {
            lens: spec.lens,
            groupBy: spec.groupBy,
            op,
            filters: [{ ...splitFilter, value: !(splitFilter.value as boolean) }],
          },
        })
      : null;

  const groups = new Set<string | null>([
    ...main.map((b) => b.group),
    ...(overlay?.map((b) => b.group) ?? []),
    ...(pending?.map((b) => b.group) ?? []),
  ]);
  const labels = await groupLabels(userId, [...groups]);
  const pick = (buckets: AggregateBucket[] | null, group: string | null) =>
    buckets?.find((b) => b.group === group);

  const buckets: ViewBucket[] = [...groups]
    .map((group) => ({
      group,
      label: labels.get(group) ?? '(none)',
      value: pick(main, group)?.value ?? 0,
      count: pick(main, group)?.count ?? 0,
      overlayValue: overlay ? (pick(overlay, group)?.value ?? 0) : null,
      pendingValue: pending ? (pick(pending, group)?.value ?? 0) : null,
    }))
    .sort(bucketComparator(spec));
  return { kind: 'aggregate', spec, buckets, hasOverlay: overlay !== null };
}

/** own scalar value when present; else the §8a budget-lines pattern. */
async function resolveOverlay(
  userId: string,
  node: Node,
  spec: ViewSpec
): Promise<AggregateBucket[] | null> {
  const key = spec.overlayOwnField!;
  const ownRows = await fieldValueRepo.readByNode(userId, node.id);
  const ownRow = ownRows.find((r) => r.key === key);
  if (ownRow) {
    const own = extractValue(ownRow);
    return typeof own === 'number' ? [{ group: null, value: own, count: 1 }] : null;
  }
  if (!spec.groupBy) return null;
  const children = await nodeRepo.findChildren(userId, node.id);
  const holder = children.find((child) => {
    const keys = new Set((child.childSchema ?? []).map((d) => d.key));
    return keys.has(spec.lens) && keys.has(spec.groupBy!);
  });
  if (!holder) return null;
  return aggregate(userId, holder.id, {
    source: 'tree',
    spec: { lens: spec.lens, groupBy: spec.groupBy, op: 'sum' },
  });
}

/** group ids → display labels: node title for link groups, YYYY-MM-DD for
 *  timestamp groups, the raw text otherwise. */
async function groupLabels(
  userId: string,
  groups: (string | null)[]
): Promise<Map<string | null, string>> {
  const all = await nodeRepo.findTimeline(userId);
  const byId = new Map(all.map((n) => [n.id, n]));
  const map = new Map<string | null, string>();
  for (const group of groups) {
    if (group === null) {
      map.set(group, '(total)');
    } else if (byId.has(group)) {
      map.set(group, labelOf(byId.get(group)!));
    } else if (/^\d{4}-\d{2}-\d{2}/.test(group)) {
      map.set(group, group.slice(0, 10));
    } else {
      map.set(group, group);
    }
  }
  return map;
}

function bucketComparator(spec: ViewSpec): (a: ViewBucket, b: ViewBucket) => number {
  const dir = spec.sort?.dir === 'desc' ? -1 : 1;
  if (spec.sort?.by === spec.lens) return (a, b) => dir * (a.value - b.value);
  return (a, b) => dir * a.label.localeCompare(b.label); // ISO dates sort chronologically
}

/* ---------------- items path (list / grid) ------------------------------ */

async function resolveItemsView(userId: string, node: Node, spec: ViewSpec): Promise<ResolvedView> {
  const [children, members] = await Promise.all([
    nodeRepo.findChildren(userId, node.id),
    linkRepo.findTargets(userId, node.id),
  ]);
  const nodes = [...new Map([...children, ...members].map((n) => [n.id, n])).values()];
  const rows = await fieldValueRepo.readByNodes(
    userId,
    nodes.map((n) => n.id)
  );
  const valueOf = (nodeId: string, key: string): FieldPrimitive | null => {
    const row = rows.find((r) => r.nodeId === nodeId && r.key === key);
    return row ? extractValue(row) : null;
  };
  const lensOf = (n: Node): FieldPrimitive | null => {
    if (spec.lens === 'capturedAt') return n.capturedAt;
    if (spec.lens === 'eventDate') return n.eventDate;
    if (spec.lens === 'title') return n.title;
    return valueOf(n.id, spec.lens);
  };

  const passes = (n: Node, f: ViewFilter): boolean => {
    const actual =
      f.key === 'capturedAt' || f.key === 'eventDate' ? lensOf(n) : valueOf(n.id, f.key);
    if (actual === null) return false; // lacking the field → drops out (DESIGN §5)
    const cmp =
      actual instanceof Date && f.value instanceof Date
        ? actual.getTime() - f.value.getTime()
        : typeof actual === 'number' && typeof f.value === 'number'
          ? actual - f.value
          : String(actual).localeCompare(String(f.value));
    switch (f.op) {
      case 'eq':
        return cmp === 0 || actual === f.value;
      case 'neq':
        return cmp !== 0 && actual !== f.value;
      case 'gt':
        return cmp > 0;
      case 'gte':
        return cmp >= 0;
      case 'lt':
        return cmp < 0;
      case 'lte':
        return cmp <= 0;
      default:
        return false;
    }
  };

  const sortKey = spec.sort?.by;
  const dir = spec.sort?.dir === 'desc' ? -1 : 1;
  const sortValue = (n: Node): number | string => {
    if (!sortKey || sortKey === 'capturedAt') return n.capturedAt.getTime();
    if (sortKey === 'title') return n.title ?? '';
    const v = sortKey === 'eventDate' ? n.eventDate : valueOf(n.id, sortKey);
    if (v instanceof Date) return v.getTime();
    if (typeof v === 'number') return v;
    return v === null ? '' : String(v);
  };

  const items: ViewItem[] = nodes
    .filter((n) => (spec.filter ?? []).every((f) => passes(n, f)))
    .sort((a, b) => {
      const va = sortValue(a);
      const vb = sortValue(b);
      const cmp =
        typeof va === 'number' && typeof vb === 'number'
          ? va - vb
          : String(va).localeCompare(String(vb));
      return dir * cmp;
    })
    .map((n) => ({ id: n.id, label: labelOf(n), lensValue: lensOf(n), capturedAt: n.capturedAt }));

  return { kind: 'items', spec, items };
}
