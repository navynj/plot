'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { requireUserId } from '@/app/_auth/requireUser';
import { saveOwnValues } from '@/service/field';

/** Save whatever was filled (partial is fine — never a gate), then advance
 *  past this node. Only the rendered keys are touched. */
export async function saveAndAdvance(nodeId: string, formData: FormData): Promise<void> {
  const userId = await requireUserId();
  await save(userId, nodeId, formData);
  revalidatePath('/triage/fields');
  redirect(`/triage/fields?after=${nodeId}`);
}

/** Selection-walk variant: same save, but the cursor is an index into the
 *  URL-carried id list (a saved node stays in this queue — unlike the derived
 *  one it doesn't "leave" by being filled). */
export async function saveAndAdvanceSelection(
  ids: string[],
  index: number,
  formData: FormData
): Promise<void> {
  const userId = await requireUserId();
  await save(userId, ids[index]!, formData);
  revalidatePath('/triage/fields');
  redirect(`/triage/fields?ids=${ids.join(',')}&i=${index + 1}`);
}

async function save(userId: string, nodeId: string, formData: FormData): Promise<void> {
  const raw: Record<string, unknown> = Object.fromEntries(formData.entries());
  const keysField = formData.get('__fieldKeys');
  const editedKeys =
    typeof keysField === 'string' && keysField !== '' ? keysField.split(',') : undefined;
  await saveOwnValues(userId, nodeId, raw, editedKeys);
}
