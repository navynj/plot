'use server';

import { revalidatePath } from 'next/cache';

import { requireUserId } from '@/app/_auth/requireUser';
import { resolveCaptureEventDate } from '@/lib/day';
import { addRoom, captureNode } from '@/service/node';

export async function capture(formData: FormData): Promise<void> {
  const userId = await requireUserId();
  const raw = formData.get('text');
  const text = typeof raw === 'string' ? raw.trim() : '';
  if (!text) {
    return; // empty submit is a no-op, not an error
  }
  const parentRaw = formData.get('parentId');
  const dayRaw = formData.get('day');
  await captureNode(userId, {
    body: text,
    // one-tap chip parent — same contextual-capture rule, from the home
    contextParentId: typeof parentRaw === 'string' && parentRaw !== '' ? parentRaw : undefined,
    // viewed day stamps eventDate; today resolves to undefined (zero-cost)
    eventDate: resolveCaptureEventDate(
      typeof dayRaw === 'string' && dayRaw !== '' ? dayRaw : undefined
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
