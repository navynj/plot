'use client';

import { useDraggable } from '@dnd-kit/core';

import type { Node } from '@/db/schema';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';

interface InboxChipProps {
  node: Node;
  /** the full drag payload — the selected set when this chip is in it */
  dragIds: string[];
  isSelected: boolean;
  isMoving: boolean;
  onToggleSelect(): void;
}

/** An undetermined leaf: a selection checkbox + the draggable chip. Click or
 *  checkbox toggles selection; drag — pointer or Space/Enter keyboard —
 *  picks it up, carrying the whole selection as a batch. */
export function InboxChip({ node, dragIds, isSelected, isMoving, onToggleSelect }: InboxChipProps) {
  const label = node.title ?? node.body ?? '(untitled)';
  const { listeners, attributes, setNodeRef } = useDraggable({
    id: `node:${node.id}`,
    data: { ids: dragIds, label: dragIds.length > 1 ? `${dragIds.length} items` : label, depth: 0 },
  });

  return (
    <span
      className={cn(
        'border-border flex items-center gap-1.5 rounded-full border py-1 pr-3 pl-2',
        isSelected && 'border-primary ring-primary/30 ring-2',
        isMoving && 'opacity-40'
      )}
    >
      <Checkbox
        checked={isSelected}
        onCheckedChange={onToggleSelect}
        aria-label={`select ${label}`}
      />
      <button
        type="button"
        ref={setNodeRef}
        {...listeners}
        {...attributes}
        onClick={onToggleSelect}
        className="focus-visible:ring-ring/60 cursor-grab touch-none rounded-sm text-sm select-none focus-visible:ring-2 focus-visible:outline-none"
      >
        {label}
      </button>
    </span>
  );
}
