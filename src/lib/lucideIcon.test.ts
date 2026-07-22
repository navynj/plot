import { describe, expect, it } from 'vitest';
import { icons } from 'lucide-react';

import { LUCIDE_DEFAULT_ICON, isKnownLucideIcon, resolveLucideIcon } from './lucideIcon';

describe('lucideIcon resolver — one place for picker + display', () => {
  it('resolves a known kebab-case name to its component', () => {
    expect(resolveLucideIcon('moon')).toBe(icons.Moon);
    expect(resolveLucideIcon('arrow-down-narrow-wide')).toBe(icons.ArrowDownNarrowWide);
    expect(resolveLucideIcon(LUCIDE_DEFAULT_ICON)).toBe(icons.List);
  });

  it('still resolves a legacy PascalCase value (single word, no hyphen)', () => {
    expect(resolveLucideIcon('Heart')).toBe(icons.Heart);
  });

  it('falls back to the default (list) for unknown / empty / null names', () => {
    expect(resolveLucideIcon('not-a-real-icon')).toBe(icons.List);
    expect(resolveLucideIcon('')).toBe(icons.List);
    expect(resolveLucideIcon(null)).toBe(icons.List);
    expect(resolveLucideIcon(undefined)).toBe(icons.List);
  });

  it('isKnownLucideIcon distinguishes real names from junk', () => {
    expect(isKnownLucideIcon('moon')).toBe(true);
    expect(isKnownLucideIcon('list')).toBe(true);
    expect(isKnownLucideIcon('not-a-real-icon')).toBe(false);
    expect(isKnownLucideIcon('')).toBe(false);
    expect(isKnownLucideIcon(null)).toBe(false);
  });
});
