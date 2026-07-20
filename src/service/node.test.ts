import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Node } from '@/db/schema';
import { nodeRepo } from '@/repository/nodeRepo';

import { EmptyCaptureError } from './errors';
import { captureNode } from './node';

vi.mock('@/repository/nodeRepo', () => ({
  nodeRepo: { create: vi.fn() },
}));
vi.mock('@/repository/undoRepo', () => ({
  undoRepo: { push: vi.fn(), pop: vi.fn(), clearRedo: vi.fn(), list: vi.fn() },
}));
vi.mock('@/repository/linkRepo', () => ({
  linkRepo: { findTargets: vi.fn() },
}));

const created = { id: 'n1' } as Node;

describe('captureNode — raw means raw (DESIGN §6-capture)', () => {
  beforeEach(() => {
    vi.mocked(nodeRepo.create).mockReset().mockResolvedValue(created);
  });

  it('FIRST LINE IS THE NAME: a single-line capture becomes title, body null, origin captured', async () => {
    await captureNode('u1', { body: '  Croissant (12pc)  ' });

    expect(nodeRepo.create).toHaveBeenCalledTimes(1);
    const input = vi.mocked(nodeRepo.create).mock.calls[0]![0];
    expect(input).toEqual({
      userId: 'u1',
      title: 'Croissant (12pc)',
      body: null,
      origin: 'captured',
      capturedAt: expect.any(Date),
    });
    // the inbox condition: nothing may set a parent at capture time
    expect(input).not.toHaveProperty('parentId');
    expect(input).not.toHaveProperty('childSchema');
  });

  it('multi-line capture splits at the first newline: first line title, remainder body', async () => {
    await captureNode('u1', { body: 'Rio Funk\n30분 연습\n어려웠음' });
    expect(vi.mocked(nodeRepo.create).mock.calls[0]![0]).toMatchObject({
      title: 'Rio Funk',
      body: '30분 연습\n어려웠음',
      origin: 'captured',
    });
  });

  it('a capture whose remainder is only whitespace stays single-line shaped', async () => {
    await captureNode('u1', { body: 'just a name\n   ' });
    expect(vi.mocked(nodeRepo.create).mock.calls[0]![0]).toMatchObject({
      title: 'just a name',
      body: null,
    });
  });

  it('an explicitly titled create skips the split and can be born constructed', async () => {
    await captureNode('u1', { title: 'Groceries room', origin: 'constructed' });
    expect(vi.mocked(nodeRepo.create).mock.calls[0]![0]).toMatchObject({
      title: 'Groceries room',
      body: null,
      origin: 'constructed',
    });
  });

  it('rejects an empty capture with a typed domain error', async () => {
    await expect(captureNode('u1', { body: '   ' })).rejects.toBeInstanceOf(EmptyCaptureError);
    expect(nodeRepo.create).not.toHaveBeenCalled();
  });
});
