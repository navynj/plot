import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { FieldDef, Node } from '@/db/schema';
import { fieldValueRepo } from '@/repository/fieldValueRepo';
import { nodeRepo } from '@/repository/nodeRepo';

import {
  FieldTypeMismatchError,
  LinkTargetNotFoundError,
  LinkTargetOutOfScopeError,
} from './errors';
import { saveOwnValues } from './field';

vi.mock('@/repository/nodeRepo', () => ({
  nodeRepo: { byId: vi.fn() },
}));
vi.mock('@/repository/fieldValueRepo', () => ({
  fieldValueRepo: { upsert: vi.fn(), readByNode: vi.fn(), deleteByKey: vi.fn() },
}));

const defs: FieldDef[] = [
  { key: 'amount', label: 'Amount', type: 'number', required: true },
  { key: 'memo', label: 'Memo', type: 'text' },
  { key: 'category', label: 'Category', type: 'link', linkTargetParentId: 'CATS' },
];
const parent = { id: 'P', parentId: null, childSchema: defs } as Node;
const child = { id: 'C', parentId: 'P', childSchema: [] } as unknown as Node;
// 식비 is a child of CATS (in scope); STRAY is a root (out of scope)
const cats = { id: 'CATS', parentId: null, childSchema: [] } as unknown as Node;
const inScope = { id: 'FOOD', parentId: 'CATS', childSchema: [] } as unknown as Node;
const outOfScope = { id: 'STRAY', parentId: null, childSchema: [] } as unknown as Node;

describe('field.saveOwnValues', () => {
  beforeEach(() => {
    vi.mocked(nodeRepo.byId)
      .mockReset()
      .mockImplementation(
        async (_u, id) =>
          [child, parent, cats, inScope, outOfScope].find((n) => n.id === id) ?? null
      );
    vi.mocked(fieldValueRepo.upsert)
      .mockReset()
      .mockResolvedValue({ id: 'fv' } as never);
    vi.mocked(fieldValueRepo.deleteByKey).mockReset().mockResolvedValue(true);
  });

  it('routes a validated value into its typed column', async () => {
    await saveOwnValues('u1', 'C', { amount: '4500' });

    expect(fieldValueRepo.upsert).toHaveBeenCalledWith('u1', 'C', 'amount', {
      column: 'numberValue',
      value: 4500,
    });
  });

  it('never gates on required: an empty required field saves fine and clears the row (DESIGN §6-capture)', async () => {
    await expect(saveOwnValues('u1', 'C', { amount: '', memo: 'hi' })).resolves.toBeUndefined();

    expect(fieldValueRepo.deleteByKey).toHaveBeenCalledWith('u1', 'C', 'amount');
    expect(fieldValueRepo.upsert).toHaveBeenCalledWith('u1', 'C', 'memo', {
      column: 'textValue',
      value: 'hi',
    });
  });

  it('throws a typed domain error on a type mismatch', async () => {
    await expect(saveOwnValues('u1', 'C', { amount: 'not a number' })).rejects.toBeInstanceOf(
      FieldTypeMismatchError
    );
    expect(fieldValueRepo.upsert).not.toHaveBeenCalled();
  });

  it('rejects a link to a node the user does not own (or that does not exist)', async () => {
    await expect(
      saveOwnValues('u1', 'C', { category: 'someone-elses-node' })
    ).rejects.toBeInstanceOf(LinkTargetNotFoundError);
  });

  it('linkTargetParentId: accepts a target that is a tree child of the declared parent', async () => {
    await saveOwnValues('u1', 'C', { category: 'FOOD' });
    expect(fieldValueRepo.upsert).toHaveBeenCalledWith('u1', 'C', 'category', {
      column: 'linkValue',
      value: 'FOOD',
    });
  });

  it('linkTargetParentId: rejects an out-of-scope target with the typed error', async () => {
    await expect(saveOwnValues('u1', 'C', { category: 'STRAY' })).rejects.toBeInstanceOf(
      LinkTargetOutOfScopeError
    );
    expect(fieldValueRepo.upsert).not.toHaveBeenCalled();
  });

  it('ignores keys outside the worn schema (extra rows are a migration concern, not a save path)', async () => {
    await saveOwnValues('u1', 'C', { rogue: 'value' });
    expect(fieldValueRepo.upsert).not.toHaveBeenCalled();
  });
});
