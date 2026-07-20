import 'dotenv/config';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/** Batch-#3 required pins: undo of a batch reparent restores every node's
 *  exact previous parent AND rank; undo of a delete restores the node and its
 *  children's original attachment; redo re-applies; a new operation clears
 *  the redo branch. Skipped (loudly) without DATABASE_URL. */

const hasDb = Boolean(process.env.DATABASE_URL);
if (!hasDb) {
  console.warn('history integration tests SKIPPED: DATABASE_URL is not set');
}

describe.skipIf(!hasDb)('undo/redo integration (real DB)', () => {
  let db: typeof import('@/db').db;
  let schema: typeof import('@/db/schema');
  let nodeRepo: typeof import('@/repository/nodeRepo').nodeRepo;
  let undoRepo: typeof import('@/repository/undoRepo').undoRepo;
  let triage: typeof import('@/service/triage');
  let history: typeof import('@/service/history');

  let uid: string;
  let roomA: string, roomB: string;
  let n1: string, n2: string, n3: string;

  const place = async (id: string) => {
    const n = (await nodeRepo.byId(uid, id))!;
    return { parentId: n.parentId, rank: n.rank };
  };

  beforeAll(async () => {
    ({ db } = await import('@/db'));
    schema = await import('@/db/schema');
    ({ nodeRepo } = await import('@/repository/nodeRepo'));
    ({ undoRepo } = await import('@/repository/undoRepo'));
    triage = await import('@/service/triage');
    history = await import('@/service/history');

    const run = Math.random().toString(36).slice(2, 10);
    const users = await db
      .insert(schema.user)
      .values([{ email: `history-${run}@test.local` }])
      .returning({ id: schema.user.id });
    uid = users[0]!.id;

    const mk = async (title: string) =>
      (await nodeRepo.create({ userId: uid, title, capturedAt: new Date() })).id;
    roomA = await mk('room A');
    roomB = await mk('room B');
    n1 = await mk('n1');
    n2 = await mk('n2');
    n3 = await mk('n3');
    await triage.reparent(uid, roomA, null);
    await triage.reparent(uid, roomB, null);
    // mixed starting placements: n1 inbox, n2 under A, n3 under A
    await triage.reparentMany(uid, [n2, n3], roomA, { record: false });
  });

  afterAll(async () => {
    const { eq } = await import('drizzle-orm');
    await db.delete(schema.user).where(eq(schema.user.id, uid));
  });

  it('batch reparent → undo restores EXACT previous parent and rank per node; redo re-applies; new op clears redo', async () => {
    const before = { n1: await place(n1), n2: await place(n2), n3: await place(n3) };

    await triage.reparentMany(uid, [n1, n2, n3], roomB); // records ONE op
    const after = { n1: await place(n1), n2: await place(n2), n3: await place(n3) };
    expect(after.n1.parentId).toBe(roomB);
    expect(after.n2.parentId).toBe(roomB);

    const undone = await history.undo(uid);
    expect(undone.ok).toBe(true);
    expect(await place(n1)).toEqual(before.n1); // inbox: null/null exactly
    expect(await place(n2)).toEqual(before.n2); // room A, same rank string
    expect(await place(n3)).toEqual(before.n3);

    const redone = await history.redo(uid);
    expect(redone.ok).toBe(true);
    expect(await place(n1)).toEqual(after.n1); // exact re-application, ranks too
    expect(await place(n2)).toEqual(after.n2);
    expect(await place(n3)).toEqual(after.n3);

    // undo again, then a NEW operation must clear the redo branch
    await history.undo(uid);
    await triage.reparentMany(uid, [n1], roomA);
    expect(await undoRepo.list(uid, 'redo')).toHaveLength(0);
    expect((await history.redo(uid)).ok).toBe(false);
  });

  it('delete → undo restores the node AND its children’s original attachment; redo re-deletes', async () => {
    // build: roomB > victim > (kid1, kid2)
    const mk = async (title: string) =>
      (await nodeRepo.create({ userId: uid, title, capturedAt: new Date() })).id;
    const victim = await mk('victim');
    const kid1 = await mk('kid1');
    const kid2 = await mk('kid2');
    await triage.reparentMany(uid, [victim], roomB, { record: false });
    await triage.reparentMany(uid, [kid1, kid2], victim, { record: false });
    const beforeVictim = await place(victim);
    const beforeKids = { kid1: await place(kid1), kid2: await place(kid2) };

    await triage.removeMany(uid, [victim]); // children close up to roomB
    expect(await nodeRepo.byId(uid, victim)).toBeNull();
    expect((await place(kid1)).parentId).toBe(roomB);

    const undone = await history.undo(uid);
    expect(undone.ok).toBe(true);
    expect(await nodeRepo.byId(uid, victim)).not.toBeNull(); // un-soft-deleted
    expect(await place(victim)).toEqual(beforeVictim);
    expect(await place(kid1)).toEqual(beforeKids.kid1); // back under victim, same rank
    expect(await place(kid2)).toEqual(beforeKids.kid2);

    const redone = await history.redo(uid);
    expect(redone.ok).toBe(true);
    expect(await nodeRepo.byId(uid, victim)).toBeNull();
    expect((await place(kid2)).parentId).toBe(roomB); // children closed up again
  });
});
