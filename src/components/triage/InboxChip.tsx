'use client';

import { useDraggable } from '@dnd-kit/core';

import type { Node } from '@/db/schema';
import { cn } from '@/lib/utils';

interface InboxChipProps {
  node: Node;
  /** the full drag payload — the selected set when this chip is in it */
  dragIds: string[];
  isSelected: boolean;
  isMoving: boolean;
  onToggleSelect(): void;
}

/** An undetermined leaf. Click toggles selection (the pointer sensor's
 *  distance constraint keeps clicks from starting a drag); drag — pointer or
 *  Space/Enter keyboard — picks it up, carrying the selection for a batch. */
export function InboxChip({ node, dragIds, isSelected, isMoving, onToggleSelect }: InboxChipProps) {
  const label = node.title ?? node.body ?? '(untitled)';
  const { listeners, attributes, setNodeRef } = useDraggable({
    id: `node:${node.id}`,
    data: { ids: dragIds, label: dragIds.length > 1 ? `${dragIds.length} items` : label, depth: 0 },
  });

  return (
    <button
      type="button"
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={onToggleSelect}
      className={cn(
        'border-border focus-visible:ring-ring/60 cursor-grab touch-none rounded-full border px-3 py-1 text-sm select-none focus-visible:ring-2 focus-visible:outline-none',
        isSelected && 'border-primary ring-primary/30 ring-2',
        isMoving && 'opacity-40'
      )}
    >
      {label}
    </button>
  );
}
