# ROADMAP — PLOT rebuild

Build order is **vertical through the skeleton**, not horizontal by layer. Each
phase is a thin slice that actually runs end to end, so integration risk is paid
down continuously instead of at the end. Domain-core phases carry required tests
(see CLAUDE.md §5); UI phases move fast.

Read [`DESIGN.md`](./DESIGN.md) and [`schema.ts`](./schema.ts) first. Each phase
lists its DESIGN.md anchor.

Legend: 🧪 = required tests · 🎨 = UI, tests optional · ⚙️ = infra/no-UI.

---

## Phase 0 — Project skeleton ⚙️

Goal: an empty Next.js app that boots on Vercel and talks to Neon.

- Next.js (App Router, TS strict) + Tailwind, ESLint/Prettier.
- Drizzle + Neon: `db/` client, `schema.ts` moved in from `_docs/`, `drizzle-kit`
  config, first migration applied to a Neon dev branch.
- Enforce the layer dirs from CLAUDE.md §1 (`repository/ service/ app/
components/ lib/`) with a lint rule or a README stub in each.
- CI: typecheck + test runner (Vitest) wired, even with zero tests.

Done when: `pnpm dev` runs, a health route reads one row from Neon.

---

## Phase 1 — Node CRUD + capture ⚙️🎨

_(DESIGN §1, §6-capture)_ The absolute core: create, read, update, soft-delete a
node. Raw capture path.

- `repository/nodeRepo`: create, byId, update, delete, `findInbox(userId)`
  (`parentId IS NULL`), `findChildren(parentId)`, `findTimeline(userId)` (by
  `capturedAt`).
- `service/node`: thin create/update wrapping the repo; sets `capturedAt`.
- Capture UI: one text box, structure collapsed. A raw node is title/`body` only,
  no parent, no fields.
- Timeline home (default) listing captured nodes; inbox view = the `findInbox`
  filter.

Done when: you can throw raw text in and see it in the timeline and inbox.

---

## Phase 1.5 — Auth ⚙️🧪

_(inserted before fields: `userId` scoping must be real before values, triage,
and views multiply the call sites that read it)_ Replace the `dev-user` stopgap
with real authentication.

- **Auth.js v5 + Drizzle adapter + Google OAuth.** Add the adapter tables
  (`user`, `account`, `session`, `verificationToken`) to `schema.ts`; generate +
  apply the migration.
- `node.userId` becomes a real FK to `user.id` (it was a bare `text` stopgap).
  Migrate existing `dev-user` rows to a seeded dev user, or reset the dev branch.
- **Session is read only at entry points** (RSC / route / server action), which
  resolve `userId` and inject it downward. `service/` and `repository/` never
  read the session — they receive `userId` as a parameter. Replace
  `lib/currentUser.ts` accordingly. (See CLAUDE.md §1.)
- Protect routes: unauthenticated users hit a sign-in page (reuse the old
  `signIn('google')` flow, now Drizzle-backed).
- 🧪 an ownership test: a user's queries never return another user's nodes
  (the `userId` scope actually isolates).

Done when: Google sign-in works, `node.userId` references a real user, and the
ownership test passes. `dev-user` is gone.

---

## Phase 1.6 — shadcn/ui adoption ⚙️🎨

_(inserted before fields: the UI vocabulary must be fixed before Phase 2+ pours
out field editors, triage, and views)_ Adopt shadcn/ui as the primitive layer and
migrate the small existing UI onto it, so there's one component vocabulary, not
two.

- Init shadcn/ui (Tailwind + CSS-variable theme already in place). Settle the
  design tokens once: color, radius, base font. Components land in
  `src/components/ui/`.
- Pull the primitives Phase 2+ will need: button, input, textarea, label,
  select, dialog, popover, dropdown-menu, checkbox, card, sheet. (Only what's
  imminently used — don't bulk-import the whole catalog.)
- **Migrate existing UI** (capture form, sign-in page, timeline/inbox rows) onto
  the shadcn primitives. Existing UI is minimal, so this is cheap now and avoids
  a mixed-vocabulary codebase later.
- Boundary (CLAUDE.md §4): shadcn components live in `components/ui/` and stay
  generic. Feature components compose them; never push feature/domain logic into
  a `ui/` primitive.

Done when: capture, sign-in, and the lists render via shadcn primitives; no
hand-rolled UI remains; tokens are documented.

---

## Phase 2 — Fields: childSchema + field_value 🧪

_(DESIGN §4)_ Give nodes structure. This is the first domain-core phase.

- `repository/fieldValueRepo`: upsert `(nodeId, key)`, read by node, and the
  typed columns per field type.
- `service/inheritance.resolveSchema(node)`: returns the field defs a node wears
  = its **direct parent's** `childSchema`. 🧪 depth-1 only; ancestor schema must
  not leak.
- Field registry (CLAUDE.md §2): type → { render, edit, valueColumn }. Adding a
  type = one `register` call.
- Field-editing UI: given a node's resolved schema, render editors; write values
  to `field_value`.

Done when: a node under a parent shows the parent-defined fields, and values
persist. Tests green for `resolveSchema`.

---

## Phase 3 — Belonging tree + position triage 🧪🎨

_(DESIGN §2-tree, §3, §6-triage)_ The heart of "organize later".

- `service/triage`: `reparent(node, newParent, depth)`, `insertLayer(inherit|
new)`, `group(nodes)`, `detachToInbox(node)`. 🧪 **cycle rejection**, subtree
  carries on move, insert-layer inherit vs new.
- `repository/nodeRepo`: subtree fetch, fractional `rank` ordering, batch
  reparent.
- Position triage UI (from the validated mockup): tree on top (accordion), inbox
  leaves below, drag to land (child / sibling / promote / group), horizontal =
  depth, root drop-zone, `inherit` default with `new` inline opt-in. Bidirectional
  (grip handle on tree nodes; drag down to inbox to detach).
- Headless `useTriageMove` hook (CLAUDE.md §4): one action model, pointer +
  keyboard adapters.
- Parent picker (searchable, command-palette style; shadcn Command): a third
  input surface for the same `triage.reparent()` — reachable from node detail
  and list rows, hides the node's own subtree from results. Optional entry
  point; does not replace the triage screen.

Done when: raw inbox nodes can be dragged into the tree and back, promoted, and
grouped, with cycles blocked. Tests green for triage ops.

---

## Phase 4 — Graph links (curation) ⚙️🎨

_(DESIGN §2-graph)_ The second attachment kind.

- `repository/linkRepo`: link/unlink, list by source/target.
- `service`: enforce "graph links never inherit" (they only reference).
- Minimal UI: add a node to a collection; a collection lists its linked nodes.
  (Full view rendering comes in Phase 6.)

Done when: a node can sit in multiple collections without gaining their schema.

---

## Phase 5 — Aggregation engine 🧪

_(DESIGN §4, §5, §8a)_ The app's hot path. No new UI; pure computation exposed to
Phase 6.

- `repository/fieldValueRepo`: indexed `group by (key, linkValue)` + sum/avg/
  count over `numberValue`; filter by field value.
- `service/aggregation`: compute over a node's tree children and/or graph links;
  budget-vs-actual (actual, scheduled, remaining) with `overlayOwnField`.
- 🧪 the DESIGN §8a budget example and §8b session-sum example become tests;
  heterogeneous collection where lens-less nodes drop out.

Done when: `aggregate(node)` returns correct grouped sums for the worked
examples. Tests green.

---

## Phase 6 — Views: viewSpec + layouts 🎨

_(DESIGN §5)_ Turn aggregation into visuals.

- Layout registry (CLAUDE.md §2): `list | grid | bar | line | calendar | heatmap`,
  each a renderer `(nodes|aggregate, spec)`. Adding one = one `register`.
- `service/view`: resolve a `viewSpec` → data (via aggregation) → hand to the
  layout renderer. Lens/groupBy/sort/filter applied here.
- Node detail = single adaptive layout (CLAUDE.md §4): frame + `OwnValues` /
  `NodeView` / `Children`, sections appear only when present.

Done when: `August` shows budget-vs-actual bars, `Rio Funk` shows session bars,
`Coffee` shows only own values — same frame, different sections.

---

## Phase 7 — Homes + field triage 🎨

_(DESIGN §6-home, §6-triage-field)_ Round out the surfaces.

- Grid home (top-node tiles) alongside the default stream home; toggle.
- Field triage: a pass to fill missing field values, including promoting a raw
  `body` fragment into a field value (text → field). Separate from position
  triage.

Done when: both homes work; raw entries can be enriched in a dedicated field
pass.

---

## Phase 8 — Migration from old PLOT ⚙️🧪

> **SKIPPED — decided at Phase 7: starting fresh, no old data to migrate.**
> The phase is retained for numbering stability and because §9's mapping table
> remains useful as the conceptual correspondence between the two models. The
> importer is not built unless old data ever resurfaces.

_(DESIGN §9)_ One-off importer from the Prisma model.

- Script: `Category → node(childSchema)`, `Plot/Todo → node(parentId)`,
  `fieldValues JSON → field_value rows`, `Tracker/Goal → node(viewSpec)`, ranks →
  single `rank`, inbox derived.
- 🧪 a fixture of old rows imports to the expected node/field_value shape.

Done when: a dump of old data lands correctly in the new schema.

---

## Phase 9 — Presets + onboarding 🎨

> **Status: not executed — fresh start chosen. Kept as the model-to-model
> correspondence reference.**

_(DESIGN §6, decision-log "blank-canvas" risk)_ Fight the empty-canvas problem.

- Ship preset nodes (Mood, Budget, Movies, Practice) as pre-built nodes with
  `childSchema` + `viewSpec` already set. Skeleton stays flat; surface guides.
- First-run flow that offers a few presets so the user starts with filled rooms.

Done when: a new user picks a preset and immediately has a working tracker.

---

## Deferred (post-MVP)

- Natural-language capture assist (chip suggestions from raw text → inferred
  category/fields). Explicitly deferred in the design.
- Web/desktop sync polish, PWA.
- Keyboard-power-user triage refinements.

---

## Sequencing notes

- Phases 1→3→5 are the spine; everything else hangs off them. If time is tight,
  a usable vertical MVP is **1, 2, 3, 5, 6** (capture → structure → organize →
  aggregate → view).
- Do not build all repositories up front. Each phase adds only the repo methods
  it needs.
- Every domain-core phase (2, 3, 5, 8) is not "done" without its required tests.
  UI phases (1, 4, 6, 7, 9) ship without gating on tests.
