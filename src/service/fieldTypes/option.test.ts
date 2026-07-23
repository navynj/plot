import { describe, expect, it } from 'vitest';

import '@/service/fieldTypes';

import type { FieldDef } from '@/db/schema';
import { FieldTypeMismatchError } from '@/service/errors';
import { getFieldType } from '@/service/fieldRegistry';

const parse = (def: FieldDef, raw: unknown) => getFieldType('option').parse(raw, def);

const single: FieldDef = { key: 'inOut', label: 'In/Out', type: 'option', options: ['expense', 'income'] };
const multi: FieldDef = { key: 'tags', label: 'Tags', type: 'option', multiple: true, options: ['a', 'b', 'c'] };

describe('option field — single (unchanged)', () => {
  it('accepts a value in options; rejects out-of-list; empty → null', () => {
    expect(parse(single, 'expense')).toBe('expense');
    expect(() => parse(single, 'nope')).toThrow(FieldTypeMismatchError);
    expect(parse(single, '')).toBeNull();
    expect(parse(single, null)).toBeNull();
  });
});

describe('option field — multiple (multi-select)', () => {
  it('accepts a valid set (array or comma-joined string), stores comma-joined', () => {
    expect(parse(multi, ['a', 'b'])).toBe('a,b');
    expect(parse(multi, 'a,c')).toBe('a,c');
    expect(parse(multi, ' a , b ')).toBe('a,b'); // trims
  });

  it('dedupes repeated choices, preserving order', () => {
    expect(parse(multi, 'a,a,b,a')).toBe('a,b');
    expect(parse(multi, ['b', 'b', 'a'])).toBe('b,a');
  });

  it('rejects a set containing a value not in options', () => {
    expect(() => parse(multi, 'a,zzz')).toThrow(FieldTypeMismatchError);
    expect(() => parse(multi, ['a', 'zzz'])).toThrow(FieldTypeMismatchError);
  });

  it('empty → null', () => {
    expect(parse(multi, '')).toBeNull();
    expect(parse(multi, [])).toBeNull();
    expect(parse(multi, ',, ,')).toBeNull();
  });

  it('round-trips: the stored comma-joined textValue re-parses to the same set', () => {
    const stored = parse(multi, ['a', 'c']) as string;
    expect(stored).toBe('a,c');
    expect(stored.split(',')).toEqual(['a', 'c']);
    // extract returns textValue verbatim, so re-parsing it is stable
    expect(parse(multi, stored)).toBe('a,c');
  });

  it('stores in textValue (the tag convention), same column as single', () => {
    expect(getFieldType('option').valueColumn).toBe('textValue');
  });
});
