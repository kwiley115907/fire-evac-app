# Fire Evacuation App

Monorepo with two apps:
- apps/web  - Next.js frontend, deploys to Vercel
- apps/api  - Express backend, deploys to Render

Data store: Supabase (schema in supabase/schema.sql).

## Local dev (two Termux sessions)
Session 1: npm run dev:api    (http://localhost:4000)
Session 2: npm run dev:web    (http://localhost:3000)

## What's wired up
- Nearest-exit routing engine (Dijkstra, multi-floor, stair-aware)
- POST /buildings  - save a BuildingGraph
- GET  /buildings/:id - fetch one
- POST /route - {buildingId, point, floor} -> nearest exit route
- Test console at http://localhost:3000 exercises both endpoints against
  a hardcoded sample building.

## Not built yet
- Print upload + AI wall/room detection (the ingestion adapters)
- Real building creation UI (currently API-only + one sample button)
- Auth / multi-tenant access control
