import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { FieldDef, FieldValue, Node } from '@/db/schema';
import { fieldValueRepo } from '@/repository/fieldValueRepo';
import { nodeRepo } from '@/repository/nodeRepo';

import { getFieldTriageQueue } from './fieldTriage';

vi.mock('@/repository/nodeRepo', () => ({
  nodeRepo: { findTimeline: vi.fn(), byId: vi.fn() },
}));
vi.mock('@/repository/fieldValueRepo', () => ({
  fieldValueRepo: { readByNodes: vi.fn(), readByNode: vi.fn() },
}));

const schema: FieldDef[] = [
  { key: 'practiceTime', label: 'Practice', type: 'number', required: true },
  { key: 'memo', label: 'Memo', type: 'text' }, // optional
];
const rio = { id: 'RIO', parentId: null, rank: 'm', childSchema: schema } as Node;
const filledSession = { id: 'S1', parentId: 'RIO', childSchema: [] } as unknown as Node;
const rawSession = { id: 'S2', parentId: 'RIO', childSchema: [] } as unknown as Node;
const memoOnlyGap = { id: 'S3', parentId: 'RIO', childSchema: [] } as unknown as Node;
const parentless = { id: 'LOOSE', parentId: null, rank: null, childSchema: [] } as unknown as Node;

beforeEach(() => {
  vi.mocked(nodeRepo.findTimeline)
    .mockReset()
    .mockResolvedValue([rio, filledSession, rawSession, memoOnlyGap, parentless]);
  vi.mocked(fieldValueRepo.readByNodes)
    .mockReset()
    .mockResolvedValue([
      { nodeId: 'S1', key: 'practiceTime' } as FieldValue, // S1: required filled
      { nodeId: 'S3', key: 'practiceTime' } as FieldValue, // S3: required filled, memo not
    ]);
});

describe('fieldTriage queue — fully derived, required-only criterion', () => {
  it('queues exactly the nodes missing a required field; optional gaps and parentless nodes never queue; filled drops out', async () => {
    const queue = await getFieldTriageQueue('u');

    expect(queue.map((i) => i.node.id)).toEqual(['S2']); // raw session only
    expect(queue[0]!.missingRequired).toEqual(['practiceTime']);
    // S1 filled → out; S3 misses only the OPTIONAL memo → out; LOOSE has no
    // parent → wears nothing → out; RIO itself wears nothing → out.
  });

  it('is empty when nothing declares required fields', async () => {
    vi.mocked(nodeRepo.findTimeline).mockResolvedValue([parentless, rio]);
    expect(await getFieldTriageQueue('u')).toEqual([]);
    expect(fieldValueRepo.readByNodes).not.toHaveBeenCalled(); // no candidates, no read
  });
});
