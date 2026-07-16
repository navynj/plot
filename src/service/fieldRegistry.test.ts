import { describe, expect, it } from 'vitest';

import '@/service/fieldTypes';
import '@/components/field/types';

import { FIELD_TYPES } from '@/db/schema';
import { getFieldUI } from '@/components/field/registry';

import { getFieldType } from './fieldRegistry';

describe('field registry completeness — both facets cover FIELD_TYPES', () => {
  it.each(FIELD_TYPES)('"%s" has a domain entry (valueColumn + parse)', (type) => {
    const entry = getFieldType(type);
    expect(entry.valueColumn).toBeDefined();
    expect(typeof entry.parse).toBe('function');
  });

  it.each(FIELD_TYPES)('"%s" has a UI entry (render + edit)', (type) => {
    const entry = getFieldUI(type);
    expect(typeof entry.render).toBe('function');
    expect(typeof entry.edit).toBe('function');
  });
});
