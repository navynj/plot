'use client';

import { useDraggable } from '@dnd-kit/core';
import { ChevronRight, GripVertical, MoreHorizontal } from 'lucide-react';
import Link from 'next/link';

import type { Node } from '@/db/schema';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

const INDENT_PX = 24;

interface TriageRowProps {
  node: Node;
  depth: number;
  hasChildren: boolean;
  isExpanded: boolean;
  isMoving: boolean;
  onToggle(): void;
  onInsertLayer(mode: 'inherit' | 'new'): void;
  onDetach(): void;
}

/** One tree row. The grip is the drag activator for BOTH sensors: a real
 *  focusable button (visible ring), pointer-draggable and Space/Enter
 *  keyboard-draggable via dnd-kit. Deliberately a small target (DESIGN §6)
 *  so scrolling never mis-grabs; touch-none so touch drag beats scroll. */
export function TriageRow(props: TriageRowProps) {
  const { node, depth, hasChildren, isExpanded, isMoving } = props;
  const label = node.title ?? node.body ?? '(untitled)';
  const { listeners, attributes, setNodeRef, setActivatorNodeRef } = useDraggable({
    id: `node:${node.id}`,
    data: { ids: [node.id], label, depth },
  });

  return (
    <div
      ref={setNodeRef}
      className={cn('group flex items-center gap-1 rounded-md py-1 pr-1', isMoving && 'opacity-40')}
      style={{ paddingLeft: depth * INDENT_PX }}
    >
      <button
        type="button"
        ref={setActivatorNodeRef}
        {...listeners}
        {...attributes}
        aria-label={`move ${label}`}
        className="text-muted-foreground/60 hover:text-foreground focus-visible:ring-ring/60 cursor-grab touch-none rounded-sm p-0.5 focus-visible:ring-2 focus-visible:outline-none"
      >
        <GripVertical className="size-4" />
      </button>
      <button
        type="button"
        onClick={props.onToggle}
        className={cn(
          'text-muted-foreground focus-visible:ring-ring/60 rounded-sm focus-visible:ring-2 focus-visible:outline-none',
          !hasChildren && 'invisible'
        )}
        aria-label={isExpanded ? 'collapse' : 'expand'}
      >
        <ChevronRight className={cn('size-4 transition-transform', isExpanded && 'rotate-90')} />
      </button>
      <Link href={`/node/${node.id}`} className="flex-1 truncate text-sm hover:underline">
        {label}
      </Link>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            className="opacity-0 group-focus-within:opacity-100 group-hover:opacity-100"
          >
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => props.onInsertLayer('inherit')}>
            Insert layer above — inherit schema
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => props.onInsertLayer('new')}>
            Insert layer above — new schema
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={props.onDetach}>Detach to inbox</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export { INDENT_PX };
