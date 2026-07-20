# CLAUDE.md — PLOT engineering guide

This file governs how code is written in this repo. It is read on every Claude
Code session. Follow it over habit or generic convention.

**Read first:** [`_docs/DESIGN.md`](./_docs/DESIGN.md) (the domain model) and
[`_docs/schema.ts`](./_docs/schema.ts) (the source of truth for data types).
Every rule below exists to protect the design in those files.

Stack: **Next.js (App Router, full-stack) · Drizzle · Neon (Postgres) · Vercel
(Node serverless) · TypeScript**.

---

## 0. The one thing to remember

Everything is a `node`. Role is never a stored type — it emerges from
relationships. Therefore **domain rules must live in exactly one place**, or they
drift and contradict each other across the codebase. The layering rules (§2) are
how we guarantee that. When in doubt, ask: "if this rule changed, how many files
would I edit?" The answer must be one.

---

## 1. Layers — strict, one-directional

Dependencies point downward only. A layer may import from layers below it, never
above, never sideways into a peer's internals.

```
schema        drizzle tables + domain types (schema.ts)   ← no logic
   ▲
repository    pure data access. the ONLY place with DB queries
   ▲
service       domain logic: inheritance, aggregation, triage ops
   ▲
action/route  thin entry points (server actions, route handlers)
   ▲
component     UI. server components by default
```

Hard rules:

- **DB queries exist only in `repository/`.** No `db.select(...)` in a service,
  action, or component. If a component needs data, it calls a service, which
  calls a repository. Grep test: `db\.` outside `repository/` is a violation.
- **Domain logic exists only in `service/`.** Inheritance resolution, cycle
  checks, aggregation math, triage operations — one implementation each, in a
  service. A component must never re-derive "a node inherits its direct parent's
  childSchema"; it calls `resolveSchema(node)`.
- **Actions/routes are thin.** Parse input, call one service, return. No business
  logic. If an action is longer than ~15 lines, the logic belongs in a service.
- **Components never import `repository/` or `db`.** Only services (or the data
  they return via server components / actions).
- **Session/auth is read only at entry points** (RSC, route handler, server
  action). The entry point resolves `userId` and passes it _down_ as a parameter.
  `service/` and `repository/` never read the session or call auth — they take
  `userId` as an argument. Grep test: auth/session imports outside `app/` (and
  the auth config itself) are a violation.

Directory shape:

```
src/
  db/            drizzle client + schema re-export
  repository/    nodeRepo.ts, linkRepo.ts, fieldValueRepo.ts
  service/       inheritance.ts, aggregation.ts, triage.ts, view.ts
  app/           next.js routes, server actions, pages
  components/    ui, split by feature (see §4)
  lib/           pure helpers, no domain knowledge
```

---

## 2. SOLID — as it applies here

Not abstractly. These are the concrete forms in this codebase.

### Single responsibility

A module owns one reason to change. `nodeRepo` changes when node _storage_
changes; `inheritance` service changes when the _inheritance rule_ changes;
`BudgetView` component changes when the _budget visual_ changes. Never mix
storage, domain, and presentation in one file.

### Open/closed — the registries

Two things in this design grow constantly: **field types** and **view layouts**.
Never handle them with a growing `switch`. Use a registry so adding one is a
_registration_, not an edit to existing code.

```ts
// field types (schema.ts FIELD_TYPES) → renderer + editor + value-column
fieldRegistry.register('number', { render, edit, column: 'numberValue' });

// view layouts (ViewSpec.layout) → a renderer taking (nodes, spec)
layoutRegistry.register('bar', BarLayout);
```

Adding `heatmap` or a new field type must touch only its own file plus one
`register` call. If you find yourself writing `if (spec.layout === 'bar') … else
if …`, stop and use the registry.

### Liskov / interface segregation

Repositories expose narrow interfaces. A service that only reads nodes depends on
a read interface, not the whole repo. Don't force a consumer to know methods it
doesn't use.

### Dependency inversion

Services depend on repository _interfaces_, not on Drizzle directly. This keeps
domain logic testable without a DB (see §5) and keeps Drizzle swappable at the
repository seam. The `db` client is injected/imported only at the repository
layer.

---

## 3. Domain invariants — never violate, never re-implement

These come straight from DESIGN.md. Each lives in one service function. Call it;
never inline it.

- **Inheritance is depth-1.** A node's schema comes from its _direct_ parent's
  `childSchema` only. Never walk ancestors. → `inheritance.resolveSchema(node)`.
  - **`inherit` on layer insertion is a snapshot, not a live link.** Choosing
    `inherit` _copies_ the parent's `childSchema` onto the new node at insert
    time. `resolveSchema` unconditionally reads only the direct parent — it never
    resolves _through_ an inherit node. Consequence (intended, not a bug): later
    edits to the original ancestor's `childSchema` do NOT propagate to the
    snapshot. `schemaMode` records which choice was made; the read path ignores
    it. This is the whole point of depth-1: a distant ancestor's change never
    shakes a descendant.
- **A tree link inherits; a graph link never does.** Inheritance is decided by
  the link kind, not the node. Graph aggregation reads borrowed fields but
  imposes no schema.
  - **Schema inherits at depth 1; display fallbacks (icon) may walk ancestors.**
    A display fallback changes what's painted, never what's stored — the icon
    ladder (own → first-link-field target → nearest ancestor) resolves at
    render time in the repository's list SQL, so re-parenting or
    re-categorizing re-resolves with zero writes and nothing goes stale.
- **Inbox is a derived filter,** `parentId IS NULL`. Never store an "in inbox"
  flag. → `nodeRepo.findInbox(userId)`.
- **No cycles.** A node cannot become a descendant of itself. Every re-parent /
  insert goes through `triage.reparent()`, which rejects cycles. Never set
  `parentId` directly in a component or action.
- **Aggregation reads `field_value`,** never JSON. Sum/avg/group-by run in SQL in
  the repository, exposed via `aggregation` service. Never load rows and reduce
  in JS when SQL can do it.
- **Layer insertion offers inherit|new;** default `inherit`. → `triage.insertLayer()`.

If you need one of these behaviors and can't find the function, it's missing —
write it in the service layer, don't inline it at the call site.

---

## 4. Components & reuse

Server components by default. Add `"use client"` only when a component needs
state, effects, or event handlers — and push it to the leaf. A `"use client"` on
a page or large container is a smell; wrap only the interactive part.

Reuse boundaries that come from the design:

- **Node detail is one adaptive layout.** Build it as a frame plus three
  swappable sections: `OwnValues`, `NodeView`, `Children`. Sections render only
  when the node has that aspect. Do not fork the screen by node "type" — that
  contradicts the model.
- **The triage drag is one action model, many inputs.** Keep the action model
  (pick up → set insertion point + depth → commit) in a headless hook
  (`useTriageMove`) that is input-agnostic. Pointer (mobile) and keyboard
  (desktop) are thin adapters over the same hook. Never duplicate the move logic
  per input.
- **Field rendering goes through the field registry** (§2), not per-call-site
  conditionals. A field cell/editor is looked up by type.
- Shared primitives (buttons, chips, sheets) live in `components/ui/`; feature
  components compose them. No feature component reaches into another feature's
  internals.
- **shadcn/ui primitives stay generic.** They live in `components/ui/` and hold
  no feature or domain logic. Feature components (`TriageTree`, `NodeDetail`,
  field editors) compose them; never edit a `ui/` primitive to carry
  domain-specific behavior. If a primitive needs domain behavior, wrap it in a
  feature component instead.

Component rules:

- One component per file; name = file name. Keep components under ~150 lines;
  extract when longer.
- Props are typed explicitly (no `any`, no implicit). Derive domain prop types
  from `schema.ts`, don't redeclare them.
- No data fetching inside client components; fetch in server components/actions
  and pass down, or use a service through an action.

---

## 5. Testing — domain core required, UI optional

Strategy (chosen deliberately): **test the skeleton, move fast on the surface.**

**Required tests** (a change here without a test is incomplete):

- `service/inheritance` — depth-1 resolution; ancestor schema must NOT leak;
  insert-layer inherit vs new.
- `service/triage` — reparent, promote, group, detach-to-inbox; **cycle
  rejection**; subtree carries on move.
- `service/aggregation` — sum/avg/group-by correctness; budget-vs-actual
  (actual, scheduled, remaining) on the DESIGN.md §8a example; heterogeneous
  collection where lens-less nodes drop out.

These are the parts that are subtle and expensive to debug wrong. Write them as
pure unit tests against repository interfaces (no live DB needed for logic).

**Optional** (write when it helps, don't gate on it): components, layouts, thin
actions/routes, styling.

Every worked example in DESIGN.md §8 should have a corresponding aggregation/
inheritance test — they are the executable form of the design.

---

## 6. Practical rules for every change

- **TypeScript strict. No `any`** (use `unknown` + narrowing). Domain types come
  from `schema.ts`; don't redeclare `Node`, `FieldDef`, `ViewSpec` elsewhere.
- **No raw `parentId` writes** outside `triage` service. No raw `db.` outside
  `repository`.
- **Round every displayed number**; format currency via `Intl.NumberFormat`.
- **Errors:** services throw typed domain errors; actions/routes translate to
  responses. No raw exception strings to the client. No silent catches.
- **Migrations** via `drizzle-kit`; never hand-edit generated SQL. Schema changes
  start in `schema.ts`.
- **Naming:** verbs for functions (`resolveSchema`, `findInbox`), nouns for data.
  Files kebab or camel consistently within a dir. No abbreviations that aren't in
  DESIGN.md.
- **Before adding a `switch` on field type or layout,** use the registry (§2).
- **Before writing a DB query in a service/component,** move it to a repository.
- **Before inlining a domain rule,** find its service function (§3).
- **Known constraint — no transactions on neon-http.** Multi-write triage ops
  (`insertLayer`, `group`) are not atomic. Acceptable single-user; revisit by
  switching to the websocket driver if concurrent editing ever becomes real.

---

## 7. When unsure

If a task seems to require breaking a layer boundary or duplicating a domain
rule, that's a signal the design needs a new service function — add it in the
right layer rather than working around the boundary. If the design itself seems
wrong, flag it and reference the specific DESIGN.md section rather than silently
diverging.
