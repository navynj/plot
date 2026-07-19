'use client';

import * as React from 'react';

import { setTimelineVisibility } from '@/app/node/[id]/actions';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const LABELS: Record<'auto' | 'shown' | 'hidden', string> = {
  auto: 'auto',
  shown: 'always',
  hidden: 'never',
};

/** "Show in timeline: auto / always / never." Only the timeline reads this;
 *  auto derives (structural nodes hide). */
export function TimelineVisibilityControl({
  nodeId,
  value,
}: {
  nodeId: string;
  value: 'auto' | 'shown' | 'hidden';
}) {
  const [current, setCurrent] = React.useState(value);
  return (
    <span className="text-muted-foreground flex items-center gap-2 text-xs">
      Show in timeline:
      <Select
        value={current}
        onValueChange={(v) => {
          const next = v as 'auto' | 'shown' | 'hidden';
          setCurrent(next);
          void setTimelineVisibility(nodeId, next);
        }}
      >
        <SelectTrigger size="sm" className="h-7 w-24 text-xs">
          <SelectValue>{LABELS[current]}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="auto">auto</SelectItem>
          <SelectItem value="shown">always</SelectItem>
          <SelectItem value="hidden">never</SelectItem>
        </SelectContent>
      </Select>
    </span>
  );
}
