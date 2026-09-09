-- Fire Evacuation App schema.
-- Run this whole file in the Supabase SQL editor (or `supabase db push` if
-- you adopt the CLI later). Safe to re-run: every statement is idempotent.

create extension if not exists pgcrypto;

create table if not exists buildings (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  -- The human-facing id the client picks (e.g. "sample-building"). Unique
  -- per owner, not globally, so two tenants can't collide on the same name.
  client_building_id text not null,
  name text not null,
  graph_data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, client_building_id)
);

-- Backfill path for a database created before owner_id/client_building_id
-- existed (the original single-tenant schema used `id text primary key`).
-- Harmless no-op on a fresh database.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_name = 'buildings' and column_name = 'id' and data_type = 'text'
  ) then
    raise notice 'Legacy text-id buildings table detected — manual data migration required before applying this schema.';
  end if;
end $$;

create index if not exists buildings_owner_id_idx on buildings (owner_id);

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists buildings_set_updated_at on buildings;
create trigger buildings_set_updated_at
  before update on buildings
  for each row
  execute function set_updated_at();

-- Row Level Security: the API talks to Supabase using a per-request client
-- scoped to the caller's own access token (see apps/api/src/supabase.ts),
-- so these policies are the actual tenant-isolation boundary, not just
-- defense in depth. Enabling RLS with no policies would deny all access,
-- which is why explicit owner-scoped policies exist below.
alter table buildings enable row level security;

drop policy if exists "select own buildings" on buildings;
create policy "select own buildings" on buildings
  for select using (auth.uid() = owner_id);

drop policy if exists "insert own buildings" on buildings;
create policy "insert own buildings" on buildings
  for insert with check (auth.uid() = owner_id);

drop policy if exists "update own buildings" on buildings;
create policy "update own buildings" on buildings
  for update using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

drop policy if exists "delete own buildings" on buildings;
create policy "delete own buildings" on buildings
  for delete using (auth.uid() = owner_id);
