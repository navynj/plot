'use server';

import { revalidatePath } from 'next/cache';

import { requireUserId } from '@/app/_auth/requireUser';
import { getRequestTimezone } from '@/app/_ctx/timezone';
import type { FieldDef } from '@/db/schema';
import { DomainError } from '@/service/errors';
import {
  createHabit,
  deleteHabit,
  getHabit,
  toggleHabit,
  updateHabit,
  type HabitInput,
} from '@/service/habit';
import { getNode } from '@/service/node';

export type HabitSaveResult = { ok: true } | { ok: false; error: string };

/** Reads the habit form: title + emoji icon + target parent + the preset field
 *  values (raw, by the `__fieldKeys` the parent-schema editors rendered). */
function parseHabitInput(formData: FormData): HabitInput {
  const s = (k: string) => {
    const v = formData.get(k);
    return typeof v === 'string' ? v : '';
  };
  const keysRaw = formData.get('__fieldKeys');
  const keys = typeof keysRaw === 'string' && keysRaw !== '' ? keysRaw.split(',') : [];
  const values: Record<string, string> = {};
  for (const k of keys) {
    const v = formData.get(k);
    if (typeof v === 'string' && v.trim() !== '') values[k] = v;
  }
  return { title: s('title').trim(), icon: s('icon').trim() || null, logParentId: s('logParentId'), values };
}

export async function createHabitAction(formData: FormData): Promise<HabitSaveResult> {
  const userId = await requireUserId();
  const input = parseHabitInput(formData);
  if (!input.logParentId) return { ok: false, error: 'pick a target parent' };
  try {
    await createHabit(userId, input);
  } catch (err) {
    if (err instanceof DomainError) return { ok: false, error: err.message };
    throw err;
  }
  revalidatePath('/', 'layout');
  return { ok: true };
}

export async function updateHabitAction(id: string, formData: FormData): Promise<HabitSaveResult> {
  const userId = await requireUserId();
  const input = parseHabitInput(formData);
  if (!input.logParentId) return { ok: false, error: 'pick a target parent' };
  try {
    await updateHabit(userId, id, input);
  } catch (err) {
    if (err instanceof DomainError) return { ok: false, error: err.message };
    throw err;
  }
  revalidatePath('/', 'layout');
  return { ok: true };
}

export async function deleteHabitAction(id: string): Promise<void> {
  const userId = await requireUserId();
  await deleteHabit(userId, id);
  revalidatePath('/', 'layout');
}

/** Flip a habit for a day (the stream toggle). A preset value that violates a
 *  validation rule surfaces inline instead of creating a broken log. */
export async function toggleHabitAction(habitId: string, day: string): Promise<HabitSaveResult> {
  const userId = await requireUserId();
  const tz = await getRequestTimezone();
  try {
    await toggleHabit(userId, habitId, day, tz);
  } catch (err) {
    if (err instanceof DomainError) return { ok: false, error: err.message };
    throw err;
  }
  revalidatePath('/');
  return { ok: true };
}

/** The target parent's childSchema — the fields a generated log wears — for the
 *  editor form's preset-value inputs (fetched when the parent is picked). */
export async function habitParentSchema(parentId: string): Promise<FieldDef[]> {
  const userId = await requireUserId();
  const node = await getNode(userId, parentId);
  return node?.childSchema ?? [];
}

export interface HabitFormData {
  title: string;
  icon: string | null;
  logParentId: string;
  values: Record<string, string>;
  schema: FieldDef[];
}

/** The full habit + its parent schema, to prefill the edit form. */
export async function habitForm(id: string): Promise<HabitFormData | null> {
  const userId = await requireUserId();
  const habit = await getHabit(userId, id);
  if (!habit) return null;
  const parent = await getNode(userId, habit.logParentId);
  return {
    title: habit.title,
    icon: habit.icon,
    logParentId: habit.logParentId,
    values: habit.values,
    schema: parent?.childSchema ?? [],
  };
}
