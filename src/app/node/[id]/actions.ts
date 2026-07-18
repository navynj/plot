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
import { setChildSchema, setViewSpec } from '@/service/node';

import { DomainError, InvalidSchemaError } from '@/service/errors';

export async function saveFields(nodeId: string, formData: FormData): Promise<void> {
  const userId = await requireUserId();
  const raw: Record<string, unknown> = Object.fromEntries(formData.entries());
  const keysField = formData.get('__fieldKeys');
  const editedKeys =
    typeof keysField === 'string' && keysField !== '' ? keysField.split(',') : undefined;
  await saveOwnValues(userId, nodeId, raw, editedKeys);
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

/** dev-only, see ViewSpecDevEditor; empty or "null" clears the spec */
export async function saveViewSpecDev(nodeId: string, formData: FormData): Promise<void> {
  const userId = await requireUserId();
  const text = formData.get('viewSpec');
  const raw = typeof text === 'string' ? text.trim() : '';
  let parsed: unknown = null;
  if (raw !== '' && raw !== 'null') {
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new InvalidSchemaError('not valid JSON');
    }
  }
  await setViewSpec(userId, nodeId, parsed);
  revalidatePath(`/node/${nodeId}`);
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
