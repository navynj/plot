import {
  pgTable,
  text,
  timestamp,
  jsonb,
  boolean,
  integer,
  numeric,
  index,
  uniqueIndex,
  primaryKey,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';

/**
 * PLOT — redesigned data model.
 *
 * One idea only: everything is a `node`. A node's role (leaf, category,
 * collection, visualization) is never stored — it emerges from its relationships
 * and from what it currently holds. There are no separate Plot/Category/Todo/
 * Tracker tables anymore.
 *
 * Two kinds of relationship:
 *   - Belonging (tree): `node.parentId` self-reference, max one parent.
 *     The ONLY channel through which schema is inherited. Depth-1 only:
 *     a node reads its direct parent's `childSchema`, never an ancestor's.
 *   - Curation (graph): the `link` table, N:N. Never inherits anything.
 *
 * A node may be a tree parent AND a graph parent at the same time.
 * Whether inheritance fires is decided by the LINK KIND, not by the node.
 */

/* ------------------------------------------------------------------ */
/* Field type vocabulary                                               */
/* ------------------------------------------------------------------ */

export const FIELD_TYPES = [
  'text',
  'number',
  'checkbox',
  'boolean',
  'option', // single choice from a fixed list
  'date',
  'timestamp',
  'tag', // free multi-value label
  'link', // reference to another node (e.g. transaction.category -> a category node)
  'url',
  'duration', // stored in numberValue as MINUTES; aggregation works unchanged
  'computed', // a duration derived from two timestamp fields; MINUTES in numberValue
] as const;
export type FieldType = (typeof FIELD_TYPES)[number];

/**
 * A single field definition a node declares for ITS CHILDREN.
 * Stored as an array in `node.childSchema`. This is the "schema" a child
 * wears when it belongs to this node. It is NOT the node's own value.
 *
 * REGISTERED DEBT (Phase 9): no min/max/step/unit expressiveness — old Mood
 * was a −5..+5 step-1 scale, old Expense had a currency prefix. Park until a
 * preset needs it; the Mood scale is the likely first repayment.
 */
export interface FieldDef {
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  options?: string[]; // for type 'option'
  linkTargetParentId?: string; // for type 'link': restrict to children of this node
  /** pre-fill for new-child forms — a real value once saved, not a phantom */
  defaultValue?: string | number | boolean;
  /** number-type constraints (any subset). Same type, same numberValue
   *  storage — a constrained mood score and a free amount differ only in
   *  the editor they wear, exactly like duration shares number's storage. */
  min?: number;
  max?: number;
  step?: number;
  /** Computed field (type 'computed'): its value is a duration derived from two
   *  other timestamp fields in the SAME childSchema (`to` − `from`), stored as
   *  MINUTES in numberValue exactly like `duration`, so aggregation is
   *  unchanged. Manual entry is honored only when the two sources are not both
   *  filled. A `to > from` validation rule (on the `to` field) keeps the pair
   *  ordered, so the computed duration is always positive (no overnight wrap). */
  compute?: { from: string; to: string; unit?: 'minutes' };
  /** Declarative, bounded validation rules checked at save (DESIGN §5's
   *  bounded power). Attached to the field they constrain; only fire when the
   *  compared values are actually present (empty is always legal, §6-capture). */
  validate?: ValidationRule[];
}

/**
 * A single bounded validation rule attached to a field. Compares the field it
 * is attached to against EITHER another field's value OR a constant (exactly
 * one of `otherField` / `value`). A small vocabulary, never free-form code —
 * this is DESIGN §5's bounded-power principle applied to consistency checks.
 * Example: `wakeUpAt.validate = [{ op: 'gt', otherField: 'sleepAt' }]` reads
 * "wakeUpAt must be greater than sleepAt".
 */
export interface ValidationRule {
  op: 'gt' | 'gte' | 'lt' | 'lte' | 'eq' | 'neq';
  otherField?: string; // compare to another field's value, OR
  value?: string | number | boolean; // compare to a constant (exactly one)
  message?: string; // optional custom error text shown on violation
}

export const VALIDATION_OPS = ['gt', 'gte', 'lt', 'lte', 'eq', 'neq'] as const;

/** The fixed layout preset vocabulary (DESIGN §5) — runtime const so the
 *  layout registry can be completeness-tested, like FIELD_TYPES. */
export const VIEW_LAYOUTS = ['list', 'grid', 'bar', 'line', 'calendar', 'heatmap'] as const;
export type ViewLayout = (typeof VIEW_LAYOUTS)[number];

/**
 * viewSpec — how a node renders the set it aggregates (its tree children
 * and/or its graph-linked nodes). Deliberately bounded: pick a lens + a
 * layout preset. No pixel-level composition (that was the Add-view monster).
 */
export interface ViewSpec {
  lens: string | 'capturedAt' | 'eventDate' | 'title'; // field key to axis on
  groupBy?: string; // field key to group by (e.g. a tag/link field)
  layout: ViewLayout;
  sort?: { by: string; dir: 'asc' | 'desc' };
  filter?: ViewFilter[];
  aggregate?: 'sum' | 'avg' | 'count' | 'none';
  // for visualization nodes that overlay their OWN value (e.g. a budget line)
  overlayOwnField?: string;
}
export interface ViewFilter {
  key: string;
  op: 'eq' | 'neq' | 'gt' | 'lt' | 'gte' | 'lte' | 'in' | 'between';
  value: unknown;
}

/* ------------------------------------------------------------------ */
/* auth — Auth.js v5 adapter tables (infrastructure, not domain)       */
/* ------------------------------------------------------------------ */

export const user = pgTable('user', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => createId()),
  name: text('name'),
  email: text('email').unique(),
  emailVerified: timestamp('email_verified', { withTimezone: true }),
  image: text('image'),
});

export const account = pgTable(
  'account',
  {
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    type: text('type').$type<'oauth' | 'oidc' | 'email' | 'webauthn'>().notNull(),
    provider: text('provider').notNull(),
    providerAccountId: text('provider_account_id').notNull(),
    refresh_token: text('refresh_token'),
    access_token: text('access_token'),
    expires_at: integer('expires_at'),
    token_type: text('token_type'),
    scope: text('scope'),
    id_token: text('id_token'),
    session_state: text('session_state'),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.provider, t.providerAccountId] }),
  })
);

export const session = pgTable('session', {
  sessionToken: text('session_token').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  expires: timestamp('expires', { withTimezone: true }).notNull(),
});

/**
 * Per-user undo/redo stacks for triage operations (reparent/delete). DB-backed
 * because serverless instances don't share memory — an in-memory stack would
 * evaporate between lambda invocations. Payload holds the exact inverse
 * (previous parentId+rank per node; delete restoration data).
 */
export const undoOp = pgTable(
  'undo_op',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    stack: text('stack').$type<'undo' | 'redo'>().notNull(),
    kind: text('kind').$type<'reparent' | 'delete' | 'create'>().notNull(),
    payload: jsonb('payload').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    byUserStack: index('undo_user_stack_idx').on(t.userId, t.stack, t.createdAt),
  })
);

export type UndoOp = typeof undoOp.$inferSelect;

export const verificationToken = pgTable(
  'verification_token',
  {
    identifier: text('identifier').notNull(),
    token: text('token').notNull(),
    expires: timestamp('expires', { withTimezone: true }).notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.identifier, t.token] }),
  })
);

/* ------------------------------------------------------------------ */
/* node                                                                */
/* ------------------------------------------------------------------ */

export const node = pgTable(
  'node',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),

    // presentation
    title: text('title'), // nullable: a raw capture may have only `body`
    icon: text('icon'),
    body: text('body'), // raw captured text; structure is optional & later

    // belonging (tree). nullable => this is the inbox condition.
    parentId: text('parent_id').references((): AnyPgColumn => node.id, {
      onDelete: 'set null',
    }),
    rank: text('rank'), // fractional index for sibling ordering

    // what this node declares for its children (the inherited schema)
    childSchema: jsonb('child_schema').$type<FieldDef[]>().default([]),

    // how this node visualizes the set it aggregates
    viewSpec: jsonb('view_spec').$type<ViewSpec | null>(),

    // time. every node gets a capture stamp (ordering infra, not identity).
    capturedAt: timestamp('captured_at', { withTimezone: true }).notNull().defaultNow(),
    eventDate: timestamp('event_date', { withTimezone: true }), // optional real-world date

    // when a node was placed under a parent, was its schema inherited or fresh?
    schemaMode: text('schema_mode').$type<'inherit' | 'new'>().default('inherit'),

    // timeline visibility: 'auto' (derived — structural nodes hide), or the
    // manual overrides 'shown' | 'hidden'. Only the timeline reads this.
    timelineVisibility: text('timeline_visibility')
      .$type<'auto' | 'shown' | 'hidden'>()
      .notNull()
      .default('auto'),

    // pure user preference (legitimately stored, not derivable): which capture
    // chip tier a node sits in — 'favorite' (top) or 'ongoing' (a temporary
    // pin for an in-progress project); null = not pinned (B2). Was a boolean;
    // old true migrated to 'favorite'.
    pinned: text('pinned').$type<'favorite' | 'ongoing'>(),

    // ATTACHED (a stored flavor of the tree link, not a node type): an
    // attached child sits under its parent in the tree but is its APPENDAGE,
    // not an instance of the parent's schema. It does NOT inherit the
    // parent's childSchema (the one documented depth-1 exception —
    // resolveSchema returns [] for it), and it is excluded from the parent's
    // records: child list, aggregates, walks, bulk selection, grid tiles. It
    // still declares and gives its OWN childSchema to its OWN children like
    // any node. Default false — a normal (inheriting) tree child.
    attached: boolean('attached').notNull().default(false),

    // how the node was BORN (a stored fact, like pinned — it replaced the
    // body-null derivation, which stopped being derivable once captures
    // started splitting their first line into title): captured entries are
    // records, constructed nodes are structure. Only the timeline's auto
    // rule reads it. Default 'constructed' so every structural creator
    // (rooms, layers, groups, create-in-place, seed — and future ones) is
    // constructed without saying so; captureNode is the single place that
    // writes 'captured'.
    origin: text('origin').$type<'captured' | 'constructed'>().notNull().default('constructed'),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    // soft delete (ROADMAP Phase 1); reads filter on IS NULL
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => ({
    byUser: index('node_user_idx').on(t.userId),
    byParent: index('node_parent_idx').on(t.parentId),
    // inbox lookup: user's nodes with no parent
    inbox: index('node_inbox_idx').on(t.userId, t.parentId),
    byCaptured: index('node_captured_idx').on(t.userId, t.capturedAt),
  })
);

/** Domain row types — import these anywhere; the table objects stay repository-only. */
export type Node = typeof node.$inferSelect;
export type NewNode = typeof node.$inferInsert;

/** The typed columns of `field_value`; each field type routes to exactly one. */
export type FieldValueColumn =
  'textValue' | 'numberValue' | 'boolValue' | 'dateValue' | 'linkValue';

/** A field value as domain code sees it (numeric comes back as `number`). */
export type FieldPrimitive = string | number | boolean | Date;

/** A validated write, routed to its typed column. Discriminated so the
 *  repository can store without re-checking value shapes. */
export type TypedFieldWrite =
  | { column: 'textValue' | 'linkValue'; value: string }
  | { column: 'numberValue'; value: number }
  | { column: 'boolValue'; value: boolean }
  | { column: 'dateValue'; value: Date };

/* ------------------------------------------------------------------ */
/* link — curation graph (no inheritance ever)                         */
/* ------------------------------------------------------------------ */

export const link = pgTable(
  'link',
  {
    sourceId: text('source_id')
      .notNull()
      .references(() => node.id, { onDelete: 'cascade' }),
    targetId: text('target_id')
      .notNull()
      .references(() => node.id, { onDelete: 'cascade' }),
    rank: text('rank'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.sourceId, t.targetId] }),
    bySource: index('link_source_idx').on(t.sourceId),
    byTarget: index('link_target_idx').on(t.targetId),
  })
);

/* ------------------------------------------------------------------ */
/* field_value — EAV, the aggregation substrate                        */
/* ------------------------------------------------------------------ */

/**
 * A node's OWN field values, one row per (node, key). Split out of the node
 * row so that group-by / sum / avg / filter run as native SQL with indexes —
 * this is the app's hot path (budget vs actual, session-time sums, mood avg).
 *
 * Typed columns are used per field type; only one is populated per row.
 * `numberValue` is the aggregation column; `linkValue` references another node
 * (e.g. a transaction's category), enabling group-by-category without JSON digging.
 */
export const fieldValue = pgTable(
  'field_value',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),
    nodeId: text('node_id')
      .notNull()
      .references(() => node.id, { onDelete: 'cascade' }),
    key: text('key').notNull(), // matches a FieldDef.key from the parent's childSchema

    textValue: text('text_value'),
    numberValue: numeric('number_value'), // sums/avgs land here
    boolValue: boolean('bool_value'),
    dateValue: timestamp('date_value', { withTimezone: true }),
    linkValue: text('link_value').references((): AnyPgColumn => node.id, {
      onDelete: 'set null',
    }),
  },
  (t) => ({
    byNode: index('fv_node_idx').on(t.nodeId),
    byKey: index('fv_key_idx').on(t.key),
    // fast group-by-category-then-sum: (key, linkValue) -> numberValue
    byKeyLink: index('fv_key_link_idx').on(t.key, t.linkValue),
    uniqNodeKey: uniqueIndex('fv_node_key_uniq').on(t.nodeId, t.key),
  })
);

export type FieldValue = typeof fieldValue.$inferSelect;

export type Link = typeof link.$inferSelect;

/* ------------------------------------------------------------------ */
/* relations                                                           */
/* ------------------------------------------------------------------ */

export const nodeRelations = relations(node, ({ one, many }) => ({
  parent: one(node, {
    fields: [node.parentId],
    references: [node.id],
    relationName: 'tree',
  }),
  children: many(node, { relationName: 'tree' }),
  outgoingLinks: many(link, { relationName: 'source' }),
  incomingLinks: many(link, { relationName: 'target' }),
  values: many(fieldValue),
}));

export const linkRelations = relations(link, ({ one }) => ({
  source: one(node, {
    fields: [link.sourceId],
    references: [node.id],
    relationName: 'source',
  }),
  target: one(node, {
    fields: [link.targetId],
    references: [node.id],
    relationName: 'target',
  }),
}));

export const fieldValueRelations = relations(fieldValue, ({ one }) => ({
  node: one(node, { fields: [fieldValue.nodeId], references: [node.id] }),
}));
