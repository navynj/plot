import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Node } from '@/db/schema';
import { nodeRepo } from '@/repository/nodeRepo';

import { EmptyCaptureError, InvalidViewSpecError } from './errors';
import { addSchemaOption, captureNode, setViewSpec } from './node';

vi.mock('@/repository/nodeRepo', () => ({
  nodeRepo: { create: vi.fn(), update: vi.fn(), byId: vi.fn() },
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
      icon: null,
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

  it('B1 two-field capture: title + body + icon map directly, no first-line split', async () => {
    await captureNode('u1', { title: 'Rio Funk', body: 'line one\nline two', icon: '🎸' });
    expect(vi.mocked(nodeRepo.create).mock.calls[0]![0]).toMatchObject({
      title: 'Rio Funk',
      body: 'line one\nline two', // multi-line body preserved verbatim
      icon: '🎸',
      origin: 'captured',
    });
  });

  it('rejects an empty capture with a typed domain error', async () => {
    await expect(captureNode('u1', { body: '   ' })).rejects.toBeInstanceOf(EmptyCaptureError);
    expect(nodeRepo.create).not.toHaveBeenCalled();
  });
});

describe('addSchemaOption — B1 option create-in-place (validated append)', () => {
  const owner = {
    id: 'p',
    childSchema: [
      { key: 'store', label: 'Store', type: 'option', options: ['Costco'] },
      { key: 'amount', label: 'Amount', type: 'number' },
    ],
  } as unknown as Node;

  beforeEach(() => {
    vi.mocked(nodeRepo.byId).mockReset().mockResolvedValue(owner);
    vi.mocked(nodeRepo.update)
      .mockReset()
      .mockResolvedValue({ id: 'p' } as Node);
  });

  it('appends a new choice to the option field through setChildSchema', async () => {
    const options = await addSchemaOption('u1', 'p', 'store', 'Homeplus');
    expect(options).toEqual(['Costco', 'Homeplus']);
    // persisted via the validated setChildSchema (nodeRepo.update)
    const patch = vi.mocked(nodeRepo.update).mock.calls[0]![2];
    const storeDef = (patch.childSchema as { key: string; options?: string[] }[]).find(
      (d) => d.key === 'store'
    );
    expect(storeDef?.options).toEqual(['Costco', 'Homeplus']);
  });

  it('an existing choice is a no-op (no duplicate)', async () => {
    const options = await addSchemaOption('u1', 'p', 'store', 'Costco');
    expect(options).toEqual(['Costco']);
  });
});

describe('setViewSpec — the A′ view editor save path (bounded, typed rejection)', () => {
  beforeEach(() => {
    vi.mocked(nodeRepo.update)
      .mockReset()
      .mockResolvedValue({ id: 'n1' } as Node);
  });

  it('accepts a valid bounded spec (lens + layout, optional groupBy/filter/overlay)', async () => {
    await setViewSpec('u1', 'n1', {
      lens: 'amount',
      groupBy: 'category',
      layout: 'bar',
      filter: [{ key: 'scheduled', op: 'eq', value: false }],
      overlayOwnField: 'amount',
    });
    expect(nodeRepo.update).toHaveBeenCalledTimes(1);
    const patch = vi.mocked(nodeRepo.update).mock.calls[0]![2];
    expect(patch.viewSpec).toMatchObject({ lens: 'amount', layout: 'bar', groupBy: 'category' });
  });

  it('null removes the view', async () => {
    await setViewSpec('u1', 'n1', null);
    expect(vi.mocked(nodeRepo.update).mock.calls[0]![2].viewSpec).toBeNull();
  });

  it('rejects an invalid spec with the typed error, before any write (inline-error backstop)', async () => {
    await expect(setViewSpec('u1', 'n1', { lens: '', layout: 'bar' })).rejects.toBeInstanceOf(
      InvalidViewSpecError
    );
    await expect(
      setViewSpec('u1', 'n1', { lens: 'x', layout: 'pie' })
    ).rejects.toBeInstanceOf(InvalidViewSpecError);
    expect(nodeRepo.update).not.toHaveBeenCalled();
  });
});
