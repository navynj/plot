import 'dotenv/config';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/** The display-icon ladder (render-time borrowing, zero storage):
 *  own -> first-link-field target (own -> its ancestors) -> nearest tree
 *  ancestor -> null. Resolved inside the list SQL. */

const hasDb = Boolean(process.env.DATABASE_URL);
if (!hasDb) {
  console.warn('displayIcon integration tests SKIPPED: DATABASE_URL is not set');
}

describe.skipIf(!hasDb)('display icon ladder (real DB)', () => {
  let db: typeof import('@/db').db;
  let schema: typeof import('@/db/schema');
  let nodeRepo: typeof import('@/repository/nodeRepo').nodeRepo;
  let triage: typeof import('@/service/triage');
  let nodeService: typeof import('@/service/node');
  let field: typeof import('@/service/field');

  let uid: string;
  let expense: string, categories: string, food: string, plainCat: string;

  beforeAll(async () => {
    ({ db } = await import('@/db'));
    schema = await import('@/db/schema');
    ({ nodeRepo } = await import('@/repository/nodeRepo'));
    triage = await import('@/service/triage');
    nodeService = await import('@/service/node');
    field = await import('@/service/field');

    const run = Math.random().toString(36).slice(2, 10);
    const users = await db
      .insert(schema.user)
      .values([{ email: `icons-${run}@test.local` }])
      .returning({ id: schema.user.id });
    uid = users[0]!.id;

    const mk = async (title: string, icon: string | null, parentId?: string) => {
      const n = await nodeRepo.create({ userId: uid, title, icon, capturedAt: new Date() });
      if (parentId) await triage.reparent(uid, n.id, parentId);
      return n.id;
    };
    expense = await mk('Expense', '💸');
    categories = await mk('Categories', '🗂️');
    food = await mk('Food', '🍚', categories);
    plainCat = await mk('Etc', null, categories); // no icon: its OWN ladder applies
    await nodeService.setChildSchema(uid, expense, [
      { key: 'amount', label: 'Amount', type: 'number' },
      { key: 'category', label: 'Category', type: 'link', linkTargetParentId: categories },
    ]);
  });

  afterAll(async () => {
    const { eq } = await import('drizzle-orm');
    await db.delete(schema.user).where(eq(schema.user.id, uid));
  });

  const child = async (title: string, icon?: string) => {
    const n = await nodeRepo.create({ userId: uid, title, icon: icon ?? null, capturedAt: new Date() });
    await triage.reparent(uid, n.id, expense);
    return n.id;
  };
  const iconOf = async (id: string) => (await nodeRepo.byId(uid, id))?.displayIcon;

  it('link-field target beats the tree ancestor: a Food-categorized item shows 🍚, not 💸', async () => {
    const g = await child('groceries');
    await field.saveOwnValues(uid, g, { category: food });
    expect(await iconOf(g)).toBe('🍚');
  });

  it('no link value falls to the nearest ancestor: an uncategorized expense shows 💸', async () => {
    const g = await child('mystery spend');
    expect(await iconOf(g)).toBe('💸');
  });

  it('own icon always wins', async () => {
    const g = await child('croissant', '🥐');
    await field.saveOwnValues(uid, g, { category: food });
    expect(await iconOf(g)).toBe('🥐');
  });

  it('an icon-less link target resolves ITS ladder: Etc has no icon, so its parent 🗂️ shows', async () => {
    const g = await child('misc');
    await field.saveOwnValues(uid, g, { category: plainCat });
    expect(await iconOf(g)).toBe('🗂️');
  });

  it('two-level ancestor gap: leaf under no-icon mid under 🌳 grandparent resolves to 🌳', async () => {
    const grand = await nodeRepo.create({ userId: uid, title: 'Grand', icon: '🌳', capturedAt: new Date() });
    const mid = await nodeRepo.create({ userId: uid, title: 'Mid', icon: null, capturedAt: new Date() });
    await triage.reparent(uid, mid.id, grand.id);
    const leaf = await nodeRepo.create({ userId: uid, title: 'Leaf', icon: null, capturedAt: new Date() });
    await triage.reparent(uid, leaf.id, mid.id);
    expect(await iconOf(leaf.id)).toBe('🌳');
  });

  it('list queries carry the ladder too (no JS N+1): findChildren resolves every row', async () => {
    const rows = await nodeRepo.findChildren(uid, expense);
    const byTitle = new Map(rows.map((r) => [r.title, r.displayIcon]));
    expect(byTitle.get('groceries')).toBe('🍚');
    expect(byTitle.get('mystery spend')).toBe('💸');
    expect(byTitle.get('croissant')).toBe('🥐');
  });
});
