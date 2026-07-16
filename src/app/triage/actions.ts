'use server';

import { revalidatePath } from 'next/cache';

import { requireUserId } from '@/app/_auth/requireUser';
import { DomainError } from '@/service/errors';
import {
  createLayerAbove,
  detachToInbox,
  getReparentCandidates,
  group,
  reparent,
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
    for (let i = 0; i < ids.length; i++) {
      await reparent(userId, ids[i]!, parentId, {
        position: position === undefined ? undefined : position + i,
      });
    }
  } catch (err) {
    return asResult(err);
  }
  revalidatePath('/triage');
  return { ok: true };
}

export async function detachNodes(ids: string[]): Promise<TriageResult> {
  const userId = await requireUserId();
  try {
    for (const id of ids) await detachToInbox(userId, id);
  } catch (err) {
    return asResult(err);
  }
  revalidatePath('/triage');
  return { ok: true };
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
  nodeId: string
): Promise<{ id: string; title: string; path: string }[]> {
  const userId = await requireUserId();
  return getReparentCandidates(userId, nodeId);
}
