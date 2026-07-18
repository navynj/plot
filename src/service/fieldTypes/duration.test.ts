import { describe, expect, it } from 'vitest';

import '@/service/fieldTypes';
import '@/components/field/types';

import type { FieldDef } from '@/db/schema';
import { formatDuration } from '@/components/field/types/duration';
import { FieldTypeMismatchError } from '@/service/errors';
import { getFieldType } from '@/service/fieldRegistry';

const def: FieldDef = { key: 'duration', label: 'Duration', type: 'duration' };
const parse = (raw: unknown) => getFieldType('duration').parse(raw, def);

describe('duration field type', () => {
  it('parses HH:MM, h/m words, and plain minutes — all to minutes', () => {
    expect(parse('8:30')).toBe(510);
    expect(parse('0:45')).toBe(45);
    expect(parse('8h 30m')).toBe(510);
    expect(parse('45m')).toBe(45);
    expect(parse('8h')).toBe(480);
    expect(parse('90')).toBe(90);
    expect(parse(90)).toBe(90);
    expect(parse('')).toBeNull();
  });

  it('stores in numberValue (the aggregation column) and rejects garbage', () => {
    expect(getFieldType('duration').valueColumn).toBe('numberValue');
    expect(() => parse('soon')).toThrow(FieldTypeMismatchError);
    expect(() => parse('8:75')).toThrow(FieldTypeMismatchError); // invalid minutes
  });

  it('renders minutes as "8h 30m"', () => {
    expect(formatDuration(510)).toBe('8h 30m');
    expect(formatDuration(480)).toBe('8h');
    expect(formatDuration(45)).toBe('45m');
  });
});
