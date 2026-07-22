import { and, asc, eq, getTableColumns, inArray, isNotNull, isNull, sql } from 'drizzle-orm';

import { db } from '@/db';
import { node, type Node } from '@/db/schema';

import { displayIcon, type NodeRow } from './displayIconSql';

export type { NodeRow };

export interface CreateNodeInput {
  userId: string;
  title?: string | null;
  body?: string | null;
  icon?: string | null;
  /** birth record; omitted = 'constructed' (column default) — captureNode
   *  is the only caller that writes 'captured' */
  origin?: 'captured' | 'constructed';
  /** appendage flavor of the tree link (A1); omitted = false (a record) */
  attached?: boolean;
  capturedAt: Date;
}

/** Fields a plain update may touch. `parentId` is absent on purpose:
 *  re-parenting goes through the triage service only (CLAUDE.md §3). */
export type UpdateNodePatch = Partial<
  Pick<
    Node,
    | 'title'
    | 'body'
    | 'icon'
    | 'eventDate'
    | 'childSchema'
    | 'schemaMode'
    | 'viewSpec'
    | 'timelineVisibility'
    | 'pinned'
    | 'attached'
  >
>;

const notDeleted = isNull(node.deletedAt);

const nodeWithIcon = { ...getTableColumns(node), displayIcon };


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

  /** Has this user EVER had a node? Soft-deleted rows count — this guards
   *  the one-time seed, which must not rerun after a delete-everything. */
  async hasAny(userId: string): Promise<boolean> {
    const rows = await db
      .select({ id: node.id })
      .from(node)
      .where(eq(node.userId, userId))
      .limit(1);
    return rows.length > 0;
  },

  async byId(userId: string, id: string): Promise<NodeRow | null> {
    const rows = await db
      .select(nodeWithIcon)
      .from(node)
      .where(and(eq(node.id, id), eq(node.userId, userId), notDeleted))
      .limit(1);
    return rows[0] ?? null;
  },

  /** A set of the user's nodes by id, in one pass (batch display resolution —
   *  e.g. show-on-main link values across a list). Order is not guaranteed. */
  async byIds(userId: string, ids: string[]): Promise<NodeRow[]> {
    if (ids.length === 0) return [];
    return db
      .select(nodeWithIcon)
      .from(node)
      .where(and(inArray(node.id, ids), eq(node.userId, userId), notDeleted));
  },

  async update(userId: string, id: string, patch: UpdateNodePatch): Promise<Node | null> {
    const rows = await db
      .update(node)
      .set({ ...patch, updatedAt: new Date() })
      .where(and(eq(node.id, id), eq(node.userId, userId), notDeleted))
      .returning();
    return rows[0] ?? null;
  },

  /** Reverse a soft delete (the undo path). */
  async restore(userId: string, id: string): Promise<boolean> {
    const rows = await db
      .update(node)
      .set({ deletedAt: null, updatedAt: new Date() })
      .where(and(eq(node.id, id), eq(node.userId, userId)))
      .returning({ id: node.id });
    return rows.length > 0;
  },

  /** Live-children counts for a set of nodes in one pass (bulk-delete UI). */
  async childCounts(userId: string, ids: string[]): Promise<Map<string, number>> {
    if (ids.length === 0) return new Map();
    const rows = await db
      .select({ parentId: node.parentId, count: sql<number>`count(*)::int` })
      .from(node)
      .where(and(eq(node.userId, userId), inArray(node.parentId, ids), notDeleted))
      .groupBy(node.parentId);
    return new Map(rows.filter((r) => r.parentId !== null).map((r) => [r.parentId!, r.count]));
  },

  /** Like childCounts but RECORD children only (excludes attached appendages)
   *  — the count that matters for "is this room drillable" and grid tiles. */
  async recordChildCounts(userId: string, ids: string[]): Promise<Map<string, number>> {
    if (ids.length === 0) return new Map();
    const rows = await db
      .select({ parentId: node.parentId, count: sql<number>`count(*)::int` })
      .from(node)
      .where(
        and(
          eq(node.userId, userId),
          inArray(node.parentId, ids),
          eq(node.attached, false),
          notDeleted
        )
      )
      .groupBy(node.parentId);
    return new Map(rows.filter((r) => r.parentId !== null).map((r) => [r.parentId!, r.count]));
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
  async findInbox(userId: string): Promise<NodeRow[]> {
    return db
      .select(nodeWithIcon)
      .from(node)
      .where(and(eq(node.userId, userId), isNull(node.parentId), isNull(node.rank), notDeleted))
      .orderBy(asc(node.capturedAt));
  },

  /** Confirmed top-level nodes: parent-less with a position among roots. */
  async findRoots(userId: string): Promise<NodeRow[]> {
    return db
      .select(nodeWithIcon)
      .from(node)
      .where(and(eq(node.userId, userId), isNull(node.parentId), isNotNull(node.rank), notDeleted))
      .orderBy(asc(node.rank), asc(node.capturedAt));
  },

  /** The parent's RECORDS: normal (inheriting) tree children, rank order.
   *  Attached children (appendages — no schema, not records) are excluded
   *  here, which is what keeps them out of aggregates, walks, bulk, and grid
   *  tiles for free (every one routes through this). */
  async findChildren(userId: string, parentId: string): Promise<NodeRow[]> {
    return db
      .select(nodeWithIcon)
      .from(node)
      .where(
        and(
          eq(node.parentId, parentId),
          eq(node.userId, userId),
          eq(node.attached, false),
          notDeleted
        )
      )
      .orderBy(asc(node.rank), asc(node.capturedAt));
  },

  /** The parent's APPENDAGES: attached children only (rendered in the quiet
   *  "Attached" area, never among records). */
  async findAttachedChildren(userId: string, parentId: string): Promise<NodeRow[]> {
    return db
      .select(nodeWithIcon)
      .from(node)
      .where(
        and(
          eq(node.parentId, parentId),
          eq(node.userId, userId),
          eq(node.attached, true),
          notDeleted
        )
      )
      .orderBy(asc(node.rank), asc(node.capturedAt));
  },

  /** Chat-style display order: oldest → newest, so a fresh capture lands
   *  directly above the bottom-pinned input. */
  async findTimeline(userId: string): Promise<NodeRow[]> {
    return db
      .select(nodeWithIcon)
      .from(node)
      .where(and(eq(node.userId, userId), notDeleted))
      .orderBy(asc(node.capturedAt));
  },

  /** The timeline view's slice: same order, minus non-record nodes. Under
   *  'auto' a node hides when it is STRUCTURAL (tree children or a non-empty
   *  childSchema) or CONSTRUCTED by birth (origin column: seeded / picker-
   *  created / grouped — never captured as text; the timeline is the river
   *  of captured text). origin replaced the old body-IS-NULL inference,
   *  which stopped being derivable when captures began splitting their
   *  first line into title (single-line captures are body-null). 'shown'/
   *  'hidden' override. Only the timeline uses this; inbox/grid/detail see
   *  everything. */
  async findTimelineVisible(userId: string, day: string | undefined, tz: string): Promise<NodeRow[]> {
    // the EVENT AXIS: when it happened wins over when it was captured —
    // exactly the aggregation engine's date axis. Day boundaries follow the
    // USER's calendar: AT TIME ZONE converts to their wall clock first.
    const axis = sql`coalesce(${node.eventDate}, ${node.capturedAt})`;
    return (
      db
        .select(nodeWithIcon)
        .from(node)
        .where(
          and(
            eq(node.userId, userId),
            notDeleted,
            day !== undefined
              ? sql`date_trunc('day', ${axis} at time zone ${tz})::date = ${day}::date`
              : undefined,
            sql`(
            ${node.timelineVisibility} = 'shown'
            or (
              ${node.timelineVisibility} = 'auto'
              and ${node.origin} = 'captured'
              and coalesce(jsonb_array_length(${node.childSchema}), 0) = 0
              and not exists (
                select 1 from node c where c.parent_id = ${node.id} and c.deleted_at is null
              )
            )
          )`
          )
        )
        // capturedAt is the TIEBREAKER: same-day entries all carry that day's
        // midnight as eventDate (the capture control defaults to today), so the
        // primary key alone is an N-way tie — within a day, capture order runs,
        // matching the times shown. (Registered, not built: true within-day
        // event times would need eventDate to carry time — a capture-friction
        // tradeoff deferred until real use demands it.)
        .orderBy(sql`${axis} asc`, asc(node.capturedAt))
    );
  },

  /** Nodes pinned to a given chip tier ('favorite' | 'ongoing'), rank order. */
  async findByPin(userId: string, pin: 'favorite' | 'ongoing'): Promise<NodeRow[]> {
    return db
      .select(nodeWithIcon)
      .from(node)
      .where(and(eq(node.userId, userId), eq(node.pinned, pin), notDeleted))
      .orderBy(asc(node.rank), asc(node.capturedAt));
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
