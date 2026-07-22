import { describe, expect, it } from 'vitest';

import { summarizeBudget } from './budgetMath';

describe('summarizeBudget — total − allocation-sum, including the over case', () => {
  it('under target: positive remaining, not over', () => {
    // During example shape: total 461,760, allocations summing under it
    expect(summarizeBudget(461760, [200000, 100000, 61760])).toEqual({
      allocated: 361760,
      remaining: 100000,
      over: false,
    });
  });

  it('THE OVER CASE: allocations exceed the total → negative remaining, over=true', () => {
    // matches the screenshot's −235,618 "전체 목표 초과"
    expect(summarizeBudget(461760, [400000, 200000, 97378])).toEqual({
      allocated: 697378,
      remaining: -235618,
      over: true,
    });
  });

  it('no total set treats target as 0 — any allocation is over', () => {
    expect(summarizeBudget(null, [500])).toEqual({ allocated: 500, remaining: -500, over: true });
  });

  it('exactly on target is not over (remaining 0)', () => {
    expect(summarizeBudget(1000, [600, 400])).toEqual({ allocated: 1000, remaining: 0, over: false });
  });

  it('ignores NaN allocations (empty inputs) rather than poisoning the sum', () => {
    expect(summarizeBudget(1000, [600, NaN, 100])).toEqual({
      allocated: 700,
      remaining: 300,
      over: false,
    });
  });
});
