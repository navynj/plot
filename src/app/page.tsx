import { CaptureForm } from '@/components/capture/CaptureForm';
import { NodeList } from '@/components/node/NodeList';
import { getCurrentUserId } from '@/lib/currentUser';
import { getTimeline } from '@/service/node';

export const dynamic = 'force-dynamic';

export default async function TimelinePage() {
  const nodes = await getTimeline(getCurrentUserId());
  return (
    <div className="flex flex-col gap-6">
      <CaptureForm />
      <section>
        <h1 className="mb-2 text-xs font-medium uppercase tracking-wider text-neutral-500">
          Timeline
        </h1>
        <NodeList nodes={nodes} emptyMessage="Nothing captured yet." />
      </section>
    </div>
  );
}
