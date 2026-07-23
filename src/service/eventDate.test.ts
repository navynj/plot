import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Node } from '@/db/schema';
import { nodeRepo } from '@/repository/nodeRepo';
import { dayInTz, shiftDay, startOfDayInTz } from '@/lib/day';

import { bulkSetEventDate, bulkShiftEventDateByDays } from './node';

vi.mock('@/repository/nodeRepo', () => ({
  nodeRepo: { byIds: vi.fn(), bulkSetEventDate: vi.fn(), setEventDates: vi.fn() },
}));
vi.mock('@/repository/linkRepo', () => ({ linkRepo: { findTargets: vi.fn() } }));
vi.mock('@/repository/undoRepo', () => ({
  undoRepo: { push: vi.fn(), pop: vi.fn(), clearRedo: vi.fn(), list: vi.fn() },
}));

const TZ = 'America/New_York';

/** the per-node eventDate map the service handed the repo */
function shifted(): Record<string, Date> {
  const updates = vi.mocked(nodeRepo.setEventDates).mock.calls.at(-1)![1];
  return Object.fromEntries(updates.map((u) => [u.id, u.eventDate]));
}

describe('bulkShiftEventDateByDays — move to next day (+1)', () => {
  beforeEach(() => {
    vi.mocked(nodeRepo.byIds).mockReset();
    vi.mocked(nodeRepo.setEventDates).mockReset().mockResolvedValue(undefined);
  });

  it('shifts a node with an eventDate to the following day (start of day in tz)', async () => {
    const eventDate = startOfDayInTz('2026-07-22', TZ);
    vi.mocked(nodeRepo.byIds).mockResolvedValue([
      { id: 'A', eventDate, capturedAt: new Date('2026-01-01T00:00:00Z') } as Node,
    ]);

    await bulkShiftEventDateByDays('u', ['A'], 1, TZ);

    expect(shifted().A).toEqual(startOfDayInTz('2026-07-23', TZ));
  });

  it('shifts a node with only capturedAt (null eventDate) to the day after its captured day', async () => {
    // 03:30 UTC on 7/22 is 7/21 23:30 in New York → captured day is 7/21
    const capturedAt = new Date('2026-07-22T03:30:00Z');
    expect(dayInTz(capturedAt, TZ)).toBe('2026-07-21'); // sanity: tz, not UTC
    vi.mocked(nodeRepo.byIds).mockResolvedValue([
      { id: 'B', eventDate: null, capturedAt } as Node,
    ]);

    await bulkShiftEventDateByDays('u', ['B'], 1, TZ);

    // day after the captured day (7/21) → 7/22, start of day in tz
    expect(shifted().B).toEqual(startOfDayInTz('2026-07-22', TZ));
    expect(shifted().B).toEqual(startOfDayInTz(shiftDay('2026-07-21', 1), TZ));
  });

  it('shifts each selected node by its own effective day (mixed set)', async () => {
    vi.mocked(nodeRepo.byIds).mockResolvedValue([
      { id: 'A', eventDate: startOfDayInTz('2026-03-01', TZ), capturedAt: new Date() } as Node,
      { id: 'B', eventDate: null, capturedAt: new Date('2026-12-31T12:00:00Z') } as Node,
    ]);
    await bulkShiftEventDateByDays('u', ['A', 'B'], 1, TZ);
    const out = shifted();
    expect(out.A).toEqual(startOfDayInTz('2026-03-02', TZ));
    expect(out.B).toEqual(startOfDayInTz('2027-01-01', TZ)); // crosses the year
  });

  it('is a no-op for an empty selection', async () => {
    await bulkShiftEventDateByDays('u', [], 1, TZ);
    expect(nodeRepo.byIds).not.toHaveBeenCalled();
    expect(nodeRepo.setEventDates).not.toHaveBeenCalled();
  });
});

describe('bulkSetEventDate — change to a specific date', () => {
  beforeEach(() => {
    vi.mocked(nodeRepo.bulkSetEventDate).mockReset().mockResolvedValue(undefined);
  });

  it("sets every id's eventDate to the chosen day's start in tz", async () => {
    await bulkSetEventDate('u', ['A', 'B', 'C'], '2026-07-22', TZ);
    expect(nodeRepo.bulkSetEventDate).toHaveBeenCalledWith(
      'u',
      ['A', 'B', 'C'],
      startOfDayInTz('2026-07-22', TZ)
    );
  });

  it('rejects an invalid day and an empty selection without writing', async () => {
    await bulkSetEventDate('u', ['A'], 'not-a-day', TZ);
    await bulkSetEventDate('u', [], '2026-07-22', TZ);
    expect(nodeRepo.bulkSetEventDate).not.toHaveBeenCalled();
  });
});
