import { describe, expect, it } from 'vitest';
import { icons } from 'lucide-react';

import {
  LUCIDE_DEFAULT_ICON,
  LUCIDE_ICON_NAMES,
  isKnownLucideIcon,
  resolveLucideIcon,
} from './lucideIcon';

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

describe('LUCIDE_ICON_NAMES — the picker search list', () => {
  it('is populated (the whole icon set) and includes the check icons', () => {
    expect(LUCIDE_ICON_NAMES.length).toBeGreaterThan(1000);
    for (const name of ['check', 'square-check', 'circle-check', 'list-todo']) {
      expect(LUCIDE_ICON_NAMES).toContain(name);
    }
  });

  it('every listed name is renderable (search never offers a name the display cannot show)', () => {
    expect(LUCIDE_ICON_NAMES.every(isKnownLucideIcon)).toBe(true);
    // a search over the list actually finds matches (regression: an empty list
    // showed nothing after typing)
    expect(LUCIDE_ICON_NAMES.filter((n) => n.includes('check')).length).toBeGreaterThan(3);
  });
});
