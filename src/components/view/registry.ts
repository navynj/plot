import type { ReactNode } from 'react';

import type { ViewLayout } from '@/db/schema';
import type { ResolvedView } from '@/service/view';

/**
 * Layout registry (CLAUDE.md §2): layout preset → renderer. Renderers are
 * dumb — resolved data + spec in, markup out; every viewSpec rule lives in
 * service/view. Adding a layout is one `registerLayout` call in its own file
 * under `components/view/layouts/` — never a `switch`. Completeness over
 * VIEW_LAYOUTS is pinned by a test.
 */
/** `tz`: the user's IANA zone, so a layout renders timestamps on the user's
 *  wall clock (server-resolved, like the day helpers). */
export type LayoutRenderer = (props: { view: ResolvedView; tz: string }) => ReactNode;

const registry = new Map<ViewLayout, LayoutRenderer>();

export function registerLayout(layout: ViewLayout, renderer: LayoutRenderer): void {
  registry.set(layout, renderer);
}

export function getLayout(layout: ViewLayout): LayoutRenderer {
  const renderer = registry.get(layout);
  if (!renderer) {
    throw new Error(`layout not registered: ${layout}`);
  }
  return renderer;
}
