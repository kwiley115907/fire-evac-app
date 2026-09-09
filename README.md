# Fire Evacuation App

Monorepo with two apps:
- apps/web - Next.js frontend, deploys to Vercel
- apps/api - Express backend, deploys to Render

Data store: Supabase (schema in `supabase/schema.sql`). Auth is handled by
Supabase Auth (email/password); the API authorizes every request against
the caller's own Supabase access token, and Postgres Row Level Security
enforces that a user can only ever read or write their own buildings.

## What's wired up
- Nearest-exit routing engine (Dijkstra, multi-floor, stair-aware), with
  unit tests covering same-floor routing, multi-floor stairs, exits
  excluded by non-evacuation-safe connectors, and nearest-of-multiple-exits.
- Email/password auth (Supabase Auth) gating the API and the test console.
- POST /buildings - save a BuildingGraph (requires a bearer token)
- GET  /buildings/:id - fetch one (requires a bearer token, scoped to the
  caller's own buildings via RLS)
- POST /route - {buildingId, point, floor} -> nearest exit route (requires
  a bearer token)
- Test console at http://localhost:3000 signs in, then exercises both
  endpoints against a hardcoded sample building.
- Production hardening: input validation (zod), rate limiting, helmet
  security headers, CORS allowlist, centralized error handling (no
  unhandled-rejection crashes), structured request logging, graceful
  shutdown, CI (build + test on every push).

## Not built yet
- Print upload + AI wall/room detection (the ingestion adapters)
- Real building creation UI (currently API-only + one sample button)
- Org/team accounts (current model is one owner per building, not shared
  team access)

## Supabase setup (one time)

1. Create a Supabase project (or use an existing one).
2. In the Supabase SQL editor, run the entire contents of
   `supabase/schema.sql`. It's idempotent, so re-running it is safe.
3. In **Project Settings -> API**, note your Project URL and anon/public
   key — you'll need both for `apps/api/.env` and `apps/web/.env.local`.
4. In **Authentication -> Providers**, email/password sign-up is enabled
   by default. If you want to skip email confirmation while testing,
   turn off "Confirm email" under Authentication -> Settings — remember
   to turn it back on before real users sign up.

## Local dev (two Termux sessions)

Run these once, from the repo root:

```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.local.example apps/web/.env.local
```

Then edit both files and fill in your Supabase Project URL and anon key
(`nano apps/api/.env` / `nano apps/web/.env.local`, or any editor).

Install dependencies once from the repo root (installs both workspaces):

```bash
npm install
```

**Session 1 — API** (http://localhost:4000):

```bash
npm run dev:api
```

**Session 2 — web** (http://localhost:3000):

```bash
npm run dev:web
```

Open http://localhost:3000, sign up with an email/password, then use the
two test-console buttons to save the sample building and find its nearest
exit.

## Running tests

```bash
npm test --workspace apps/api
```

## Production build (what CI runs)

```bash
npm run build --workspace apps/api
npm run build --workspace apps/web
```

## Deploying

**API (Render)**: set the build command to `npm run build --workspace apps/api`,
start command to `npm run start --workspace apps/api`, and set the env vars
from `apps/api/.env.example` (`SUPABASE_URL`, `SUPABASE_ANON_KEY`,
`CORS_ORIGIN` — set this to your deployed web app's URL, not `*`).

**Web (Vercel)**: set the env vars from `apps/web/.env.local.example`
(`NEXT_PUBLIC_API_URL` pointing at your deployed API, plus the two
`NEXT_PUBLIC_SUPABASE_*` values).
