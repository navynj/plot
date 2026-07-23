import { describe, expect, it } from 'vitest';

import { bipolarDomain, scaleFrac } from './scale';

describe('bipolarDomain — always spans zero, covers negatives', () => {
  it('signed data: lo is the min (below 0), hi the max', () => {
    expect(bipolarDomain([3, -2, 5])).toEqual({ lo: -2, hi: 5 });
  });

  it('all non-negative: lo pins to 0 (baseline at the bottom)', () => {
    expect(bipolarDomain([1, 2, 3])).toEqual({ lo: 0, hi: 3 });
  });

  it('all non-positive: hi pins to 0 (baseline at the top)', () => {
    expect(bipolarDomain([-5, -1])).toEqual({ lo: -5, hi: 0 });
  });

  it('degenerate (all zero / empty): guarded so hi > lo', () => {
    expect(bipolarDomain([0, 0])).toEqual({ lo: 0, hi: 1 });
    expect(bipolarDomain([])).toEqual({ lo: 0, hi: 1 });
  });
});

describe('scaleFrac — maps values into [0,1] with zero placed correctly', () => {
  const { lo, hi } = bipolarDomain([3, -2, 5]); // lo=-2, hi=5, span=7

  it('endpoints map to the plot bounds', () => {
    expect(scaleFrac(hi, lo, hi)).toBe(1); // top
    expect(scaleFrac(lo, lo, hi)).toBe(0); // bottom
  });

  it('a negative value maps inside the plot range (not clipped below 0)', () => {
    const f = scaleFrac(-2, lo, hi);
    expect(f).toBeGreaterThanOrEqual(0);
    expect(f).toBeLessThanOrEqual(1);
    expect(f).toBe(0); // the lowest point sits at the bottom edge, in view
  });

  it('the zero baseline sits above the bottom when negatives exist', () => {
    const zero = scaleFrac(0, lo, hi);
    expect(zero).toBeCloseTo(2 / 7); // (0 − (−2)) / 7
    expect(zero).toBeGreaterThan(0);
    expect(zero).toBeLessThan(1);
  });

  it('map into a pixel plot: a negative point falls below the zero line, in view', () => {
    const top = 24;
    const bottom = 136;
    const y = (v: number) => bottom - scaleFrac(v, lo, hi) * (bottom - top);
    expect(y(5)).toBe(top);
    expect(y(-2)).toBe(bottom);
    expect(y(-2)).toBeGreaterThan(y(0)); // negative sits below the zero baseline
    expect(y(0)).toBeLessThan(bottom); // ...which is no longer the bottom
  });
});
