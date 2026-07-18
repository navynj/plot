import { and, eq, isNull, sql, type SQL } from 'drizzle-orm';

import { db } from '@/db';
import { fieldValue, node, type FieldValue, type TypedFieldWrite } from '@/db/schema';

/* ------------------------------------------------------------------ */
/* grouped aggregation — the app's hot path (DESIGN §4)                */
/* ------------------------------------------------------------------ */

/** Storage-level filter: the service resolves which typed column a filter
 *  compares against; `textOrLink` covers string identities (option text or a
 *  link target id) via COALESCE. */
export interface StorageFilter {
  key: string;
  op: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte';
  column: 'boolValue' | 'numberValue' | 'dateValue' | 'textOrLink';
  value: boolean | number | string | Date;
}

export interface RepoAggregateSpec {
  /** the lens: nodes lacking this field silently drop out (DESIGN §5) */
  valueKey: string;
  groupByKey?: string;
  op: 'sum' | 'avg' | 'count';
  filters?: StorageFilter[];
}

export interface AggregateRow {
  /** group identity: link target id, option text, or timestamp text; null when ungrouped */
  groupId: string | null;
  value: number;
  count: number;
}

const FILTER_OPS: Record<StorageFilter['op'], string> = {
  eq: '=',
  neq: '<>',
  gt: '>',
  gte: '>=',
  lt: '<',
  lte: '<=',
};

/**
 * ONE single-pass SQL statement: filter, group, and reduce all happen in the
 * database — never load rows and reduce in JS (CLAUDE.md §3). Exported so
 * tests can introspect the emitted SQL. Exactly one typed column is populated
 * per row, so COALESCE across them yields the group identity for link AND
 * date/text axes while the (key, linkValue) index carries the join.
 */
export function buildAggregateSql(userId: string, nodeIds: string[], spec: RepoAggregateSpec): SQL {
  const valueExpr =
    spec.op === 'count'
      ? sql`count(*)::float8`
      : spec.op === 'sum'
        ? sql`sum(v.number_value)::float8`
        : sql`avg(v.number_value)::float8`;
  const groupExpr = spec.groupByKey
    ? sql`coalesce(g.link_value, g.text_value, g.date_value::text, g.bool_value::text, g.number_value::text)`
    : sql`null::text`;
  const joinGroup = spec.groupByKey
    ? sql`left join field_value g on g.node_id = v.node_id and g.key = ${spec.groupByKey}`
    : sql.raw('');
  // sum/avg participate only with an actual numeric value — a text row under
  // the same key must not pollute the count of participants
  const numericGuard = spec.op === 'count' ? sql.raw('') : sql`and v.number_value is not null`;
  const idList = sql.join(
    nodeIds.map((id) => sql`${id}`),
    sql`, `
  );
  const filterClauses = (spec.filters ?? []).map((f) => {
    const column =
      f.column === 'boolValue'
        ? sql.raw('f.bool_value')
        : f.column === 'numberValue'
          ? sql.raw('f.number_value')
          : f.column === 'dateValue'
            ? sql.raw('f.date_value')
            : sql.raw('coalesce(f.text_value, f.link_value)');
    const value = f.column === 'numberValue' ? sql`${String(f.value)}::numeric` : sql`${f.value}`;
    return sql`and exists (select 1 from field_value f where f.node_id = v.node_id and f.key = ${f.key} and ${column} ${sql.raw(FILTER_OPS[f.op])} ${value})`;
  });

  return sql`
    select ${groupExpr} as group_id, ${valueExpr} as value, count(*)::int as count
    from field_value v
    inner join node n on n.id = v.node_id and n.user_id = ${userId} and n.deleted_at is null
    ${joinGroup}
    where v.key = ${spec.valueKey}
      and v.node_id in (${idList})
      ${numericGuard}
      ${sql.join(filterClauses, sql` `)}
    group by 1
  `;
}

/** field_value has no user column; ownership is enforced through the owning
 *  node, in SQL, on every method — same guarantee as nodeRepo. */
async function ownsNode(userId: string, nodeId: string): Promise<boolean> {
  const rows = await db
    .select({ id: node.id })
    .from(node)
    .where(and(eq(node.id, nodeId), eq(node.userId, userId), isNull(node.deletedAt)))
    .limit(1);
  return rows.length > 0;
}

/** All typed columns nulled; the write's column is then set — an upsert that
 *  changes a field's type must clear the previously used column. */
function toColumnValues(write: TypedFieldWrite) {
  const values = {
    textValue: null as string | null,
    numberValue: null as string | null, // numeric column: Drizzle takes strings
    boolValue: null as boolean | null,
    dateValue: null as Date | null,
    linkValue: null as string | null,
  };
  switch (write.column) {
    case 'textValue':
      values.textValue = write.value;
      break;
    case 'numberValue':
      values.numberValue = String(write.value);
      break;
    case 'boolValue':
      values.boolValue = write.value;
      break;
    case 'dateValue':
      values.dateValue = write.value;
      break;
    case 'linkValue':
      values.linkValue = write.value;
      break;
  }
  return values;
}

export const fieldValueRepo = {
  /** Upsert on the (nodeId, key) unique pair. Returns null when the node is
   *  not owned by `userId` (or does not exist). */
  async upsert(
    userId: string,
    nodeId: string,
    key: string,
    write: TypedFieldWrite
  ): Promise<FieldValue | null> {
    if (!(await ownsNode(userId, nodeId))) return null;
    const values = toColumnValues(write);
    const rows = await db
      .insert(fieldValue)
      .values({ nodeId, key, ...values })
      .onConflictDoUpdate({
        target: [fieldValue.nodeId, fieldValue.key],
        set: values,
      })
      .returning();
    return rows[0] ?? null;
  },

  async readByNode(userId: string, nodeId: string): Promise<FieldValue[]> {
    const rows = await db
      .select({ fv: fieldValue })
      .from(fieldValue)
      .innerJoin(node, eq(node.id, fieldValue.nodeId))
      .where(and(eq(fieldValue.nodeId, nodeId), eq(node.userId, userId), isNull(node.deletedAt)));
    return rows.map((r) => r.fv);
  },

  /** Clears a field. Returns false only when the node is not owned; clearing
   *  an already-empty field is a legal no-op. */
  async deleteByKey(userId: string, nodeId: string, key: string): Promise<boolean> {
    if (!(await ownsNode(userId, nodeId))) return false;
    await db.delete(fieldValue).where(and(eq(fieldValue.nodeId, nodeId), eq(fieldValue.key, key)));
    return true;
  },

  /** Grouped aggregate over a node-id set — one indexed SQL pass. */
  async aggregate(
    userId: string,
    nodeIds: string[],
    spec: RepoAggregateSpec
  ): Promise<AggregateRow[]> {
    if (nodeIds.length === 0) return [];
    const result = await db.execute<{
      group_id: string | null;
      value: number | null;
      count: number;
    }>(buildAggregateSql(userId, nodeIds, spec));
    return result.rows.map((r) => ({
      groupId: r.group_id,
      value: Number(r.value ?? 0),
      count: Number(r.count),
    }));
  },
};
