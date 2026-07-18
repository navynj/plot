'use server';

import { revalidatePath } from 'next/cache';

import { requireUserId } from '@/app/_auth/requireUser';
import type { NodeCandidate } from '@/service/candidates';
import {
  addToCollection,
  getCollectionCandidates,
  removeFromCollection,
} from '@/service/collection';
import { getLinkCandidates, saveOwnValues } from '@/service/field';
import { setChildSchema } from '@/service/node';

import { DomainError, InvalidSchemaError } from '@/service/errors';

export async function saveFields(nodeId: string, formData: FormData): Promise<void> {
  const userId = await requireUserId();
  const raw: Record<string, unknown> = Object.fromEntries(formData.entries());
  await saveOwnValues(userId, nodeId, raw);
  revalidatePath(`/node/${nodeId}`);
}

export type CollectionResult = { ok: true } | { ok: false; error: string };

export async function addCollection(
  nodeId: string,
  collectionId: string
): Promise<CollectionResult> {
  const userId = await requireUserId();
  try {
    await addToCollection(userId, collectionId, nodeId);
  } catch (err) {
    if (err instanceof DomainError) return { ok: false, error: err.code };
    throw err;
  }
  revalidatePath(`/node/${nodeId}`);
  return { ok: true };
}

/** form action: removes the edge, revalidates the page it was clicked on */
export async function removeMembership(
  collectionId: string,
  memberId: string,
  revalidateNodeId: string
): Promise<void> {
  const userId = await requireUserId();
  await removeFromCollection(userId, collectionId, memberId);
  revalidatePath(`/node/${revalidateNodeId}`);
}

export async function collectionCandidates(nodeId: string): Promise<NodeCandidate[]> {
  const userId = await requireUserId();
  return getCollectionCandidates(userId, nodeId);
}

export async function linkCandidates(scopeParentId: string | null): Promise<NodeCandidate[]> {
  const userId = await requireUserId();
  return getLinkCandidates(userId, { linkTargetParentId: scopeParentId ?? undefined });
}

/** dev-only, see ChildSchemaDevEditor */
export async function saveChildSchemaDev(nodeId: string, formData: FormData): Promise<void> {
  const userId = await requireUserId();
  const text = formData.get('childSchema');
  let parsed: unknown;
  try {
    parsed = JSON.parse(typeof text === 'string' ? text : '');
  } catch {
    throw new InvalidSchemaError('not valid JSON');
  }
  await setChildSchema(userId, nodeId, parsed);
  revalidatePath(`/node/${nodeId}`);
}
