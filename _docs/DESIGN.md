# PLOT — Design Document

> Rapid capture, later organization. Everything is a node; structure is optional and always deferred.

PLOT is a unified life-logging app: a digital bullet journal with Notion-like
custom fields and views. You throw thoughts in raw, and give them structure
later — or never. The same substrate holds a movie archive, a mood tracker, a
practice log, and a budget, because none of them are special: they are all just
nodes with different fields and views.

This document is the authoritative spec for the rebuild. It supersedes the
earlier separate-table model (Plot / Category / Todo / Tracker).

---

## 1. Core model — one idea

**Everything is a `node`.** A node's role is never stored. Whether something is a
category, a record, a group, or a visualization is not a type on the row — it
emerges from the node's relationships and from what it currently holds.

This is the decision the old model could not support. When Category, Plot, Todo,
and Tracker were separate tables, identity was fixed at birth: a category was
forever a category, a log forever a log. "A thrown-away note becomes a category"
was impossible without a type conversion. In the node model, promotion,
demotion, and regrouping are all just _changing links_.

A node carries:

| Aspect        | Column          | Meaning                                              |
| ------------- | --------------- | ---------------------------------------------------- |
| Own values    | `field_value`\* | what this node _is_ (amount, BPM, rating…)           |
| Child schema  | `childSchema`   | the field template this node imposes on its children |
| View spec     | `viewSpec`      | how this node visualizes the set it aggregates       |
| Belonging     | `parentId`      | its single tree parent (nullable)                    |
| Raw text      | `body`          | the original captured text                           |
| Capture stamp | `capturedAt`    | ordering infrastructure, not identity                |

\* Own values live in a separate `field_value` table, not on the node row — see §4.

---

## 2. Two kinds of relationship

There are exactly two ways one node attaches to another.

### Belonging (tree)

- `node.parentId`, a self-reference. **At most one** parent.
- This is the **only** channel through which schema is inherited.
- Gives the node its field schema (from the parent's `childSchema`) and its
  place in the hierarchy.

### Curation (graph)

- The `link` table, N:N (`sourceId → targetId`).
- **Never** inherits anything. Pure curation.
- A node can be linked into many collections at once: one movie entry can sit in
  "movies", in "August timeline", and in "all-time favorites" simultaneously.

### The governing rule

> **A node may have both a tree parent and graph parents at the same time.
> Whether inheritance fires is decided by the LINK KIND, not by the node.**

Inheritance is a property of the _link_, not of the _parent_. A tree link
inherits schema (depth-1). A graph link never does — even if the graph parent
itself holds fields. This is what lets a single node (e.g. `August`) be the tree
parent of its budget lines _and_ the graph parent of the month's transactions,
without ambiguity.

A tree parent and a graph parent can both hold their own fields and both
aggregate their children (one shared aggregation engine). The _only_ difference
between them is inheritance.

---

## 3. Inheritance rules

### Depth 1 — direct parent only

A node inherits its field schema from its **direct parent's `childSchema`**, and
from nowhere else. Ancestors are irrelevant. There is no grandparent schema.

This single rule collapses a hard problem. Because inheritance never walks a
chain:

- **Reads** are always one step. Deep trees don't slow schema resolution.
- **Moves / insertions** never trigger cascade recomputation. If a node's direct
  parent doesn't change, the node doesn't change.

Consequence: schema a node inherits and schema a node re-imposes on its own
children are **separate**. A song inherits `{genre, bpm}` from its parent
`Songs`, and separately declares `{practiceTime, date}` for its own session
children. The song's genre does not flow down to sessions. Inheritance drops
exactly one level, and each node declares its own `childSchema`.

### Layer insertion — inherit or new (two-choice)

When you insert a node between an existing parent and child (adding a layer), the
app offers exactly two choices:

1. **Inherit (default):** the new intermediate node adopts and passes through the
   parent's child schema. The grandchild's inherited schema is unchanged — a
   lossless insertion.
2. **New:** the new node declares its own child schema. The rule changes from
   this layer down.

This bounds schema editing to a specific moment (insertion) as a two-option
choice, instead of an always-open editor. It is the same containment tactic used
for views (§5): freedom is wide in _what/relationship_, and near-zero in
free-form configuration.

In the UI, `inherit` is the quiet default; `new` is an opt-in that never blocks
the drag rhythm (§6).

---

## 4. Fields

### Two distinct concepts

- **`childSchema`** (on a node): the field template this node gives its
  children. "Children of Mood have `{score:number, memo:text}`."
- **`field_value`** (rows keyed by node): a node's _own_ values. "This mood
  entry has score=4."

`childSchema` is definition; `field_value` is data. They never live in the same
place.

### Why field_value is a separate table (EAV)

Aggregation is the app's heart — budget vs actual, session-time sums, mood
averages. If own-values sat in a JSONB blob on the node row, every `sum`/`avg`/
`group by` would have to dig into JSON. Splitting values into their own table
makes aggregation native SQL with real indexes.

The key index is `(key, linkValue) → numberValue`: group transactions by their
`category` link field and sum `amount`, all in one indexed pass. This is exactly
what the budget-vs-actual view needs.

### Field types

`text, number, checkbox, boolean, option, date, timestamp, tag, link, url`

- `link` references another node (e.g. a transaction's `category` points at a
  child of the "budget categories" node). This is what keeps the budget axis and
  the spending axis on the _same_ categories.
- `number` is the aggregation type — it lands in `field_value.numberValue`.

---

## 5. Views

A node with a `viewSpec` visualizes the set it aggregates — its tree children,
its graph-linked nodes, or both.

`viewSpec = { lens, groupBy?, layout, sort?, filter?, aggregate?, overlayOwnField? }`

- **lens** — which field is the axis (a field key, or `capturedAt` / `eventDate`
  / `title`). Nodes lacking that field silently drop out of the view. This is how
  a heterogeneous collection (movies + expenses + ideas) still renders: the view
  picks what it can see.
- **layout** — a preset: `list | grid | bar | line | calendar | heatmap`. Chosen
  from a fixed set, never composed pixel by pixel.
- **groupBy / sort / filter** — group by a tag/link field, sort, filter by field
  value (e.g. `status = actual`).
- **overlayOwnField** — draws the node's _own_ value on top of the child
  aggregation (e.g. a budget line over an actual-spending bar).
- **Partition reading of a boolean filter under an overlay.** When a spec has
  `overlayOwnField` AND exactly one boolean `eq` filter, the view service reads
  the filter as a partition, not a plain exclusion: the matching set renders as
  the primary ("actual") series, and the complement is also aggregated and
  exposed as a pending series. This is what makes §8a's remaining = budget −
  actual − scheduled visible without a new spec field — a richer preset default
  per the bounded-power rule. A boolean filter without an overlay stays a plain
  exclusion.
- **Overlay resolution.** `overlayOwnField` resolves to the node's own field
  value when present; otherwise to the budget-lines pattern — the tree child
  whose `childSchema` declares both the lens and the groupBy, aggregated
  tree-side on the shared axis (§8a's August).
- **Aggregation source.** Chart views aggregate over both sources (tree
  children + graph members) as one set; lens-less nodes drop out silently,
  which keeps dual-role nodes correct without a `source` spec field. Registered
  debt: if a real case ever needs the two sides separated in one view, add
  `source` to the spec then.

### The bounded-power principle

The Add-view monster (View type × Title × Content × Computed × Col/Row) was
killed on purpose. Views give freedom in **what you gather and through which
lens**, and **zero** freedom in pixel arrangement. The app owns visual
composition; the user owns relationships and perspective.

### Date is storage, not identity

Storage is pure UTC timestamps; the user's (auto-detected) timezone is a
display/boundary lens only — traveling re-lenses past entries (a Seoul 11 PM
capture reads as that morning in New York), which is correct and needs no
migration.

Every node has `capturedAt` (creation stamp — the free universal ordering key)
and an optional `eventDate` (when it actually happened). Whether a view is
"date-bound" is decided by the _view_, not the entry:

- time-axis views (timeline, mood line, calendar) sort by date;
- collection views (movies, books) ignore date and sort by a field (rating,
  status, tag).

The same movie node reads as "noted on May 3" in a timeline and "★4.5,
watched, thriller" in a collection. One node, two lenses. This is the bullet
journal's Daily Log vs Collections split, expressed as two readings rather than
two stores.

---

## 6. Surface concepts

The data model is powerful, therefore dangerous. The UX rule: **the power is
preserved, but the user meets it one piece at a time.** The skeleton is heavy;
the surface stays light. Every deep choice sits one opt-in step to the side.

### Capture

Raw text first; structure (category, fields) is collapsed and optional. Never
forced. Structuring may happen at capture, at triage, or never — three paths to
the same entry. A node can live with no parent and no fields.

**Contextual capture — position is inherited, not forced.** Capture inherits the
current context node as `parentId`: from the home it is `null` (→ inbox); from
inside a node (e.g. inside `Rio Funk`) the new node's `parentId` is that node.
The user still only typed text — no category was chosen, no field filled. The
parent comes free from _where they are standing_, so this does not violate the
raw-first rule. It is top-down capture: doing position triage up front by
throwing the entry directly into its room.

Two consequences, both deliberate:

- **Inherited schema, but values are never forced.** When a parent is auto-
  attached, its `childSchema` is inherited (per §3), so the new node _wears_ those
  fields — but their values stay empty. A `required` field in the parent's
  `childSchema` does NOT block capture; it is filled later in field triage. (Raw
  "30분" does not auto-become `practiceTime=30` — that is deferred NL assist.)
  Context gives position only, never values.
- **Context is escapable in one tap.** Inside a node, the default is to belong to
  that node, but capture offers a one-tap opt-out to throw the entry raw (no
  parent → inbox). Context is a convenience, not a cage.

### Inbox = a filter, not a container

The inbox is not a place things pile up. It is the filter `parentId IS NULL AND
rank IS NULL` — "no parent and never positioned." A confirmed root is also
parent-less but carries a rank among roots (positioning it was the act of
confirming), so it leaves the inbox while staying fully derived: no flag, no
table.
The permanent home of every entry is the timeline (ordered by `capturedAt`); the
inbox is just the still-unattached slice. An un-triaged entry is **not a debt** —
it is a complete raw note. Nothing accrues, because no container holds anything.

### Triage — two separate rituals

A raw node is incomplete in two independent ways: **no position** (no parent) or
**no structure** (no field values). These are different in kind, so triage
splits in two:

- **Position triage** — spatial/relational. Drag to assign a parent, promote, or
  group. Resolved by drag.
- **Field triage** — semantic/data. Fill field values, promote text fragments
  into fields. Real input; not a drag.

Graph curation is a plus-alpha, excluded from triage.

#### Position triage interaction (validated by mockup)

- Top: the current tree (top-level nodes, accordion-expandable to any depth).
- Bottom: inbox leaves (position-undetermined nodes).
- Drag a leaf; the **landing point** selects the action — one drag grammar, three
  outcomes (isomorphic to the data model's "top-down and bottom-up are two ends
  of one operation"):
  - onto a node → child (parent assignment)
  - between nodes → sibling insert / promotion
  - multi-select → batch to one parent
  - stack / drop on empty → new group (bottom-up bundling)
- **Depth is set by horizontal position**, order by vertical position — this
  resolves the sibling-vs-child ambiguity.
- **Root confirmation** is a distinct top drop-zone: "no parent (undetermined,
  stays in inbox)" and "is root (confirmed, leaves inbox)" are the same
  parent-less state but reached by different landing points.
- On promotion, schema defaults to `inherit`; `new` is an inline opt-in that
  never stops the drag.
- **Fully bidirectional:** tree nodes are also draggable (via a left grip handle
  — a beat more deliberate than inbox chips, to avoid mis-grabs while scrolling a
  long tree). Moving a parent carries its subtree. Dragging a tree node down to
  the inbox detaches it back to undetermined. Dropping into a node's own subtree
  is forbidden (cycle prevention).

#### One action model, many input surfaces

The drag grammar is one _action model_: pick up → set insertion point (vertical)
and depth (horizontal) → commit. Mobile expresses it with finger position;
desktop with the keyboard (click to select, arrow keys to move — up/down =
insertion point, left/right = depth, Enter = commit, Esc = cancel). A third
surface is a **searchable picker** (command-palette style): from a node's
detail or a list row, search a node by name (showing its tree path) and pick it
as the new parent — fastest when the target is already known, and available
outside the triage screen. The picker hides the node's own subtree from
results, mirroring how drag physically excludes it. All surfaces are optional
entry points into the same operation; none replaces the triage screen.

Every surface — drag, keyboard, picker, and any future input — goes through the
single `triage.reparent()` entry point. Cycle rejection, subtree carrying, and
schema handling live there once; input surfaces are thin adapters.

### Home

Two homes, toggled: a **time-stream home** (leaf / bottom-up, the default) and a
**top-node grid home** (root / top-down). Date is storage metadata; the home is
not a river of everything unless the user picks the stream view. The grid tiles
top-level nodes as rooms you enter, each already filled by its own view.

### Node detail — single adaptive layout

Opening any node shows **one frame**: header, then a vertical stack of three
sections — **own values → view → children**. Sections that don't apply simply
don't appear. A leaf shows only own values; a grown node (`Rio Funk` with
sessions) shows all three; the frame **grows as the node grows**. Layout is never
chosen by node "type" — that would reintroduce fixed identity. What's shown is
driven by what the node currently has.

---

## 7. Drizzle schema

Stack: **Drizzle + Neon (Postgres) + Vercel (Node serverless)**.

See [`schema.ts`](./schema.ts) for the full definitions. Summary:

### `node`

Holds `childSchema` (JSONB `FieldDef[]`), `viewSpec` (JSONB), `parentId`
(self-ref, nullable → inbox condition), `rank` (fractional sibling order),
`body`, `capturedAt`, `eventDate`, `schemaMode` (`inherit | new`).

Indexes: `(user_id)`, `(parent_id)`, `(user_id, parent_id)` for inbox,
`(user_id, captured_at)` for the timeline.

### `link`

Curation graph. PK `(sourceId, targetId)`, indexed both directions. No
inheritance, ever.

### `field_value`

EAV. One row per `(nodeId, key)`, unique. Typed columns
(`textValue / numberValue / boolValue / dateValue / linkValue`); one populated
per row. `numberValue` is the aggregation column; `linkValue` references another
node for group-by-category. Key index: `(key, linkValue)`.

---

## 8. Worked examples

### 8a. During budget (aggregation + goal-vs-actual)

The stress test: goals (budget) compared against actuals (spending), including
not-yet-spent (scheduled) amounts.

**Belonging tree (schema inherited here):**

```
Expense (node) — childSchema: {
    category   : link  -> child of "Budget categories"
    inOut      : option (expense | income)
    amount     : number (>= 0)
    scheduled  : boolean
  }
  ├─ Coffee   values: {category: 식비, inOut: expense, amount: 4500,  scheduled: false}  eventDate: 8/3
  └─ Taxi    values: {category: 교통, inOut: expense, amount: 12000, scheduled: true}   eventDate: 8/5

Budget categories (node) — childSchema: { name: text, icon: icon }
  ├─ 식비 (🍚)
  └─ 교통 (🚕)
```

The expense's date is `eventDate` (node meta, set by the capture date
control), not a schema field — the aggregation date meta-axis
(`groupBy: 'eventDate'`) covers everything a `when` field would have.

**August as a node that is BOTH a tree parent and a graph parent:**

```
August (node)
  · own fields (field_value): startDate=8/1, endDate=8/31
  · TREE children  (inheriting): a "Budget" category child holding budget lines
        Budget (node) — childSchema: { category: link, amount: number }
          ├─ (식비, 300000)
          └─ (교통, 100000)
  · GRAPH links (no inheritance): materialized `link` rows to the relevant
      Expense nodes. `link` has NO predicate — these rows are created by a user
      or an assist action, not evaluated dynamically. (Rule-based collection
      such as "expenses where when ∈ [start,end]" is instead expressed by this
      node's `viewSpec.filter`, not by links. Split to confirm at Phase 4:
      `link` = hand-picked curation; `viewSpec.filter` = rule-based gathering.)
  · viewSpec: { lens: amount, groupBy: category, layout: bar,
                filter: [scheduled = false], overlayOwnField: <budget> }
```

Because budget lines and expense entries both reference the **same** category
nodes via `link` fields, budget and actual share one axis. `August` computes
locally within its own scope:

- actual = Σ(`amount` where `scheduled=false`), grouped by `category`
- scheduled = Σ(`amount` where `scheduled=true`)
- remaining = budget − actual − scheduled

No cross-set join, no special "computed node" — the two operands (own budget,
child aggregate) sit under one node, and both are the same "Σ amount by category"
operation. Over/under/scheduled-remaining all fall out as subtractions of two
like-shaped aggregates.

`scheduled → actual` confirmation is just toggling a boolean field on the entry.

### 8b. Practice log (identity shift + multi-layer tree)

Demonstrates "a thrown note becomes a category" and arbitrary-depth trees with
per-layer schema.

```
Bass (node)
  ├─ Songs (node) — childSchema: { bpm: number, genre: text, isCover: boolean }
  │    ├─ Rio Funk  own: {bpm:85, genre:Funk, isCover:true}
  │    │             childSchema: { practiceTime: number, date: date, memo: text }
  │    │    ├─ (practiceTime:30, date:8/3, memo:"slap")   ← session
  │    │    └─ (practiceTime:20, date:8/7)
  │    └─ Hysteria  own: {bpm:120, genre:Rock, isCover:true}
  └─ Basics (node) — childSchema: { difficulty: option, targetTempo: number }
       └─ Cromatic
```

Key points this validates:

- `Rio Funk` is **content and container**: it holds own values (bpm, genre) and
  declares a child schema (sessions). Same capability as `August`.
- Schema is per-node, per-layer: `Songs` and `Basics` are siblings but give
  different child schemas. Inheritance is depth-1, so this is clean.
- A raw "Rio Funk 30분" thrown to the inbox is later dragged under `Rio Funk`;
  the "30분" text is then promoted into the `practiceTime` field value during
  **field triage** (the real cost of "raw first" surfaces here — a text→field
  promotion step).
- `Rio Funk` aggregates sessions with `viewSpec: { lens: practiceTime, layout:
bar }`.

---

## 9. Migration from the old Prisma model

The old schema (`Plot`, `Todo`, `Category`, `Tracker` as separate tables, with
`fieldValues` JSON on `Plot`) collapses into `node` + `link` + `field_value`.
The old migrations do not carry over structurally; this is a rebuild, not an
`alter`.

### Mapping

| Old (Prisma)                            | New (Drizzle)                                                   |
| --------------------------------------- | --------------------------------------------------------------- |
| `Category` row                          | a `node` (its `childSchema` = the category's `Field[]`)         |
| `Category.field` definitions            | `node.childSchema` (`FieldDef[]`)                               |
| `Plot` / `Todo` row                     | a `node` with `parentId` = the category node                    |
| `Plot.fieldValues` (JSON)               | expanded into `field_value` rows (one per key)                  |
| `Plot.categoryId`                       | `node.parentId`                                                 |
| `Plot.date` / `dueDate`                 | `node.eventDate` (and `capturedAt` from `createdAt`)            |
| `Plot.todayRank/inboxRank/categoryRank` | `node.rank`; inbox = `parentId IS NULL`                         |
| `Tracker` / `TrackLog`                  | a `node` with a `viewSpec` over its child log nodes             |
| `Goal` / `GoalLog`                      | a `node` (goal) + `field_value`; progress via child aggregation |

### Procedure (one-off script)

1. For each user, create a `node` per `Category`, moving its field definitions
   into `childSchema`.
2. For each `Plot`/`Todo`, create a `node` with `parentId` = the mapped category
   node, `body` = title/description, `capturedAt` = `createdAt`,
   `eventDate` = `date`/`dueDate`.
3. Explode each `Plot.fieldValues` JSON entry into a `field_value` row, routing
   the value into the typed column matching the field's type; category-like
   references become `linkValue`.
4. Convert `Tracker`/`Goal` definitions into nodes carrying a `viewSpec`.
5. Drop `todayRank`/`inboxRank`/`categoryRank` in favor of a single `rank`;
   inbox membership is now derived (`parentId IS NULL`), not stored.

### Notes

- Because inheritance is depth-1 and schema lives on the parent's `childSchema`,
  a migrated child that had ad-hoc extra keys simply gets extra `field_value`
  rows; they render if the parent later declares matching fields, and are
  harmless otherwise.
- The `link` table starts empty — old data had no curation graph. Collections
  are created by users post-migration.

---

## Appendix — decision log (why, in one line each)

- **Everything is a node** — so identity can be conferred by relationship, not
  fixed at birth; enables top-down and bottom-up as one operation.
- **Two link kinds, inheritance decided by the link** — so a node can be tree
  parent and graph parent at once without ambiguity.
- **Depth-1 inheritance** — so deep/re-arranged trees never trigger cascade
  recomputation; moves stay cheap.
- **Layer insertion = inherit/new** — so schema editing is a bounded two-choice
  moment, not an open editor.
- **field_value as EAV** — so aggregation (the app's hot path) is native indexed
  SQL.
- **viewSpec = lens + layout preset** — so views have relational freedom and
  zero pixel-composition freedom (kills the Add-view monster).
- **Inbox = `parentId IS NULL` filter** — so nothing piles up; un-triaged is not
  debt.
- **Two triages (position / field)** — because "no position" and "no structure"
  are different kinds of incompleteness.
- **Single adaptive node-detail layout** — so the screen grows with the node
  instead of branching by fixed type.
- **Drizzle + Neon + Vercel** — SQL-close ORM fits the self-referential tree +
  JSONB + EAV model; Node serverless removes the edge-driver constraint.
