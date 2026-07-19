import { describe, expect, it } from 'vitest';

import type { Node } from '@/db/schema';

import { depthFromX, flattenTree, gapFromPoint, resolveGap } from './treeModel';

const mk = (id: string, parentId: string | null, rank: string | null, at = 0) =>
  ({ id, parentId, rank, capturedAt: new Date(at) }) as Node;

// Bass(d0) > Songs(d1) > Rio(d2), Mood(d0) — all expanded
const nodes = [
  mk('bass', null, 'f'),
  mk('songs', 'bass', 'm'),
  mk('rio', 'songs', 'm'),
  mk('mood', null, 'm'),
];
const rows = flattenTree(nodes, new Set(['bass', 'songs']));

describe('gapFromPoint — measured rects → gap index', () => {
  // rows at y 0/32/64/96, each 32 tall
  const rects = [0, 32, 64, 96].map((top) => ({ top, height: 32 }));

  it('above a row midline targets the gap above it; below, the next gap', () => {
    expect(gapFromPoint(rects, -10)).toBe(0);
    expect(gapFromPoint(rects, 15)).toBe(0); // above row 0 midline (16)
    expect(gapFromPoint(rects, 17)).toBe(1); // below it
    expect(gapFromPoint(rects, 79)).toBe(2); // just under row 2 midline (80)
    expect(gapFromPoint(rects, 81)).toBe(3);
    expect(gapFromPoint(rects, 500)).toBe(4); // trailing gap
  });

  it('scroll offsets are the caller’s rects — shifted rects shift gaps identically', () => {
    const scrolled = rects.map((r) => ({ ...r, top: r.top - 40 }));
    expect(gapFromPoint(scrolled, 15 - 40)).toBe(0);
    expect(gapFromPoint(scrolled, 81 - 40)).toBe(3);
  });
});

describe('depthFromX — horizontal offset → depth with ±half-step snap', () => {
  it('rounds at half an indent', () => {
    expect(depthFromX(100, 100, 1, 24)).toBe(1);
    expect(depthFromX(100, 111, 1, 24)).toBe(1); // < half step
    expect(depthFromX(100, 113, 1, 24)).toBe(2); // ≥ half step
    expect(depthFromX(100, 100 - 13, 1, 24)).toBe(0);
  });
});

describe('resolveGap — gap+depth → parent/position (own subtree excluded)', () => {
  it('gap between Songs and Rio at depth 2 = first child of Songs', () => {
    expect(resolveGap(rows, nodes, 2, 2, ['x'])).toEqual({ parentId: 'songs', position: 0 });
  });

  it('same gap clamps depth into the valid band (Rio below forces ≥ its depth)', () => {
    expect(resolveGap(rows, nodes, 2, 0, ['x'])).toEqual({ parentId: 'songs', position: 0 });
  });

  it('trailing gap at depth 0 = root append', () => {
    expect(resolveGap(rows, nodes, 4, 0, ['x'])).toEqual({ parentId: null, position: 2 });
  });

  it('a gap inside the dragged node’s own subtree is invalid', () => {
    expect(resolveGap(rows, nodes, 2, 2, ['songs'])).toBeNull(); // under itself
    expect(resolveGap(rows, nodes, 3, 1, ['bass'])).toBeNull(); // as child of own child
  });

  it('moving a node past later siblings does not count itself in the position', () => {
    expect(resolveGap(rows, nodes, 4, 0, ['bass'])).toEqual({ parentId: null, position: 1 });
  });
});
