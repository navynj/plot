import type { Node } from '@/db/schema';

/** Pure presentation math for the triage board: flatten the tree into visible
 *  rows, and resolve a (gap, depth) landing point into a reparent target.
 *  Cycle ENFORCEMENT lives in service/triage; the exclusion here only mirrors
 *  it so invalid targets never light up. */

export interface TreeRow {
  node: Node;
  depth: number;
  hasChildren: boolean;
}

const byRank = (a: Node, b: Node) =>
  (a.rank ?? '~').localeCompare(b.rank ?? '~') || a.capturedAt.getTime() - b.capturedAt.getTime();

export function childrenMap(nodes: Node[]): Map<string | null, Node[]> {
  const map = new Map<string | null, Node[]>();
  for (const n of nodes) {
    const key = n.parentId;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(n);
  }
  for (const list of map.values()) list.sort(byRank);
  return map;
}

/** Confirmed roots: parent-less AND positioned (rank set). */
export function rootsOf(nodes: Node[]): Node[] {
  return nodes.filter((n) => n.parentId === null && n.rank !== null).sort(byRank);
}

/** Undetermined: parent-less and never positioned — the inbox slice. */
export function inboxOf(nodes: Node[]): Node[] {
  return nodes.filter((n) => n.parentId === null && n.rank === null);
}

/** Depth-first flatten of the visible tree, honoring the expanded set. */
export function flattenTree(nodes: Node[], expanded: Set<string>): TreeRow[] {
  const children = childrenMap(nodes);
  const rows: TreeRow[] = [];
  const walk = (list: Node[], depth: number) => {
    for (const n of list) {
      const kids = children.get(n.id) ?? [];
      rows.push({ node: n, depth, hasChildren: kids.length > 0 });
      if (kids.length > 0 && expanded.has(n.id)) walk(kids, depth + 1);
    }
  };
  walk(rootsOf(nodes), 0);
  return rows;
}

/** The node and all its descendants — the set drag must exclude. */
export function subtreeIdsOf(nodes: Node[], rootId: string): Set<string> {
  const children = childrenMap(nodes);
  const out = new Set<string>([rootId]);
  const stack = [rootId];
  while (stack.length > 0) {
    for (const child of children.get(stack.pop()!) ?? []) {
      if (!out.has(child.id)) {
        out.add(child.id);
        stack.push(child.id);
      }
    }
  }
  return out;
}

export interface DropTarget {
  parentId: string | null;
  position: number;
}

/** Valid depth band for the gap above rows[gapIndex] (gap 0 = top; gap
 *  rows.length = bottom): deep enough to nest under the row above, never
 *  shallower than the row below. */
export function depthRange(rows: TreeRow[], gapIndex: number): { min: number; max: number } {
  const above = rows[gapIndex - 1];
  const below = rows[gapIndex];
  return { min: below ? below.depth : 0, max: above ? above.depth + 1 : 0 };
}

/**
 * Resolve a landing point: gap + depth → parent and sibling position.
 * depth = above.depth + 1 lands "onto" the row above (its child); shallower
 * depths land as a sibling of the ancestor at that depth. Returns null when
 * the target would sit inside the dragged subtree.
 */
export function resolveGap(
  rows: TreeRow[],
  nodes: Node[],
  gapIndex: number,
  depth: number,
  draggingIds: string[]
): DropTarget | null {
  const { min, max } = depthRange(rows, gapIndex);
  const d = Math.max(min, Math.min(depth, max));

  // walk up from the gap to find the parent: nearest earlier row at depth d-1
  let parentId: string | null = null;
  for (let i = gapIndex - 1; i >= 0; i--) {
    const row = rows[i]!;
    if (row.depth === d - 1) {
      parentId = row.node.id;
      break;
    }
    if (row.depth < d - 1) break;
  }
  if (d > 0 && parentId === null) return null;

  // exclusion: never inside the dragged nodes' own subtrees
  const excluded = new Set<string>();
  for (const id of draggingIds) for (const sub of subtreeIdsOf(nodes, id)) excluded.add(sub);
  if (parentId !== null && excluded.has(parentId)) return null;

  // position = how many earlier visible siblings of that parent sit above the gap
  let position = 0;
  for (let i = 0; i < gapIndex; i++) {
    const row = rows[i]!;
    if (row.node.parentId === parentId && row.depth === d && !draggingIds.includes(row.node.id)) {
      position++;
    }
  }
  return { parentId, position };
}
