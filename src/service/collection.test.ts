import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { FieldDef, Link, Node } from '@/db/schema';
import { linkRepo } from '@/repository/linkRepo';
import { nodeRepo } from '@/repository/nodeRepo';

import { addToCollection } from './collection';
import { SelfLinkError } from './errors';
import { resolveSchema } from './inheritance';

vi.mock('@/repository/linkRepo', () => ({
  linkRepo: {
    create: vi.fn(),
    remove: vi.fn(),
    findTargets: vi.fn(),
    findSources: vi.fn(),
    findEdges: vi.fn(),
  },
}));
vi.mock('@/repository/nodeRepo', () => ({
  nodeRepo: {
    byId: vi.fn(),
    setParent: vi.fn(),
    update: vi.fn(),
    findTimeline: vi.fn(),
    findChildren: vi.fn(),
  },
}));

const treeSchema: FieldDef[] = [{ key: 'bpm', label: 'BPM', type: 'number' }];
const collectionSchema: FieldDef[] = [{ key: 'rating', label: 'Rating', type: 'number' }];

// treeParent ── member ; favorites is a collection with its OWN childSchema
const treeParent = { id: 'TP', parentId: null, rank: 'm', childSchema: treeSchema } as Node;
const member = { id: 'M', parentId: 'TP', rank: 'm', childSchema: [] } as unknown as Node;
const favorites = {
  id: 'FAV',
  parentId: null,
  rank: 't',
  childSchema: collectionSchema,
} as Node;

beforeEach(() => {
  vi.mocked(nodeRepo.byId)
    .mockReset()
    .mockImplementation(
      async (_u, id) => [treeParent, member, favorites].find((n) => n.id === id) ?? null
    );
  vi.mocked(linkRepo.findEdges).mockReset().mockResolvedValue([]);
  vi.mocked(linkRepo.create)
    .mockReset()
    .mockImplementation(async (_u, sourceId, targetId, rank) => {
      return { sourceId, targetId, rank, createdAt: new Date() } as Link;
    });
  vi.mocked(nodeRepo.setParent).mockReset();
  vi.mocked(nodeRepo.update).mockReset();
});

describe('collection.addToCollection', () => {
  it('rejects a self-link with a typed domain error', async () => {
    await expect(addToCollection('u', 'FAV', 'FAV')).rejects.toBeInstanceOf(SelfLinkError);
    expect(linkRepo.create).not.toHaveBeenCalled();
  });

  it('appends after the last edge with a fractional rank', async () => {
    vi.mocked(linkRepo.findEdges).mockResolvedValue([
      { sourceId: 'FAV', targetId: 'X', rank: 'm', createdAt: new Date() } as Link,
    ]);
    await addToCollection('u', 'FAV', 'M');
    const rank = vi.mocked(linkRepo.create).mock.calls[0]![3]!;
    expect(rank > 'm').toBe(true);
  });

  it('NEVER inherits, NEVER touches position: linking into a collection with a non-empty childSchema changes nothing about the member', async () => {
    await addToCollection('u', 'FAV', 'M');

    // position untouched: no tree writes of any kind
    expect(nodeRepo.setParent).not.toHaveBeenCalled();
    expect(nodeRepo.update).not.toHaveBeenCalled();

    // the member still wears its TREE parent's schema — not the collection's
    const worn = await resolveSchema('u', member);
    expect(worn).toEqual(treeSchema);
    expect(worn).not.toEqual(collectionSchema);
    expect(nodeRepo.byId).toHaveBeenCalledWith('u', 'TP'); // resolution reads the tree parent…
    expect(nodeRepo.byId).not.toHaveBeenCalledWith('u', 'FAV'); // …never the graph parent
  });
});
