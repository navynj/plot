import 'dotenv/config';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/** A3 — month-stamped budget lines on an attached Budget ledger: the period
 *  lens picks only the navigated month's lines for the overlay, and
 *  copy-previous-month advances the stamp with amounts intact (one undoable
 *  create op). */

const hasDb = Boolean(process.env.DATABASE_URL);
if (!hasDb) {
  console.warn('budget integration tests SKIPPED: DATABASE_URL is not set');
}

describe.skipIf(!hasDb)('month-stamped budgets (real DB)', () => {
  let db: typeof import('@/db').db;
  let schema: typeof import('@/db/schema');
  let nodeRepo: typeof import('@/repository/nodeRepo').nodeRepo;
  let triage: typeof import('@/service/triage');
  let nodeService: typeof import('@/service/node');
  let field: typeof import('@/service/field');
  let view: typeof import('@/service/view');
  let budget: typeof import('@/service/budget');
  let history: typeof import('@/service/history');
  let day: typeof import('@/lib/day');

  let uid: string;
  let expense: string, categories: string, food: string, transport: string, budgetId: string;
  const TZ = 'Asia/Seoul';

  beforeAll(async () => {
    ({ db } = await import('@/db'));
    schema = await import('@/db/schema');
    ({ nodeRepo } = await import('@/repository/nodeRepo'));
    triage = await import('@/service/triage');
    nodeService = await import('@/service/node');
    field = await import('@/service/field');
    view = await import('@/service/view');
    budget = await import('@/service/budget');
    history = await import('@/service/history');
    day = await import('@/lib/day');

    const run = Math.random().toString(36).slice(2, 10);
    const users = await db
      .insert(schema.user)
      .values([{ email: `budget-${run}@test.local` }])
      .returning({ id: schema.user.id });
    uid = users[0]!.id;

    const mk = async (title: string, parentId?: string, attached = false) => {
      const n = await nodeRepo.create({ userId: uid, title, attached, capturedAt: new Date() });
      if (parentId) await triage.reparent(uid, n.id, parentId);
      return n.id;
    };
    expense = await mk('Expense');
    await triage.reparent(uid, expense, null);
    categories = await mk('Expense categories', expense, true);
    food = await mk('Food', categories);
    transport = await mk('Transport', categories);
    budgetId = await mk('Budget', expense, true);

    await nodeService.setChildSchema(uid, expense, [
      { key: 'amount', label: 'Amount', type: 'number' },
      { key: 'category', label: 'Category', type: 'link', linkTargetParentId: categories },
      { key: 'scheduled', label: 'Scheduled', type: 'boolean' },
    ]);
    await nodeService.setChildSchema(uid, budgetId, [
      { key: 'category', label: 'Category', type: 'link', linkTargetParentId: categories },
      { key: 'amount', label: 'Amount', type: 'number' },
      { key: 'month', label: 'Month', type: 'date' },
    ]);
    await nodeService.setViewSpec(uid, expense, {
      lens: 'amount',
      groupBy: 'category',
      layout: 'bar',
      filter: [{ key: 'scheduled', op: 'eq', value: false }],
      overlayOwnField: 'amount',
    });

    // budget lines: Food 400 for July and August, Transport 100 for August only
    const line = async (category: string, amount: number, month: string) => {
      const id = await mk(`b-${category}-${month}`, budgetId);
      // ONE call — saveOwnValues without editedKeys clears worn keys absent
      // from raw, so all three must go together
      await field.saveOwnValues(uid, id, {
        category,
        amount: String(amount),
        month: day.startOfDayInTz(`${month}-01`, TZ),
      });
      return id;
    };
    await line(food, 400, '2026-07');
    await line(food, 500, '2026-08');
    await line(transport, 100, '2026-08');

    // one actual August expense: Food 250 (not scheduled)
    const rec = await mk('coffee run', expense);
    await field.saveOwnValues(uid, rec, {
      amount: '250',
      category: food,
      scheduled: false,
    });
    await nodeService.updateNode(uid, rec, { eventDate: new Date('2026-08-10T03:00:00Z') });
  });

  afterAll(async () => {
    const { eq } = await import('drizzle-orm');
    await db.delete(schema.user).where(eq(schema.user.id, uid));
  });

  it('overlay picks ONLY the navigated month’s budget lines', async () => {
    const node = (await nodeRepo.byId(uid, expense))!;

    // August: Food budget 500, Transport budget 100; actual Food 250
    const aug = await view.resolveView(uid, node, TZ, day.monthBoundsInTz('2026-08', TZ));
    expect(aug?.kind).toBe('aggregate');
    if (aug?.kind !== 'aggregate') throw new Error('expected aggregate');
    const augFood = aug.buckets.find((b) => b.label === 'Food')!;
    const augTransport = aug.buckets.find((b) => b.label === 'Transport')!;
    expect(augFood.overlayValue).toBe(500); // the August Food budget, not July's 400
    expect(augFood.value).toBe(250); // actual August Food spend
    expect(augTransport.overlayValue).toBe(100);
    expect(augTransport.value).toBe(0); // budgeted, nothing spent

    // July: Food budget 400 only; no actuals
    const jul = await view.resolveView(uid, node, TZ, day.monthBoundsInTz('2026-07', TZ));
    if (jul?.kind !== 'aggregate') throw new Error('expected aggregate');
    const julFood = jul.buckets.find((b) => b.label === 'Food')!;
    expect(julFood.overlayValue).toBe(400); // July budget, not August's 500
    expect(jul.buckets.some((b) => b.label === 'Transport')).toBe(false); // no July transport
  });

  it('copy-previous-month advances the stamp and preserves amounts, as one undoable op', async () => {
    const ledger = (await nodeRepo.byId(uid, budgetId))!;
    const septLinesBefore = await budget.getLedgerLines(uid, ledger, '2026-09', TZ);
    expect(septLinesBefore).toHaveLength(0);

    // copy August (Food 500, Transport 100) into September
    const { copied } = await budget.copyMonth(uid, ledger, '2026-08', '2026-09', TZ);
    expect(copied).toBe(2);

    const sept = await budget.getLedgerLines(uid, ledger, '2026-09', TZ);
    expect(sept).toHaveLength(2);
    // amounts intact, month advanced — read via the September-scoped overlay
    const node = (await nodeRepo.byId(uid, expense))!;
    const sepView = await view.resolveView(uid, node, TZ, day.monthBoundsInTz('2026-09', TZ));
    if (sepView?.kind !== 'aggregate') throw new Error('expected aggregate');
    const byLabel = Object.fromEntries(sepView.buckets.map((b) => [b.label, b.overlayValue]));
    expect(byLabel['Food']).toBe(500);
    expect(byLabel['Transport']).toBe(100);
    // August is untouched by the copy (still 2 lines)
    expect(await budget.getLedgerLines(uid, ledger, '2026-08', TZ)).toHaveLength(2);

    // undo removes exactly the copies; August still intact; redo restores
    expect((await history.undo(uid)).ok).toBe(true);
    expect(await budget.getLedgerLines(uid, ledger, '2026-09', TZ)).toHaveLength(0);
    expect(await budget.getLedgerLines(uid, ledger, '2026-08', TZ)).toHaveLength(2);
    expect((await history.redo(uid)).ok).toBe(true);
    expect(await budget.getLedgerLines(uid, ledger, '2026-09', TZ)).toHaveLength(2);
  });
});
