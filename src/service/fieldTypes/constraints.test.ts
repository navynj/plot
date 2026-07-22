import { beforeEach, describe, expect, it, vi } from 'vitest';

import '@/service/fieldTypes';

import type { FieldDef, Node } from '@/db/schema';
import { nodeRepo } from '@/repository/nodeRepo';
import { FieldTypeMismatchError, InvalidSchemaError } from '@/service/errors';
import { getFieldType } from '@/service/fieldRegistry';
import { setChildSchema } from '@/service/node';

vi.mock('@/repository/nodeRepo', () => ({
  nodeRepo: { update: vi.fn(), create: vi.fn(), byId: vi.fn(), findChildren: vi.fn() },
}));
vi.mock('@/repository/linkRepo', () => ({ linkRepo: { findTargets: vi.fn() } }));
vi.mock('@/repository/undoRepo', () => ({
  undoRepo: { push: vi.fn(), pop: vi.fn(), clearRedo: vi.fn(), list: vi.fn() },
}));

const scale: FieldDef = { key: 'score', label: 'Score', type: 'number', min: -5, max: 5, step: 1 };
const free: FieldDef = { key: 'amount', label: 'Amount', type: 'number' };
const parse = (def: FieldDef, raw: unknown) => getFieldType('number').parse(raw, def);

describe('number constraints — service validation (UI-bypass-proof)', () => {
  it('in-range on-step values accepted, boundaries included', () => {
    expect(parse(scale, '2')).toBe(2);
    expect(parse(scale, '-5')).toBe(-5);
    expect(parse(scale, '5')).toBe(5);
    expect(parse(scale, '0')).toBe(0);
  });

  it('out-of-range rejected with the typed error', () => {
    expect(() => parse(scale, '6')).toThrow(FieldTypeMismatchError);
    expect(() => parse(scale, '-6')).toThrow(FieldTypeMismatchError);
  });

  it('off-step rejected with the typed error', () => {
    expect(() => parse(scale, '1.5')).toThrow(FieldTypeMismatchError);
  });

  it('a constraint-less number is unaffected', () => {
    expect(parse(free, '123456.789')).toBe(123456.789);
    expect(parse(free, '-1')).toBe(-1);
  });
});

describe('schema-sheet constraint validation (service layer)', () => {
  beforeEach(() => {
    vi.mocked(nodeRepo.update)
      .mockReset()
      .mockResolvedValue({ id: 'N' } as Node);
  });

  it('min > max rejected', async () => {
    await expect(
      setChildSchema('u', 'N', [{ key: 'x', label: 'X', type: 'number', min: 5, max: 1 }])
    ).rejects.toBeInstanceOf(InvalidSchemaError);
  });

  it('step ≤ 0 rejected', async () => {
    await expect(
      setChildSchema('u', 'N', [{ key: 'x', label: 'X', type: 'number', step: 0 }])
    ).rejects.toBeInstanceOf(InvalidSchemaError);
  });

  it('non-divisible range rejected; the Mood scale accepted', async () => {
    await expect(
      setChildSchema('u', 'N', [{ key: 'x', label: 'X', type: 'number', min: 0, max: 10, step: 3 }])
    ).rejects.toBeInstanceOf(InvalidSchemaError);
    await expect(setChildSchema('u', 'N', [scale])).resolves.toBeDefined();
  });
});

describe('validation-rule schema validation (parseFieldDefs, untrusted input)', () => {
  beforeEach(() => {
    vi.mocked(nodeRepo.update)
      .mockReset()
      .mockResolvedValue({ id: 'N' } as Node);
  });

  const sleepAt = { key: 'sleepAt', label: 'Sleep at', type: 'timestamp' } as const;

  it('accepts a cross-field rule that references an existing key', async () => {
    await expect(
      setChildSchema('u', 'N', [
        sleepAt,
        { key: 'wakeUpAt', label: 'Wake up at', type: 'timestamp', validate: [{ op: 'gt', otherField: 'sleepAt' }] },
      ])
    ).resolves.toBeDefined();
    const patch = vi.mocked(nodeRepo.update).mock.calls.at(-1)![2];
    const wake = (patch.childSchema as { key: string; validate?: unknown[] }[]).find(
      (d) => d.key === 'wakeUpAt'
    );
    expect(wake?.validate).toEqual([{ op: 'gt', otherField: 'sleepAt' }]);
  });

  it('accepts a constant rule (amount >= 0)', async () => {
    await expect(
      setChildSchema('u', 'N', [
        { key: 'amount', label: 'Amount', type: 'number', validate: [{ op: 'gte', value: 0 }] },
      ])
    ).resolves.toBeDefined();
  });

  it('rejects an unknown op', async () => {
    await expect(
      setChildSchema('u', 'N', [
        { key: 'a', label: 'A', type: 'number', validate: [{ op: 'between', value: 0 }] },
      ])
    ).rejects.toBeInstanceOf(InvalidSchemaError);
  });

  it('rejects both otherField and value present (needs exactly one)', async () => {
    await expect(
      setChildSchema('u', 'N', [
        sleepAt,
        {
          key: 'wakeUpAt',
          label: 'Wake up at',
          type: 'timestamp',
          validate: [{ op: 'gt', otherField: 'sleepAt', value: 3 }],
        },
      ])
    ).rejects.toBeInstanceOf(InvalidSchemaError);
  });

  it('rejects an otherField that references no existing key', async () => {
    await expect(
      setChildSchema('u', 'N', [
        { key: 'wakeUpAt', label: 'Wake up at', type: 'timestamp', validate: [{ op: 'gt', otherField: 'ghost' }] },
      ])
    ).rejects.toBeInstanceOf(InvalidSchemaError);
  });
});
