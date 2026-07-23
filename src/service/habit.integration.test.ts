import 'dotenv/config';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/** Habit tracker end-to-end against a real DB: toggle ON creates a preset log +
 *  check, toggle OFF removes them, delete keeps the logs. Exercises the repo SQL
 *  the mocked unit tests can't (liveCheck joins, deleteCheck, insertCheck). */

const hasDb = Boolean(process.env.DATABASE_URL);
if (!hasDb) console.warn('habit integration tests SKIPPED: DATABASE_URL is not set');

const TZ = 'Asia/Seoul';
const DAY = '2026-07-20';

describe.skipIf(!hasDb)('habit tracker (real DB)', () => {
  let db: typeof import('@/db').db;
  let schema: typeof import('@/db/schema');
  let nodeRepo: typeof import('@/repository/nodeRepo').nodeRepo;
  let triage: typeof import('@/service/triage');
  let nodeService: typeof import('@/service/node');
  let fieldService: typeof import('@/service/field');
  let habitService: typeof import('@/service/habit');
  let day: typeof import('@/lib/day');

  let uid: string;
  let parentId: string;

  beforeAll(async () => {
    ({ db } = await import('@/db'));
    schema = await import('@/db/schema');
    ({ nodeRepo } = await import('@/repository/nodeRepo'));
    triage = await import('@/service/triage');
    nodeService = await import('@/service/node');
    fieldService = await import('@/service/field');
    habitService = await import('@/service/habit');
    day = await import('@/lib/day');

    const run = Math.random().toString(36).slice(2, 10);
    const users = await db
      .insert(schema.user)
      .values([{ email: `habit-${run}@test.local` }])
      .returning({ id: schema.user.id });
    uid = users[0]!.id;

    const parent = await nodeRepo.create({ userId: uid, title: 'Coffees', capturedAt: new Date() });
    await triage.reparent(uid, parent.id, null);
    await nodeService.setChildSchema(uid, parent.id, [
      { key: 'amount', label: 'Amount', type: 'number' },
      { key: 'note', label: 'Note', type: 'text' },
    ]);
    parentId = parent.id;
  });

  afterAll(async () => {
    const { eq } = await import('drizzle-orm');
    await db.delete(schema.user).where(eq(schema.user.id, uid));
  });

  it('toggle ON creates a preset log (title, eventDate, filtered values) + a check', async () => {
    const habit = await habitService.createHabit(uid, {
      title: 'Coffee',
      icon: '☕',
      logParentId: parentId,
      values: { amount: '4500', note: 'latte', stale: 'ignored' },
    });

    await habitService.toggleHabit(uid, habit.id, DAY, TZ);

    // status reads on
    expect(await habitService.getHabitChecks(uid, [DAY])).toEqual({ [DAY]: [habit.id] });

    // the generated log: a child of the parent with the day's eventDate + title
    const children = await nodeRepo.findChildren(uid, parentId);
    expect(children).toHaveLength(1);
    const log = children[0]!;
    expect(log.title).toBe('Coffee');
    expect(log.eventDate?.getTime()).toBe(day.startOfDayInTz(DAY, TZ).getTime());
    // preset values written, filtered to the parent's current schema (no 'stale')
    const values = await fieldService.getOwnValues(uid, log.id);
    expect(values).toEqual({ amount: 4500, note: 'latte' });
  });

  it('toggle OFF removes the log and the check; toggling ON again is a fresh log', async () => {
    const [habit] = await habitService.listHabits(uid);
    await habitService.toggleHabit(uid, habit!.id, DAY, TZ); // OFF

    expect(await habitService.getHabitChecks(uid, [DAY])).toEqual({});
    expect(await nodeRepo.findChildren(uid, parentId)).toHaveLength(0);

    await habitService.toggleHabit(uid, habit!.id, DAY, TZ); // ON again
    expect(await habitService.getHabitChecks(uid, [DAY])).toEqual({ [DAY]: [habit!.id] });
    expect(await nodeRepo.findChildren(uid, parentId)).toHaveLength(1);
  });

  it('deleteHabit removes the habit + checks but KEEPS the generated log nodes', async () => {
    const [habit] = await habitService.listHabits(uid);
    const logBefore = (await nodeRepo.findChildren(uid, parentId))[0]!;

    await habitService.deleteHabit(uid, habit!.id);

    expect(await habitService.listHabits(uid)).toHaveLength(0);
    // the log node stays (a normal record now)
    expect(await nodeRepo.byId(uid, logBefore.id)).not.toBeNull();
    // the check is gone → the day reads unchecked
    expect(await habitService.getHabitChecks(uid, [DAY])).toEqual({});
  });
});
