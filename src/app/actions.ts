'use server';

import { revalidatePath } from 'next/cache';

import { requireUserId } from '@/app/_auth/requireUser';
import { getRequestTimezone } from '@/app/_ctx/timezone';
import { explicitEventDate } from '@/lib/day';
import { ValidationError } from '@/service/errors';
import { saveOwnValues } from '@/service/field';
import { addRoom, captureNode, getChipChildren, type ChipItem } from '@/service/node';

const str = (fd: FormData, key: string): string => {
  const v = fd.get(key);
  return typeof v === 'string' ? v.trim() : '';
};

/** Collect the inline parent-schema field values by the keys the form
 *  rendered (B1). Empty is fine — required-ness never gates capture. */
async function saveInlineFields(userId: string, nodeId: string, formData: FormData): Promise<void> {
  const keysRaw = formData.get('__fieldKeys');
  const keys = typeof keysRaw === 'string' && keysRaw !== '' ? keysRaw.split(',') : [];
  if (keys.length === 0) return;
  const raw: Record<string, unknown> = {};
  for (const key of keys) raw[key] = formData.get(key);
  try {
    await saveOwnValues(userId, nodeId, raw, keys);
  } catch (err) {
    // raw-first (DESIGN §6-capture): the capture stands; a rule violation on
    // the inline values is deferred to field triage, not a capture gate.
    if (!(err instanceof ValidationError)) throw err;
  }
}

export async function capture(formData: FormData): Promise<void> {
  const userId = await requireUserId();
  // B1: title input + body textarea map directly (no first-line split needed).
  // 'text' is the legacy single-blob name (kept for callers still on it).
  const title = str(formData, 'title') || str(formData, 'text');
  const body = str(formData, 'body');
  if (!title && !body) {
    return; // empty submit is a no-op, not an error
  }
  const parentRaw = formData.get('parentId');
  const parentId = typeof parentRaw === 'string' && parentRaw !== '' ? parentRaw : undefined;
  const tz = await getRequestTimezone();
  const node = await captureNode(userId, {
    title: title || undefined,
    body: body || undefined,
    icon: str(formData, 'icon') || undefined,
    // one-tap chip parent — same contextual-capture rule, from the home
    contextParentId: parentId,
    // the date control's shown day IS the eventDate (today included);
    // '' = explicitly cleared → dateless entry (null)
    eventDate: explicitEventDate(str(formData, 'captureDate') || undefined, tz),
  });
  // inline parent-schema fields (only when a parent was chosen)
  if (parentId) await saveInlineFields(userId, node.id, formData);
  revalidatePath('/');
  revalidatePath('/inbox');
}

/** B2 chip drill-down: a chip's record children, fetched on expand. */
export async function chipChildren(parentId: string): Promise<ChipItem[]> {
  const userId = await requireUserId();
  return getChipChildren(userId, parentId);
}

/** Grid inline add: a new room under a section's root. */
export async function addRoomAction(rootId: string, formData: FormData): Promise<void> {
  const userId = await requireUserId();
  const raw = formData.get('title');
  const title = typeof raw === 'string' ? raw.trim() : '';
  if (!title) return;
  await addRoom(userId, rootId, title);
  revalidatePath('/grid');
}
