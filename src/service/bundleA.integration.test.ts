import 'dotenv/config';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/** Bundle A required tests: delete semantics, timeline structural derivation
 *  (SQL), date meta-axis grouping. Skipped (loudly) without DATABASE_URL. */

const hasDb = Boolean(process.env.DATABASE_URL);
if (!hasDb) {
  console.warn('bundle A integration tests SKIPPED: DATABASE_URL is not set');
}

describe.skipIf(!hasDb)('bundle A integration (real DB)', () => {
  let db: typeof import('@/db').db;
  let schema: typeof import('@/db/schema');
  let nodeRepo: typeof import('@/repository/nodeRepo').nodeRepo;
  let linkRepo: typeof import('@/repository/linkRepo').linkRepo;
  let triage: typeof import('@/service/triage');
  let nodeService: typeof import('@/service/node');
  let field: typeof import('@/service/field');
  let aggregation: typeof import('@/service/aggregation');

  let uid: string;

  const mk = async (title: string, parentId?: string) => {
    const n = await nodeRepo.create({ userId: uid, title, capturedAt: new Date() });
    if (parentId) await triage.reparent(uid, n.id, parentId);
    return n.id;
  };

  beforeAll(async () => {
    ({ db } = await import('@/db'));
    schema = await import('@/db/schema');
    ({ nodeRepo } = await import('@/repository/nodeRepo'));
    ({ linkRepo } = await import('@/repository/linkRepo'));
    triage = await import('@/service/triage');
    nodeService = await import('@/service/node');
    field = await import('@/service/field');
    aggregation = await import('@/service/aggregation');

    const run = Math.random().toString(36).slice(2, 10);
    const users = await db
      .insert(schema.user)
      .values([{ email: `bundleA-${run}@test.local` }])
      .returning({ id: schema.user.id });
    uid = users[0]!.id;
  });

  afterAll(async () => {
    const { eq } = await import('drizzle-orm');
    await db.delete(schema.user).where(eq(schema.user.id, uid));
  });

  it('delete semantics: children re-parent up (gap closes), links removed, subtree not orphaned', async () => {
    // grandparent > mid > (kid1, kid2 > grandkid); collection links mid
    const grandparent = await mk('grandparent');
    await triage.reparent(uid, grandparent, null);
    const mid = await mk('mid', grandparent);
    const kid1 = await mk('kid1', mid);
    const kid2 = await mk('kid2', mid);
    const grandkid = await mk('grandkid', kid2);
    const collection = await mk('collection');
    const collectionService = await import('@/service/collection');
    await collectionService.addToCollection(uid, collection, mid);

    await triage.removeNode(uid, mid);

    // mid is soft-deleted and invisible to reads
    expect(await nodeRepo.byId(uid, mid)).toBeNull();
    // children moved UP to grandparent, in order, not orphaned
    const moved = await nodeRepo.findChildren(uid, grandparent);
    expect(moved.map((n) => n.id)).toEqual([kid1, kid2]);
    // deeper subtree untouched: grandkid still under kid2
    expect((await nodeRepo.byId(uid, grandkid))?.parentId).toBe(kid2);
    // graph edges to the deleted node are gone
    expect((await linkRepo.findTargets(uid, collection)).map((n) => n.id)).not.toContain(mid);
  });

  it('delete of an inbox node with children: children fall back to the inbox', async () => {
    const bundle = await mk('bundle'); // undetermined
    const a = await mk('a', bundle);
    const b = await mk('b', bundle);

    await triage.removeNode(uid, bundle);

    const inbox = (await nodeRepo.findInbox(uid)).map((n) => n.id);
    expect(inbox).toEqual(expect.arrayContaining([a, b]));
  });

  it('timeline derivation in SQL: structural + constructed hide under auto; shown/hidden override; captured leaves unaffected', async () => {
    // captured entries carry body (the capture artifact); constructed nodes don't
    const captured = async (body: string, parentId?: string) => {
      const n = await nodeService.captureNode(uid, { body, contextParentId: parentId });
      return n.id;
    };
    const structuralParent = await captured('has-children');
    await triage.reparent(uid, structuralParent, null);
    await captured('the-child', structuralParent);
    const schemaOnly = await captured('declares-schema');
    await nodeService.setChildSchema(uid, schemaOnly, [{ key: 'x', label: 'X', type: 'text' }]);
    await captured('plain-leaf');
    await mk('constructed-leaf'); // title only, never captured
    const shownConstructed = await mk('shown-constructed');
    await nodeService.updateNode(uid, shownConstructed, { timelineVisibility: 'shown' });
    const hiddenLeaf = await captured('hidden-leaf');
    await nodeService.updateNode(uid, hiddenLeaf, { timelineVisibility: 'hidden' });

    const rows = await nodeRepo.findTimelineVisible(uid);
    const visible = rows.map((n) => n.title ?? n.body);

    expect(visible).not.toContain('has-children'); // structural via children
    expect(visible).not.toContain('declares-schema'); // structural via childSchema
    expect(visible).toContain('the-child'); // captured leaf child unaffected
    expect(visible).toContain('plain-leaf');
    expect(visible).not.toContain('constructed-leaf'); // never captured → not a record
    expect(visible).toContain('shown-constructed'); // manual override in
    expect(visible).not.toContain('hidden-leaf'); // manual override out
  });

  it('timeline event axis: event_date wins, capturedAt falls back, day filter respects boundaries', async () => {
    const nodeService2 = nodeService;
    const captured = async (body: string, eventDay?: string) => {
      const n = await nodeService2.captureNode(uid, {
        body,
        eventDate: eventDay ? new Date(`${eventDay}T00:00:00`) : undefined,
      });
      return n.id;
    };
    await captured('axis-today'); // capturedAt only → today
    await captured('axis-early', '2026-06-01');
    await captured('axis-late', '2026-06-03');
    await captured('axis-mid', '2026-06-02');

    const all = await nodeRepo.findTimelineVisible(uid);
    const bodies = all.map((n) => n.body).filter((b) => b?.startsWith('axis-'));
    // event axis order: dated entries first (June), then the captured-today one
    expect(bodies).toEqual(['axis-early', 'axis-mid', 'axis-late', 'axis-today']);

    // day filter: exactly the boundary day, nothing bleeding across
    const june2 = await nodeRepo.findTimelineVisible(uid, '2026-06-02');
    expect(june2.map((n) => n.body)).toEqual(['axis-mid']);
    const june1 = await nodeRepo.findTimelineVisible(uid, '2026-06-01');
    expect(june1.map((n) => n.body)).toEqual(['axis-early']);
  });

  it('date meta-axis: eventDate groups on coalesce(event_date, captured_at) day', async () => {
    const mood = await mk('MoodAxis');
    await nodeService.setChildSchema(uid, mood, [{ key: 'score', label: 'Score', type: 'number' }]);
    const entry = async (score: number, eventDate?: string) => {
      const id = await mk(`m${score}`, mood);
      await field.saveOwnValues(uid, id, { score: String(score) });
      if (eventDate) await nodeService.updateNode(uid, id, { eventDate: new Date(eventDate) });
      return id;
    };
    await entry(4); // no eventDate → falls back to capturedAt (today)
    await entry(2); // today as well
    await entry(5, '2026-07-01T12:00:00Z'); // explicit event date

    const buckets = await aggregation.aggregate(uid, mood, {
      source: 'tree',
      spec: { lens: 'score', groupBy: 'eventDate', op: 'avg' },
    });
    const today = new Date().toISOString().slice(0, 10);
    const byDay = (d: string) => buckets.find((b) => b.group?.startsWith(d));

    expect(byDay(today)?.value).toBe(3); // avg(4,2) — captured-at fallback
    expect(byDay(today)?.count).toBe(2);
    expect(byDay('2026-07-01')?.value).toBe(5); // event date wins over capture day
    expect(buckets).toHaveLength(2);
  });
});
