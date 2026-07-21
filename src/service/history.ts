import { nodeRepo } from '@/repository/nodeRepo';
import { undoRepo } from '@/repository/undoRepo';

import { CycleError, TriageError } from './errors';

/**
 * Undo/redo for triage operations — designed for bulk, where one tap can move
 * twenty nodes. Ops store the EXACT inverse (previous parentId+rank per node;
 * full restoration data for deletes) in a per-user DB-backed stack (flagged
 * choice: serverless lambdas don't share memory). A new operation clears the
 * redo branch. Known limitation: graph links removed by a delete are NOT
 * restored by undo — only the tree attachment and the rows themselves.
 */

export interface Placement {
  parentId: string | null;
  rank: string | null;
}

export interface ReparentOpPayload {
  moves: { id: string; from: Placement; to: Placement }[];
}

export interface DeleteOpPayload {
  deletions: {
    nodeId: string;
    placement: Placement;
    childMoves: { id: string; from: Placement }[];
  }[];
}

/** A bulk CREATE (A3's copy-previous-month): the inverse is deleting exactly
 *  the created nodes. They are fresh leaves (no children, no links), so undo
 *  is a plain soft-delete and redo a plain restore — no placement to rebuild. */
export interface CreateOpPayload {
  nodeIds: string[];
}

export type OpKind = 'reparent' | 'delete' | 'create';

export async function recordReparent(userId: string, payload: ReparentOpPayload): Promise<void> {
  await undoRepo.clearRedo(userId);
  await undoRepo.push(userId, 'undo', 'reparent', payload);
}

export async function recordDelete(userId: string, payload: DeleteOpPayload): Promise<void> {
  await undoRepo.clearRedo(userId);
  await undoRepo.push(userId, 'undo', 'delete', payload);
}

export async function recordCreate(userId: string, payload: CreateOpPayload): Promise<void> {
  await undoRepo.clearRedo(userId);
  await undoRepo.push(userId, 'undo', 'create', payload);
}

/** Restore placements exactly — with a cycle guard: interleaved operations can
 *  make a stale placement illegal, and undo must never corrupt the tree. */
async function applyPlacements(
  userId: string,
  moves: { id: string; place: Placement }[]
): Promise<void> {
  for (const move of moves) {
    if (move.place.parentId !== null) {
      const subtree = await nodeRepo.subtreeIds(userId, move.id);
      if (subtree.includes(move.place.parentId)) {
        throw new CycleError(move.id, move.place.parentId);
      }
    }
    const applied = await nodeRepo.setParent(userId, move.id, move.place.parentId, move.place.rank);
    if (!applied) throw new TriageError(`undo target vanished: ${move.id}`);
  }
}

async function applyOp(
  userId: string,
  kind: OpKind,
  payload: unknown,
  direction: 'undo' | 'redo'
): Promise<string> {
  if (kind === 'reparent') {
    const { moves } = payload as ReparentOpPayload;
    await applyPlacements(
      userId,
      moves.map((m) => ({ id: m.id, place: direction === 'undo' ? m.from : m.to }))
    );
    return `${direction === 'undo' ? 'moved back' : 're-moved'} ${moves.length} item${moves.length === 1 ? '' : 's'}`;
  }
  if (kind === 'create') {
    // undo a create = delete the copies; redo = restore them. Fresh leaves,
    // so soft-delete/restore is exact (no placement or link to rebuild).
    const { nodeIds } = payload as CreateOpPayload;
    for (const id of nodeIds) {
      if (direction === 'undo') await nodeRepo.softDelete(userId, id);
      else await nodeRepo.restore(userId, id);
    }
    return `${direction === 'undo' ? 'removed' : 'restored'} ${nodeIds.length} copied line${nodeIds.length === 1 ? '' : 's'}`;
  }
  const { deletions } = payload as DeleteOpPayload;
  if (direction === 'undo') {
    for (const del of deletions) {
      const restored = await nodeRepo.restore(userId, del.nodeId);
      if (!restored) throw new TriageError(`deleted node vanished: ${del.nodeId}`);
      await nodeRepo.setParent(userId, del.nodeId, del.placement.parentId, del.placement.rank);
      // children back under the restored node, exact ranks
      await applyPlacements(
        userId,
        del.childMoves.map((c) => ({ id: c.id, place: c.from }))
      );
    }
    return `restored ${deletions.length} item${deletions.length === 1 ? '' : 's'}`;
  }
  // redo of a delete re-runs the delete semantics
  const { removeNode } = await import('./triage');
  for (const del of deletions) {
    await removeNode(userId, del.nodeId, { record: false });
  }
  return `re-deleted ${deletions.length} item${deletions.length === 1 ? '' : 's'}`;
}

export async function undo(userId: string): Promise<{ ok: boolean; description?: string }> {
  const op = await undoRepo.pop(userId, 'undo');
  if (!op) return { ok: false };
  const description = await applyOp(userId, op.kind, op.payload, 'undo');
  await undoRepo.push(userId, 'redo', op.kind, op.payload);
  return { ok: true, description };
}

export async function redo(userId: string): Promise<{ ok: boolean; description?: string }> {
  const op = await undoRepo.pop(userId, 'redo');
  if (!op) return { ok: false };
  const description = await applyOp(userId, op.kind, op.payload, 'redo');
  await undoRepo.push(userId, 'undo', op.kind, op.payload);
  return { ok: true, description };
}
