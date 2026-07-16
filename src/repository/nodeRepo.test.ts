import 'dotenv/config';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/** Ownership isolation (ROADMAP Phase 1.5 🧪): one user's queries never return
 *  another user's nodes. The isolation lives in SQL WHERE clauses, so this is
 *  an integration test against the Neon dev branch — it needs DATABASE_URL and
 *  is skipped (loudly) when that is absent. All imports are dynamic because
 *  the db client throws at load time without DATABASE_URL. */

const hasDb = Boolean(process.env.DATABASE_URL);
if (!hasDb) {
  console.warn('nodeRepo ownership test SKIPPED: DATABASE_URL is not set');
}

describe.skipIf(!hasDb)('nodeRepo ownership isolation', () => {
  let db: typeof import('@/db').db;
  let schema: typeof import('@/db/schema');
  let nodeRepo: typeof import('@/repository/nodeRepo').nodeRepo;

  const run = `owner-test-${Math.random().toString(36).slice(2, 10)}`;
  let userA: string;
  let userB: string;
  let nodeA: string;
  let nodeB: string;

  beforeAll(async () => {
    ({ db } = await import('@/db'));
    schema = await import('@/db/schema');
    ({ nodeRepo } = await import('@/repository/nodeRepo'));

    const users = await db
      .insert(schema.user)
      .values([{ email: `${run}-a@test.local` }, { email: `${run}-b@test.local` }])
      .returning({ id: schema.user.id });
    userA = users[0]!.id;
    userB = users[1]!.id;

    nodeA = (await nodeRepo.create({ userId: userA, body: `${run} A`, capturedAt: new Date() })).id;
    nodeB = (await nodeRepo.create({ userId: userB, body: `${run} B`, capturedAt: new Date() })).id;
  });

  afterAll(async () => {
    // user deletion cascades to nodes via the FK
    const { inArray } = await import('drizzle-orm');
    await db.delete(schema.user).where(inArray(schema.user.id, [userA, userB]));
  });

  it('findTimeline returns only the owner’s nodes', async () => {
    const timelineA = await nodeRepo.findTimeline(userA);
    expect(timelineA.map((n) => n.id)).toContain(nodeA);
    expect(timelineA.map((n) => n.id)).not.toContain(nodeB);
  });

  it('findInbox returns only the owner’s nodes', async () => {
    const inboxB = await nodeRepo.findInbox(userB);
    expect(inboxB.map((n) => n.id)).toContain(nodeB);
    expect(inboxB.map((n) => n.id)).not.toContain(nodeA);
  });

  it('byId does not cross user boundaries', async () => {
    expect(await nodeRepo.byId(userA, nodeA)).not.toBeNull();
    expect(await nodeRepo.byId(userA, nodeB)).toBeNull();
  });

  it('update and softDelete cannot touch another user’s node', async () => {
    expect(await nodeRepo.update(userA, nodeB, { title: 'stolen' })).toBeNull();
    expect(await nodeRepo.softDelete(userA, nodeB)).toBe(false);
    // B's node is untouched
    const untouched = await nodeRepo.byId(userB, nodeB);
    expect(untouched?.title).toBeNull();
    expect(untouched?.deletedAt).toBeNull();
  });
});
