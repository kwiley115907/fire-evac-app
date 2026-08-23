create table if not exists buildings (
  id text primary key,
  name text not null,
  graph_data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
