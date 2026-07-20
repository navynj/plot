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
    // origin is the birth record: captureNode writes 'captured', every other
    // creator defaults 'constructed' — body no longer distinguishes them
    // (a single-line capture is body-null since the first-line split)
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

    const rows = await nodeRepo.findTimelineVisible(uid, undefined, 'UTC');
    const visible = rows.map((n) => n.title ?? n.body);

    expect(visible).not.toContain('has-children'); // structural via children
    expect(visible).not.toContain('declares-schema'); // structural via childSchema
    expect(visible).toContain('the-child'); // captured leaf child unaffected
    expect(visible).toContain('plain-leaf'); // single-line capture: body-null yet VISIBLE (origin)
    expect(visible).not.toContain('constructed-leaf'); // born constructed → not a record
    expect(visible).toContain('shown-constructed'); // manual override in
    expect(visible).not.toContain('hidden-leaf'); // manual override out
  });

  it('capture splits the first line into title at the service path; multi-line keeps the rest as body', async () => {
    const single = await nodeService.captureNode(uid, { body: 'Croissant (12pc)' });
    expect(single.title).toBe('Croissant (12pc)');
    expect(single.body).toBeNull();
    expect(single.origin).toBe('captured');

    const multi = await nodeService.captureNode(uid, { body: 'Rio Funk\n30분 연습' });
    expect(multi.title).toBe('Rio Funk');
    expect(multi.body).toBe('30분 연습');

    const rows = await nodeRepo.findTimelineVisible(uid, undefined, 'UTC');
    const titles = rows.map((n) => n.title);
    expect(titles).toContain('Croissant (12pc)'); // single-line capture on the timeline
    expect(titles).toContain('Rio Funk');
  });

  it('origin migration fixture: legacy shapes split and mark correctly (mirrors .migrate-origin.mjs)', async () => {
    const { sql: rawSql } = await import('drizzle-orm');
    const mig = (k: string) => `mig-${uid.slice(0, 6)}-${k}`; // ids unique per run
    // legacy capture shape: body only, pre-split, origin default 'constructed'
    await db.insert(schema.node).values([
      { id: mig('single'), userId: uid, body: 'buy stamps' },
      { id: mig('multi'), userId: uid, body: 'trip notes\npack light\nbook early' },
      { id: mig('both'), userId: uid, title: 'Renamed', body: 'original capture text' },
      { id: mig('room'), userId: uid, title: 'A room' },
    ]);

    // the same statements the one-off migration runs
    await db.execute(rawSql`update node set origin='captured'
      where body is not null and title is not null and origin <> 'captured' and user_id=${uid}`);
    await db.execute(rawSql`update node set
      title = nullif(trim(split_part(body, e'\n', 1)), ''),
      body = case when position(e'\n' in body) = 0 then null
                  else nullif(trim(substring(body from position(e'\n' in body) + 1)), '') end,
      origin = 'captured'
      where body is not null and title is null and user_id=${uid}`);

    const byIdRow = async (id: string) => (await nodeRepo.byId(uid, id))!;
    const single = await byIdRow(mig('single'));
    expect([single.title, single.body, single.origin]).toEqual(['buy stamps', null, 'captured']);
    const multi = await byIdRow(mig('multi'));
    expect([multi.title, multi.body, multi.origin]).toEqual([
      'trip notes',
      'pack light\nbook early',
      'captured',
    ]);
    // both-set: FLAGGED not split — text untouched, marked captured
    const both = await byIdRow(mig('both'));
    expect([both.title, both.body, both.origin]).toEqual([
      'Renamed',
      'original capture text',
      'captured',
    ]);
    // constructed shape untouched
    const room = await byIdRow(mig('room'));
    expect([room.title, room.body, room.origin]).toEqual(['A room', null, 'constructed']);
  });

  it('timeline event axis: event_date wins, capturedAt falls back, day boundaries follow the USER timezone', async () => {
    const { startOfDayInTz } = await import('@/lib/day');
    const captured = async (body: string, eventDate?: Date) => {
      const n = await nodeService.captureNode(uid, { body, eventDate });
      return n.id;
    };
    await captured('axis-today'); // capturedAt only → today (fallback)
    await captured('axis-early', startOfDayInTz('2026-06-01', 'UTC'));
    await captured('axis-late', startOfDayInTz('2026-06-03', 'UTC'));
    // THE ROLLOVER, at the SQL layer: 23:30 UTC on 06-02 = 08:30 KST on 06-03
    await captured('axis-mid', new Date('2026-06-02T23:30:00Z'));

    const all = await nodeRepo.findTimelineVisible(uid, undefined, 'UTC');
    // single-line captures land in TITLE since the first-line split
    const titles = all.map((n) => n.title).filter((t) => t?.startsWith('axis-'));
    // event axis order (pure UTC instants): dated entries first, then today
    expect(titles).toEqual(['axis-early', 'axis-mid', 'axis-late', 'axis-today']);

    // a UTC user finds the 23:30Z entry on 06-02…
    const utcDay = await nodeRepo.findTimelineVisible(uid, '2026-06-02', 'UTC');
    expect(utcDay.map((n) => n.title)).toEqual(['axis-mid']);
    // …a KST user finds the SAME entry on 06-03 (their morning), sharing the
    // day with axis-late (06-03T00:00Z = 09:00 KST same day)
    const kstDay = await nodeRepo.findTimelineVisible(uid, '2026-06-03', 'Asia/Seoul');
    expect(kstDay.map((n) => n.title).sort()).toEqual(['axis-late', 'axis-mid']);
    expect((await nodeRepo.findTimelineVisible(uid, '2026-06-02', 'Asia/Seoul')).length).toBe(0);
    // boundary day, nothing bleeding
    const june1 = await nodeRepo.findTimelineVisible(uid, '2026-06-01', 'UTC');
    expect(june1.map((n) => n.title)).toEqual(['axis-early']);

    // THE TIEBREAKER: same eventDate (same midnight) → capture order within
    // the day, matching the displayed times
    const sameDay = startOfDayInTz('2026-06-10', 'UTC');
    await captured('tie-first', sameDay);
    await captured('tie-second', sameDay);
    await captured('tie-third', sameDay);
    const june10 = await nodeRepo.findTimelineVisible(uid, '2026-06-10', 'UTC');
    expect(june10.map((n) => n.title)).toEqual(['tie-first', 'tie-second', 'tie-third']);
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
      spec: { lens: 'score', groupBy: 'eventDate', op: 'avg', tz: 'UTC' },
    });
    const today = new Date().toISOString().slice(0, 10); // UTC day, matching tz: 'UTC'
    const byDay = (d: string) => buckets.find((b) => b.group?.startsWith(d));

    expect(byDay(today)?.value).toBe(3); // avg(4,2) — captured-at fallback
    expect(byDay(today)?.count).toBe(2);
    expect(byDay('2026-07-01')?.value).toBe(5); // event date wins over capture day
    expect(buckets).toHaveLength(2);
  });
});
