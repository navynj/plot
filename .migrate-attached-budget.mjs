/** Batch A migration — idempotent, safe to re-run. Usage:
 *    DATABASE_URL='<target>' node .migrate-attached-budget.mjs
 *  Run against dev and production; delete after the production run.
 *
 *  Does, with counts:
 *  0. ALTER node ADD attached boolean NOT NULL DEFAULT false (0007) if missing.
 *  1. Locate the Expense ledger and its categories node by STRUCTURAL
 *     IDENTITY, not titles (a relabeled "Expense"/"Budget categories" must not
 *     0-match — that is exactly the bug this replaced): the Expense node is a
 *     NON-attached node that declares a number field and a link field whose
 *     linkTargetParentId resolves to a live node with children (the category
 *     list). The categories node is derived from that link. No title strings.
 *     Reparent categories under Expense and mark it attached (id-based, so
 *     safe to re-run after a partial migration). Rank kept.
 *  2. Seed a Budget attached child under Expense if the user has none — the
 *     "has none" check is also structural (an attached child declaring a date
 *     field = a month-stamped ledger), so a relabeled Budget is not
 *     double-seeded.
 *  3. Seed a "Tax" 🧾 category under the categories node if missing. (The only
 *     remaining title literal — a plain category has no structural signature;
 *     a relabeled Tax would get a sibling, never a 0-match.)
 *  Flags (does NOT convert) any "August"-shaped node that looks like the old
 *  month-owns-budgets structure.
 */
import { neon } from '@neondatabase/serverless';
import { createId } from '@paralleldrive/cuid2';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('set DATABASE_URL to the target database');
  process.exit(1);
}
const sql = neon(url);

// 0 — column
await sql`ALTER TABLE "node" ADD COLUMN IF NOT EXISTS "attached" boolean NOT NULL DEFAULT false`;
console.log('attached column ensured');

const budgetSchema = (categoriesId) => [
  { key: 'category', label: 'Category', type: 'link', linkTargetParentId: categoriesId },
  { key: 'amount', label: 'Amount', type: 'number' },
  { key: 'month', label: 'Month', type: 'date' },
];

// find (user, expense, categories) triples by STRUCTURAL IDENTITY (no titles):
// Expense = a non-attached node declaring a number field + a link field whose
// linkTargetParentId resolves to a live node that HAS children (the category
// list). categories = that link's target. The lateral picks the first link
// field carrying a linkTargetParentId (Expense declares exactly one).
const rows = await sql`
  select n.user_id,
         n.id  as expense_id,
         cat.id as categories_id
  from node n
  cross join lateral (
    select (elem ->> 'linkTargetParentId') as target
    from jsonb_array_elements(coalesce(n.child_schema, '[]'::jsonb)) elem
    where elem ->> 'type' = 'link' and (elem ->> 'linkTargetParentId') is not null
    limit 1
  ) lf
  join node cat on cat.id = lf.target and cat.user_id = n.user_id and cat.deleted_at is null
  where n.deleted_at is null
    and n.attached = false
    and n.child_schema @> '[{"type":"number"}]'::jsonb
    and exists (
      select 1 from node c where c.parent_id = cat.id and c.deleted_at is null
    )`;

let reparented = 0, attachedFlag = 0, budgets = 0, taxes = 0;

for (const { user_id, expense_id, categories_id } of rows) {
  // 1 — categories → attached child of Expense
  const cat = (await sql`select parent_id, attached from node where id = ${categories_id}`)[0];
  if (cat.parent_id !== expense_id) {
    await sql`update node set parent_id = ${expense_id} where id = ${categories_id}`;
    reparented++;
  }
  if (cat.attached !== true) {
    await sql`update node set attached = true where id = ${categories_id}`;
    attachedFlag++;
  }

  // 2 — Budget attached child (if none) — structural: an attached child of
  // Expense declaring a date field is a month-stamped ledger, whatever it's
  // titled, so a relabeled Budget is never double-seeded.
  const existingBudget = await sql`
    select id from node
    where user_id = ${user_id} and parent_id = ${expense_id}
      and attached = true and deleted_at is null
      and child_schema @> '[{"type":"date"}]'::jsonb`;
  if (existingBudget.length === 0) {
    // rank: append after existing attached children (max rank + 'z', simplest
    // stable append; ranks here are cosmetic among appendages)
    const id = createId();
    await sql`
      insert into node (id, user_id, title, icon, parent_id, rank, attached, child_schema, origin)
      values (${id}, ${user_id}, 'Budget', '📊', ${expense_id}, 'n', true,
              ${JSON.stringify(budgetSchema(categories_id))}::jsonb, 'constructed')`;
    budgets++;
  }

  // 3 — Tax category under Expense categories (if missing)
  const existingTax = await sql`
    select id from node
    where user_id = ${user_id} and parent_id = ${categories_id}
      and title = 'Tax' and deleted_at is null`;
  if (existingTax.length === 0) {
    const id = createId();
    await sql`
      insert into node (id, user_id, title, icon, parent_id, rank, origin)
      values (${id}, ${user_id}, 'Tax', '🧾', ${categories_id}, 'zz', 'constructed')`;
    taxes++;
  }
}

// flag August-shaped structures rather than converting
const august = await sql`
  select id, user_id, title from node
  where deleted_at is null
    and (title ilike 'august%' or title ~* '^\\d{4}-\\d{2}$' or title ~* '(january|february|march|april|may|june|july|september|october|november|december)')`;

console.log(JSON.stringify({
  usersWithExpense: rows.length,
  categoriesReparented: reparented,
  categoriesFlaggedAttached: attachedFlag,
  budgetsSeeded: budgets,
  taxCategoriesSeeded: taxes,
  augustShapedFlagged: august.map((a) => ({ id: a.id, title: a.title })),
}, null, 2));
