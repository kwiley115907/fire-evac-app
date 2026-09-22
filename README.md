# Sentinel Grid — AI Fire Evacuation Planner

A single Next.js app (App Router) deploying to one Vercel project. Data
store: Supabase (schema in `supabase/schema.sql`). Auth is Supabase Auth
(email/password) via cookie-backed sessions (`@supabase/ssr`); every API
route authorizes against the caller's own session, and Postgres Row Level
Security enforces that a user can only ever read or write their own
buildings.

## What's here
- **Routing engine** — Dijkstra, multi-floor, stair-aware, unaltered from
  the original tested implementation (`lib/evacuation-*.ts`), with the same
  unit test suite (`lib/*.test.ts`).
- **Building editor** (`/buildings/[id]`) — SVG-based multi-floor editor:
  draw rooms, walls, doors, and stairs/elevators; mark exits and
  evacuation-safe connectors; click any point to compute the live route to
  the nearest exit.
- **AI floor-plan detection** (`/api/ai-detect`) — upload a floor plan
  image and Claude drafts rooms/walls/doors for that floor as an editable
  overlay; nothing is saved until you review and accept it.
- **AI evacuation assistant** (`/api/ai-chat`) — resolves a natural-language
  room reference ("nearest exit from the server room") to a room id, then
  hands off to the real Dijkstra engine for the actual route. The model
  never invents a path.
- Dashboard for creating/listing buildings, login/signup pages.
- Production hardening carried over: input validation (zod), security
  headers, structured route handlers, CI (build + test on every push).

## Supabase setup (one time)

1. Create a Supabase project (or use an existing one).
2. In the Supabase SQL editor, run the entire contents of
   `supabase/schema.sql`. It's idempotent, so re-running it is safe.
3. In **Project Settings -> API**, note your Project URL and anon/public
   key.
4. In **Authentication -> Providers**, email/password sign-up is enabled
   by default.

## Local dev

```bash
cp .env.local.example .env.local
```

Edit `.env.local` and fill in your Supabase Project URL, anon key, and an
Anthropic API key (`ANTHROPIC_API_KEY`, server-side only — never exposed to
the client).

```bash
npm install
npm run dev
```

Open http://localhost:3000, sign up, create a building, and start drawing.

## Running tests

```bash
npm test        # vitest — routing/geometry unit tests
npm run typecheck
npm run lint
```

## Production build (what CI runs)

```bash
npm run build
```

## Deploying

**Vercel**: one project, root directory. Set the env vars from
`.env.local.example` (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`ANTHROPIC_API_KEY`). `NEXT_PUBLIC_*` vars must be **Plaintext**, not
Secret — Secret-typed vars aren't inlined into the client bundle at build
time.
