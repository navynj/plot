# PLOT

Rapid capture, later organization. Everything is a node; structure is optional
and always deferred.

- **Read first:** [`CLAUDE.md`](./CLAUDE.md) (engineering rules),
  [`_docs/DESIGN.md`](./_docs/DESIGN.md) (domain model),
  [`src/db/schema.ts`](./src/db/schema.ts) (data types),
  [`_docs/ROADMAP.md`](./_docs/ROADMAP.md) (build order).

Stack: Next.js (App Router) · Drizzle · Neon (Postgres) · Vercel · TypeScript.

## Develop

```sh
cp .env.example .env   # fill in the Neon dev-branch DATABASE_URL
pnpm install
pnpm db:migrate        # apply migrations
pnpm dev               # http://localhost:3000 — /api/health checks the DB
```

Checks: `pnpm lint` · `pnpm typecheck` · `pnpm test` (all run in CI).
Schema changes start in `src/db/schema.ts`, then `pnpm db:generate`.
