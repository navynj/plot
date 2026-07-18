import { describe, expect, it } from 'vitest';

import '@/components/view/layouts';

import { VIEW_LAYOUTS } from '@/db/schema';

import { getLayout } from './registry';

describe('layout registry completeness — every preset has a renderer', () => {
  it.each(VIEW_LAYOUTS)('"%s" is registered', (layout) => {
    expect(typeof getLayout(layout)).toBe('function');
  });
});
