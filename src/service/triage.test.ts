import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { FieldDef, Node } from '@/db/schema';
import { fieldValueRepo } from '@/repository/fieldValueRepo';
import { nodeRepo } from '@/repository/nodeRepo';

import { CycleError } from './errors';
import { detachToInbox, group, insertLayer, reparent } from './triage';

vi.mock('@/repository/nodeRepo', () => ({
  nodeRepo: {
    byId: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    findChildren: vi.fn(),
    findRoots: vi.fn(),
    subtreeIds: vi.fn(),
    setParent: vi.fn(),
    batchReparent: vi.fn(),
    setRanks: vi.fn(),
  },
}));
vi.mock('@/repository/fieldValueRepo', () => ({
  fieldValueRepo: { upsert: vi.fn(), readByNode: vi.fn(), deleteByKey: vi.fn() },
}));
vi.mock('@/repository/linkRepo', () => ({
  linkRepo: { removeAllFor: vi.fn() },
}));

// tree: A ── B ── C (grandchild), D is a separate root, L is an inbox leaf
const schemaA: FieldDef[] = [{ key: 'x', label: 'X', type: 'text' }];
const A = { id: 'A', parentId: null, rank: 'm', childSchema: schemaA } as Node;
const B = { id: 'B', parentId: 'A', rank: 'm', childSchema: [] } as unknown as Node;
const C = { id: 'C', parentId: 'B', rank: 'm', childSchema: [] } as unknown as Node;
const D = { id: 'D', parentId: null, rank: 't', childSchema: [] } as unknown as Node;
const L = { id: 'L', parentId: null, rank: null, childSchema: [] } as unknown as Node;
const ALL = [A, B, C, D, L];

const SUBTREES: Record<string, string[]> = {
  A: ['A', 'B', 'C'],
  B: ['B', 'C'],
  C: ['C'],
  D: ['D'],
  L: ['L'],
};

beforeEach(() => {
  vi.mocked(nodeRepo.byId)
    .mockReset()
    .mockImplementation(async (_u, id) => ALL.find((n) => n.id === id) ?? null);
  vi.mocked(nodeRepo.subtreeIds)
    .mockReset()
    .mockImplementation(async (_u, id) => SUBTREES[id] ?? [id]);
  vi.mocked(nodeRepo.findChildren).mockReset().mockResolvedValue([]);
  vi.mocked(nodeRepo.findRoots).mockReset().mockResolvedValue([A, D]);
  vi.mocked(nodeRepo.setParent)
    .mockReset()
    .mockImplementation(async (_u, id) => ALL.find((n) => n.id === id) ?? null);
  vi.mocked(nodeRepo.update).mockReset().mockResolvedValue(B);
  vi.mocked(nodeRepo.create)
    .mockReset()
    .mockResolvedValue({ id: 'G', parentId: null, rank: null } as Node);
  vi.mocked(nodeRepo.batchReparent).mockReset().mockResolvedValue(undefined);
  vi.mocked(nodeRepo.setRanks).mockReset().mockResolvedValue(undefined);
});

describe('triage.reparent — cycle rejection', () => {
  it('rejects reparenting onto itself', async () => {
    await expect(reparent('u', 'A', 'A')).rejects.toBeInstanceOf(CycleError);
    expect(nodeRepo.setParent).not.toHaveBeenCalled();
  });

  it('rejects reparenting onto a direct child', async () => {
    await expect(reparent('u', 'A', 'B')).rejects.toBeInstanceOf(CycleError);
  });

  it('rejects the deep case: reparenting onto a grandchild', async () => {
    await expect(reparent('u', 'A', 'C')).rejects.toBeInstanceOf(CycleError);
    expect(nodeRepo.setParent).not.toHaveBeenCalled();
  });

  it('allows moving a node under an unrelated root', async () => {
    vi.mocked(nodeRepo.findChildren).mockResolvedValue([]);
    await reparent('u', 'B', 'D');
    expect(nodeRepo.setParent).toHaveBeenCalledWith('u', 'B', 'D', expect.any(String));
  });
});

describe('triage.reparent — subtree carries, values persist', () => {
  it('moves ONLY the node row; children stay attached beneath it (subtree carries)', async () => {
    await reparent('u', 'B', 'D');
    expect(nodeRepo.setParent).toHaveBeenCalledTimes(1);
    const [, movedId] = vi.mocked(nodeRepo.setParent).mock.calls[0]!;
    expect(movedId).toBe('B'); // C is never touched — it rides along via parentId
  });

  it('never touches field_value rows — values persist across a move', async () => {
    await reparent('u', 'B', 'D');
    expect(fieldValueRepo.deleteByKey).not.toHaveBeenCalled();
    expect(fieldValueRepo.upsert).not.toHaveBeenCalled();
  });

  it('positions among new siblings with a fractional rank', async () => {
    vi.mocked(nodeRepo.findChildren).mockResolvedValue([
      { id: 's1', rank: 'f' } as Node,
      { id: 's2', rank: 'q' } as Node,
    ]);
    await reparent('u', 'L', 'D', { position: 1 });
    const rank = vi.mocked(nodeRepo.setParent).mock.calls[0]![3]!;
    expect(rank > 'f' && rank < 'q').toBe(true);
  });

  it('null parent = confirmed root: gets a rank among roots (leaves the inbox filter)', async () => {
    await reparent('u', 'L', null, { position: 0 });
    const [, , parentId, rank] = vi.mocked(nodeRepo.setParent).mock.calls[0]!;
    expect(parentId).toBeNull();
    expect(typeof rank).toBe('string'); // positioned → not in inbox
    expect(rank! < 'm').toBe(true); // before root A
  });
});

describe('triage.insertLayer — inherit vs new', () => {
  it('inherit SNAPSHOTS the old parent’s childSchema onto the layer (a copy, not a reference)', async () => {
    await insertLayer('u', { nodeId: 'L', childId: 'B', mode: 'inherit' });

    const patch = vi.mocked(nodeRepo.update).mock.calls[0]![2];
    expect(patch.childSchema).toEqual(schemaA); // wears what A imposed
    expect(patch.childSchema).not.toBe(schemaA); // but a snapshot copy
    expect(patch.schemaMode).toBe('inherit');
    // layer takes the child's exact place; child moves under the layer
    expect(nodeRepo.setParent).toHaveBeenNthCalledWith(1, 'u', 'L', 'A', 'm');
    expect(nodeRepo.setParent).toHaveBeenNthCalledWith(2, 'u', 'B', 'L', expect.any(String));
  });

  it('new starts the layer with an empty childSchema', async () => {
    await insertLayer('u', { nodeId: 'L', childId: 'B', mode: 'new' });
    const patch = vi.mocked(nodeRepo.update).mock.calls[0]![2];
    expect(patch.childSchema).toEqual([]);
    expect(patch.schemaMode).toBe('new');
  });

  it('rejects inserting a node as a layer above its own descendant', async () => {
    await expect(
      insertLayer('u', { nodeId: 'A', childId: 'C', mode: 'inherit' })
    ).rejects.toBeInstanceOf(CycleError);
  });
});

describe('triage.detachToInbox', () => {
  it('clears parent AND rank — back to undetermined, the inbox filter', async () => {
    await detachToInbox('u', 'B');
    expect(nodeRepo.setParent).toHaveBeenCalledWith('u', 'B', null, null);
  });
});

describe('triage.group', () => {
  it('creates a group node and reparents the selection under it', async () => {
    await group('u', ['L', 'D'], 'Bundle');

    expect(nodeRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'u', title: 'Bundle' })
    );
    const [, moves, parentId] = vi.mocked(nodeRepo.batchReparent).mock.calls[0]!;
    expect(parentId).toBe('G');
    expect(moves.map((m) => m.id)).toEqual(['L', 'D']);
    const ranks = moves.map((m) => m.rank!);
    expect([...ranks].sort()).toEqual(ranks); // ordered ranks
  });
});
