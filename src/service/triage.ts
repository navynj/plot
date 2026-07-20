import type { FieldDef, Node } from '@/db/schema';
import { rankBetween, spreadRanks } from '@/lib/rank';
import { linkRepo } from '@/repository/linkRepo';
import { nodeRepo } from '@/repository/nodeRepo';

import { describeCandidates, type NodeCandidate } from './candidates';
import { CycleError, NodeNotFoundError, TriageError } from './errors';
import { recordDelete, recordReparent, type DeleteOpPayload, type Placement } from './history';

/**
 * THE single entry point for every position change (DESIGN §6): drag,
 * keyboard, picker — all thin adapters over these functions. Cycle rejection,
 * subtree carrying, rank math, and layer-insertion schema handling live here
 * once. Field values are untouched by every operation: a moved node keeps its
 * `field_value` rows even when the new parent's schema doesn't declare those
 * keys (harmless, DESIGN §9).
 */

async function mustOwn(userId: string, id: string): Promise<Node> {
  const found = await nodeRepo.byId(userId, id);
  if (!found) throw new NodeNotFoundError(id);
  return found;
}

/** Rank for landing at `position` among the target siblings (append when
 *  undefined). Rebalances the sibling set when ranks are missing/exhausted. */
async function rankFor(
  userId: string,
  parentId: string | null,
  position: number | undefined,
  movingIds: string[]
): Promise<string> {
  const all = parentId
    ? await nodeRepo.findChildren(userId, parentId)
    : await nodeRepo.findRoots(userId);
  const siblings = all.filter((s) => !movingIds.includes(s.id));
  const index =
    position === undefined ? siblings.length : Math.max(0, Math.min(position, siblings.length));
  const before = index > 0 ? (siblings[index - 1]?.rank ?? null) : null;
  const after = index < siblings.length ? (siblings[index]?.rank ?? null) : null;

  if ((index > 0 && before === null) || (index < siblings.length && after === null)) {
    return rebalance(userId, siblings, index);
  }
  const rank = rankBetween(before, after);
  return rank ?? rebalance(userId, siblings, index);
}

async function rebalance(userId: string, siblings: Node[], index: number): Promise<string> {
  const ranks = spreadRanks(siblings.length + 1);
  const assignments = siblings.map((s, i) => ({
    id: s.id,
    rank: ranks[i < index ? i : i + 1]!,
  }));
  await nodeRepo.setRanks(userId, assignments);
  return ranks[index]!;
}

/**
 * Re-parent a node. `newParentId: null` = CONFIRMED ROOT: parent-less with a
 * rank among roots — positioned, so it leaves the inbox. (Undetermined is
 * `detachToInbox`.) The subtree carries: children reference the moved node,
 * so nothing else changes. The node now wears the new parent's childSchema
 * (resolution is depth-1 and dynamic); its own values stay.
 */
export async function reparent(
  userId: string,
  nodeId: string,
  newParentId: string | null,
  opts: { position?: number } = {}
): Promise<Node> {
  await mustOwn(userId, nodeId);
  if (newParentId !== null) {
    if (newParentId === nodeId) throw new CycleError(nodeId, newParentId);
    await mustOwn(userId, newParentId);
    const subtree = await nodeRepo.subtreeIds(userId, nodeId);
    if (subtree.includes(newParentId)) throw new CycleError(nodeId, newParentId);
  }
  const rank = await rankFor(userId, newParentId, opts.position, [nodeId]);
  const moved = await nodeRepo.setParent(userId, nodeId, newParentId, rank);
  if (!moved) throw new NodeNotFoundError(nodeId);
  return moved;
}

/** Bulk move — the primary triage surface. One recorded op for the whole
 *  batch, so a single undo restores every node's previous parent AND rank. */
export async function reparentMany(
  userId: string,
  nodeIds: string[],
  newParentId: string | null,
  opts: { position?: number; record?: boolean } = {}
): Promise<void> {
  const moves: { id: string; from: Placement; to: Placement }[] = [];
  for (let i = 0; i < nodeIds.length; i++) {
    const id = nodeIds[i]!;
    const before = await mustOwn(userId, id);
    const after = await reparent(userId, id, newParentId, {
      position: opts.position === undefined ? undefined : opts.position + i,
    });
    moves.push({
      id,
      from: { parentId: before.parentId, rank: before.rank },
      to: { parentId: after.parentId, rank: after.rank },
    });
  }
  if (opts.record !== false && moves.length > 0) {
    await recordReparent(userId, { moves });
  }
}

/** Bulk detach to the inbox — one recorded op. */
export async function detachMany(
  userId: string,
  nodeIds: string[],
  opts: { record?: boolean } = {}
): Promise<void> {
  const moves: { id: string; from: Placement; to: Placement }[] = [];
  for (const id of nodeIds) {
    const before = await mustOwn(userId, id);
    await detachToInbox(userId, id);
    moves.push({
      id,
      from: { parentId: before.parentId, rank: before.rank },
      to: { parentId: null, rank: null },
    });
  }
  if (opts.record !== false && moves.length > 0) {
    await recordReparent(userId, { moves });
  }
}

/** Back to undetermined: no parent, no position → the inbox filter. The
 *  subtree carries along, still attached beneath it. */
export async function detachToInbox(userId: string, nodeId: string): Promise<Node> {
  await mustOwn(userId, nodeId);
  const detached = await nodeRepo.setParent(userId, nodeId, null, null);
  if (!detached) throw new NodeNotFoundError(nodeId);
  return detached;
}

/**
 * Insert `nodeId` as a new layer between `childId` and its current parent
 * (DESIGN §3). Exactly two schema choices:
 * - `inherit` (default): the layer SNAPSHOTS the old parent's childSchema as
 *   its own — the child's worn schema is unchanged; a lossless insertion.
 *   Later edits to the original parent's schema do not propagate (CLAUDE.md §3).
 * - `new`: the layer starts with an empty childSchema; the rule changes from
 *   this level down.
 */
export async function insertLayer(
  userId: string,
  params: { nodeId: string; childId: string; mode: 'inherit' | 'new' }
): Promise<Node> {
  const { nodeId, childId, mode } = params;
  if (nodeId === childId) throw new CycleError(nodeId, childId);
  await mustOwn(userId, nodeId);
  const child = await mustOwn(userId, childId);

  // if the child sits inside the node's own subtree, the node's new parent
  // (the child's old parent) would also be inside it — a cycle
  const subtree = await nodeRepo.subtreeIds(userId, nodeId);
  if (subtree.includes(childId)) throw new CycleError(nodeId, childId);

  let snapshot: FieldDef[] = [];
  if (mode === 'inherit' && child.parentId) {
    const oldParent = await mustOwn(userId, child.parentId);
    snapshot = structuredClone(oldParent.childSchema ?? []);
  }

  // the layer takes the child's exact place (parent AND rank — including the
  // undetermined state: wrapping an inbox node keeps the bundle in the inbox)
  const layer = await nodeRepo.setParent(userId, nodeId, child.parentId, child.rank);
  if (!layer) throw new NodeNotFoundError(nodeId);
  await nodeRepo.update(userId, nodeId, { childSchema: snapshot, schemaMode: mode });
  await nodeRepo.setParent(userId, childId, nodeId, spreadRanks(1)[0]!);

  const result = await nodeRepo.byId(userId, nodeId);
  if (!result) throw new NodeNotFoundError(nodeId);
  return result;
}

/** Create a fresh layer node and insert it above `childId` — the row-action
 *  form of layer insertion. */
export async function createLayerAbove(
  userId: string,
  params: { childId: string; mode: 'inherit' | 'new'; title?: string }
): Promise<Node> {
  const layer = await nodeRepo.create({
    userId,
    title: params.title ?? 'New layer',
    capturedAt: new Date(),
  });
  return insertLayer(userId, { nodeId: layer.id, childId: params.childId, mode: params.mode });
}

/**
 * Bottom-up bundling (DESIGN §6): create a group node and move the selected
 * nodes under it. The group itself is born undetermined (no parent, no rank)
 * — bundle first, position later — so it sits in the inbox as one unit.
 */
export async function group(userId: string, nodeIds: string[], title?: string): Promise<Node> {
  const unique = [...new Set(nodeIds)];
  if (unique.length === 0) throw new TriageError('group needs at least one node');
  for (const id of unique) await mustOwn(userId, id);

  const groupNode = await nodeRepo.create({
    userId,
    title: title ?? 'New group',
    capturedAt: new Date(),
  });
  const ranks = spreadRanks(unique.length);
  await nodeRepo.batchReparent(
    userId,
    unique.map((id, i) => ({ id, rank: ranks[i]! })),
    groupNode.id
  );
  return groupNode;
}

/** Everything the given nodes may be re-parented onto: all of the user's
 *  nodes except the union of their own subtrees (mirrored by the picker and
 *  by drag's exclusion). */
export async function getReparentCandidates(
  userId: string,
  nodeIds: string[]
): Promise<NodeCandidate[]> {
  const [all, ...subtrees] = await Promise.all([
    nodeRepo.findTimeline(userId),
    ...nodeIds.map((id) => nodeRepo.subtreeIds(userId, id)),
  ]);
  return describeCandidates(all, new Set(subtrees.flat()));
}

/**
 * Delete a node, closing the gap: its tree children re-parent to the deleted
 * node's parent (same shape as detach, one level up — no cycle is possible,
 * the destination is an ancestor), placed where the node was; every graph
 * edge touching it is removed; the row itself soft-deletes. Field values of
 * the node stay on the soft-deleted row; descendants are untouched.
 */
export async function removeNode(
  userId: string,
  nodeId: string,
  opts: { record?: boolean } = {}
): Promise<DeleteOpPayload['deletions'][number]> {
  const node = await mustOwn(userId, nodeId);
  const children = await nodeRepo.findChildren(userId, nodeId);
  const inverse: DeleteOpPayload['deletions'][number] = {
    nodeId,
    placement: { parentId: node.parentId, rank: node.rank },
    childMoves: children.map((c) => ({ id: c.id, from: { parentId: c.parentId, rank: c.rank } })),
  };

  if (children.length > 0) {
    // slot the children into the deleted node's position among its siblings
    const siblings =
      node.parentId !== null
        ? await nodeRepo.findChildren(userId, node.parentId)
        : node.rank !== null
          ? await nodeRepo.findRoots(userId)
          : null; // undetermined parent-less node: children go to the inbox
    let moves: { id: string; rank: string | null }[];
    if (siblings === null) {
      moves = children.map((c) => ({ id: c.id, rank: null }));
    } else {
      const index = siblings.findIndex((s) => s.id === nodeId);
      const after = index >= 0 ? (siblings[index + 1]?.rank ?? null) : null;
      let prev = node.rank;
      moves = children.map((c) => {
        const rank = rankBetween(prev, after) ?? rankBetween(prev, null) ?? spreadRanks(1)[0]!;
        prev = rank;
        return { id: c.id, rank };
      });
    }
    await nodeRepo.batchReparent(userId, moves, node.parentId);
  }

  const unlinked = await linkRepo.removeAllFor(userId, nodeId);
  if (!unlinked) throw new NodeNotFoundError(nodeId);
  const deleted = await nodeRepo.softDelete(userId, nodeId);
  if (!deleted) throw new NodeNotFoundError(nodeId);
  if (opts.record !== false) {
    await recordDelete(userId, { deletions: [inverse] });
  }
  return inverse;
}

/** Bulk delete — one recorded op covering every node's restoration data. */
export async function removeMany(userId: string, nodeIds: string[]): Promise<void> {
  const deletions: DeleteOpPayload['deletions'] = [];
  for (const id of nodeIds) {
    deletions.push(await removeNode(userId, id, { record: false }));
  }
  if (deletions.length > 0) {
    await recordDelete(userId, { deletions });
  }
}
