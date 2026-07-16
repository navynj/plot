import { and, asc, eq, isNull } from 'drizzle-orm';

import { db } from '@/db';
import { node, type Node } from '@/db/schema';

export interface CreateNodeInput {
  userId: string;
  title?: string | null;
  body?: string | null;
  capturedAt: Date;
}

/** Fields a plain update may touch. `parentId` is absent on purpose:
 *  re-parenting goes through the triage service only (CLAUDE.md §3). */
export type UpdateNodePatch = Partial<Pick<Node, 'title' | 'body' | 'icon' | 'eventDate'>>;

const notDeleted = isNull(node.deletedAt);

/** Every read/write is scoped by `userId` — ownership isolation lives in the
 *  WHERE clause, not in caller discipline. Entry points resolve the id from
 *  the session and pass it down (CLAUDE.md §1). */
export const nodeRepo = {
  async create(input: CreateNodeInput): Promise<Node> {
    const rows = await db.insert(node).values(input).returning();
    const created = rows[0];
    if (!created) {
      throw new Error('node insert returned no row');
    }
    return created;
  },

  async byId(userId: string, id: string): Promise<Node | null> {
    const rows = await db
      .select()
      .from(node)
      .where(and(eq(node.id, id), eq(node.userId, userId), notDeleted))
      .limit(1);
    return rows[0] ?? null;
  },

  async update(userId: string, id: string, patch: UpdateNodePatch): Promise<Node | null> {
    const rows = await db
      .update(node)
      .set({ ...patch, updatedAt: new Date() })
      .where(and(eq(node.id, id), eq(node.userId, userId), notDeleted))
      .returning();
    return rows[0] ?? null;
  },

  async softDelete(userId: string, id: string): Promise<boolean> {
    const rows = await db
      .update(node)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(node.id, id), eq(node.userId, userId), notDeleted))
      .returning({ id: node.id });
    return rows.length > 0;
  },

  /** Inbox is a derived filter — `parentId IS NULL` — never stored state (DESIGN §6). */
  async findInbox(userId: string): Promise<Node[]> {
    return db
      .select()
      .from(node)
      .where(and(eq(node.userId, userId), isNull(node.parentId), notDeleted))
      .orderBy(asc(node.capturedAt));
  },

  async findChildren(userId: string, parentId: string): Promise<Node[]> {
    return db
      .select()
      .from(node)
      .where(and(eq(node.parentId, parentId), eq(node.userId, userId), notDeleted))
      .orderBy(asc(node.rank), asc(node.capturedAt));
  },

  /** Chat-style display order: oldest → newest, so a fresh capture lands
   *  directly above the bottom-pinned input. */
  async findTimeline(userId: string): Promise<Node[]> {
    return db
      .select()
      .from(node)
      .where(and(eq(node.userId, userId), notDeleted))
      .orderBy(asc(node.capturedAt));
  },
};
