# DEPLOY — Vercel + Neon + Google OAuth

The ordered runbook. Console steps (GitHub / Neon / Vercel / Google) are
yours; code-side prerequisites are already in the repo:

- `pnpm build` passes as a production build; all app routes are dynamic.
- Env fails fast naming the missing var: `DATABASE_URL` (db client),
  `AUTH_SECRET` / `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` (auth config).
- `trustHost: true` is set for Auth.js behind Vercel's proxy (no AUTH_URL
  needed).
- The migration chain 0000→0004 is verified to apply, in order, to a fresh
  empty Postgres. Migrations are a documented one-time deploy step — never
  auto-run on boot.
- CI passes `DATABASE_URL` from an Actions secret into the test step
  (integration tests self-skip loudly when absent).

## 1 — GitHub

```sh
git remote add origin git@github.com:<you>/plot.git
git push -u origin main
```

Repo → Settings → Secrets and variables → Actions → **New repository secret**:

- Name: `DATABASE_URL` · Value: the **dev** branch connection string
  (the same one in your local `.env`) — CI's integration tests run there.

## 2 — Neon

1. Console → your project → Branches → confirm/create the **production**
   branch (the default `main`/`production` branch is fine; dev work has been
   on the dev branch, so production is untouched/empty).
2. Copy the production branch's **pooled** connection string (host contains
   `-pooler`) — this is `DATABASE_URL` for Vercel AND for the one-time
   migration below.
3. **One-time migration — run now, locally**, before the first deploy:

```sh
DATABASE_URL='<production pooled URL>' pnpm db:migrate
```

The inline value overrides `.env` (verified). Expect
`migrations applied successfully!`. Re-running is safe (journal-tracked,
no-ops). Future schema changes repeat this step before deploying the code
that needs them.

## 3 — Vercel

Import the GitHub repo (framework auto-detects Next.js; defaults are fine —
build `pnpm build`, no overrides needed). Set Environment Variables
(Production):

| Name                 | Value                                          |
| -------------------- | ---------------------------------------------- |
| `DATABASE_URL`       | the production **pooled** URL from step 2      |
| `AUTH_SECRET`        | fresh: `openssl rand -base64 32` — never dev's |
| `AUTH_GOOGLE_ID`     | Google Console → the OAuth client's ID         |
| `AUTH_GOOGLE_SECRET` | Google Console → the OAuth client's secret     |

Deploy. Note the domain (`https://<app>.vercel.app`).

## 4 — Google Cloud Console

APIs & Services → Credentials → your OAuth 2.0 Client → **Authorized
redirect URIs** → add:

```
https://<app>.vercel.app/api/auth/callback/google
```

(Keep the localhost one for dev. If the consent screen is in Testing mode,
your account must be listed as a test user — it already is.)

## 5 — Post-deploy verification (walked together)

1. `https://<app>.vercel.app/api/health` → `{"ok":true,"nodeCount":0}`
   (fresh production DB).
2. Sign in with Google on the production domain.
3. First visit seeds → lands on `/grid` with the six rooms; inbox 0.
4. Real-device PWA pass (phone): install from the deployed URL → launch from
   the home-screen icon → sign-in round-trip inside the standalone window →
   capture a node → triage drag feel on touch.

### What to watch in the standalone OAuth round-trip

- **Android/Chrome:** tapping "Continue with Google" should open a Custom
  Tab over the standalone window and RETURN to the standalone window after
  account pick. Failure mode: landing in a full Chrome tab afterward (app
  window left signed out) — report which happened.
- **iOS/Safari standalone:** the OAuth redirect happens in-window (or an
  in-app Safari view). Historical friction: session cookies not persisting
  back into the installed context on relaunch. After signing in, kill the
  app from the switcher, relaunch from the icon — report whether it lands
  authenticated (`/`) or bounces to `/signin`.
- The auth cookie is `SameSite=Lax` + `Secure` (Auth.js default on HTTPS) —
  correct for the redirect flow; the tz cookie is host-only, path=/, Lax,
  Secure on HTTPS, fine for the single origin.

## Notes

- `/api/health` is public by design (connection probe). Its `nodeCount` is a
  global aggregate across users — anonymous, but flag if you'd rather it
  return `{ok}` only.
- Deleting a Vercel deployment does not touch Neon; the production branch
  holds all data.
