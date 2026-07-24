import '@/components/view/layouts';

import type { ResolvedView } from '@/service/view';

import { getLayout } from './registry';

/** The NodeView section of the adaptive node detail (DESIGN §6): renders iff
 *  the node has a viewSpec — driven by what the node holds, never by a node
 *  "type". Dispatch is the layout registry, not a switch. `tz` reaches layouts
 *  so their timestamps render on the user's wall clock. */
export function NodeView({ view, tz }: { view: ResolvedView; tz: string }) {
  return <>{getLayout(view.spec.layout)({ view, tz })}</>;
}
