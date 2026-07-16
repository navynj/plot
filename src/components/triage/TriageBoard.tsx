'use client';

import * as React from 'react';

import type { Node } from '@/db/schema';
import { detachNodes, groupNodes, layerAbove, moveNodes } from '@/app/triage/actions';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import { flattenTree, inboxOf } from './treeModel';
import { INDENT_PX, TriageRow } from './TriageRow';
import { useTriageMove } from './useTriageMove';

/** Position triage (DESIGN §6): tree on top, inbox leaves below. One action
 *  model behind pointer AND keyboard adapters; every commit goes through the
 *  triage service via server actions. */
export function TriageBoard({ nodes }: { nodes: Node[] }) {
  const [expanded, setExpanded] = React.useState<Set<string>>(new Set());
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [error, setError] = React.useState<string | null>(null);

  const rows = React.useMemo(() => flattenTree(nodes, expanded), [nodes, expanded]);
  const inbox = React.useMemo(() => inboxOf(nodes), [nodes]);

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

  // ---- pointer adapter: rows report their rects; pointermove picks the gap
  const treeRef = React.useRef<HTMLDivElement>(null);
  const inboxRef = React.useRef<HTMLDivElement>(null);
  const originX = React.useRef(0);

  const onGripDown = (ids: string[]) => (e: React.PointerEvent) => {
    e.preventDefault();
    originX.current = e.clientX;
    move.pickUp(ids);
    const onPointerMove = (ev: PointerEvent) => {
      const inboxRect = inboxRef.current?.getBoundingClientRect();
      if (inboxRect && ev.clientY >= inboxRect.top) {
        move.setZone('inbox');
        return;
      }
      const rowEls = Array.from(
        treeRef.current?.querySelectorAll<HTMLElement>('[data-row-index]') ?? []
      );
      let gap = rowEls.length;
      for (const el of rowEls) {
        const rect = el.getBoundingClientRect();
        if (ev.clientY < rect.top + rect.height / 2) {
          gap = Number(el.dataset.rowIndex);
          break;
        }
      }
      const depth = Math.round((ev.clientX - originX.current) / INDENT_PX) + baseDepth(gap);
      move.setGap(gap, depth);
    };
    const onPointerUp = () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      move.commit();
    };
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  };

  const baseDepth = (gap: number) => rows[gap - 1]?.depth ?? 0;

  // ---- keyboard adapter over the same hook
  const onRowKeyDown = (ids: string[], rowIndex: number) => (e: React.KeyboardEvent) => {
    if (!move.moving) {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        move.pickUp(ids, { gapIndex: rowIndex, depth: rows[rowIndex]?.depth ?? 0 });
      }
      return;
    }
    e.preventDefault();
    if (e.key === 'ArrowUp') move.moveRow(-1);
    else if (e.key === 'ArrowDown') move.moveRow(1);
    else if (e.key === 'ArrowLeft') move.moveDepth(-1);
    else if (e.key === 'ArrowRight') move.moveDepth(1);
    else if (e.key === 'Enter') move.commit();
    else if (e.key === 'Escape') move.cancel();
  };

  const toggleSelect = (id: string) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const dragIds = (id: string) => (selected.has(id) ? [...selected] : [id]);
  const indicatorAt = move.moving?.zone === 'tree' ? move.moving.gapIndex : null;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 py-4">
      {error && <p className="text-destructive text-xs">blocked: {error}</p>}

      {/* root drop-zone — distinct from the inbox: confirmed top-level */}
      <div
        className={cn(
          'border-border text-muted-foreground rounded-md border border-dashed px-3 py-2 text-xs',
          move.moving?.zone === 'tree' && move.target?.parentId === null
            ? 'border-primary text-foreground'
            : !move.moving && 'opacity-60'
        )}
      >
        Root — drop here to confirm as top-level
      </div>

      <div ref={treeRef} className="relative min-h-24 flex-1 overflow-y-auto">
        {rows.length === 0 && (
          <p className="text-muted-foreground py-6 text-center text-sm">
            No tree yet — drag something up from the inbox.
          </p>
        )}
        {rows.map((row, i) => (
          <div key={row.node.id} data-row-index={i} className="relative">
            {indicatorAt === i && <GapIndicator depth={move.moving!.depth} valid={!!move.target} />}
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
              onGripPointerDown={onGripDown([row.node.id])}
              onKeyDown={onRowKeyDown([row.node.id], i)}
              onInsertLayer={(mode) => run(layerAbove(row.node.id, mode))}
              onDetach={() => run(detachNodes([row.node.id]))}
            />
          </div>
        ))}
        {indicatorAt === rows.length && rows.length > 0 && (
          <GapIndicator depth={move.moving!.depth} valid={!!move.target} />
        )}
      </div>

      {/* inbox: undetermined leaves; drop here to detach */}
      <div
        ref={inboxRef}
        className={cn(
          'border-border rounded-md border border-dashed p-3',
          move.moving?.zone === 'inbox' && 'border-primary'
        )}
      >
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
            Inbox — drag up to place, drop here to detach
          </h2>
          {selected.size >= 2 && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                run(groupNodes([...selected]));
                setSelected(new Set());
              }}
            >
              Group {selected.size}
            </Button>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {inbox.length === 0 && (
            <p className="text-muted-foreground text-sm">Empty — nothing is waiting on you.</p>
          )}
          {inbox.map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={() => toggleSelect(n.id)}
              onPointerDown={onGripDown(dragIds(n.id))}
              onKeyDown={onRowKeyDown(dragIds(n.id), rows.length)}
              className={cn(
                'border-border cursor-grab touch-none rounded-full border px-3 py-1 text-sm select-none',
                selected.has(n.id) && 'border-primary ring-primary/30 ring-2',
                move.moving?.ids.includes(n.id) && 'opacity-40'
              )}
            >
              {n.title ?? n.body}
            </button>
          ))}
        </div>
      </div>
    </div>
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
