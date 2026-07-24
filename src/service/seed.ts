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
  // A4: receipts are transcribed as-is — a Canadian (pre-tax) receipt gets a
  // Tax line; a Korean (tax-inclusive) one doesn't. No tax math, no rate, no
  // region; the Tax category sum surfaces total tax paid for free.
  { title: 'Tax', icon: '🧾' },
];

export async function ensureSeed(userId: string): Promise<boolean> {
  if (await nodeRepo.hasAny(userId)) return false;

  const create = async (
    title: string,
    icon: string,
    parentId: string | null,
    opts: { attached?: boolean } = {}
  ) => {
    const node = await nodeRepo.create({
      userId,
      title,
      icon,
      attached: opts.attached ?? false,
      capturedAt: new Date(),
    });
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
  const mood = await create('Mood', '🙂', lifestyle);
  // A1/A3: categories and Budget are ATTACHED appendages of Expense — under
  // it in the tree, but not its records (no schema inheritance, no aggregate
  // membership, no grid tile). Budget holds month-stamped budget lines
  // permanently; there is no monthly node creation.
  const categories = await create('Expense categories', '🗂️', expense, { attached: true });
  const budget = await create('Budget', '📊', expense, { attached: true });
  for (const category of EXPENSE_CATEGORIES) {
    await create(category.title, category.icon, categories);
  }

  /* 2 — childSchemas. Sleep/Mood need no date field: their views group on
     the eventDate META-AXIS (falls back to capturedAt), so a bare capture
     lands on today with zero field-filling. */
  const schemas: [string, FieldDef[]][] = [
    // Done is an ordinary checkbox, shown on main so it can be toggled right on
    // the stream (no special uneditable field).
    [todo, [{ key: 'done', label: 'Done', type: 'checkbox', showOnMain: true, icon: 'square-check' }]],
    [schedule, [{ key: 'when', label: 'When', type: 'timestamp' }]],
    [sleep, [{ key: 'duration', label: 'Duration', type: 'duration' }]],
    [
      expense,
      [
        { key: 'amount', label: 'Amount', type: 'number' },
        {
          key: 'inOut',
          label: 'In/Out',
          type: 'option',
          options: ['expense', 'income'],
          defaultValue: 'expense',
        },
        { key: 'category', label: 'Category', type: 'link', linkTargetParentId: categories },
        { key: 'scheduled', label: 'Scheduled', type: 'checkbox' },
        // no `when` field: the expense's date is eventDate (capture date
        // control), and the date meta-axis covers aggregation
      ],
    ],
    [categories, [{ key: 'name', label: 'Name', type: 'text' }]],
    [
      // A3: budget lines share the category axis with expenses (same link
      // scope), carry a number amount, and are stamped with the month they
      // budget — the period lens reads that stamp.
      budget,
      [
        { key: 'category', label: 'Category', type: 'link', linkTargetParentId: categories },
        { key: 'amount', label: 'Amount', type: 'number' },
        { key: 'month', label: 'Month', type: 'date' },
      ],
    ],
    [mood, [{ key: 'score', label: 'Score', type: 'number', min: -5, max: 5, step: 1 }]],
  ];
  for (const [id, defs] of schemas) {
    await setChildSchema(userId, id, defs);
  }

  /* 3 — viewSpecs last */
  const views: [string, ViewSpec][] = [
    [sleep, { lens: 'duration', groupBy: 'eventDate', layout: 'bar' }],
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
    [mood, { lens: 'score', groupBy: 'eventDate', layout: 'line' }],
  ];
  for (const [id, spec] of views) {
    await setViewSpec(userId, id, spec);
  }
  return true;
}
