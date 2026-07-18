import 'dotenv/config';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/** Phase 9 required test: seeding is idempotent, and the seeded Expense room
 *  passes an empty-aggregate smoke. Skipped (loudly) without DATABASE_URL. */

const hasDb = Boolean(process.env.DATABASE_URL);
if (!hasDb) {
  console.warn('seed integration tests SKIPPED: DATABASE_URL is not set');
}

describe.skipIf(!hasDb)('seed integration (real DB)', () => {
  let db: typeof import('@/db').db;
  let schema: typeof import('@/db/schema');
  let nodeRepo: typeof import('@/repository/nodeRepo').nodeRepo;
  let seed: typeof import('@/service/seed');
  let view: typeof import('@/service/view');

  let uid: string;

  beforeAll(async () => {
    ({ db } = await import('@/db'));
    schema = await import('@/db/schema');
    ({ nodeRepo } = await import('@/repository/nodeRepo'));
    seed = await import('@/service/seed');
    view = await import('@/service/view');

    const run = Math.random().toString(36).slice(2, 10);
    const users = await db
      .insert(schema.user)
      .values([{ email: `seed-${run}@test.local` }])
      .returning({ id: schema.user.id });
    uid = users[0]!.id;
  });

  afterAll(async () => {
    const { eq } = await import('drizzle-orm');
    await db.delete(schema.user).where(eq(schema.user.id, uid)); // cascades nodes
  });

  it('seeds once, then never again (idempotent)', async () => {
    expect(await seed.ensureSeed(uid)).toBe(true);
    const after = await nodeRepo.findTimeline(uid);
    // 6 roots + 6 Lifestyle children + 13 expense categories
    expect(after).toHaveLength(25);

    expect(await seed.ensureSeed(uid)).toBe(false);
    expect(await nodeRepo.findTimeline(uid)).toHaveLength(25);
  });

  it('seeded structure: ranked roots (nothing in the inbox), rooms under Lifestyle', async () => {
    const roots = await nodeRepo.findRoots(uid);
    expect(roots.map((r) => r.title)).toEqual([
      'Work',
      'Study',
      'Project',
      'Hobby',
      'Fitness',
      'Lifestyle',
    ]);
    expect(await nodeRepo.findInbox(uid)).toHaveLength(0);

    const lifestyle = roots.find((r) => r.title === 'Lifestyle')!;
    const rooms = await nodeRepo.findChildren(uid, lifestyle.id);
    expect(rooms.map((r) => r.title)).toEqual([
      'Todo',
      'Schedule',
      'Sleep',
      'Expense',
      'Expense categories',
      'Mood',
    ]);

    const categories = rooms.find((r) => r.title === 'Expense categories')!;
    expect(await nodeRepo.findChildren(uid, categories.id)).toHaveLength(13);

    // Expense's link field is scoped to the seeded categories node
    const expense = rooms.find((r) => r.title === 'Expense')!;
    const categoryDef = (expense.childSchema ?? []).find((d) => d.key === 'category');
    expect(categoryDef?.linkTargetParentId).toBe(categories.id);
  });

  it('empty Expense room: the §8a view resolves cleanly with no rows', async () => {
    const roots = await nodeRepo.findRoots(uid);
    const lifestyle = roots.find((r) => r.title === 'Lifestyle')!;
    const rooms = await nodeRepo.findChildren(uid, lifestyle.id);
    const expense = rooms.find((r) => r.title === 'Expense')!;

    const resolved = await view.resolveView(uid, expense);
    expect(resolved?.kind).toBe('aggregate');
    if (resolved?.kind === 'aggregate') {
      expect(resolved.buckets).toEqual([]); // no data, no throw, no null pollution
    }
  });
});
