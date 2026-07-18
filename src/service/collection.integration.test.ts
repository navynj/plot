import 'dotenv/config';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/** Curation against the real Neon dev branch: cross-user edge isolation, the
 *  never-inherits/never-moves pin, multi-collection membership, and link-field
 *  scope enforcement. Skipped (loudly) without DATABASE_URL. */

const hasDb = Boolean(process.env.DATABASE_URL);
if (!hasDb) {
  console.warn('collection integration tests SKIPPED: DATABASE_URL is not set');
}

describe.skipIf(!hasDb)('collection integration (real DB)', () => {
  let db: typeof import('@/db').db;
  let schema: typeof import('@/db/schema');
  let nodeRepo: typeof import('@/repository/nodeRepo').nodeRepo;
  let linkRepo: typeof import('@/repository/linkRepo').linkRepo;
  let collection: typeof import('@/service/collection');
  let inheritance: typeof import('@/service/inheritance');
  let field: typeof import('@/service/field');
  let errors: typeof import('@/service/errors');

  let uidA: string;
  let uidB: string;
  let cats: string, food: string, expense: string, coffee: string;
  let movies: string, augustLog: string, favorites: string;
  let bNode: string;

  beforeAll(async () => {
    ({ db } = await import('@/db'));
    schema = await import('@/db/schema');
    ({ nodeRepo } = await import('@/repository/nodeRepo'));
    ({ linkRepo } = await import('@/repository/linkRepo'));
    collection = await import('@/service/collection');
    inheritance = await import('@/service/inheritance');
    field = await import('@/service/field');
    errors = await import('@/service/errors');

    const run = Math.random().toString(36).slice(2, 10);
    const users = await db
      .insert(schema.user)
      .values([{ email: `col-${run}-a@test.local` }, { email: `col-${run}-b@test.local` }])
      .returning({ id: schema.user.id });
    uidA = users[0]!.id;
    uidB = users[1]!.id;

    const mk = async (uid: string, title: string) =>
      (await nodeRepo.create({ userId: uid, title, capturedAt: new Date() })).id;

    cats = await mk(uidA, 'Budget categories');
    food = await mk(uidA, '식비');
    expense = await mk(uidA, 'Expense');
    coffee = await mk(uidA, 'Coffee');
    movies = await mk(uidA, 'movies');
    augustLog = await mk(uidA, 'August timeline');
    favorites = await mk(uidA, 'all-time favorites');
    bNode = await mk(uidB, 'B private');

    const triage = await import('@/service/triage');
    await triage.reparent(uidA, food, cats);
    await triage.reparent(uidA, coffee, expense);
    await nodeRepo.update(uidA, expense, {
      childSchema: [
        { key: 'amount', label: 'Amount', type: 'number' },
        { key: 'category', label: 'Category', type: 'link', linkTargetParentId: cats },
      ],
    });
    // the collection imposes its OWN childSchema — it must never leak via links
    await nodeRepo.update(uidA, movies, {
      childSchema: [{ key: 'rating', label: 'Rating', type: 'number' }],
    });
  });

  afterAll(async () => {
    const { inArray } = await import('drizzle-orm');
    await db.delete(schema.user).where(inArray(schema.user.id, [uidA, uidB]));
  });

  it('linking NEVER inherits and NEVER moves: schema, parent, and rank are unchanged', async () => {
    const before = await nodeRepo.byId(uidA, coffee);
    await collection.addToCollection(uidA, movies, coffee);

    const after = await nodeRepo.byId(uidA, coffee);
    expect(after?.parentId).toBe(before?.parentId); // still under Expense
    expect(after?.rank).toBe(before?.rank);
    const worn = await inheritance.resolveSchema(uidA, after!);
    expect(worn.map((d) => d.key)).toEqual(['amount', 'category']); // tree parent's
    expect(worn.some((d) => d.key === 'rating')).toBe(false); // not the collection's
  });

  it('one node sits in multiple collections at once (DESIGN §2)', async () => {
    await collection.addToCollection(uidA, augustLog, coffee);
    await collection.addToCollection(uidA, favorites, coffee);

    const memberships = (await collection.getMemberships(uidA, coffee)).map((n) => n.title);
    expect(memberships).toEqual(
      expect.arrayContaining(['movies', 'August timeline', 'all-time favorites'])
    );
    expect((await collection.getMembers(uidA, movies)).map((n) => n.id)).toContain(coffee);
  });

  it('ownership isolation across the edge: neither direction may cross users', async () => {
    await expect(collection.addToCollection(uidA, movies, bNode)).rejects.toBeInstanceOf(
      errors.NodeNotFoundError
    ); // A cannot pull B's node in
    await expect(collection.addToCollection(uidB, bNode, coffee)).rejects.toBeInstanceOf(
      errors.NodeNotFoundError
    ); // B cannot collect A's node
    expect(await linkRepo.create(uidA, movies, bNode, 'm')).toBeNull(); // repo layer too
    expect((await collection.getMembers(uidB, bNode)).length).toBe(0);
  });

  it('removeFromCollection deletes only the edge', async () => {
    await collection.removeFromCollection(uidA, favorites, coffee);
    const memberships = (await collection.getMemberships(uidA, coffee)).map((n) => n.title);
    expect(memberships).not.toContain('all-time favorites');
    expect((await nodeRepo.byId(uidA, coffee))?.parentId).not.toBeNull(); // node untouched
  });

  it('linkTargetParentId end to end: in-scope accepted, out-of-scope typed-rejected', async () => {
    await field.saveOwnValues(uidA, coffee, { amount: '4500', category: food });
    const values = await field.getOwnValues(uidA, coffee);
    expect(values.category).toBe(food);

    await expect(field.saveOwnValues(uidA, coffee, { category: movies })).rejects.toBeInstanceOf(
      errors.LinkTargetOutOfScopeError
    );
  });

  it('link-field candidates are scoped to the declared parent’s children', async () => {
    const candidates = await field.getLinkCandidates(uidA, { linkTargetParentId: cats });
    expect(candidates.map((c) => c.id)).toEqual([food]);
  });
});
