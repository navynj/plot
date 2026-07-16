# db/ — Drizzle client + schema

**May live here:** the Drizzle/Neon client (`index.ts`), the table definitions and
domain types (`schema.ts`). No logic of any kind.

**May not live here:** queries, domain rules, anything that reads or interprets
data.

**Who may import what:**

- `@/db` (the client) — **only `src/repository/`**. Enforced by ESLint
  (`no-restricted-imports`).
- `@/db/schema` (tables for query-building) — only `src/repository/`.
- Domain _types_ from schema (`FieldDef`, `ViewSpec`, `FieldType`) — any layer,
  via `import type`.
