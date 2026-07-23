import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Habit, HabitCheck, Node } from '@/db/schema';
import { habitRepo } from '@/repository/habitRepo';
import { nodeRepo } from '@/repository/nodeRepo';
import { startOfDayInTz } from '@/lib/day';

import { HabitParentMissingError, ValidationError } from './errors';
import { saveOwnValues } from './field';
import { captureNode } from './node';
import {
  createHabit,
  deleteHabit,
  getHabitChecks,
  listHabits,
  toggleHabit,
} from './habit';
import { removeNode } from './triage';

vi.mock('@/repository/habitRepo', () => ({
  habitRepo: {
    byId: vi.fn(),
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    liveCheck: vi.fn(),
    liveChecksForDays: vi.fn(),
    insertCheck: vi.fn(),
    deleteCheck: vi.fn(),
  },
}));
vi.mock('@/repository/nodeRepo', () => ({
  nodeRepo: { byId: vi.fn(), byIds: vi.fn(), softDelete: vi.fn() },
}));
vi.mock('./node', () => ({ captureNode: vi.fn() }));
vi.mock('./field', () => ({ saveOwnValues: vi.fn() }));
vi.mock('./triage', () => ({ removeNode: vi.fn() }));

const TZ = 'Asia/Seoul';
const DAY = '2026-07-22';
const parent = {
  id: 'P',
  childSchema: [
    { key: 'inOut', label: 'In/Out', type: 'option' },
    { key: 'amount', label: 'Amount', type: 'number' },
  ],
} as unknown as Node;
const habit = {
  id: 'H',
  userId: 'u',
  title: 'Coffee',
  icon: '☕',
  logParentId: 'P',
  values: { inOut: 'expense', amount: '4500', stale: 'gone' },
  rank: 'a',
} as unknown as Habit;

beforeEach(() => {
  vi.mocked(habitRepo.byId).mockReset().mockResolvedValue(habit);
  vi.mocked(nodeRepo.byId)
    .mockReset()
    .mockImplementation(async (_u, id) => (id === 'P' ? parent : null) as never);
  vi.mocked(habitRepo.liveCheck).mockReset().mockResolvedValue(null);
  vi.mocked(habitRepo.insertCheck).mockReset().mockResolvedValue({} as HabitCheck);
  vi.mocked(habitRepo.deleteCheck).mockReset().mockResolvedValue(undefined);
  vi.mocked(habitRepo.remove).mockReset().mockResolvedValue(true);
  vi.mocked(nodeRepo.softDelete).mockReset().mockResolvedValue(true);
  vi.mocked(captureNode).mockReset().mockResolvedValue({ id: 'LOG' } as Node);
  vi.mocked(saveOwnValues).mockReset().mockResolvedValue(undefined);
  vi.mocked(removeNode).mockReset().mockResolvedValue({} as never);
});

describe('toggleHabit ON — creates a preset log + check', () => {
  it('creates a captured log under the parent with the day as eventDate, then records the check', async () => {
    await toggleHabit('u', 'H', DAY, TZ);

    expect(captureNode).toHaveBeenCalledWith('u', {
      title: 'Coffee',
      icon: '☕',
      contextParentId: 'P',
      eventDate: startOfDayInTz(DAY, TZ),
      origin: 'captured',
    });
    expect(habitRepo.insertCheck).toHaveBeenCalledWith('H', 'LOG', DAY);
  });

  it('filters preset values to the parent CURRENT schema keys (stale keys dropped)', async () => {
    await toggleHabit('u', 'H', DAY, TZ);
    expect(saveOwnValues).toHaveBeenCalledWith(
      'u',
      'LOG',
      { inOut: 'expense', amount: '4500' }, // 'stale' excluded
      ['inOut', 'amount']
    );
  });

  it('a preset value violating a rule rolls the log back and surfaces (no broken log)', async () => {
    vi.mocked(saveOwnValues).mockRejectedValue(new ValidationError('amount', 'amount must be ≥ 0'));
    await expect(toggleHabit('u', 'H', DAY, TZ)).rejects.toBeInstanceOf(ValidationError);
    expect(nodeRepo.softDelete).toHaveBeenCalledWith('u', 'LOG');
    expect(habitRepo.insertCheck).not.toHaveBeenCalled();
  });
});

describe('toggleHabit OFF — deletes the log + check', () => {
  it('removes the generated node and the check; never creates', async () => {
    vi.mocked(habitRepo.liveCheck).mockResolvedValue({
      id: 'C',
      habitId: 'H',
      nodeId: 'LOG',
      day: DAY,
    } as HabitCheck);

    await toggleHabit('u', 'H', DAY, TZ);

    expect(removeNode).toHaveBeenCalledWith('u', 'LOG');
    expect(habitRepo.deleteCheck).toHaveBeenCalledWith('u', 'H', DAY); // only this day
    expect(captureNode).not.toHaveBeenCalled();
    expect(habitRepo.insertCheck).not.toHaveBeenCalled();
  });
});

describe('toggleHabit guards', () => {
  it('throws when the target parent was deleted (disabled, not a crash)', async () => {
    vi.mocked(nodeRepo.byId).mockResolvedValue(null);
    await expect(toggleHabit('u', 'H', DAY, TZ)).rejects.toBeInstanceOf(HabitParentMissingError);
    expect(captureNode).not.toHaveBeenCalled();
  });
});

describe('deleteHabit — keeps the logs', () => {
  it('removes the habit (checks cascade) but never deletes a log node', async () => {
    await deleteHabit('u', 'H');
    expect(habitRepo.remove).toHaveBeenCalledWith('u', 'H');
    expect(removeNode).not.toHaveBeenCalled();
  });
});

describe('getHabitChecks — per-day on/off', () => {
  it('groups live checks by day', async () => {
    vi.mocked(habitRepo.liveChecksForDays).mockResolvedValue([
      { habitId: 'H1', day: 'D1' },
      { habitId: 'H2', day: 'D1' },
      { habitId: 'H1', day: 'D2' },
    ] as HabitCheck[]);
    const checks = await getHabitChecks('u', ['D1', 'D2']);
    expect(checks).toEqual({ D1: ['H1', 'H2'], D2: ['H1'] });
  });
});

describe('listHabits — disabled when the parent is gone', () => {
  it('flags a habit whose parent node no longer exists', async () => {
    vi.mocked(habitRepo.list).mockResolvedValue([
      { ...habit, id: 'H1', logParentId: 'P' },
      { ...habit, id: 'H2', logParentId: 'GONE' },
    ] as Habit[]);
    vi.mocked(nodeRepo.byIds).mockResolvedValue([{ id: 'P' }] as never);

    const summaries = await listHabits('u');
    expect(summaries.find((s) => s.id === 'H1')?.disabled).toBe(false);
    expect(summaries.find((s) => s.id === 'H2')?.disabled).toBe(true);
  });
});

describe('createHabit', () => {
  it('rejects an empty title before touching the repo', async () => {
    await expect(
      createHabit('u', { title: '   ', icon: null, logParentId: 'P', values: {} })
    ).rejects.toThrow();
    expect(habitRepo.create).not.toHaveBeenCalled();
  });
});
