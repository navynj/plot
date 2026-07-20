'use server';

import { revalidatePath } from 'next/cache';

import { requireUserId } from '@/app/_auth/requireUser';
import { getRequestTimezone } from '@/app/_ctx/timezone';
import { explicitEventDate } from '@/lib/day';
import { addRoom, captureNode } from '@/service/node';

export async function capture(formData: FormData): Promise<void> {
  const userId = await requireUserId();
  const raw = formData.get('text');
  const text = typeof raw === 'string' ? raw.trim() : '';
  if (!text) {
    return; // empty submit is a no-op, not an error
  }
  const parentRaw = formData.get('parentId');
  const dayRaw = formData.get('captureDate');
  const tz = await getRequestTimezone();
  await captureNode(userId, {
    body: text,
    // one-tap chip parent — same contextual-capture rule, from the home
    contextParentId: typeof parentRaw === 'string' && parentRaw !== '' ? parentRaw : undefined,
    // the date control's shown day IS the eventDate (today included);
    // '' = explicitly cleared → dateless entry (null)
    eventDate: explicitEventDate(
      typeof dayRaw === 'string' && dayRaw !== '' ? dayRaw : undefined,
      tz
    ),
  });
  revalidatePath('/');
  revalidatePath('/inbox');
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
