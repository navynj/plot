import { describe, expect, it } from 'vitest';

import type { FieldDef } from '@/db/schema';

import { ValidationError } from './errors';
import { validateValues } from './validation';

const sleepAt: FieldDef = { key: 'sleepAt', label: 'Sleep at', type: 'timestamp' };
const wakeUpAt: FieldDef = {
  key: 'wakeUpAt',
  label: 'Wake up at',
  type: 'timestamp',
  validate: [{ op: 'gt', otherField: 'sleepAt' }],
};
const amount: FieldDef = {
  key: 'amount',
  label: 'Amount',
  type: 'number',
  validate: [{ op: 'gte', value: 0 }],
};

const t = (s: string) => new Date(s);

describe('validateValues — declarative rules, checked at save (DESIGN §5)', () => {
  it('cross-field timestamp gt: passes when after', () => {
    expect(() =>
      validateValues([sleepAt, wakeUpAt], {
        sleepAt: t('2026-07-22T23:00:00Z'),
        wakeUpAt: t('2026-07-23T07:00:00Z'),
      })
    ).not.toThrow();
  });

  it('cross-field timestamp gt: rejects when before (the inverted overnight pair)', () => {
    let thrown: unknown;
    try {
      validateValues([sleepAt, wakeUpAt], {
        sleepAt: t('2026-07-23T07:00:00Z'),
        wakeUpAt: t('2026-07-22T23:00:00Z'),
      });
    } catch (err) {
      thrown = err;
    }
    expect(thrown).toBeInstanceOf(ValidationError);
    expect((thrown as ValidationError).key).toBe('wakeUpAt');
  });

  it('cross-field timestamp gt: rejects when equal (strict)', () => {
    const same = t('2026-07-23T07:00:00Z');
    expect(() =>
      validateValues([sleepAt, wakeUpAt], { sleepAt: same, wakeUpAt: same })
    ).toThrow(ValidationError);
  });

  it('is skipped when either operand is empty (empty is always legal, §6-capture)', () => {
    expect(() =>
      validateValues([sleepAt, wakeUpAt], { wakeUpAt: t('2026-07-22T23:00:00Z') })
    ).not.toThrow();
    expect(() =>
      validateValues([sleepAt, wakeUpAt], { sleepAt: t('2026-07-23T07:00:00Z') })
    ).not.toThrow();
    expect(() => validateValues([sleepAt, wakeUpAt], {})).not.toThrow();
  });

  it('constant comparison: amount >= 0 accepts 0 and positives, rejects negatives', () => {
    expect(() => validateValues([amount], { amount: 0 })).not.toThrow();
    expect(() => validateValues([amount], { amount: 4500 })).not.toThrow();
    expect(() => validateValues([amount], { amount: -1 })).toThrow(ValidationError);
  });

  it('numeric cross-field comparison (max >= min)', () => {
    const min: FieldDef = { key: 'min', label: 'Min', type: 'number' };
    const max: FieldDef = {
      key: 'max',
      label: 'Max',
      type: 'number',
      validate: [{ op: 'gte', otherField: 'min' }],
    };
    expect(() => validateValues([min, max], { min: 3, max: 5 })).not.toThrow();
    expect(() => validateValues([min, max], { min: 5, max: 3 })).toThrow(ValidationError);
  });

  it('uses a custom message when provided, and names the offending field', () => {
    const def: FieldDef = {
      key: 'wakeUpAt',
      label: 'Wake up at',
      type: 'timestamp',
      validate: [{ op: 'gt', otherField: 'sleepAt', message: 'wake must be after sleep' }],
    };
    try {
      validateValues([sleepAt, def], {
        sleepAt: t('2026-07-23T07:00:00Z'),
        wakeUpAt: t('2026-07-22T23:00:00Z'),
      });
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(ValidationError);
      expect((err as ValidationError).message).toBe('wake must be after sleep');
      expect((err as ValidationError).key).toBe('wakeUpAt');
    }
  });
});
