'use server';

import { revalidatePath } from 'next/cache';

import { getCurrentUserId } from '@/lib/currentUser';
import { captureNode } from '@/service/node';

export async function capture(formData: FormData): Promise<void> {
  const raw = formData.get('text');
  const text = typeof raw === 'string' ? raw.trim() : '';
  if (!text) {
    return; // empty submit is a no-op, not an error
  }
  await captureNode(getCurrentUserId(), { body: text });
  revalidatePath('/');
  revalidatePath('/inbox');
}
