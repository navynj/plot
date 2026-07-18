import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Node } from '@/db/schema';
import { nodeRepo } from '@/repository/nodeRepo';

import { EmptyCaptureError } from './errors';
import { captureNode } from './node';

vi.mock('@/repository/nodeRepo', () => ({
  nodeRepo: { create: vi.fn() },
}));
vi.mock('@/repository/linkRepo', () => ({
  linkRepo: { findTargets: vi.fn() },
}));

const created = { id: 'n1' } as Node;

describe('captureNode — raw means raw (DESIGN §6-capture)', () => {
  beforeEach(() => {
    vi.mocked(nodeRepo.create).mockReset().mockResolvedValue(created);
  });

  it('stores title/body + capturedAt only — no parent, no schema, no field values', async () => {
    await captureNode('u1', { body: '  Rio Funk 30분  ' });

    expect(nodeRepo.create).toHaveBeenCalledTimes(1);
    const input = vi.mocked(nodeRepo.create).mock.calls[0]![0];
    expect(input).toEqual({
      userId: 'u1',
      title: null,
      body: 'Rio Funk 30분',
      capturedAt: expect.any(Date),
    });
    // the inbox condition: nothing may set a parent at capture time
    expect(input).not.toHaveProperty('parentId');
    expect(input).not.toHaveProperty('childSchema');
  });

  it('rejects an empty capture with a typed domain error', async () => {
    await expect(captureNode('u1', { body: '   ' })).rejects.toBeInstanceOf(EmptyCaptureError);
    expect(nodeRepo.create).not.toHaveBeenCalled();
  });
});
