import { sql, type SQL } from 'drizzle-orm';

import { node, type Node } from '@/db/schema';

/** Every node-returning query carries the render-time display icon.
 *  Optional so mocked repos (unit tests) can return bare Nodes — the real
 *  queries always populate it. */
export type NodeRow = Node & { displayIcon?: string | null };

/** Nearest ancestor's OWN icon, walking up from `start` to the first
 *  non-null. `cte` names the recursive CTE (two ladders can nest in one
 *  statement, so the names must differ). */
const ancestorIcon = (start: SQL | typeof node.parentId, cte: string): SQL => sql`(
  with recursive ${sql.raw(cte)} as (
    select p.icon, p.parent_id, 1 as depth from node p
      where p.id = ${start} and p.deleted_at is null
    union all
    select p2.icon, p2.parent_id, u.depth + 1
      from node p2 join ${sql.raw(cte)} u on p2.id = u.parent_id
      where p2.deleted_at is null and u.depth < 32
  )
  select w.icon from ${sql.raw(cte)} w where w.icon is not null
  order by w.depth limit 1
)`;

/** The DISPLAY icon ladder (render-time borrowing — never stored, so a
 *  re-parent or re-categorization re-resolves with zero writes; schema
 *  inheritance stays depth-1, CLAUDE.md §3):
 *    own icon
 *    -> icon of the node the FIRST link-type field (in the worn schema's
 *       declared order) points to, that target resolved own -> its ancestors
 *    -> nearest tree-ancestor icon
 *    -> null.
 *  Resolved as correlated subqueries INSIDE each list statement: one query
 *  per list, per-row indexed walks — no JS N+1. Deliberately BOUNDED: the
 *  link target's ladder skips its own link-field step (own -> ancestors
 *  only); full mutual recursion in SQL would buy an exotic case (a category
 *  that itself holds a link value) at unbounded cost. */
const outer = { id: sql.raw('"node"."id"'), parentId: sql.raw('"node"."parent_id"'), icon: sql.raw('"node"."icon"') };

export const displayIcon = sql<string | null>`coalesce(
  ${outer.icon},
  (
    select coalesce(lt.icon, ${ancestorIcon(sql`lt.parent_id`, 'up_lt')})
    from node par
    cross join lateral (
      select e.value->>'key' as key
      from jsonb_array_elements(coalesce(par.child_schema, '[]'::jsonb))
        with ordinality e(value, ord)
      where e.value->>'type' = 'link'
      order by e.ord limit 1
    ) lf
    join field_value fv
      on fv.node_id = ${outer.id} and fv.key = lf.key and fv.link_value is not null
    join node lt on lt.id = fv.link_value and lt.deleted_at is null
    where par.id = ${outer.parentId} and par.deleted_at is null
    limit 1
  ),
  ${ancestorIcon(outer.parentId, 'up_n')}
)`.as('display_icon');

