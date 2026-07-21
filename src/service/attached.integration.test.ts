import 'dotenv/config';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/** A1 — attached children are appendages: no inherited schema, and excluded
 *  from the parent's records (child list / aggregates / walks / bulk). Their
 *  own children still inherit normally, and they are ordinary parents. */

const hasDb = Boolean(process.env.DATABASE_URL);
if (!hasDb) {
  console.warn('attached integration tests SKIPPED: DATABASE_URL is not set');
}

describe.skipIf(!hasDb)('attached children (real DB)', () => {
  let db: typeof import('@/db').db;
  let schema: typeof import('@/db/schema');
  let nodeRepo: typeof import('@/repository/nodeRepo').nodeRepo;
  let triage: typeof import('@/service/triage');
  let nodeService: typeof import('@/service/node');
  let field: typeof import('@/service/field');
  let aggregation: typeof import('@/service/aggregation');
  let inheritance: typeof import('@/service/inheritance');
  let fieldTriage: typeof import('@/service/fieldTriage');

  let uid: string;

  beforeAll(async () => {
    ({ db } = await import('@/db'));
    schema = await import('@/db/schema');
    ({ nodeRepo } = await import('@/repository/nodeRepo'));
    triage = await import('@/service/triage');
    nodeService = await import('@/service/node');
    field = await import('@/service/field');
    aggregation = await import('@/service/aggregation');
    inheritance = await import('@/service/inheritance');
    fieldTriage = await import('@/service/fieldTriage');

    const run = Math.random().toString(36).slice(2, 10);
    const users = await db
      .insert(schema.user)
      .values([{ email: `attached-${run}@test.local` }])
      .returning({ id: schema.user.id });
    uid = users[0]!.id;
  });

  afterAll(async () => {
    const { eq } = await import('drizzle-orm');
    await db.delete(schema.user).where(eq(schema.user.id, uid));
  });

  it('an attached child is excluded from records but present as an appendage; its own children inherit; aggregates skip it', async () => {
    // Expense (amount+category schema) with two expense records and one
    // ATTACHED appendage (Budget) whose own child wears Budget's schema
    const expense = await nodeRepo.create({ userId: uid, title: 'Expense', capturedAt: new Date() });
    await triage.reparent(uid, expense.id, null);
    await nodeService.setChildSchema(uid, expense.id, [
      { key: 'amount', label: 'Amount', type: 'number', required: true },
    ]);

    const rec = async (amount: number) => {
      const n = await nodeRepo.create({ userId: uid, title: `e${amount}`, capturedAt: new Date() });
      await triage.reparent(uid, n.id, expense.id);
      await field.saveOwnValues(uid, n.id, { amount: String(amount) });
      return n.id;
    };
    await rec(1000);
    await rec(2500);

    // the attached appendage: no schema of the parent, its own schema for kids
    const budget = await nodeRepo.create({
      userId: uid,
      title: 'Budget',
      attached: true,
      capturedAt: new Date(),
    });
    await triage.reparent(uid, budget.id, expense.id);
    await nodeService.setChildSchema(uid, budget.id, [
      { key: 'cap', label: 'Cap', type: 'number' },
    ]);

    // 1. resolveSchema on the attached child → empty (wears nothing)
    const budgetRow = (await nodeRepo.byId(uid, budget.id))!;
    expect(await inheritance.resolveSchema(uid, budgetRow)).toEqual([]);

    // 2. child list excludes it; attached list contains only it
    const records = await nodeRepo.findChildren(uid, expense.id);
    expect(records.map((n) => n.title).sort()).toEqual(['e1000', 'e2500']);
    expect(records.some((n) => n.id === budget.id)).toBe(false);
    const appendages = await nodeRepo.findAttachedChildren(uid, expense.id);
    expect(appendages.map((n) => n.id)).toEqual([budget.id]);

    // 3. aggregates over the parent skip the attached child (it has no amount
    //    anyway, but the exclusion is structural — via findChildren)
    const agg = await aggregation.aggregate(uid, expense.id, {
      source: 'tree',
      spec: { lens: 'amount', op: 'sum' },
    });
    expect(agg[0]?.value).toBe(3500);
    expect(agg[0]?.count).toBe(2);

    // 4. the field-triage WALK/queue skips the attached child (no required
    //    fields), but still surfaces the two records missing nothing here
    const queue = await fieldTriage.getFieldTriageQueue(uid);
    expect(queue.some((q) => q.node.id === budget.id)).toBe(false);

    // 5. an attached child is an ordinary parent: its own child inherits its
    //    schema, and a normal node reparents onto it fine
    const line = await nodeRepo.create({ userId: uid, title: 'line', capturedAt: new Date() });
    await triage.reparent(uid, line.id, budget.id);
    const lineRow = (await nodeRepo.byId(uid, line.id))!;
    expect((await inheritance.resolveSchema(uid, lineRow)).map((d) => d.key)).toEqual(['cap']);
    expect(lineRow.attached).toBe(false); // the child of an attached node is a normal record
    expect((await nodeRepo.findChildren(uid, budget.id)).map((n) => n.id)).toEqual([line.id]);
  });
});
