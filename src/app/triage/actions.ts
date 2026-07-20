'use server';

import { revalidatePath } from 'next/cache';

import { requireUserId } from '@/app/_auth/requireUser';
import { DomainError } from '@/service/errors';
import { redo, undo } from '@/service/history';
import { captureNode } from '@/service/node';
import {
  createLayerAbove,
  detachMany,
  getReparentCandidates,
  group,
  removeMany,
  reparent,
  reparentMany,
} from '@/service/triage';

export type TriageResult = { ok: true } | { ok: false; error: string };

/** Domain errors become result codes — raw messages never reach the client. */
function asResult(err: unknown): TriageResult {
  if (err instanceof DomainError) return { ok: false, error: err.code };
  throw err;
}

export async function moveNodes(
  ids: string[],
  parentId: string | null,
  position?: number
): Promise<TriageResult> {
  const userId = await requireUserId();
  try {
    await reparentMany(userId, ids, parentId, { position });
  } catch (err) {
    return asResult(err);
  }
  revalidatePath('/', 'layout');
  return { ok: true };
}

export async function detachNodes(ids: string[]): Promise<TriageResult> {
  const userId = await requireUserId();
  try {
    await detachMany(userId, ids);
  } catch (err) {
    return asResult(err);
  }
  revalidatePath('/', 'layout');
  return { ok: true };
}

/** Bulk delete with one recorded op — always behind a confirm in the UI. */
export async function deleteNodes(ids: string[]): Promise<TriageResult> {
  const userId = await requireUserId();
  try {
    await removeMany(userId, ids);
  } catch (err) {
    return asResult(err);
  }
  revalidatePath('/', 'layout');
  return { ok: true };
}

export async function undoAction(): Promise<{ ok: boolean; description?: string }> {
  const userId = await requireUserId();
  try {
    const result = await undo(userId);
    if (result.ok) revalidatePath('/', 'layout');
    return result;
  } catch (err) {
    if (err instanceof DomainError) return { ok: false, description: err.code };
    throw err;
  }
}

export async function redoAction(): Promise<{ ok: boolean; description?: string }> {
  const userId = await requireUserId();
  try {
    const result = await redo(userId);
    if (result.ok) revalidatePath('/', 'layout');
    return result;
  } catch (err) {
    if (err instanceof DomainError) return { ok: false, description: err.code };
    throw err;
  }
}

export async function groupNodes(ids: string[], title?: string): Promise<TriageResult> {
  const userId = await requireUserId();
  try {
    await group(userId, ids, title);
  } catch (err) {
    return asResult(err);
  }
  revalidatePath('/triage');
  return { ok: true };
}

export async function layerAbove(childId: string, mode: 'inherit' | 'new'): Promise<TriageResult> {
  const userId = await requireUserId();
  try {
    await createLayerAbove(userId, { childId, mode });
  } catch (err) {
    return asResult(err);
  }
  revalidatePath('/triage');
  return { ok: true };
}

export async function parentCandidates(
  nodeIds: string[]
): Promise<{ id: string; title: string; path: string }[]> {
  const userId = await requireUserId();
  return getReparentCandidates(userId, nodeIds);
}

/** Create-in-place from the parent picker: no context implies a parent, so
 *  the new node lands as a confirmed root. */
export async function createParentNode(title: string): Promise<{ id: string; title: string }> {
  const userId = await requireUserId();
  const created = await captureNode(userId, { title });
  await reparent(userId, created.id, null);
  return { id: created.id, title };
}
