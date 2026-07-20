'use client';

import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragMoveEvent,
  type DragStartEvent,
  type KeyboardCoordinateGetter,
} from '@dnd-kit/core';
import { GripVertical } from 'lucide-react';
import * as React from 'react';

import type { Node } from '@/db/schema';
import { detachNodes, groupNodes, layerAbove, moveNodes } from '@/app/triage/actions';
import { ParentPicker } from '@/components/node/ParentPicker';
import { Button } from '@/components/ui/button';
import { SubmitButton } from '@/components/ui/submit-button';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';

import { InboxChip } from './InboxChip';
import {
  childrenMap,
  depthFromX,
  flattenTree,
  gapFromPoint,
  inboxOf,
  resolveGap,
} from './treeModel';
import { INDENT_PX, TriageRow } from './TriageRow';
import { useTriageMove } from './useTriageMove';

/** Position triage (DESIGN §6): tree on top, inbox leaves below. One headless
 *  action model (useTriageMove); dnd-kit's pointer and keyboard sensors are
 *  thin adapters feeding the same gap+depth grammar. Every commit goes
 *  through the triage service via server actions. */

const rowEls = () =>
  Array.from(document.querySelectorAll<HTMLElement>('[data-triage-tree] [data-row-index]'));
const measureRows = () => rowEls().map((el) => el.getBoundingClientRect());
const zoneRect = (zone: 'root' | 'inbox') =>
  document.querySelector(`[data-triage-zone="${zone}"]`)?.getBoundingClientRect() ?? null;
const treeRect = () =>
  document.querySelector('[data-triage-tree]')?.getBoundingClientRect() ?? null;

/** Keyboard grammar over the same coordinate space the pointer uses:
 *  ↑/↓ snap the dragged rect's center to the previous/next gap boundary,
 *  continuing past the ends into the root and inbox zones; ←/→ step exactly
 *  one indent. The target row is scrolled into view BEFORE measuring — a
 *  logical gap on a scrolled-out row otherwise lands physically inside
 *  another zone and the walk goes nowhere. */
const triageCoordinates: KeyboardCoordinateGetter = (event, { currentCoordinates, context }) => {
  const height = context.collisionRect?.height ?? 32;
  const centerOf = (y: number) => ({ x: currentCoordinates.x, y: y - height / 2 });
  const root = zoneRect('root');
  const inbox = zoneRect('inbox');
  const tree = treeRect();
  const centerY = currentCoordinates.y + height / 2;
  const inInbox = inbox !== null && centerY >= inbox.top && !(tree && centerY <= tree.bottom);
  const inRoot = root !== null && centerY <= root.bottom;

  /** scroll the gap's anchor row into view, then measure the boundary */
  const gapY = (gap: number): number => {
    const els = rowEls();
    if (els.length === 0) return tree ? tree.top + 16 : 0;
    const el = els[Math.min(gap, els.length - 1)]!;
    el.scrollIntoView({ block: 'nearest' });
    const rect = el.getBoundingClientRect();
    return gap < els.length ? rect.top : rect.bottom;
  };

  switch (event.code) {
    case 'ArrowUp': {
      if (inInbox) return centerOf(gapY(rowEls().length));
      const gap = gapFromPoint(measureRows(), centerY);
      if (gap === 0 || inRoot) {
        return root ? centerOf(root.top + root.height / 2 + height / 2) : undefined;
      }
      return centerOf(gapY(gap - 1));
    }
    case 'ArrowDown': {
      if (inRoot) return centerOf(gapY(0));
      if (inInbox) return undefined;
      const gap = gapFromPoint(measureRows(), centerY);
      if (gap >= rowEls().length && inbox) {
        return centerOf(inbox.top + inbox.height / 2 + height / 2);
      }
      return centerOf(gapY(gap + 1));
    }
    case 'ArrowLeft':
      return { x: currentCoordinates.x - INDENT_PX, y: currentCoordinates.y };
    case 'ArrowRight':
      return { x: currentCoordinates.x + INDENT_PX, y: currentCoordinates.y };
  }
  return undefined;
};

export function TriageBoard({ nodes }: { nodes: Node[] }) {
  // start fully expanded: keyboard placement (and drop feedback generally)
  // needs the landing rows visible; collapsing stays one tap away
  const [expanded, setExpanded] = React.useState<Set<string>>(
    () => new Set([...childrenMap(nodes).keys()].filter((k): k is string => k !== null))
  );
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [error, setError] = React.useState<string | null>(null);

  const rows = React.useMemo(() => flattenTree(nodes, expanded), [nodes, expanded]);
  const inbox = React.useMemo(() => inboxOf(nodes), [nodes]);
  const labelOf = (id: string) => {
    const n = nodes.find((x) => x.id === id);
    return n?.title ?? n?.body ?? '(untitled)';
  };

  const run = async (result: Promise<{ ok: boolean; error?: string }>) => {
    const r = await result;
    setError(r.ok ? null : (r.error ?? 'unknown'));
  };

  const move = useTriageMove({
    rows,
    nodes,
    onMove: (ids, target) => run(moveNodes(ids, target.parentId, target.position)),
    onDetach: (ids) => run(detachNodes(ids)),
  });

  /* what a drop right now would do — written synchronously by the compute
     step so announcements never lag a render behind the indicator */
  const describeRef = React.useRef('');
  const draggingIds = React.useRef<string[]>([]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: triageCoordinates })
  );

  /** x is captured on the FIRST drag-move — dnd-kit has not measured the
   *  initial rect yet at onDragStart, and a 0 fallback silently maxed out
   *  every depth (drops landed at the deepest clamp, not where aimed) */
  const origin = React.useRef<{ x: number | null; depth: number }>({ x: null, depth: 0 });
  const lastRect = React.useRef<{ top: number; height: number; left: number } | null>(null);
  const edgeDir = React.useRef(0);
  const rafId = React.useRef(0);

  /* zone + gap + depth from the dragged rect — one computation for pointer
     moves, keyboard steps, AND the auto-scroll loop (rows slide under a
     stationary pointer, so the gap must be recomputed per scrolled frame) */
  const computeRef = React.useRef<(rect: { top: number; height: number; left: number }) => void>(
    () => {}
  );
  React.useEffect(() => {
    computeRef.current = (rect) => {
      const centerY = rect.top + rect.height / 2;
      // containment priority: root zone, then the TREE CONTAINER (a scrolled
      // tree has row rects physically extending under other zones — inside
      // the container is always the tree), then the inbox
      const root = zoneRect('root');
      if (root && centerY <= root.bottom && centerY >= root.top) {
        move.setZone('root');
        describeRef.current = 'over the root zone — drop confirms as top-level';
        return;
      }
      const tree = treeRect();
      const inTree = tree !== null && centerY >= tree.top && centerY <= tree.bottom;
      const inboxR = zoneRect('inbox');
      if (!inTree && inboxR && centerY >= inboxR.top) {
        move.setZone('inbox');
        describeRef.current = 'over the inbox — drop detaches to undetermined';
        return;
      }
      const rects = measureRows();
      const gap = gapFromPoint(rects, centerY);
      const depth = depthFromX(
        origin.current.x ?? rect.left,
        rect.left,
        origin.current.depth,
        INDENT_PX
      );
      move.setGap(gap, depth);
      const target = resolveGap(rows, nodes, gap, depth, draggingIds.current);
      describeRef.current = !target
        ? 'not a valid drop target (inside its own subtree)'
        : target.parentId === null
          ? `top level, position ${target.position + 1}`
          : `child of ${labelOf(target.parentId)}, position ${target.position + 1}`;
      if (edgeDir.current === 0) {
        // keyboard steps can land outside the viewport; nearest is a no-op
        // when the gap row is already visible
        document
          .querySelectorAll<HTMLElement>('[data-triage-tree] [data-row-index]')
          [Math.min(gap, rects.length - 1)]?.scrollIntoView({ block: 'nearest' });
      }
    };
  });

  const startEdgeLoop = () => {
    if (rafId.current) return;
    const tick = () => {
      rafId.current = 0;
      const tree = document.querySelector<HTMLElement>('[data-triage-tree]');
      if (edgeDir.current === 0 || !tree || !lastRect.current) return;
      tree.scrollTop += edgeDir.current * 6;
      computeRef.current(lastRect.current);
      rafId.current = requestAnimationFrame(tick);
    };
    rafId.current = requestAnimationFrame(tick);
  };
  const stopDrag = () => {
    edgeDir.current = 0;
    lastRect.current = null;
  };

  const onDragStart = (e: DragStartEvent) => {
    const data = e.active.data.current as { ids: string[]; depth: number };
    origin.current = { x: null, depth: data.depth };
    draggingIds.current = data.ids;
    move.pickUp(data.ids);
  };

  const onDragMove = (e: DragMoveEvent) => {
    const rect = e.active.rect.current.translated;
    if (!rect) return;
    if (origin.current.x === null) {
      origin.current.x = e.active.rect.current.initial?.left ?? rect.left;
    }
    lastRect.current = { top: rect.top, height: rect.height, left: rect.left };
    computeRef.current(lastRect.current);

    // auto-scroll while held near the tree's edges — even with no movement.
    // narrow band + gentle speed: a drop near (not at) the edge must not have
    // its landing point scrolled out from under the pointer
    const tree = document.querySelector('[data-triage-tree]')?.getBoundingClientRect();
    const centerY = rect.top + rect.height / 2;
    edgeDir.current =
      tree && centerY > tree.top - 24 && centerY < tree.bottom + 24
        ? centerY < tree.top + 28
          ? -1
          : centerY > tree.bottom - 28
            ? 1
            : 0
        : 0;
    if (edgeDir.current !== 0) startEdgeLoop();
  };

  const toggleSelect = (id: string) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const dragIds = (id: string) => (selected.has(id) ? [...new Set([...selected, id])] : [id]);
  const indicatorAt = move.moving?.zone === 'tree' ? move.moving.gapIndex : null;
  const overlayLabel = move.moving
    ? move.moving.ids.length > 1
      ? `${move.moving.ids.length} items`
      : labelOf(move.moving.ids[0]!)
    : null;

  return (
    <DndContext
      id="triage-dnd" /* stable id: SSR + client must agree on the generated aria ids */
      sensors={sensors}
      autoScroll={false}
      onDragStart={onDragStart}
      onDragMove={onDragMove}
      onDragEnd={() => {
        stopDrag();
        move.commit();
      }}
      onDragCancel={() => {
        stopDrag();
        move.cancel();
      }}
      accessibility={{
        screenReaderInstructions: {
          draggable:
            'Press Space or Enter to pick up. Arrow up and down move the insertion point, left and right change depth, Enter drops, Escape cancels.',
        },
        announcements: {
          onDragStart: ({ active }) =>
            `Picked up ${(active.data.current as { label: string }).label}.`,
          onDragMove: () => describeRef.current,
          onDragOver: () => undefined,
          onDragEnd: () => `Dropped: ${describeRef.current}.`,
          onDragCancel: () => 'Move cancelled.',
        },
      }}
    >
      <div className="flex min-h-0 flex-1 flex-col gap-4 py-4">
        {error && <p className="text-destructive text-xs">blocked: {error}</p>}

        {/* root drop-zone — distinct from the inbox: confirmed top-level */}
        <div
          data-triage-zone="root"
          className={cn(
            'border-border text-muted-foreground rounded-md border border-dashed px-3 py-2 text-xs',
            move.moving?.zone === 'root'
              ? 'border-primary text-foreground'
              : !move.moving && 'opacity-60'
          )}
        >
          Root — drop here to confirm as top-level
        </div>

        <div data-triage-tree className="relative min-h-24 flex-1 overflow-y-auto">
          {rows.length === 0 && (
            <p className="text-muted-foreground py-6 text-center text-sm">
              No tree yet — drag something up from the inbox.
            </p>
          )}
          {rows.map((row, i) => (
            <div key={row.node.id} data-row-index={i} className="relative">
              {indicatorAt === i && (
                <GapIndicator depth={move.moving!.depth} valid={!!move.target} />
              )}
              <TriageRow
                node={row.node}
                depth={row.depth}
                hasChildren={row.hasChildren}
                isExpanded={expanded.has(row.node.id)}
                isMoving={!!move.moving?.ids.includes(row.node.id)}
                onToggle={() =>
                  setExpanded((s) => {
                    const next = new Set(s);
                    if (next.has(row.node.id)) next.delete(row.node.id);
                    else next.add(row.node.id);
                    return next;
                  })
                }
                onInsertLayer={(mode) => run(layerAbove(row.node.id, mode))}
                onDetach={() => run(detachNodes([row.node.id]))}
              />
            </div>
          ))}
          {indicatorAt === rows.length && rows.length > 0 && (
            <div className="relative">
              <GapIndicator depth={move.moving!.depth} valid={!!move.target} />
            </div>
          )}
        </div>

        {/* inbox: undetermined leaves; drop here to detach */}
        <div
          data-triage-zone="inbox"
          className={cn(
            'border-border rounded-md border border-dashed p-3',
            move.moving?.zone === 'inbox' && 'border-primary'
          )}
        >
          <div className="mb-2 flex items-center justify-between gap-2">
            <label className="text-muted-foreground flex items-center gap-2 text-xs font-medium tracking-wider uppercase">
              {inbox.length > 0 && (
                <Checkbox
                  aria-label="select all inbox items"
                  checked={selected.size > 0 && selected.size === inbox.length}
                  onCheckedChange={(checked) =>
                    setSelected(checked ? new Set(inbox.map((n) => n.id)) : new Set())
                  }
                />
              )}
              Inbox — drag up to place, drop here to detach
            </label>
            {selected.size >= 1 && (
              <span className="flex items-center gap-1">
                <ParentPicker nodeIds={[...selected]}>
                  <Button size="sm" variant="outline">
                    Move {selected.size} to…
                  </Button>
                </ParentPicker>
                {selected.size >= 2 && (
                  <form
                    action={async () => {
                      await run(groupNodes([...selected]));
                      setSelected(new Set());
                    }}
                  >
                    <SubmitButton size="sm" variant="outline">
                      Group into new
                    </SubmitButton>
                  </form>
                )}
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {inbox.length === 0 && (
              <p className="text-muted-foreground text-sm">Empty — nothing is waiting on you.</p>
            )}
            {inbox.map((n) => (
              <InboxChip
                key={n.id}
                node={n}
                dragIds={dragIds(n.id)}
                isSelected={selected.has(n.id)}
                isMoving={!!move.moving?.ids.includes(n.id)}
                onToggleSelect={() => toggleSelect(n.id)}
              />
            ))}
          </div>
        </div>
      </div>

      {/* the ghost that tracks the cursor — transform-driven by dnd-kit */}
      <DragOverlay dropAnimation={null}>
        {overlayLabel && (
          <div className="border-border bg-background pointer-events-none flex w-fit items-center gap-1 rounded-full border px-3 py-1 text-sm shadow-md">
            <GripVertical className="text-muted-foreground size-3.5" />
            {overlayLabel}
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}

function GapIndicator({ depth, valid }: { depth: number; valid: boolean }) {
  return (
    <div
      className={cn('absolute -top-px right-0 z-10 h-0.5', valid ? 'bg-primary' : 'bg-destructive')}
      style={{ left: depth * INDENT_PX }}
    />
  );
}
