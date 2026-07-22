import { describe, expect, it } from 'vitest';

import '@/service/fieldTypes';
import '@/components/field/types';

import type { FieldDef, TypedFieldWrite } from '@/db/schema';
import { getFieldType } from '@/service/fieldRegistry';

import { applyComputedWrites } from './computed';

const def: FieldDef = {
  key: 'duration',
  label: 'Duration',
  type: 'computed',
  compute: { from: 'sleepAt', to: 'wakeUpAt' },
};
const parse = (raw: unknown) => getFieldType('computed').parse(raw, def);

describe('computed field type — manual fallback parse (reuses duration)', () => {
  it('parses HH:MM, h/m words, plain minutes; empty -> null', () => {
    expect(parse('8:30')).toBe(510);
    expect(parse('8h 30m')).toBe(510);
    expect(parse('90')).toBe(90);
    expect(parse(90)).toBe(90);
    expect(parse('')).toBeNull();
    expect(parse(null)).toBeNull();
  });

  it('stores in numberValue (the aggregation column), like duration', () => {
    expect(getFieldType('computed').valueColumn).toBe('numberValue');
  });
});

describe('applyComputedWrites — the compute rule (CLAUDE.md §3)', () => {
  const worn: FieldDef[] = [
    { key: 'sleepAt', label: 'Sleep at', type: 'timestamp' },
    { key: 'wakeUpAt', label: 'Wake up at', type: 'timestamp' },
    def,
  ];
  const t = (s: string) => new Date(s);

  it('both sources present: overrides with the difference in minutes', () => {
    const writes = new Map<string, TypedFieldWrite | null>();
    applyComputedWrites(worn, {
      sleepAt: t('2026-07-22T23:00:00Z'),
      wakeUpAt: t('2026-07-23T07:30:00Z'),
    }, writes);
    expect(writes.get('duration')).toEqual({ column: 'numberValue', value: 510 });
  });

  it('overrides any manual value that phase 1 put in writes', () => {
    const writes = new Map<string, TypedFieldWrite | null>([
      ['duration', { column: 'numberValue', value: 999 }],
    ]);
    applyComputedWrites(worn, {
      sleepAt: t('2026-07-23T00:00:00Z'),
      wakeUpAt: t('2026-07-23T06:00:00Z'),
    }, writes);
    expect(writes.get('duration')).toEqual({ column: 'numberValue', value: 360 });
  });

  it('a missing source leaves the manual value untouched (honored)', () => {
    const manual = { column: 'numberValue', value: 480 } as TypedFieldWrite;
    const writes = new Map<string, TypedFieldWrite | null>([['duration', manual]]);
    applyComputedWrites(worn, { sleepAt: t('2026-07-23T00:00:00Z') }, writes);
    expect(writes.get('duration')).toBe(manual);
  });

  it('no sources present: does not write the computed key at all', () => {
    const writes = new Map<string, TypedFieldWrite | null>();
    applyComputedWrites(worn, {}, writes);
    expect(writes.has('duration')).toBe(false);
  });
});
