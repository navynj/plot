'use server';

import { revalidatePath } from 'next/cache';

import { requireUserId } from '@/app/_auth/requireUser';
import { captureNode } from '@/service/node';

export async function capture(formData: FormData): Promise<void> {
  const userId = await requireUserId();
  const raw = formData.get('text');
  const text = typeof raw === 'string' ? raw.trim() : '';
  if (!text) {
    return; // empty submit is a no-op, not an error
  }
  await captureNode(userId, { body: text });
  revalidatePath('/');
  revalidatePath('/inbox');
}
