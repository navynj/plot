# components/ — UI only

**May live here:** feature components (split by feature) and shared primitives
under `components/ui/`. Server components by default; `"use client"` only at
interactive leaves. One component per file, ~150 lines max, explicit prop types
derived from `@/db/schema`.

**May not live here:** imports of `@/db` or `src/repository/` (enforced by
ESLint), data fetching in client components, re-derived domain rules (call the
service), `switch` on field type or layout (use the registries, CLAUDE.md §2).

Empty in Phase 0 by design — first components land in Phase 1.
