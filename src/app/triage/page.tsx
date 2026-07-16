import { requireUserId } from '@/app/_auth/requireUser';
import { TriageBoard } from '@/components/triage/TriageBoard';
import { getTimeline } from '@/service/node';

export const dynamic = 'force-dynamic';

export default async function TriagePage() {
  const userId = await requireUserId();
  const nodes = await getTimeline(userId); // all nodes; the board derives tree + inbox
  return <TriageBoard nodes={nodes} />;
}
