'use client';

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
  onGripPointerDown(e: React.PointerEvent): void;
  onKeyDown(e: React.KeyboardEvent): void;
  onInsertLayer(mode: 'inherit' | 'new'): void;
  onDetach(): void;
}

/** One tree row: grip (drag), chevron (accordion), title, row menu. The grip
 *  is a deliberate small target (DESIGN §6) so scrolling never mis-grabs. */
export function TriageRow(props: TriageRowProps) {
  const { node, depth, hasChildren, isExpanded, isMoving } = props;
  return (
    <div
      tabIndex={0}
      onKeyDown={props.onKeyDown}
      className={cn(
        'group flex items-center gap-1 rounded-md py-1 pr-1 outline-none',
        'focus-visible:ring-ring/50 focus-visible:ring-2',
        isMoving && 'opacity-40'
      )}
      style={{ paddingLeft: depth * INDENT_PX }}
    >
      <span
        onPointerDown={props.onGripPointerDown}
        className="text-muted-foreground/60 hover:text-foreground cursor-grab touch-none"
        aria-label="drag handle"
      >
        <GripVertical className="size-4" />
      </span>
      <button
        type="button"
        onClick={props.onToggle}
        className={cn('text-muted-foreground', !hasChildren && 'invisible')}
        aria-label={isExpanded ? 'collapse' : 'expand'}
      >
        <ChevronRight className={cn('size-4 transition-transform', isExpanded && 'rotate-90')} />
      </button>
      <Link href={`/node/${node.id}`} className="flex-1 truncate text-sm hover:underline">
        {node.title ?? node.body}
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
