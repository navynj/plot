import 'dotenv/config';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/** Triage against the real Neon dev branch: recursive-CTE cycle checks, rank
 *  math, and the inbox/root semantics only real SQL can prove. Skipped
 *  (loudly) without DATABASE_URL. Imports are dynamic — the db client throws
 *  at load time when the env is absent. */

const hasDb = Boolean(process.env.DATABASE_URL);
if (!hasDb) {
  console.warn('triage integration tests SKIPPED: DATABASE_URL is not set');
}

describe.skipIf(!hasDb)('triage integration (real DB)', () => {
  let db: typeof import('@/db').db;
  let schema: typeof import('@/db/schema');
  let nodeRepo: typeof import('@/repository/nodeRepo').nodeRepo;
  let fieldValueRepo: typeof import('@/repository/fieldValueRepo').fieldValueRepo;
  let triage: typeof import('@/service/triage');
  let errors: typeof import('@/service/errors');

  let uid: string;
  // chain: root ── mid ── leaf ; plus two inbox nodes
  let root: string, mid: string, leaf: string, loose1: string, loose2: string;

  beforeAll(async () => {
    ({ db } = await import('@/db'));
    schema = await import('@/db/schema');
    ({ nodeRepo } = await import('@/repository/nodeRepo'));
    ({ fieldValueRepo } = await import('@/repository/fieldValueRepo'));
    triage = await import('@/service/triage');
    errors = await import('@/service/errors');

    const run = Math.random().toString(36).slice(2, 10);
    const users = await db
      .insert(schema.user)
      .values([{ email: `triage-${run}@test.local` }])
      .returning({ id: schema.user.id });
    uid = users[0]!.id;

    const mk = async (title: string) =>
      (await nodeRepo.create({ userId: uid, title, capturedAt: new Date() })).id;
    root = await mk('root');
    mid = await mk('mid');
    leaf = await mk('leaf');
    loose1 = await mk('loose1');
    loose2 = await mk('loose2');

    await triage.reparent(uid, root, null); // confirm as root
    await triage.reparent(uid, mid, root);
    await triage.reparent(uid, leaf, mid);
    await fieldValueRepo.upsert(uid, leaf, 'memo', { column: 'textValue', value: 'kept' });
  });

  afterAll(async () => {
    const { eq } = await import('drizzle-orm');
    await db.delete(schema.user).where(eq(schema.user.id, uid)); // cascades nodes + values
  });

  it('the recursive CTE sees the whole chain', async () => {
    expect((await nodeRepo.subtreeIds(uid, root)).sort()).toEqual([root, mid, leaf].sort());
  });

  it('rejects the deep cycle in real SQL: root under its grandchild', async () => {
    await expect(triage.reparent(uid, root, leaf)).rejects.toBeInstanceOf(errors.CycleError);
  });

  it('confirmed root left the inbox; loose nodes remain', async () => {
    const inboxIds = (await nodeRepo.findInbox(uid)).map((n) => n.id);
    expect(inboxIds).not.toContain(root);
    expect(inboxIds).toEqual(expect.arrayContaining([loose1, loose2]));
    expect((await nodeRepo.findRoots(uid)).map((n) => n.id)).toContain(root);
  });

  it('subtree carries on move and field values persist', async () => {
    const newHome = await triage.group(uid, [loose1]); // fresh parent to move under
    await triage.reparent(uid, mid, newHome.id);

    const children = await nodeRepo.findChildren(uid, mid);
    expect(children.map((n) => n.id)).toContain(leaf); // leaf rode along
    const values = await fieldValueRepo.readByNode(uid, leaf);
    expect(values.find((v) => v.key === 'memo')?.textValue).toBe('kept'); // values kept
    await triage.reparent(uid, mid, root); // restore
  });

  it('detachToInbox: parent cleared, node reappears in findInbox, subtree intact', async () => {
    await triage.detachToInbox(uid, mid);
    expect((await nodeRepo.findInbox(uid)).map((n) => n.id)).toContain(mid);
    expect((await nodeRepo.findChildren(uid, mid)).map((n) => n.id)).toContain(leaf);
    await triage.reparent(uid, mid, root); // restore
  });

  it('insertLayer(inherit) snapshots; a later edit to the original schema does not propagate', async () => {
    await nodeRepo.update(uid, root, {
      childSchema: [{ key: 'orig', label: 'Orig', type: 'text' }],
    });
    const layer = await triage.createLayerAbove(uid, { childId: mid, mode: 'inherit' });

    expect(layer.childSchema).toEqual([{ key: 'orig', label: 'Orig', type: 'text' }]);
    expect((await nodeRepo.byId(uid, mid))?.parentId).toBe(layer.id);
    expect((await nodeRepo.byId(uid, layer.id))?.parentId).toBe(root);

    // edit the original AFTER insertion — the snapshot must not change
    await nodeRepo.update(uid, root, {
      childSchema: [{ key: 'edited', label: 'Edited', type: 'text' }],
    });
    expect((await nodeRepo.byId(uid, layer.id))?.childSchema).toEqual([
      { key: 'orig', label: 'Orig', type: 'text' },
    ]);
  });

  it('group bundles into a fresh undetermined node (stays in inbox)', async () => {
    const g = await triage.group(uid, [loose1, loose2], 'bundle');
    expect((await nodeRepo.findChildren(uid, g.id)).map((n) => n.id).sort()).toEqual(
      [loose1, loose2].sort()
    );
    expect((await nodeRepo.findInbox(uid)).map((n) => n.id)).toContain(g.id);
  });

  it('reparent candidates exclude the node’s own subtree', async () => {
    const candidates = await triage.getReparentCandidates(uid, root);
    const ids = candidates.map((c) => c.id);
    expect(ids).not.toContain(root);
    expect(ids).not.toContain(mid);
    expect(ids).not.toContain(leaf);
  });
});
