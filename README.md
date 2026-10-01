# Sentinel Grid — AI Fire Evacuation Planner

A single Next.js app (App Router) deploying to one Vercel project. Data
store: Supabase (schema in `supabase/schema.sql`). Auth is Supabase Auth
(email/password) via cookie-backed sessions (`@supabase/ssr`); every API
route authorizes against the caller's own session, and Postgres Row Level
Security enforces that a user can only ever read or write their own
buildings.

## What's here
- **Three ways to see the way out** (`/buildings/[id]`, and the public
  `/demo`):
  - **Lifeline** — turn-by-turn guidance from any room. Turns come from the
    plan geometry (relative to the way you come through each door), the
    route walks square-on through doors and down the middle of corridors,
    a countdown to safety is painted along the path, and every route has a
    **Plan B** through a different exit (or a "No Plan B" warning). "Walk
    it" flies the camera along each step.
  - **Escape Field** — every room's way out at once: rooms tinted by time
    to safety, animated streams that thicken where the building funnels
    together, "NO WAY OUT" on rooms that can't reach an exit.
  - **Floor Stack** — an exploded, orbitable 3D stack of every floor with
    the route threaded down the stairwells (pure SVG, no WebGL).
- **Drill mode** — set rooms on fire, block doors or stairs; every route
  re-plans instantly. Burning rooms are never routed through (you can
  always leave one), rooms next to a fire are treated as smoke-logged.
- **AR Scan** — walk a route with your phone and get it back in 3D
  (`lib/ar-scan.ts`, `components/scan/`). Two capture modes:
  - *Camera + motion* (any phone): films the walk with the camera while
    the accelerometer counts steps and the gyroscope tracks turns; tap
    Stairs down/up on a flight. Stride is adjustable afterwards.
  - *Precise AR* (Android with ARCore, via WebXR): records the phone's real
    6-DoF position, so height and stairs are captured automatically, and
    paints a live trail on the floor in the camera view.
  Scans are replayed in an orbitable 3D view (with the recorded video when
  there is one), placed onto the plan (tap the start point, rotate, square
  up, stretch), shown on each floor and threaded through the Floor Stack,
  and saved with the building. Video stays on the device; only the path
  is saved. `/demo?scan=1` opens it straight away, with a sample walk for
  trying it without a phone.
- **Egress audit** — rooms with no way out, longest travel vs. a limit you
  set, single-exit dependence, and load per exit.
- **Escape-field engine** (`lib/evacuation-field.ts`) — reverse Dijkstra
  from every exit over a door/stair-landing graph, run client-side on every
  edit. Door-to-door costs are never longer than the original router's.
- **Original routing engine** — Dijkstra over room centroids, multi-floor,
  stair-aware (`lib/evacuation-router.ts`), still backing `/api/route` and
  the AI assistant's server side, with its original tests.
- **Building editor** — pan/zoom/pinch SVG canvas; draw rooms (corners
  snap), walls, doors (snap onto the wall two rooms share) and
  stairs/elevators; undo/redo; keyboard shortcuts (V R W D S F G, 1/2/3 for
  views); the floor below shows as an onion-skin outline. Works on phones
  with a bottom tool dock and a swipe-up guide sheet.
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
