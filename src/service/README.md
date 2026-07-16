# service/ — domain logic, exactly once

**May live here:** every domain rule, each implemented exactly once
(CLAUDE.md §3): depth-1 inheritance (`inheritance.resolveSchema`), triage ops +
cycle rejection (`triage.reparent`, the only place `parentId` is ever written),
aggregation semantics, view resolution.

**May not live here:** DB queries (`db.` — use a repository), HTTP/response
shaping, UI. Services depend on repository _interfaces_, not on Drizzle, so
domain logic is testable without a live DB (CLAUDE.md §5).

Services throw typed domain errors; actions/routes translate them.

Empty in Phase 0 by design — first service lands in Phase 1.
