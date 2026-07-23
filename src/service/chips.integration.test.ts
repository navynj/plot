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

  it('three tiers, drill-down excludes leaves (only drillable rooms), hasChildren', async () => {
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
    // Lifestyle's children: Todo (leaf) + Journal (non-leaf → drillable)
    await mk('Todo', life);
    const journal = await mk('Journal', life);
    await mk('entry', journal); // makes Journal a drillable room

    // findByPin (the three-value store)
    expect((await nodeRepo.findByPin(uid, 'favorite')).map((n) => n.id)).toEqual([mood]);
    expect((await nodeRepo.findByPin(uid, 'ongoing')).map((n) => n.id)).toEqual([project]);

    // getCaptureChips tiers
    const chips = await nodeService.getCaptureChips(uid);
    expect(chips.favorites.map((c) => c.title)).toEqual(['Mood']);
    expect(chips.ongoing.map((c) => c.title)).toEqual(['Big Project']);
    expect(chips.topLevel.map((c) => c.title)).toEqual(['Work', 'Lifestyle']);

    // hasChildren: Lifestyle drillable; Mood a leaf
    const lifeChip = chips.topLevel.find((c) => c.title === 'Lifestyle')!;
    const moodChip = chips.favorites[0]!;
    expect(lifeChip.hasChildren).toBe(true);
    expect(moodChip.hasChildren).toBe(false);

    // drill-down: Lifestyle → only its DRILLABLE children (Journal); the leaves
    // Mood and Todo never appear as chips
    const kids = await nodeService.getChipChildren(uid, life);
    expect(kids.map((c) => c.title)).toEqual(['Journal']);
  });

  it('attached appendages are NOT drillable children; leaves excluded too', async () => {
    const room = (await nodeRepo.create({ userId: uid, title: 'Roomy', capturedAt: new Date() }))
      .id;
    await triage.reparent(uid, room, null);
    // a leaf record, a drillable sub-room, and an attached appendage
    const leaf = await nodeRepo.create({ userId: uid, title: 'a leaf record', capturedAt: new Date() });
    await triage.reparent(uid, leaf.id, room);
    const subRoom = await nodeRepo.create({ userId: uid, title: 'a sub-room', capturedAt: new Date() });
    await triage.reparent(uid, subRoom.id, room);
    const grand = await nodeRepo.create({ userId: uid, title: 'grandchild', capturedAt: new Date() });
    await triage.reparent(uid, grand.id, subRoom.id); // makes the sub-room drillable
    const app = await nodeRepo.create({
      userId: uid,
      title: 'an appendage',
      attached: true,
      capturedAt: new Date(),
    });
    await triage.reparent(uid, app.id, room);

    const kids = await nodeService.getChipChildren(uid, room);
    // only the drillable sub-room: the leaf record and the appendage are excluded
    expect(kids.map((c) => c.title)).toEqual(['a sub-room']);
  });

  it('capturing into a node that HAS children sets it as parent (not the inbox)', async () => {
    // the reported bug's DB half: a room with existing children must still be a
    // valid capture parent — the new entry lands under it, parentId set.
    const room = (await nodeRepo.create({ userId: uid, title: 'Expense-like', capturedAt: new Date() })).id;
    await triage.reparent(uid, room, null);
    const existing = await nodeRepo.create({ userId: uid, title: 'a log', capturedAt: new Date() });
    await triage.reparent(uid, existing.id, room); // room now has a child

    const created = await nodeService.captureNode(uid, { title: 'new entry', contextParentId: room });
    const fetched = await nodeRepo.byId(uid, created.id);
    expect(fetched?.parentId).toBe(room); // not null, not inbox
  });
});
