import { and, asc, desc, eq } from 'drizzle-orm';

import { db } from '@/db';
import { undoOp, type UndoOp } from '@/db/schema';

const MAX_STACK = 20;

/** Per-user undo/redo stacks (DB-backed: serverless memory is per-lambda). */
export const undoRepo = {
  async push(
    userId: string,
    stack: 'undo' | 'redo',
    kind: 'reparent' | 'delete',
    payload: unknown
  ): Promise<void> {
    await db.insert(undoOp).values({ userId, stack, kind, payload });
    // cap: drop oldest beyond MAX_STACK
    const rows = await db
      .select({ id: undoOp.id })
      .from(undoOp)
      .where(and(eq(undoOp.userId, userId), eq(undoOp.stack, stack)))
      .orderBy(desc(undoOp.createdAt))
      .offset(MAX_STACK);
    for (const row of rows) {
      await db.delete(undoOp).where(eq(undoOp.id, row.id));
    }
  },

  /** Pop the newest op of a stack (removes and returns it). */
  async pop(userId: string, stack: 'undo' | 'redo'): Promise<UndoOp | null> {
    const rows = await db
      .select()
      .from(undoOp)
      .where(and(eq(undoOp.userId, userId), eq(undoOp.stack, stack)))
      .orderBy(desc(undoOp.createdAt), desc(undoOp.id))
      .limit(1);
    const top = rows[0];
    if (!top) return null;
    await db.delete(undoOp).where(eq(undoOp.id, top.id));
    return top;
  },

  /** A new operation invalidates the redo branch. */
  async clearRedo(userId: string): Promise<void> {
    await db.delete(undoOp).where(and(eq(undoOp.userId, userId), eq(undoOp.stack, 'redo')));
  },

  async list(userId: string, stack: 'undo' | 'redo'): Promise<UndoOp[]> {
    return db
      .select()
      .from(undoOp)
      .where(and(eq(undoOp.userId, userId), eq(undoOp.stack, stack)))
      .orderBy(asc(undoOp.createdAt));
  },
};
