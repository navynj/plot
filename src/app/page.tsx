import { requireUserId } from '@/app/_auth/requireUser';
import { CaptureForm } from '@/components/capture/CaptureForm';
import { NodeList } from '@/components/node/NodeList';
import { getTimeline } from '@/service/node';

export const dynamic = 'force-dynamic';

export default async function TimelinePage() {
  const userId = await requireUserId();
  const nodes = await getTimeline(userId);
  return (
    <div className="flex flex-1 flex-col">
      <section className="flex-1 pb-6">
        <h1 className="mb-2 text-xs font-medium uppercase tracking-wider text-neutral-500">
          Timeline
        </h1>
        <NodeList nodes={nodes} emptyMessage="Nothing captured yet." />
      </section>
      {/* messenger-style: pinned to the bottom of the screen while the timeline scrolls */}
      <div className="sticky bottom-0 -mx-4 mt-auto border-t border-neutral-200 bg-background px-4 py-3 dark:border-neutral-800">
        <CaptureForm />
      </div>
    </div>
  );
}
