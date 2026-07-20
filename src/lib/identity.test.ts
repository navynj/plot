import { describe, expect, it } from 'vitest';

import { displayName } from './identity';

describe('displayName — title first, body first-line as legacy fallback', () => {
  it('title wins outright', () => {
    expect(displayName({ title: 'Croissant (12pc)', body: 'notes' })).toBe('Croissant (12pc)');
  });
  it('legacy body-only rows show their first line', () => {
    expect(displayName({ title: null, body: 'old capture\nsecond line' })).toBe('old capture');
  });
  it('nothing at all is the (now rare) signal state', () => {
    expect(displayName({ title: null, body: null })).toBe('(untitled)');
    expect(displayName({ title: null, body: '   ' })).toBe('(untitled)');
  });
});
