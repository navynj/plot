import { and, asc, eq, inArray, isNull, sql } from 'drizzle-orm';

import { db } from '@/db';
import { habit, habitCheck, node, type Habit, type HabitCheck } from '@/db/schema';

export interface CreateHabitInput {
  userId: string;
  title: string;
  icon: string | null;
  logParentId: string;
  values: Record<string, string>;
  rank: string | null;
}

/** Fields a habit update may touch. */
export type UpdateHabitPatch = Partial<
  Pick<Habit, 'title' | 'icon' | 'logParentId' | 'values' | 'rank'>
>;

/** All habit reads/writes are scoped by `userId`; habit_check ownership is
 *  enforced through its habit (join), the way field_value goes through node. */
export const habitRepo = {
  async list(userId: string): Promise<Habit[]> {
    return db
      .select()
      .from(habit)
      .where(eq(habit.userId, userId))
      .orderBy(asc(habit.rank), asc(habit.createdAt));
  },

  async byId(userId: string, id: string): Promise<Habit | null> {
    const rows = await db
      .select()
      .from(habit)
      .where(and(eq(habit.id, id), eq(habit.userId, userId)))
      .limit(1);
    return rows[0] ?? null;
  },

  async create(input: CreateHabitInput): Promise<Habit> {
    const rows = await db.insert(habit).values(input).returning();
    const created = rows[0];
    if (!created) throw new Error('habit insert returned no row');
    return created;
  },

  async update(userId: string, id: string, patch: UpdateHabitPatch): Promise<Habit | null> {
    const rows = await db
      .update(habit)
      .set(patch)
      .where(and(eq(habit.id, id), eq(habit.userId, userId)))
      .returning();
    return rows[0] ?? null;
  },

  /** Deletes the habit; its checks cascade, but the generated log NODES stay
   *  (the "keep logs" decision). Returns false when not owned / absent. */
  async remove(userId: string, id: string): Promise<boolean> {
    const rows = await db
      .delete(habit)
      .where(and(eq(habit.id, id), eq(habit.userId, userId)))
      .returning({ id: habit.id });
    return rows.length > 0;
  },

  /** The LIVE check for (habit, day): a check whose generated node still exists
   *  (not soft-deleted). A check whose log was deleted reads as "no check", so
   *  the day is unchecked again — matching the display. */
  async liveCheck(userId: string, habitId: string, day: string): Promise<HabitCheck | null> {
    const rows = await db
      .select({ hc: habitCheck })
      .from(habitCheck)
      .innerJoin(habit, and(eq(habit.id, habitCheck.habitId), eq(habit.userId, userId)))
      .innerJoin(node, and(eq(node.id, habitCheck.nodeId), isNull(node.deletedAt)))
      .where(and(eq(habitCheck.habitId, habitId), eq(habitCheck.day, day)))
      .limit(1);
    return rows[0]?.hc ?? null;
  },

  /** Live checks across a set of days, for the stream's on/off row. One pass. */
  async liveChecksForDays(userId: string, days: string[]): Promise<HabitCheck[]> {
    if (days.length === 0) return [];
    const rows = await db
      .select({ hc: habitCheck })
      .from(habitCheck)
      .innerJoin(habit, and(eq(habit.id, habitCheck.habitId), eq(habit.userId, userId)))
      .innerJoin(node, and(eq(node.id, habitCheck.nodeId), isNull(node.deletedAt)))
      .where(inArray(habitCheck.day, days));
    return rows.map((r) => r.hc);
  },

  async insertCheck(habitId: string, nodeId: string, day: string): Promise<HabitCheck> {
    const rows = await db.insert(habitCheck).values({ habitId, nodeId, day }).returning();
    const created = rows[0];
    if (!created) throw new Error('habit_check insert returned no row');
    return created;
  },

  /** Removes any check row for (habit, day) — used to turn a day off and to
   *  clear a stale row before a fresh check-in. Ownership is the caller's
   *  responsibility (the service verifies the habit first). */
  async deleteCheck(userId: string, habitId: string, day: string): Promise<void> {
    await db.delete(habitCheck).where(
      and(
        eq(habitCheck.day, day),
        eq(
          habitCheck.habitId,
          // scope to an owned habit id
          sql`(select ${habit.id} from ${habit} where ${habit.id} = ${habitId} and ${habit.userId} = ${userId})`
        )
      )
    );
  },
};
