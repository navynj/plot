import { icons, type LucideIcon } from 'lucide-react';

/**
 * ONE place mapping a stored lucide icon name to a renderable component, used by
 * BOTH the icon picker and the display (MainFieldChips) so they never drift.
 *
 * Names are stored canonical kebab-case (`list`, `arrow-down-narrow-wide`,
 * `moon`). The `icons` named export is keyed PascalCase; segment-capitalizing a
 * kebab name is the exact inverse for every one of lucide's ~1746 canonical
 * icons, so `resolveLucideIcon` is synchronous (no lazy/Suspense) — it renders
 * the same on the server (grid) and client, and never crashes on a bad value.
 */

/** Canonical default icon (kebab-case) — kept in one place, easy to change. */
export const LUCIDE_DEFAULT_ICON = 'list';

const registry = icons as Record<string, LucideIcon>;

/** kebab-case (stored) → PascalCase (`icons` key). */
function toPascal(kebab: string): string {
  return kebab
    .split('-')
    .filter(Boolean)
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join('');
}

/** Whether a name resolves to a real lucide icon — drives the picker's list so
 *  it never offers a name the display can't render. */
export function isKnownLucideIcon(name: string | null | undefined): boolean {
  return !!name && toPascal(name) in registry;
}

/** The icon component for a stored name; unknown/empty falls back to the
 *  default, so a bad or legacy value never crashes rendering. */
export function resolveLucideIcon(name: string | null | undefined): LucideIcon {
  return (name ? registry[toPascal(name)] : undefined) ?? registry[toPascal(LUCIDE_DEFAULT_ICON)]!;
}
