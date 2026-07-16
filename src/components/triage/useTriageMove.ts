'use client';

import * as React from 'react';

import type { Node } from '@/db/schema';

import { depthRange, resolveGap, type DropTarget, type TreeRow } from './treeModel';

/**
 * The ONE action model (DESIGN §6): pick up → set insertion point (vertical)
 * and depth (horizontal) → commit. Input-agnostic; pointer and keyboard are
 * thin adapters over this state. Committing calls back into server actions,
 * which go through triage.reparent()/detachToInbox() — never a raw write.
 */
export interface MoveState {
  ids: string[];
  /** 'tree': landing at gapIndex/depth. 'inbox': detach to undetermined. */
  zone: 'tree' | 'inbox';
  gapIndex: number;
  depth: number;
}

export interface TriageMoveApi {
  moving: MoveState | null;
  /** resolved landing target while over the tree (null = invalid/own subtree) */
  target: DropTarget | null;
  pickUp(ids: string[], at?: { gapIndex: number; depth: number }): void;
  setGap(gapIndex: number, depth: number): void;
  setZone(zone: 'tree' | 'inbox'): void;
  moveRow(delta: number): void;
  moveDepth(delta: number): void;
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
    if (!moving || moving.zone !== 'tree') return null;
    return resolveGap(rows, nodes, moving.gapIndex, moving.depth, moving.ids);
  }, [moving, rows, nodes]);

  const clampGap = (gap: number) => Math.max(0, Math.min(gap, rows.length));

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
    moveRow(delta) {
      setMoving((m) => (m ? { ...m, zone: 'tree', gapIndex: clampGap(m.gapIndex + delta) } : m));
    },
    moveDepth(delta) {
      setMoving((m) => {
        if (!m) return m;
        const { min, max } = depthRange(rows, m.gapIndex);
        return { ...m, zone: 'tree', depth: Math.max(min, Math.min(m.depth + delta, max)) };
      });
    },
    commit() {
      if (!moving) return;
      if (moving.zone === 'inbox') {
        onDetach(moving.ids);
      } else if (target) {
        onMove(moving.ids, target);
      }
      setMoving(null);
    },
    cancel() {
      setMoving(null);
    },
  };
}
