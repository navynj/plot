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
}

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
