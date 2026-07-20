// ONE-OFF: give earlyoonj's existing Mood score the -5..5 step-1 scale (and
// Expense's inOut its default). Stored score values untouched — already
// valid numberValues. Run with an inline DATABASE_URL for production.
import 'dotenv/config';
import { neon } from '@neondatabase/serverless';
const sql = neon(process.env.DATABASE_URL);
const [u] = await sql`select id from "user" where email = 'earlyoonj@gmail.com'`;
if (!u) throw new Error('account not found');
const [mood] =
  await sql`select id, child_schema from node where user_id=${u.id} and title='Mood' and deleted_at is null`;
if (!mood) throw new Error('Mood not found');
const moodSchema = mood.child_schema.map((d) =>
  d.key === 'score' ? { ...d, min: -5, max: 5, step: 1 } : d
);
await sql`update node set child_schema = ${JSON.stringify(moodSchema)}::jsonb where id = ${mood.id}`;
const [exp] =
  await sql`select id, child_schema from node where user_id=${u.id} and title='Expense' and deleted_at is null`;
if (exp) {
  const expSchema = exp.child_schema.map((d) =>
    d.key === 'inOut' ? { ...d, defaultValue: 'expense' } : d
  );
  await sql`update node set child_schema = ${JSON.stringify(expSchema)}::jsonb where id = ${exp.id}`;
}
console.log('Mood score:', JSON.stringify(moodSchema.find((d) => d.key === 'score')));
console.log(
  'Expense inOut:',
  JSON.stringify(
    exp?.child_schema &&
      (await sql`select child_schema from node where id=${exp.id}`)[0].child_schema.find(
        (d) => d.key === 'inOut'
      )
  )
);
