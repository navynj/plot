// ONE-OFF: fold Expense children's `when` field into eventDate for
// earlyoonj@gmail.com, then drop `when` from the Expense childSchema.
// Scoped to Expense's children — Schedule keeps its `when` field untouched.
// Run with an inline DATABASE_URL to target another branch (e.g. production).
import 'dotenv/config';
import { neon } from '@neondatabase/serverless';
const sql = neon(process.env.DATABASE_URL);

const [u] = await sql`select id from "user" where email = 'earlyoonj@gmail.com'`;
if (!u) throw new Error('account not found');
const [exp] = await sql`
  select id, child_schema from node
  where user_id = ${u.id} and title = 'Expense' and deleted_at is null`;
if (!exp) throw new Error('Expense node not found');

// migrate: when.date_value -> event_date where event_date is null (eventDate wins)
const migrated = await sql`
  update node n set event_date = fv.date_value
  from field_value fv
  where fv.node_id = n.id and fv.key = 'when' and fv.date_value is not null
    and n.parent_id = ${exp.id} and n.user_id = ${u.id} and n.event_date is null
  returning n.id`;
const skipped = await sql`
  select count(*)::int as c from field_value fv
  join node n on n.id = fv.node_id
  where fv.key = 'when' and n.parent_id = ${exp.id} and n.user_id = ${u.id}
    and n.event_date is not null
    and not (n.id = any(${migrated.map((m) => m.id)}::text[]))`;
const deleted = await sql`
  delete from field_value fv
  using node n
  where fv.node_id = n.id and fv.key = 'when'
    and n.parent_id = ${exp.id} and n.user_id = ${u.id}
  returning fv.id`;

const newSchema = exp.child_schema.filter((d) => d.key !== 'when');
await sql`update node set child_schema = ${JSON.stringify(newSchema)}::jsonb where id = ${exp.id}`;

console.log(`migrated when -> eventDate : ${migrated.length}`);
console.log(`skipped (eventDate wins)   : ${skipped[0].c}`);
console.log(`when rows deleted          : ${deleted.length}`);
console.log(`Expense childSchema now    : ${newSchema.map((d) => d.key).join(', ')}`);
