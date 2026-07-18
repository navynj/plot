import { and, asc, eq, isNull } from 'drizzle-orm';

import { db } from '@/db';
import { link, node, type Link, type Node } from '@/db/schema';

/** Curation graph (DESIGN §2): pure membership edges, NO inheritance ever —
 *  this repo never reads or writes parentId, rank (the node's), or schema.
 *  Ownership is enforced in SQL on BOTH ends of every edge. */

async function ownsNode(userId: string, nodeId: string): Promise<boolean> {
  const rows = await db
    .select({ id: node.id })
    .from(node)
    .where(and(eq(node.id, nodeId), eq(node.userId, userId), isNull(node.deletedAt)))
    .limit(1);
  return rows.length > 0;
}

export const linkRepo = {
  /** Idempotent: re-linking an existing pair returns the existing edge.
   *  Returns null when either end is not owned by `userId`. */
  async create(
    userId: string,
    sourceId: string,
    targetId: string,
    rank: string | null
  ): Promise<Link | null> {
    if (!(await ownsNode(userId, sourceId)) || !(await ownsNode(userId, targetId))) return null;
    const rows = await db
      .insert(link)
      .values({ sourceId, targetId, rank })
      .onConflictDoNothing()
      .returning();
    if (rows[0]) return rows[0];
    const existing = await db
      .select()
      .from(link)
      .where(and(eq(link.sourceId, sourceId), eq(link.targetId, targetId)))
      .limit(1);
    return existing[0] ?? null;
  },

  /** Removing an absent edge is a legal no-op; false only when unowned. */
  async remove(userId: string, sourceId: string, targetId: string): Promise<boolean> {
    if (!(await ownsNode(userId, sourceId)) || !(await ownsNode(userId, targetId))) return false;
    await db.delete(link).where(and(eq(link.sourceId, sourceId), eq(link.targetId, targetId)));
    return true;
  },

  /** A collection's members (target nodes), in curation order. */
  async findTargets(userId: string, sourceId: string): Promise<Node[]> {
    if (!(await ownsNode(userId, sourceId))) return [];
    const rows = await db
      .select({ n: node })
      .from(link)
      .innerJoin(node, eq(node.id, link.targetId))
      .where(and(eq(link.sourceId, sourceId), eq(node.userId, userId), isNull(node.deletedAt)))
      .orderBy(asc(link.rank), asc(link.createdAt));
    return rows.map((r) => r.n);
  },

  /** The collections a node sits in (source nodes). */
  async findSources(userId: string, targetId: string): Promise<Node[]> {
    if (!(await ownsNode(userId, targetId))) return [];
    const rows = await db
      .select({ n: node })
      .from(link)
      .innerJoin(node, eq(node.id, link.sourceId))
      .where(and(eq(link.targetId, targetId), eq(node.userId, userId), isNull(node.deletedAt)))
      .orderBy(asc(link.createdAt));
    return rows.map((r) => r.n);
  },

  /** A collection's edges in curation order (ranks live on the edge). */
  async findEdges(userId: string, sourceId: string): Promise<Link[]> {
    if (!(await ownsNode(userId, sourceId))) return [];
    return db
      .select()
      .from(link)
      .where(eq(link.sourceId, sourceId))
      .orderBy(asc(link.rank), asc(link.createdAt));
  },
};
