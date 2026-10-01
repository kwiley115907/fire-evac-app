-- Admin console: app-wide access for the people in public.app_admins.
-- Run after schema.sql, in the Supabase SQL editor. Safe to re-run: every
-- statement is idempotent.
--
-- Everything here runs with the caller's own access token. There is no
-- service-role key in the app: the security-definer functions below check
-- is_app_admin() themselves before reading auth.users or changing admins.

-- Who is an admin. RLS is on with no policies and no table grants, so the
-- browser can never read or write it; only the security-definer functions
-- below (owned by postgres) touch it.
create table if not exists public.app_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  granted_at timestamptz not null default now(),
  granted_by uuid references auth.users (id) on delete set null
);

alter table public.app_admins enable row level security;
revoke all on public.app_admins from anon, authenticated;

create or replace function public.is_app_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.app_admins where user_id = (select auth.uid())
  );
$$;

-- Admins see, edit and delete every building. These are added alongside the
-- owner policies in schema.sql; Postgres ORs permissive policies, so owners
-- keep exactly the access they had.
drop policy if exists "admins select all buildings" on public.buildings;
create policy "admins select all buildings" on public.buildings
  for select to authenticated using ((select public.is_app_admin()));

drop policy if exists "admins update all buildings" on public.buildings;
create policy "admins update all buildings" on public.buildings
  for update to authenticated
  using ((select public.is_app_admin()))
  with check ((select public.is_app_admin()));

drop policy if exists "admins delete all buildings" on public.buildings;
create policy "admins delete all buildings" on public.buildings
  for delete to authenticated using ((select public.is_app_admin()));

-- Counts in a graph_data array, tolerating a missing or non-array value.
create or replace function public.graph_array_length(graph jsonb, key text)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case when jsonb_typeof(graph -> key) = 'array' then jsonb_array_length(graph -> key) else 0 end;
$$;

-- Every account and every building, for the /admin page.
create or replace function public.admin_overview()
returns json
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_app_admin() then
    raise exception 'Admins only' using errcode = '42501';
  end if;

  return json_build_object(
    'accounts', coalesce((
      select json_agg(a order by a.joined_at desc)
      from (
        select
          u.id,
          u.email,
          u.created_at as joined_at,
          u.last_sign_in_at,
          (select count(*) from public.buildings b where b.owner_id = u.id)::int as building_count,
          exists (select 1 from public.app_admins x where x.user_id = u.id) as is_admin
        from auth.users u
      ) a
    ), '[]'::json),
    'buildings', coalesce((
      select json_agg(b order by b.updated_at desc)
      from (
        select
          bl.id,
          bl.name,
          bl.owner_id,
          u.email as owner_email,
          public.graph_array_length(bl.graph_data, 'floors') as floors,
          public.graph_array_length(bl.graph_data, 'rooms') as rooms,
          (
            select count(*)::int
            from jsonb_array_elements(
              case when jsonb_typeof(bl.graph_data -> 'rooms') = 'array' then bl.graph_data -> 'rooms' else '[]'::jsonb end
            ) r
            where r ->> 'isExit' = 'true'
          ) as exits,
          bl.updated_at
        from public.buildings bl
        left join auth.users u on u.id = bl.owner_id
      ) b
    ), '[]'::json)
  );
end;
$$;

-- Grant or remove admin. An admin can't remove themselves, so there is
-- always at least the one doing the removing left.
create or replace function public.admin_set_admin(target uuid, make_admin boolean)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if not public.is_app_admin() then
    raise exception 'Admins only' using errcode = '42501';
  end if;

  if make_admin then
    if not exists (select 1 from auth.users where id = target) then
      raise exception 'No such account' using errcode = 'P0002';
    end if;
    insert into public.app_admins (user_id, granted_by)
    values (target, (select auth.uid()))
    on conflict (user_id) do nothing;
  else
    if target = (select auth.uid()) then
      raise exception 'You cannot remove your own admin access' using errcode = '42501';
    end if;
    delete from public.app_admins where user_id = target;
  end if;
end;
$$;

-- Signed-in users only. Supabase grants execute on new public functions to
-- anon directly (not just through PUBLIC), so revoke both.
revoke execute on function public.is_app_admin() from public, anon;
revoke execute on function public.admin_overview() from public, anon;
revoke execute on function public.admin_set_admin(uuid, boolean) from public, anon;
revoke execute on function public.graph_array_length(jsonb, text) from public, anon, authenticated;
grant execute on function public.is_app_admin() to authenticated;
grant execute on function public.admin_overview() to authenticated;
grant execute on function public.admin_set_admin(uuid, boolean) to authenticated;

-- First admin: nobody can grant admin until one exists, so insert the owner
-- once by hand. Replace the address, run this line on its own, and keep the
-- real address out of the repo.
--
--   insert into public.app_admins (user_id)
--   select id from auth.users where email = 'owner@example.com'
--   on conflict (user_id) do nothing;
