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

describe('number parse — arithmetic expressions (stored as the result)', () => {
  it('evaluates an expression and stores only the result', () => {
    expect(parse(free, '3+4')).toBe(7);
    expect(parse(free, '1200*3')).toBe(3600);
    expect(parse(free, '(2+3)*4')).toBe(20);
    expect(parse(free, '1.5+2.5')).toBe(4);
    expect(parse(free, '-3+5')).toBe(2);
  });

  it('plain numbers, commas, and empty still behave', () => {
    expect(parse(free, '42')).toBe(42);
    expect(parse(free, '1,200')).toBe(1200);
    expect(parse(free, '')).toBeNull();
    expect(parse(free, '   ')).toBeNull(); // whitespace-only clears, not 0
    expect(parse(free, 90)).toBe(90); // a numeric value passes through
  });

  it('an invalid expression throws the typed field error', () => {
    expect(() => parse(free, '1+')).toThrow(FieldTypeMismatchError);
    expect(() => parse(free, 'abc')).toThrow(FieldTypeMismatchError);
    expect(() => parse(free, '(2+3')).toThrow(FieldTypeMismatchError);
    expect(() => parse(free, '1/0')).toThrow(FieldTypeMismatchError);
  });

  it('constraints apply to the EVALUATED value', () => {
    // scale is -5..5 step 1; 2*3=6 is out of range, 1+1=2 is in range/on step
    expect(() => parse(scale, '2*3')).toThrow(FieldTypeMismatchError);
    expect(parse(scale, '1+1')).toBe(2);
    expect(() => parse(scale, '1.5+0')).toThrow(FieldTypeMismatchError); // off-step
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

describe('show-on-main + compute schema validation (parseFieldDefs)', () => {
  beforeEach(() => {
    vi.mocked(nodeRepo.update)
      .mockReset()
      .mockResolvedValue({ id: 'N' } as Node);
  });

  it('passes through showOnMain (boolean) and icon (string)', async () => {
    await setChildSchema('u', 'N', [
      { key: 'mood', label: 'Mood', type: 'number', showOnMain: true, icon: 'Heart' },
    ]);
    const patch = vi.mocked(nodeRepo.update).mock.calls.at(-1)![2];
    expect(patch.childSchema).toEqual([
      { key: 'mood', label: 'Mood', type: 'number', showOnMain: true, icon: 'Heart' },
    ]);
  });

  it('rejects a non-boolean showOnMain', async () => {
    await expect(
      setChildSchema('u', 'N', [{ key: 'm', label: 'M', type: 'number', showOnMain: 'yes' }])
    ).rejects.toBeInstanceOf(InvalidSchemaError);
  });

  it('accepts compute referencing existing timestamp keys', async () => {
    await expect(
      setChildSchema('u', 'N', [
        { key: 'sleepAt', label: 'Sleep at', type: 'timestamp' },
        { key: 'wakeUpAt', label: 'Wake up at', type: 'timestamp' },
        { key: 'duration', label: 'Duration', type: 'computed', compute: { from: 'sleepAt', to: 'wakeUpAt' } },
      ])
    ).resolves.toBeDefined();
  });

  it('rejects compute.from that references no existing key', async () => {
    await expect(
      setChildSchema('u', 'N', [
        { key: 'duration', label: 'Duration', type: 'computed', compute: { from: 'ghost', to: 'ghost2' } },
      ])
    ).rejects.toBeInstanceOf(InvalidSchemaError);
  });
});
