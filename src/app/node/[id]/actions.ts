'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { requireUserId } from '@/app/_auth/requireUser';
import { getRequestTimezone } from '@/app/_ctx/timezone';
import { explicitEventDate, isValidDay, startOfDayInTz } from '@/lib/day';
import type { NodeCandidate } from '@/service/candidates';
import {
  addToCollection,
  getCollectionCandidates,
  removeFromCollection,
} from '@/service/collection';
import { getLinkCandidates, saveOwnValues } from '@/service/field';
import { captureNode, setChildSchema, setViewSpec, updateNode } from '@/service/node';
import { removeNode, reparent } from '@/service/triage';

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

export async function saveNodeMeta(nodeId: string, formData: FormData): Promise<void> {
  const userId = await requireUserId();
  const text = (key: string) => {
    const v = formData.get(key);
    return typeof v === 'string' && v.trim() !== '' ? v.trim() : null;
  };
  await updateNode(userId, nodeId, {
    title: text('title'),
    icon: text('icon'),
    body: text('body'),
  });
  revalidatePath(`/node/${nodeId}`);
}

export async function deleteNodeAction(nodeId: string): Promise<void> {
  const userId = await requireUserId();
  await removeNode(userId, nodeId);
  redirect('/');
}

export async function setTimelineVisibility(
  nodeId: string,
  visibility: 'auto' | 'shown' | 'hidden'
): Promise<void> {
  const userId = await requireUserId();
  await updateNode(userId, nodeId, { timelineVisibility: visibility });
  revalidatePath(`/node/${nodeId}`);
}

export async function setPinned(nodeId: string, pinned: boolean): Promise<void> {
  const userId = await requireUserId();
  await updateNode(userId, nodeId, { pinned });
  revalidatePath(`/node/${nodeId}`);
}

/** eventDate is optional for every node, exactly as the schema always said —
 *  set from a YYYY-MM-DD day, or null to clear. */
export async function setEventDate(nodeId: string, day: string | null): Promise<void> {
  const userId = await requireUserId();
  const tz = await getRequestTimezone();
  await updateNode(userId, nodeId, {
    eventDate: day !== null && isValidDay(day) ? startOfDayInTz(day, tz) : null,
  });
  revalidatePath(`/node/${nodeId}`);
}

/** Contextual capture (DESIGN §6): child of the context node by default; the
 *  one-tap opt-out (dest=inbox) throws it raw instead. */
export async function captureHere(nodeId: string, formData: FormData): Promise<void> {
  const userId = await requireUserId();
  const raw = formData.get('text');
  const text = typeof raw === 'string' ? raw.trim() : '';
  if (!text) return;
  const toInbox = formData.get('dest') === 'inbox';
  const dayRaw = formData.get('captureDate');
  const tz = await getRequestTimezone();
  await captureNode(userId, {
    body: text,
    contextParentId: toInbox ? undefined : nodeId,
    eventDate: explicitEventDate(
      typeof dayRaw === 'string' && dayRaw !== '' ? dayRaw : undefined,
      tz
    ),
  });
  revalidatePath(`/node/${nodeId}`);
}

/** Create-in-place from the collection picker: a fresh CONFIRMED-ROOT node
 *  (an intentionally named collection reads as top-level, not inbox debt). */
export async function createCollectionNode(title: string): Promise<{ id: string; title: string }> {
  const userId = await requireUserId();
  const created = await captureNode(userId, { title, origin: 'constructed' });
  await reparent(userId, created.id, null);
  return { id: created.id, title };
}

/** Create-in-place from a link-field picker: a tree child of the field's
 *  declared scope (which is exactly what makes it a valid candidate); an
 *  unscoped field creates into the inbox. */
export async function createLinkTargetNode(
  title: string,
  scopeParentId: string | null
): Promise<{ id: string; title: string }> {
  const userId = await requireUserId();
  const created = await captureNode(userId, {
    title,
    origin: 'constructed',
    contextParentId: scopeParentId ?? undefined,
  });
  return { id: created.id, title };
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

export type SchemaSaveResult = { ok: true } | { ok: false; error: string };

/** The field-schema editor's save path — through the validated service;
 *  typed InvalidSchemaError surfaces as an inline form error, not a crash. */
export async function saveChildSchemaAction(
  nodeId: string,
  defs: unknown
): Promise<SchemaSaveResult> {
  const userId = await requireUserId();
  try {
    await setChildSchema(userId, nodeId, defs);
  } catch (err) {
    if (err instanceof InvalidSchemaError) return { ok: false, error: err.message };
    throw err;
  }
  // layout-wide: the walk (and any sibling's detail) must re-render the NEW
  // schema in place when the sheet saves mid-walk
  revalidatePath('/', 'layout');
  return { ok: true };
}
