import Link from 'next/link';

import type { ChildSort } from '@/service/node';
import { cn } from '@/lib/utils';

/** The Children section's date-sort toggle: two link tabs (happened / captured)
 *  that set the `csort` URL param, so sorting stays server-side and shareable.
 *  Reuses the segmented style of the stream's Day / All control. */
export function ChildSortToggle({
  sort,
  hrefFor,
}: {
  sort: ChildSort;
  hrefFor: (sort: ChildSort) => string;
}) {
  const tab = (key: ChildSort, label: string) => (
    <Link
      href={hrefFor(key)}
      className={cn(
        'px-2 py-1',
        sort === key ? 'bg-muted font-medium' : 'text-muted-foreground'
      )}
    >
      {label}
    </Link>
  );
  return (
    <div className="border-border flex overflow-hidden rounded-md border text-xs">
      {tab('happened', 'happened')}
      {tab('captured', 'captured')}
    </div>
  );
}
