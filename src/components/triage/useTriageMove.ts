'use client';

import * as React from 'react';

import type { Node } from '@/db/schema';

import { resolveGap, type DropTarget, type TreeRow } from './treeModel';

/**
 * The ONE action model (DESIGN §6): pick up → set insertion point (vertical)
 * and depth (horizontal) → commit. Input-agnostic; the dnd-kit pointer and
 * keyboard sensors are thin adapters over this state. Committing calls back
 * into server actions, which go through triage.reparent() — never a raw
 * write.
 *
 * `commit`/`cancel` read the CURRENT state via a ref, not the closure that
 * created them — the original pointer adapter committed through a stale
 * closure captured at pick-up, which made every pointer drop a silent no-op.
 */
export interface MoveState {
  ids: string[];
  /** 'tree': landing at gapIndex/depth · 'root': confirm top-level · 'inbox': detach */
  zone: 'tree' | 'root' | 'inbox';
  gapIndex: number;
  depth: number;
}

export interface TriageMoveApi {
  moving: MoveState | null;
  /** resolved landing target while over the tree (null = invalid/own subtree) */
  target: DropTarget | null;
  pickUp(ids: string[], at?: { gapIndex: number; depth: number }): void;
  setGap(gapIndex: number, depth: number): void;
  setZone(zone: MoveState['zone']): void;
  commit(): void;
  cancel(): void;
}

export function useTriageMove(args: {
  rows: TreeRow[];
  nodes: Node[];
  onMove(ids: string[], target: DropTarget): void;
  onDetach(ids: string[]): void;
}): TriageMoveApi {
  const { rows, nodes, onMove, onDetach } = args;
  const [moving, setMoving] = React.useState<MoveState | null>(null);

  const target = React.useMemo(() => {
    if (!moving) return null;
    if (moving.zone === 'root') return { parentId: null, position: 0 };
    if (moving.zone !== 'tree') return null;
    return resolveGap(rows, nodes, moving.gapIndex, moving.depth, moving.ids);
  }, [moving, rows, nodes]);

  // latest state, readable from long-lived sensor callbacks
  const latest = React.useRef<{ moving: MoveState | null; target: DropTarget | null }>({
    moving,
    target,
  });
  React.useEffect(() => {
    latest.current = { moving, target };
  });

  const clampGap = React.useCallback(
    (gap: number) => Math.max(0, Math.min(gap, rows.length)),
    [rows.length]
  );

  return {
    moving,
    target,
    pickUp(ids, at) {
      setMoving({
        ids,
        zone: 'tree',
        gapIndex: clampGap(at?.gapIndex ?? rows.length),
        depth: at?.depth ?? 0,
      });
    },
    setGap(gapIndex, depth) {
      setMoving((m) => (m ? { ...m, zone: 'tree', gapIndex: clampGap(gapIndex), depth } : m));
    },
    setZone(zone) {
      setMoving((m) => (m ? { ...m, zone } : m));
    },
    commit() {
      const { moving: m, target: t } = latest.current;
      if (!m) return;
      if (m.zone === 'inbox') {
        onDetach(m.ids);
      } else if (t) {
        onMove(m.ids, t);
      }
      setMoving(null);
    },
    cancel() {
      setMoving(null);
    },
  };
}
