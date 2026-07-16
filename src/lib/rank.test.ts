import { describe, expect, it } from 'vitest';

import { rankBetween, spreadRanks } from './rank';

describe('rankBetween', () => {
  it('produces a rank strictly between its bounds', () => {
    expect(rankBetween('b', 'c')).toBe('bm');
    const r = rankBetween('az', 'b');
    expect(r).not.toBeNull();
    expect(r! > 'az' && r! < 'b').toBe(true);
  });

  it('returns null (rebalance) when no rank fits', () => {
    expect(rankBetween(null, 'a')).toBeNull(); // nothing sorts before 'a'
    expect(rankBetween('b', 'b')).toBeNull(); // unordered/equal input
  });

  it('survives 50 head-insertions with rebalance fallback', () => {
    let ranks = spreadRanks(1);
    for (let i = 0; i < 50; i++) {
      const head = rankBetween(null, ranks[0]!);
      ranks = head !== null ? [head, ...ranks] : spreadRanks(ranks.length + 1);
      for (let j = 1; j < ranks.length; j++) expect(ranks[j - 1]! < ranks[j]!).toBe(true);
    }
  });

  it('survives 50 adjacent midpoint insertions with rebalance fallback', () => {
    let ranks = spreadRanks(2);
    for (let i = 0; i < 50; i++) {
      const mid = rankBetween(ranks[0]!, ranks[1]!);
      ranks = mid !== null ? [ranks[0]!, mid, ...ranks.slice(1)] : spreadRanks(ranks.length + 1);
      for (let j = 1; j < ranks.length; j++) expect(ranks[j - 1]! < ranks[j]!).toBe(true);
    }
  });
});

describe('spreadRanks', () => {
  it('emits strictly ordered ranks with room on both ends', () => {
    for (const n of [1, 2, 5, 26, 100]) {
      const ranks = spreadRanks(n);
      expect(ranks).toHaveLength(n);
      for (let i = 1; i < n; i++) expect(ranks[i - 1]! < ranks[i]!).toBe(true);
      expect(rankBetween(null, ranks[0]!)).not.toBeNull();
      expect(rankBetween(ranks[n - 1]!, null)).not.toBeNull();
    }
  });
});
