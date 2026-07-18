import '@/components/view/layouts';

import type { ResolvedView } from '@/service/view';

import { getLayout } from './registry';

/** The NodeView section of the adaptive node detail (DESIGN §6): renders iff
 *  the node has a viewSpec — driven by what the node holds, never by a node
 *  "type". Dispatch is the layout registry, not a switch. */
export function NodeView({ view }: { view: ResolvedView }) {
  return <>{getLayout(view.spec.layout)({ view })}</>;
}
