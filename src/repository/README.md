# repository/ — data access, nothing else

**May live here:** every DB query in the app. This is the ONLY directory where
`db.` may appear (CLAUDE.md §1 grep test) and the only one allowed to import
`@/db`. Aggregation SQL (sum/avg/group-by over `field_value`) lives here,
exposed to the `aggregation` service.

**May not live here:** domain logic (inheritance, cycle checks, triage rules,
aggregation _semantics_), HTTP concerns, UI.

Repositories expose narrow interfaces (CLAUDE.md §2); services depend on those
interfaces, not on Drizzle.

`health.ts` exists for the Phase 0 health route only; real repos
(`nodeRepo`, `linkRepo`, `fieldValueRepo`) arrive with the phases that need them.
