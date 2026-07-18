'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { requireUserId } from '@/app/_auth/requireUser';
import { saveOwnValues } from '@/service/field';

/** Save whatever was filled (partial is fine — never a gate), then advance
 *  past this node. Only the rendered keys are touched. */
export async function saveAndAdvance(nodeId: string, formData: FormData): Promise<void> {
  const userId = await requireUserId();
  const raw: Record<string, unknown> = Object.fromEntries(formData.entries());
  const keysField = formData.get('__fieldKeys');
  const editedKeys =
    typeof keysField === 'string' && keysField !== '' ? keysField.split(',') : undefined;
  await saveOwnValues(userId, nodeId, raw, editedKeys);
  revalidatePath('/triage/fields');
  redirect(`/triage/fields?after=${nodeId}`);
}
