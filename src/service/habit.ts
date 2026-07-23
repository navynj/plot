import type { Habit } from '@/db/schema';
import { habitRepo } from '@/repository/habitRepo';
import { nodeRepo } from '@/repository/nodeRepo';

import { startOfDayInTz, isValidDay } from '@/lib/day';
import { rankBetween, spreadRanks } from '@/lib/rank';

import {
  HabitError,
  HabitNotFoundError,
  HabitParentMissingError,
  NodeNotFoundError,
} from './errors';
import { saveOwnValues } from './field';
import { captureNode } from './node';
import { removeNode } from './triage';

export interface HabitInput {
  title: string;
  icon: string | null;
  logParentId: string;
  /** raw form-shaped preset values, keyed by the parent's childSchema keys */
  values: Record<string, string>;
}

/** A habit as the stream / editor list needs it — plus whether its target
 *  parent still exists (a soft-deleted parent disables the toggle). */
export interface HabitSummary {
  id: string;
  title: string;
  icon: string | null;
  logParentId: string;
  rank: string | null;
  disabled: boolean;
}

function toSummary(h: Habit, parentIds: Set<string>): HabitSummary {
  return {
    id: h.id,
    title: h.title,
    icon: h.icon,
    logParentId: h.logParentId,
    rank: h.rank,
    disabled: !parentIds.has(h.logParentId),
  };
}

/** The user's habits, in icon-row order, each flagged disabled when its target
 *  parent node is gone (the guard — never crash on a deleted parent). */
export async function listHabits(userId: string): Promise<HabitSummary[]> {
  const habits = await habitRepo.list(userId);
  if (habits.length === 0) return [];
  const parentIds = [...new Set(habits.map((h) => h.logParentId))];
  const present = new Set((await nodeRepo.byIds(userId, parentIds)).map((n) => n.id));
  return habits.map((h) => toSummary(h, present));
}

/** The full habit (incl. preset values) — for the editor form. */
export function getHabit(userId: string, id: string): Promise<Habit | null> {
  return habitRepo.byId(userId, id);
}

async function assertParent(userId: string, logParentId: string): Promise<void> {
  const parent = await nodeRepo.byId(userId, logParentId);
  if (!parent) throw new NodeNotFoundError(logParentId);
}

export async function createHabit(userId: string, input: HabitInput): Promise<Habit> {
  const title = input.title.trim();
  if (!title) throw new HabitError('a habit needs a title');
  await assertParent(userId, input.logParentId);
  // append to the end of the icon row
  const existing = await habitRepo.list(userId);
  const lastRank = existing[existing.length - 1]?.rank ?? null;
  const rank = rankBetween(lastRank, null) ?? spreadRanks(1)[0]!;
  return habitRepo.create({
    userId,
    title,
    icon: input.icon?.trim() || null,
    logParentId: input.logParentId,
    values: input.values,
    rank,
  });
}

export async function updateHabit(userId: string, id: string, input: HabitInput): Promise<Habit> {
  const title = input.title.trim();
  if (!title) throw new HabitError('a habit needs a title');
  await assertParent(userId, input.logParentId);
  const updated = await habitRepo.update(userId, id, {
    title,
    icon: input.icon?.trim() || null,
    logParentId: input.logParentId,
    values: input.values,
  });
  if (!updated) throw new HabitNotFoundError(id);
  return updated;
}

/** Removes the habit and its checks; the previously generated log nodes STAY
 *  (they are ordinary records now — the "keep logs" decision). */
export async function deleteHabit(userId: string, id: string): Promise<void> {
  const removed = await habitRepo.remove(userId, id);
  if (!removed) throw new HabitNotFoundError(id);
}

/**
 * Flip a habit for a day (CLAUDE.md §3 — the ONE place this rule lives).
 *
 * ON (no live check): create a visible captured log under the habit's parent
 * with `eventDate = startOfDayInTz(day)` and the habit's title, then write its
 * preset values (filtered to the parent's CURRENT schema keys) through the
 * validated pipeline — a rule violation rolls the log back and surfaces, never
 * a broken log. Then record the check.
 *
 * OFF (a live check exists): delete the generated log and the check.
 *
 * A "live" check is one whose log node still exists; a check whose log was
 * deleted reads as off, and its stale row is cleared before a fresh check-in.
 */
export async function toggleHabit(
  userId: string,
  habitId: string,
  day: string,
  tz: string
): Promise<void> {
  if (!isValidDay(day)) throw new HabitError(`invalid day: ${day}`);
  const h = await habitRepo.byId(userId, habitId);
  if (!h) throw new HabitNotFoundError(habitId);
  const parent = await nodeRepo.byId(userId, h.logParentId);
  if (!parent) throw new HabitParentMissingError(habitId);

  const live = await habitRepo.liveCheck(userId, habitId, day);
  if (live) {
    // OFF — remove the generated log (even if manually edited: off means gone)
    try {
      await removeNode(userId, live.nodeId);
    } catch (err) {
      if (!(err instanceof NodeNotFoundError)) throw err;
    }
    await habitRepo.deleteCheck(userId, habitId, day);
    return;
  }

  // ON — a fully-populated preset log, born visible (captured record)
  const created = await captureNode(userId, {
    title: h.title,
    icon: h.icon ?? undefined,
    contextParentId: h.logParentId,
    eventDate: startOfDayInTz(day, tz),
    origin: 'captured',
  });
  // filter preset values to the parent's CURRENT schema keys (never write stale)
  const keys = (parent.childSchema ?? []).map((d) => d.key);
  const raw: Record<string, string> = {};
  for (const k of keys) if (h.values[k] !== undefined) raw[k] = h.values[k]!;
  try {
    await saveOwnValues(userId, created.id, raw, keys);
  } catch (err) {
    await nodeRepo.softDelete(userId, created.id); // no broken log left behind
    throw err;
  }
  await habitRepo.deleteCheck(userId, habitId, day); // clear any stale row first
  await habitRepo.insertCheck(habitId, created.id, day);
}

/** Per-day on/off status for the stream row: `{ 'YYYY-MM-DD': [habitId, …] }`,
 *  counting only checks whose generated log still exists. Serializable (plain
 *  arrays) for the server→client boundary. */
export async function getHabitChecks(
  userId: string,
  days: string[]
): Promise<Record<string, string[]>> {
  const checks = await habitRepo.liveChecksForDays(userId, days);
  const byDay: Record<string, string[]> = {};
  for (const c of checks) (byDay[c.day] ??= []).push(c.habitId);
  return byDay;
}
