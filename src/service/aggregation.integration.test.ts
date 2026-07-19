import 'dotenv/config';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/** The DESIGN §8 worked examples, executable against the real Neon branch —
 *  the aggregation engine's required tests. Skipped (loudly) without
 *  DATABASE_URL; imports are dynamic (the db client throws without env). */

const hasDb = Boolean(process.env.DATABASE_URL);
if (!hasDb) {
  console.warn('aggregation integration tests SKIPPED: DATABASE_URL is not set');
}

describe.skipIf(!hasDb)('aggregation integration — DESIGN §8 worked examples', () => {
  let db: typeof import('@/db').db;
  let schema: typeof import('@/db/schema');
  let nodeRepo: typeof import('@/repository/nodeRepo').nodeRepo;
  let field: typeof import('@/service/field');
  let collection: typeof import('@/service/collection');
  let triage: typeof import('@/service/triage');
  let aggregation: typeof import('@/service/aggregation');

  let uid: string;
  // §8a
  let cats: string, food: string, transport: string;
  let expense: string, august: string, budget: string;
  // §8b
  let rio: string, hysteria: string;
  // heterogeneous
  let mixed: string;

  const mk = async (title: string, parentId?: string) => {
    const n = await nodeRepo.create({ userId: uid, title, capturedAt: new Date() });
    if (parentId) await triage.reparent(uid, n.id, parentId);
    return n.id;
  };

  beforeAll(async () => {
    ({ db } = await import('@/db'));
    schema = await import('@/db/schema');
    ({ nodeRepo } = await import('@/repository/nodeRepo'));
    field = await import('@/service/field');
    collection = await import('@/service/collection');
    triage = await import('@/service/triage');
    aggregation = await import('@/service/aggregation');

    const run = Math.random().toString(36).slice(2, 10);
    const users = await db
      .insert(schema.user)
      .values([{ email: `agg-${run}@test.local` }])
      .returning({ id: schema.user.id });
    uid = users[0]!.id;

    /* ---- §8a: During budget ---- */
    cats = await mk('Budget categories');
    food = await mk('식비', cats);
    transport = await mk('교통', cats);

    expense = await mk('Expense');
    await nodeRepo.update(uid, expense, {
      childSchema: [
        { key: 'category', label: 'Category', type: 'link', linkTargetParentId: cats },
        { key: 'amount', label: 'Amount', type: 'number' },
        { key: 'scheduled', label: 'Scheduled', type: 'boolean' },
      ],
    });
    const spend = async (title: string, category: string, amount: number, scheduled: boolean) => {
      const id = await mk(title, expense);
      await field.saveOwnValues(uid, id, {
        category,
        amount: String(amount),
        scheduled: scheduled ? 'on' : undefined,
      });
      return id;
    };
    const coffee = await spend('Coffee', food, 4500, false);
    const lunch = await spend('Lunch', food, 12000, false);
    const taxi = await spend('Taxi', transport, 12000, true); // scheduled, not yet spent
    const bus = await spend('Bus', transport, 8000, false);

    august = await mk('August');
    budget = await mk('Budget', august); // tree child of August holding budget lines
    await nodeRepo.update(uid, budget, {
      childSchema: [
        { key: 'category', label: 'Category', type: 'link', linkTargetParentId: cats },
        { key: 'amount', label: 'Amount', type: 'number' },
      ],
    });
    const budgetLine = async (category: string, amount: number) => {
      const id = await mk(`line-${amount}`, budget);
      await field.saveOwnValues(uid, id, { category, amount: String(amount) });
    };
    await budgetLine(food, 300000);
    await budgetLine(transport, 10000); // small on purpose → over budget

    // August is ALSO a graph parent: expenses are materialized links
    for (const id of [coffee, lunch, taxi, bus]) {
      await collection.addToCollection(uid, august, id);
    }

    /* ---- §8b: practice log ---- */
    const bass = await mk('Bass');
    const songs = await mk('Songs', bass);
    await nodeRepo.update(uid, songs, {
      childSchema: [{ key: 'bpm', label: 'BPM', type: 'number' }],
    });
    rio = await mk('Rio Funk', songs);
    hysteria = await mk('Hysteria', songs);
    const sessionSchema = [
      { key: 'practiceTime', label: 'Practice', type: 'number' },
      { key: 'date', label: 'Date', type: 'date' },
    ] as const;
    await nodeRepo.update(uid, rio, { childSchema: [...sessionSchema] });
    await nodeRepo.update(uid, hysteria, { childSchema: [...sessionSchema] });
    const session = async (song: string, minutes: number, date: string) => {
      const id = await mk(`s-${minutes}`, song);
      await field.saveOwnValues(uid, id, { practiceTime: String(minutes), date });
    };
    await session(rio, 30, '2026-08-03');
    await session(rio, 15, '2026-08-03');
    await session(rio, 20, '2026-08-07');
    await session(hysteria, 60, '2026-08-03'); // must not leak into Rio's sums

    /* ---- heterogeneous collection ---- */
    mixed = await mk('mixed bag');
    const movie = await mk('Heat (1995)'); // no amount field at all
    for (const id of [coffee, bus, movie]) await collection.addToCollection(uid, mixed, id);
  });

  afterAll(async () => {
    const { eq } = await import('drizzle-orm');
    await db.delete(schema.user).where(eq(schema.user.id, uid));
  });

  it('§8a: actual / scheduled / remaining per category — exact, including over-budget', async () => {
    const rows = await aggregation.budgetVsActual(uid, {
      budgetNodeId: budget,
      actualsNodeId: august,
      valueKey: 'amount',
      categoryKey: 'category',
      scheduledKey: 'scheduled',
    });
    const by = new Map(rows.map((r) => [r.category, r]));

    // 식비: 300000 budget; actual 4500+12000; nothing scheduled
    expect(by.get(food)).toEqual({
      category: food,
      budget: 300000,
      actual: 16500,
      scheduled: 0,
      remaining: 283500,
    });
    // 교통: 10000 budget; actual 8000; scheduled 12000 → remaining −10000 (over)
    expect(by.get(transport)).toEqual({
      category: transport,
      budget: 10000,
      actual: 8000,
      scheduled: 12000,
      remaining: -10000,
    });
    expect(rows).toHaveLength(2); // one row per category on the shared axis
  });

  it('§8a: filter pushdown — scheduled=false excludes Taxi inside the single SQL pass', async () => {
    const actual = await aggregation.aggregate(uid, august, {
      source: 'graph',
      spec: {
        lens: 'amount',
        groupBy: 'category',
        op: 'sum',
        filters: [{ key: 'scheduled', op: 'eq', value: false }],
      },
    });
    const transportBucket = actual.find((b) => b.group === transport);
    expect(transportBucket?.value).toBe(8000); // Bus only; Taxi (12000) filtered in SQL
    expect(transportBucket?.count).toBe(1);
  });

  it('§8b: Σ practiceTime grouped by date; the other song’s sessions do not leak', async () => {
    const buckets = await aggregation.aggregate(uid, rio, {
      source: 'tree',
      spec: { lens: 'practiceTime', groupBy: 'date', op: 'sum' },
    });
    const byDay = (day: string) => buckets.find((b) => b.group?.startsWith(day));

    expect(byDay('2026-08-03')?.value).toBe(45); // 30 + 15, NOT +60 from Hysteria
    expect(byDay('2026-08-03')?.count).toBe(2);
    expect(byDay('2026-08-07')?.value).toBe(20);
    expect(buckets).toHaveLength(2);
  });

  it('heterogeneous set: the lens-less movie silently drops out of sum AND count', async () => {
    const [sum] = await aggregation.aggregate(uid, mixed, {
      source: 'graph',
      spec: { lens: 'amount', op: 'sum' },
    });
    expect(sum?.value).toBe(12500); // Coffee 4500 + Bus 8000; Heat (1995) absent
    expect(sum?.count).toBe(2); // count reflects only participating nodes

    const [count] = await aggregation.aggregate(uid, mixed, {
      source: 'graph',
      spec: { lens: 'amount', op: 'count' },
    });
    expect(count?.value).toBe(2);
  });

  it('emits ONE single-pass grouped statement (introspected, for the record)', async () => {
    const { PgDialect } = await import('drizzle-orm/pg-core');
    const { buildAggregateSql } = await import('@/repository/fieldValueRepo');
    const query = new PgDialect().sqlToQuery(
      buildAggregateSql(uid, ['n1', 'n2'], {
        valueKey: 'amount',
        groupByKey: 'category',
        op: 'sum',
        filters: [{ key: 'scheduled', op: 'eq', column: 'boolValue', value: false }],
      })
    );
    console.log('[aggregate SQL]', query.sql.replace(/\s+/g, ' ').trim());
    expect(query.sql).toContain('group by 1');
    expect((query.sql.match(/select /gi) ?? []).length).toBe(2); // outer + one EXISTS subquery
  });

  it('date meta-axis keeps the single-statement shape: date_trunc on the joined node, no g join', async () => {
    const { PgDialect } = await import('drizzle-orm/pg-core');
    const { buildAggregateSql } = await import('@/repository/fieldValueRepo');
    const query = new PgDialect().sqlToQuery(
      buildAggregateSql(uid, ['n1'], { valueKey: 'score', groupByKey: 'eventDate', op: 'avg' })
    );
    console.log('[meta-axis SQL]', query.sql.replace(/\s+/g, ' ').trim());
    expect(query.sql).toContain("date_trunc('day', coalesce(n.event_date, n.captured_at))");
    expect(query.sql).not.toContain('left join field_value g'); // meta axis needs no value join
    expect(query.sql).toContain('group by 1');
    expect((query.sql.match(/select /gi) ?? []).length).toBe(1); // one statement, no subqueries

    const captured = new PgDialect().sqlToQuery(
      buildAggregateSql(uid, ['n1'], { valueKey: 'score', groupByKey: 'capturedAt', op: 'sum' })
    );
    expect(captured.sql).toContain("date_trunc('day', n.captured_at)");
  });
});
