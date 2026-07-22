import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { FieldDef, FieldValue, Node } from '@/db/schema';
import { fieldValueRepo } from '@/repository/fieldValueRepo';
import { nodeRepo } from '@/repository/nodeRepo';

import { getMainFieldsByNode } from './field';

vi.mock('@/repository/nodeRepo', () => ({ nodeRepo: { byId: vi.fn(), byIds: vi.fn() } }));
vi.mock('@/repository/fieldValueRepo', () => ({ fieldValueRepo: { readByNodes: vi.fn() } }));

const schema: FieldDef[] = [
  { key: 'mood', label: 'Mood', type: 'number', showOnMain: true, icon: 'Heart' },
  { key: 'category', label: 'Category', type: 'link', showOnMain: true, icon: 'Tag' },
  { key: 'memo', label: 'Memo', type: 'text' }, // not show-on-main
];
const parent = { id: 'P', childSchema: schema } as Node;

const num = (nodeId: string, key: string, n: number): FieldValue =>
  ({ id: `${nodeId}-${key}`, nodeId, key, textValue: null, numberValue: String(n), boolValue: null, dateValue: null, linkValue: null }) as FieldValue;
const link = (nodeId: string, key: string, target: string): FieldValue =>
  ({ id: `${nodeId}-${key}`, nodeId, key, textValue: null, numberValue: null, boolValue: null, dateValue: null, linkValue: target }) as FieldValue;

describe('getMainFieldsByNode — show-on-main values, batched (Task 2)', () => {
  beforeEach(() => {
    vi.mocked(nodeRepo.byId).mockReset().mockImplementation(async (_u, id) => (id === 'P' ? parent : null) as never);
    vi.mocked(nodeRepo.byIds)
      .mockReset()
      .mockResolvedValue([{ id: 'FOOD', title: '식비', body: null, displayIcon: '🍚' }] as never);
    vi.mocked(fieldValueRepo.readByNodes)
      .mockReset()
      .mockResolvedValue([num('C1', 'mood', 4), link('C1', 'category', 'FOOD'), num('C2', 'mood', 3)]);
  });

  it('returns only show-on-main fields that have a value, with their icon', async () => {
    const map = await getMainFieldsByNode('u1', [
      { id: 'C1', parentId: 'P', attached: false },
      { id: 'C2', parentId: 'P', attached: false },
    ] as Node[]);

    const c1 = map.get('C1')!;
    expect(c1.map((f) => f.key)).toEqual(['mood', 'category']); // memo excluded
    expect(c1.find((f) => f.key === 'mood')).toMatchObject({ icon: 'Heart', value: 4 });
    // a link value resolves to its target's icon+name, never a raw id
    expect(c1.find((f) => f.key === 'category')?.display).toBe('🍚 식비');

    expect(map.get('C2')!.map((f) => f.key)).toEqual(['mood']);
  });

  it('a parentless node wears no schema → absent from the map', async () => {
    const map = await getMainFieldsByNode('u1', [{ id: 'R', parentId: null, attached: false }] as Node[]);
    expect(map.has('R')).toBe(false);
  });

  it('an attached child wears no schema (the depth-1 exception) → absent', async () => {
    const map = await getMainFieldsByNode('u1', [{ id: 'A', parentId: 'P', attached: true }] as Node[]);
    expect(map.has('A')).toBe(false);
  });
});
