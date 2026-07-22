'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { requireUserId } from '@/app/_auth/requireUser';
import { getRequestTimezone } from '@/app/_ctx/timezone';
import { explicitEventDate, isValidDay, startOfDayInTz } from '@/lib/day';
import type { NodeCandidate } from '@/service/candidates';
import { loadBudgetMonth, saveBudget, type AllocationInput } from '@/service/budget';
import {
  addToCollection,
  getCollectionCandidates,
  getMemberCandidates,
  linkMembers,
  removeFromCollection,
} from '@/service/collection';
import { getLinkCandidates, saveOwnValues } from '@/service/field';
import { captureNode, setChildSchema, setViewSpec, updateNode } from '@/service/node';
import { removeNode, reparent } from '@/service/triage';
import type { ViewSpec } from '@/db/schema';

import { DomainError, InvalidSchemaError, InvalidViewSpecError } from '@/service/errors';

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

/** A4 "Link receipt items": candidates to add as members of this node (any
 *  node but itself and its current members). */
export async function memberCandidates(collectionId: string): Promise<NodeCandidate[]> {
  const userId = await requireUserId();
  return getMemberCandidates(userId, collectionId);
}

/** Link one node in as a member (the detail-side add; the picker stays open
 *  to add several — each is idempotent). Reference graph link only. */
export async function linkItem(collectionId: string, memberId: string): Promise<CollectionResult> {
  const userId = await requireUserId();
  try {
    await linkMembers(userId, collectionId, [memberId]);
  } catch (err) {
    if (err instanceof DomainError) return { ok: false, error: err.code };
    throw err;
  }
  revalidatePath(`/node/${collectionId}`);
  return { ok: true };
}

export type ViewSpecSaveResult = { ok: true } | { ok: false; error: string };

/** A' view editor save (retires the dev JSON textarea): the bounded sheet
 *  builds a ViewSpec object and hands it to the validated setViewSpec path;
 *  `null` removes the view. Typed InvalidViewSpecError surfaces inline, never
 *  a crash. Revalidates layout-wide so the view re-renders in place. */
export async function saveViewSpecAction(
  nodeId: string,
  spec: ViewSpec | null
): Promise<ViewSpecSaveResult> {
  const userId = await requireUserId();
  try {
    await setViewSpec(userId, nodeId, spec);
  } catch (err) {
    if (err instanceof InvalidViewSpecError) return { ok: false, error: err.message };
    throw err;
  }
  revalidatePath('/', 'layout');
  return { ok: true };
}

/** A'' budget editor save: the whole form for one month. Inputs are `total`,
 *  `alloc:<categoryId>` (the manual amount — always submitted, even while auto,
 *  so it survives), and `auto:<categoryId>` (present only when that row's auto
 *  toggle is on). The manual amount is kept while auto, just ignored. */
export async function saveBudgetAction(
  budgetId: string,
  month: string,
  formData: FormData
): Promise<void> {
  const userId = await requireUserId();
  const tz = await getRequestTimezone();
  const num = (raw: FormDataEntryValue | null): number | null => {
    if (typeof raw !== 'string' || raw.trim() === '') return null;
    const n = Number(raw.replace(/,/g, '')); // tolerate thousands separators
    return Number.isFinite(n) ? n : null;
  };
  const allocations: Record<string, AllocationInput> = {};
  for (const [key, value] of formData.entries()) {
    if (key.startsWith('alloc:')) {
      const categoryId = key.slice('alloc:'.length);
      allocations[categoryId] = { amount: num(value), auto: formData.has(`auto:${categoryId}`) };
    }
  }
  await saveBudget(userId, budgetId, month, tz, { total: num(formData.get('total')), allocations });
  revalidatePath('/', 'layout');
}

/** Prefill source for the editor's "copy from previous month": the given
 *  month's total + allocations (with auto flags — the client fills the inputs,
 *  nothing writes until Save). */
export async function loadBudgetMonthAction(
  budgetId: string,
  month: string
): Promise<{ total: number | null; allocations: Record<string, AllocationInput> }> {
  const userId = await requireUserId();
  const tz = await getRequestTimezone();
  return loadBudgetMonth(userId, budgetId, month, tz);
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
