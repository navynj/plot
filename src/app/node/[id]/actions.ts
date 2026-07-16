'use server';

import { revalidatePath } from 'next/cache';

import { requireUserId } from '@/app/_auth/requireUser';
import { saveOwnValues } from '@/service/field';
import { setChildSchema } from '@/service/node';

import { InvalidSchemaError } from '@/service/errors';

export async function saveFields(nodeId: string, formData: FormData): Promise<void> {
  const userId = await requireUserId();
  const raw: Record<string, unknown> = Object.fromEntries(formData.entries());
  await saveOwnValues(userId, nodeId, raw);
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
