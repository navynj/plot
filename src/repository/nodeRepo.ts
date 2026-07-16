import { and, asc, eq, isNotNull, isNull, sql } from 'drizzle-orm';

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
export type UpdateNodePatch = Partial<
  Pick<Node, 'title' | 'body' | 'icon' | 'eventDate' | 'childSchema' | 'schemaMode'>
>;

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

  /** Inbox is a derived filter — never stored state (DESIGN §6): no parent AND
   *  never positioned. A confirmed root is also parent-less but carries a rank
   *  (its position among roots), which is what "leaves the inbox" means. */
  async findInbox(userId: string): Promise<Node[]> {
    return db
      .select()
      .from(node)
      .where(and(eq(node.userId, userId), isNull(node.parentId), isNull(node.rank), notDeleted))
      .orderBy(asc(node.capturedAt));
  },

  /** Confirmed top-level nodes: parent-less with a position among roots. */
  async findRoots(userId: string): Promise<Node[]> {
    return db
      .select()
      .from(node)
      .where(and(eq(node.userId, userId), isNull(node.parentId), isNotNull(node.rank), notDeleted))
      .orderBy(asc(node.rank), asc(node.capturedAt));
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

  /** The node and every descendant (recursive CTE). Deleted nodes are
   *  included on purpose — cycle safety must see the whole chain. */
  async subtreeIds(userId: string, rootId: string): Promise<string[]> {
    const result = await db.execute<{ id: string }>(sql`
      WITH RECURSIVE sub AS (
        SELECT id FROM node WHERE id = ${rootId} AND user_id = ${userId}
        UNION ALL
        SELECT n.id FROM node n JOIN sub s ON n.parent_id = s.id
      )
      SELECT id FROM sub
    `);
    return result.rows.map((r) => r.id);
  },

  /** TRIAGE SERVICE ONLY (CLAUDE.md §3): the single write path for parentId
   *  and rank. Every input surface funnels through triage.reparent(), which
   *  owns cycle rejection — never call this from another service. */
  async setParent(
    userId: string,
    id: string,
    parentId: string | null,
    rank: string | null
  ): Promise<Node | null> {
    const rows = await db
      .update(node)
      .set({ parentId, rank, updatedAt: new Date() })
      .where(and(eq(node.id, id), eq(node.userId, userId), notDeleted))
      .returning();
    return rows[0] ?? null;
  },

  /** TRIAGE SERVICE ONLY: batch form of setParent (group, multi-drop). */
  async batchReparent(
    userId: string,
    moves: { id: string; rank: string | null }[],
    parentId: string | null
  ): Promise<void> {
    for (const move of moves) {
      await db
        .update(node)
        .set({ parentId, rank: move.rank, updatedAt: new Date() })
        .where(and(eq(node.id, move.id), eq(node.userId, userId), notDeleted));
    }
  },

  /** TRIAGE SERVICE ONLY: rewrite sibling ranks (rebalance). */
  async setRanks(userId: string, ranks: { id: string; rank: string }[]): Promise<void> {
    for (const entry of ranks) {
      await db
        .update(node)
        .set({ rank: entry.rank, updatedAt: new Date() })
        .where(and(eq(node.id, entry.id), eq(node.userId, userId), notDeleted));
    }
  },
};
