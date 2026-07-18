import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Node } from '@/db/schema';
import { fieldValueRepo } from '@/repository/fieldValueRepo';
import { linkRepo } from '@/repository/linkRepo';
import { nodeRepo } from '@/repository/nodeRepo';

import { aggregate, budgetVsActual } from './aggregation';
import { UnsupportedFilterError } from './errors';

vi.mock('@/repository/nodeRepo', () => ({ nodeRepo: { findChildren: vi.fn() } }));
vi.mock('@/repository/linkRepo', () => ({ linkRepo: { findTargets: vi.fn() } }));
vi.mock('@/repository/fieldValueRepo', () => ({ fieldValueRepo: { aggregate: vi.fn() } }));

const asNodes = (ids: string[]) => ids.map((id) => ({ id }) as Node);

beforeEach(() => {
  vi.mocked(nodeRepo.findChildren)
    .mockReset()
    .mockResolvedValue(asNodes(['t1', 't2']));
  vi.mocked(linkRepo.findTargets)
    .mockReset()
    .mockResolvedValue(asNodes(['g1', 't2']));
  vi.mocked(fieldValueRepo.aggregate).mockReset().mockResolvedValue([]);
});

describe('aggregation — one engine, two sources', () => {
  const spec = { lens: 'amount', op: 'sum' as const };

  it('tree source aggregates over tree children only', async () => {
    await aggregate('u', 'N', { source: 'tree', spec });
    expect(linkRepo.findTargets).not.toHaveBeenCalled();
    expect(vi.mocked(fieldValueRepo.aggregate).mock.calls[0]![1]).toEqual(['t1', 't2']);
  });

  it('graph source aggregates over linked members only', async () => {
    await aggregate('u', 'N', { source: 'graph', spec });
    expect(nodeRepo.findChildren).not.toHaveBeenCalled();
    expect(vi.mocked(fieldValueRepo.aggregate).mock.calls[0]![1]).toEqual(['g1', 't2']);
  });

  it('both = union of the two sets, deduplicated — same engine either way', async () => {
    await aggregate('u', 'N', { source: 'both', spec });
    expect(vi.mocked(fieldValueRepo.aggregate).mock.calls[0]![1]).toEqual(['t1', 't2', 'g1']);
  });

  it('maps viewSpec filters onto typed storage columns', async () => {
    await aggregate('u', 'N', {
      source: 'tree',
      spec: { ...spec, filters: [{ key: 'scheduled', op: 'eq', value: false }] },
    });
    expect(vi.mocked(fieldValueRepo.aggregate).mock.calls[0]![2].filters).toEqual([
      { key: 'scheduled', op: 'eq', column: 'boolValue', value: false },
    ]);
  });

  it('rejects in/between filters with a typed error (not silently dropped)', async () => {
    await expect(
      aggregate('u', 'N', {
        source: 'tree',
        spec: { ...spec, filters: [{ key: 'x', op: 'in', value: [1, 2] }] },
      })
    ).rejects.toBeInstanceOf(UnsupportedFilterError);
  });
});

describe('aggregation.budgetVsActual — subtraction of like-shaped aggregates', () => {
  it('merges the three aggregates on the shared category axis, including one-sided categories', async () => {
    vi.mocked(fieldValueRepo.aggregate).mockImplementation(async (_u, _ids, spec) => {
      const scheduled = spec.filters?.[0]?.value;
      if (scheduled === undefined) {
        // budget side: food 300000, transport 10000
        return [
          { groupId: 'food', value: 300000, count: 1 },
          { groupId: 'transport', value: 10000, count: 1 },
        ];
      }
      if (scheduled === false) {
        // actuals: food 16500, transport 8000, and an unbudgeted category
        return [
          { groupId: 'food', value: 16500, count: 2 },
          { groupId: 'transport', value: 8000, count: 1 },
          { groupId: 'fun', value: 9900, count: 1 },
        ];
      }
      return [{ groupId: 'transport', value: 12000, count: 1 }]; // scheduled
    });

    const rows = await budgetVsActual('u', {
      budgetNodeId: 'B',
      actualsNodeId: 'A',
      valueKey: 'amount',
      categoryKey: 'category',
      scheduledKey: 'scheduled',
    });
    const by = new Map(rows.map((r) => [r.category, r]));

    expect(by.get('food')).toEqual({
      category: 'food',
      budget: 300000,
      actual: 16500,
      scheduled: 0,
      remaining: 283500,
    });
    // over budget: 10000 − 8000 − 12000 = −10000
    expect(by.get('transport')).toEqual({
      category: 'transport',
      budget: 10000,
      actual: 8000,
      scheduled: 12000,
      remaining: -10000,
    });
    // spent with no budget line: negative remaining from zero
    expect(by.get('fun')).toEqual({
      category: 'fun',
      budget: 0,
      actual: 9900,
      scheduled: 0,
      remaining: -9900,
    });
  });
});
