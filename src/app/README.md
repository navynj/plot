# app/ — routes, pages, server actions (thin)

**May live here:** Next.js App Router pages, layouts, route handlers, and server
actions. Entry points are thin: parse input, call one service, return
(~15 lines, CLAUDE.md §1). Routes/actions translate typed domain errors into
responses — no raw exception strings to the client.

**May not live here:** business logic, DB queries (`db.` / `@/db` — enforced by
ESLint), raw `parentId` writes (go through `triage`).

Exception noted for Phase 0: `api/health` calls `repository/health` directly —
it has zero domain logic, and layer imports point strictly downward, so no
pass-through service is fabricated for it.
