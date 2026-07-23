import 'dotenv/config';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/** Children ordering (node detail): 'happened' (event axis, eventDate ??
 *  capturedAt) is the default; 'captured' orders strictly by capturedAt. Real
 *  DB — the ORDER BY lives in SQL and can't be unit-tested. */

const hasDb = Boolean(process.env.DATABASE_URL);
if (!hasDb) console.warn('childSort integration tests SKIPPED: DATABASE_URL is not set');

describe.skipIf(!hasDb)('getChildren date sort (real DB)', () => {
  let db: typeof import('@/db').db;
  let schema: typeof import('@/db/schema');
  let nodeRepo: typeof import('@/repository/nodeRepo').nodeRepo;
  let triage: typeof import('@/service/triage');
  let nodeService: typeof import('@/service/node');

  let uid: string;
  let parentId: string;
  let A: string; // captured 7/3, no eventDate      → happened 7/3
  let B: string; // captured 7/1, eventDate 7/5     → happened 7/5
  let C: string; // captured 7/2, eventDate 7/1     → happened 7/1

  beforeAll(async () => {
    ({ db } = await import('@/db'));
    schema = await import('@/db/schema');
    ({ nodeRepo } = await import('@/repository/nodeRepo'));
    triage = await import('@/service/triage');
    nodeService = await import('@/service/node');

    const run = Math.random().toString(36).slice(2, 10);
    const users = await db
      .insert(schema.user)
      .values([{ email: `csort-${run}@test.local` }])
      .returning({ id: schema.user.id });
    uid = users[0]!.id;

    const parent = await nodeRepo.create({ userId: uid, title: 'Room', capturedAt: new Date() });
    await triage.reparent(uid, parent.id, null);
    parentId = parent.id;

    const mk = async (title: string, capturedAt: string, eventDate: string | null) => {
      const n = await nodeRepo.create({ userId: uid, title, capturedAt: new Date(capturedAt) });
      await triage.reparent(uid, n.id, parentId);
      if (eventDate) await nodeRepo.update(uid, n.id, { eventDate: new Date(eventDate) });
      return n.id;
    };
    A = await mk('A', '2026-07-03T10:00:00Z', null);
    B = await mk('B', '2026-07-01T10:00:00Z', '2026-07-05T10:00:00Z');
    C = await mk('C', '2026-07-02T10:00:00Z', '2026-07-01T10:00:00Z');
  });

  afterAll(async () => {
    const { eq } = await import('drizzle-orm');
    await db.delete(schema.user).where(eq(schema.user.id, uid));
  });

  it("'happened' orders by the event axis (eventDate ?? capturedAt), ascending", async () => {
    const ids = (await nodeService.getChildren(uid, parentId, 'happened')).map((n) => n.id);
    expect(ids).toEqual([C, A, B]); // 7/1, 7/3, 7/5
  });

  it("'captured' orders strictly by capturedAt, ascending", async () => {
    const ids = (await nodeService.getChildren(uid, parentId, 'captured')).map((n) => n.id);
    expect(ids).toEqual([B, C, A]); // 7/1, 7/2, 7/3
  });

  it('the default is happened', async () => {
    const ids = (await nodeService.getChildren(uid, parentId)).map((n) => n.id);
    expect(ids).toEqual([C, A, B]);
  });

  it('the repo default (no sort option) is still manual rank order — unchanged', async () => {
    // triage assigned ranks in insertion order A, B, C
    const ids = (await nodeRepo.findChildren(uid, parentId)).map((n) => n.id);
    expect(ids).toEqual([A, B, C]);
  });
});
