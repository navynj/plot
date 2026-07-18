import type { FieldDef, ViewSpec } from '@/db/schema';
import { nodeRepo } from '@/repository/nodeRepo';

import { setChildSchema, setViewSpec } from './node';
import { reparent } from './triage';

/**
 * First-run seed (ROADMAP Phase 9): pre-built rooms so a new user never faces
 * a blank canvas. The skeleton stays flat — these are ordinary nodes, nothing
 * special. Idempotent: skips if the user has ever had a node.
 *
 * No transactions on neon-http (CLAUDE.md §6), so writes are ordered to leave
 * a harmless prefix on partial failure: nodes (parents before children, all
 * placed via triage.reparent) → childSchemas → viewSpecs. A prefix is just
 * empty rooms — never a broken graph.
 */

const ROOTS: { title: string; icon: string }[] = [
  { title: 'Work', icon: '💼' },
  { title: 'Study', icon: '📚' },
  { title: 'Project', icon: '🛠️' },
  { title: 'Hobby', icon: '🎨' },
  { title: 'Fitness', icon: '💪' },
  { title: 'Lifestyle', icon: '🏡' },
];

const EXPENSE_CATEGORIES: { title: string; icon: string }[] = [
  { title: 'Food', icon: '🍚' },
  { title: 'Transport', icon: '🚉' },
  { title: 'Living', icon: '🛒' },
  { title: 'Shopping', icon: '🛍️' },
  { title: 'Culture & Leisure', icon: '🎬' },
  { title: 'Housing & Utilities', icon: '🏠' },
  { title: 'Health', icon: '🏥' },
  { title: 'Occasions', icon: '💌' },
  { title: 'Salary', icon: '💰' },
  { title: 'Allowance', icon: '💵' },
  { title: 'Interest', icon: '🏦' },
  { title: 'Rewards', icon: '👍' },
  { title: 'Resale', icon: '🥕' },
];

export async function ensureSeed(userId: string): Promise<boolean> {
  if (await nodeRepo.hasAny(userId)) return false;

  const create = async (title: string, icon: string, parentId: string | null) => {
    const node = await nodeRepo.create({ userId, title, icon, capturedAt: new Date() });
    await reparent(userId, node.id, parentId); // null = confirmed root, ranked
    return node.id;
  };

  /* 1 — nodes, parents before children */
  const rootIds = new Map<string, string>();
  for (const root of ROOTS) {
    rootIds.set(root.title, await create(root.title, root.icon, null));
  }
  const lifestyle = rootIds.get('Lifestyle')!;

  const todo = await create('Todo', '✅', lifestyle);
  const schedule = await create('Schedule', '📆', lifestyle);
  const sleep = await create('Sleep', '🌙', lifestyle);
  const expense = await create('Expense', '💸', lifestyle);
  const categories = await create('Expense categories', '🗂️', lifestyle);
  const mood = await create('Mood', '🙂', lifestyle);
  for (const category of EXPENSE_CATEGORIES) {
    await create(category.title, category.icon, categories);
  }

  /* 2 — childSchemas. Sleep/Mood carry an explicit `date` field: the seeded
     views group by it (a field_value axis — capturedAt is a column, not a
     groupable field). */
  const schemas: [string, FieldDef[]][] = [
    [todo, [{ key: 'done', label: 'Done', type: 'checkbox' }]],
    [schedule, [{ key: 'when', label: 'When', type: 'timestamp' }]],
    [
      sleep,
      [
        { key: 'duration', label: 'Duration', type: 'duration' },
        { key: 'date', label: 'Date', type: 'date' },
      ],
    ],
    [
      expense,
      [
        { key: 'amount', label: 'Amount', type: 'number' },
        { key: 'inOut', label: 'In/Out', type: 'option', options: ['expense', 'income'] },
        { key: 'category', label: 'Category', type: 'link', linkTargetParentId: categories },
        { key: 'scheduled', label: 'Scheduled', type: 'boolean' },
        { key: 'when', label: 'When', type: 'timestamp' },
      ],
    ],
    [categories, [{ key: 'name', label: 'Name', type: 'text' }]],
    [
      mood,
      [
        { key: 'score', label: 'Score', type: 'number' },
        { key: 'date', label: 'Date', type: 'date' },
      ],
    ],
  ];
  for (const [id, defs] of schemas) {
    await setChildSchema(userId, id, defs);
  }

  /* 3 — viewSpecs last */
  const views: [string, ViewSpec][] = [
    [sleep, { lens: 'duration', groupBy: 'date', layout: 'bar' }],
    [
      expense,
      {
        lens: 'amount',
        groupBy: 'category',
        layout: 'bar',
        filter: [{ key: 'scheduled', op: 'eq', value: false }],
        overlayOwnField: 'amount', // §8a partition reading applies
      },
    ],
    [mood, { lens: 'score', groupBy: 'date', layout: 'line' }],
  ];
  for (const [id, spec] of views) {
    await setViewSpec(userId, id, spec);
  }
  return true;
}
