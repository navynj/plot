import { requireUserId } from '@/app/_auth/requireUser';
import { CaptureForm } from '@/components/capture/CaptureForm';
import { NodeList } from '@/components/node/NodeList';
import { ScrollAnchor } from '@/components/ui/scroll-anchor';
import { getTimeline } from '@/service/node';

export const dynamic = 'force-dynamic';

/** Chat-style record river: oldest → newest top → bottom, so a fresh capture
 *  lands directly above the input. Short content fills from the top; overflow
 *  anchors to the newest (see ScrollAnchor). */
export default async function TimelinePage() {
  const userId = await requireUserId();
  const nodes = await getTimeline(userId);
  return (
    <>
      <ScrollAnchor className="min-h-0 flex-1 py-4">
        <h1 className="text-muted-foreground mb-2 text-xs font-medium tracking-wider uppercase">
          Timeline
        </h1>
        <NodeList nodes={nodes} emptyMessage="Nothing captured yet." />
      </ScrollAnchor>
      <div className="border-border -mx-4 border-t px-4 py-3">
        <CaptureForm />
      </div>
    </>
  );
}
