import 'dotenv/config';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/** B2 capture chips: three tiers (favorites / ongoing / roots), drill-down
 *  children, and the three-value pin. */

const hasDb = Boolean(process.env.DATABASE_URL);
if (!hasDb) console.warn('chips integration tests SKIPPED: DATABASE_URL is not set');

describe.skipIf(!hasDb)('capture chips (real DB)', () => {
  let db: typeof import('@/db').db;
  let schema: typeof import('@/db/schema');
  let nodeRepo: typeof import('@/repository/nodeRepo').nodeRepo;
  let triage: typeof import('@/service/triage');
  let nodeService: typeof import('@/service/node');

  let uid: string;

  beforeAll(async () => {
    ({ db } = await import('@/db'));
    schema = await import('@/db/schema');
    ({ nodeRepo } = await import('@/repository/nodeRepo'));
    triage = await import('@/service/triage');
    nodeService = await import('@/service/node');

    const run = Math.random().toString(36).slice(2, 10);
    const users = await db
      .insert(schema.user)
      .values([{ email: `chips-${run}@test.local` }])
      .returning({ id: schema.user.id });
    uid = users[0]!.id;
  });

  afterAll(async () => {
    const { eq } = await import('drizzle-orm');
    await db.delete(schema.user).where(eq(schema.user.id, uid));
  });

  it('three tiers, drill-down children, and hasChildren (leaf vs room)', async () => {
    const mk = async (title: string, parentId: string | null, pin?: 'favorite' | 'ongoing') => {
      const n = await nodeRepo.create({ userId: uid, title, capturedAt: new Date() });
      await triage.reparent(uid, n.id, parentId);
      if (pin) await nodeRepo.update(uid, n.id, { pinned: pin });
      return n.id;
    };
    // roots
    const work = await mk('Work', null);
    const life = await mk('Lifestyle', null);
    // a favorite + an ongoing (pinned)
    const project = await mk('Big Project', work, 'ongoing');
    const mood = await mk('Mood', life, 'favorite');
    // Lifestyle has record children (drillable); Mood is a leaf
    await mk('Todo', life);

    // findByPin (the three-value store)
    expect((await nodeRepo.findByPin(uid, 'favorite')).map((n) => n.id)).toEqual([mood]);
    expect((await nodeRepo.findByPin(uid, 'ongoing')).map((n) => n.id)).toEqual([project]);

    // getCaptureChips tiers
    const chips = await nodeService.getCaptureChips(uid);
    expect(chips.favorites.map((c) => c.title)).toEqual(['Mood']);
    expect(chips.ongoing.map((c) => c.title)).toEqual(['Big Project']);
    expect(chips.topLevel.map((c) => c.title)).toEqual(['Work', 'Lifestyle']);

    // hasChildren: Lifestyle (has Mood + Todo) drillable; Mood a leaf
    const lifeChip = chips.topLevel.find((c) => c.title === 'Lifestyle')!;
    const moodChip = chips.favorites[0]!;
    expect(lifeChip.hasChildren).toBe(true);
    expect(moodChip.hasChildren).toBe(false);

    // drill-down: Lifestyle → its record children (Mood, Todo)
    const kids = await nodeService.getChipChildren(uid, life);
    expect(kids.map((c) => c.title).sort()).toEqual(['Mood', 'Todo']);
  });

  it('attached appendages are NOT drillable children (records only)', async () => {
    const room = (await nodeRepo.create({ userId: uid, title: 'Roomy', capturedAt: new Date() }))
      .id;
    await triage.reparent(uid, room, null);
    // one record child + one attached appendage
    const rec = await nodeRepo.create({ userId: uid, title: 'a record', capturedAt: new Date() });
    await triage.reparent(uid, rec.id, room);
    const app = await nodeRepo.create({
      userId: uid,
      title: 'an appendage',
      attached: true,
      capturedAt: new Date(),
    });
    await triage.reparent(uid, app.id, room);

    const kids = await nodeService.getChipChildren(uid, room);
    expect(kids.map((c) => c.title)).toEqual(['a record']); // appendage excluded
  });
});
