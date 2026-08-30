-- Minimal stand-ins for what already exists live, so the Service Desk schema
-- can be executed for real against a throwaway Postgres. Shapes copied from
-- the verified live information_schema output, not guessed.
create extension if not exists "uuid-ossp";

create schema if not exists auth;
create table if not exists auth._current (uid uuid);
create or replace function auth.uid() returns uuid
language sql stable as $$ select uid from auth._current limit 1 $$;

create table if not exists public.profiles (
  id uuid primary key default uuid_generate_v4(),
  city text
);

create table if not exists public.res_profiles (
  id uuid primary key,
  role text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Gruvs-owned shared rail. Column list copied verbatim from the live table —
-- note it really does carry BOTH read/is_read and body/message, which is why
-- the client reads defensively and the fan-out writes both.
create table if not exists public.notifications (
  id uuid primary key default uuid_generate_v4(),
  recipient_id uuid not null,
  sender_id uuid,
  type text not null,
  action_id text,
  action_type text,
  title text,
  message text,
  icon text,
  read boolean default false,
  read_at timestamptz,
  action_url text,
  created_at timestamptz default now(),
  expires_at timestamptz,
  user_id uuid,
  actor_id uuid,
  event_id uuid,
  echo_id uuid,
  body text,
  is_read boolean default false,
  data jsonb
);

create table if not exists public.res_infra_providers (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  kind text not null check (kind in ('power','water','network','fiber','road')),
  contact_email text,
  contact_phone text,
  created_at timestamptz not null default now()
);

create table if not exists public.res_infra_partner_admins (
  provider_id uuid not null,
  user_id uuid not null,
  primary key (provider_id, user_id)
);

create table if not exists public.res_rate_limits (
  user_id uuid not null,
  action text not null,
  window_start timestamptz not null,
  count integer not null,
  primary key (user_id, action, window_start)
);

-- Verbatim from the live database.
create or replace function public.res_check_rate_limit(p_action text, p_max integer, p_window_seconds integer)
returns boolean language plpgsql security definer set search_path to 'public' as $function$
declare
  v_window timestamptz;
  v_count integer;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  v_window := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  insert into res_rate_limits (user_id, action, window_start, count)
  values (auth.uid(), p_action, v_window, 1)
  on conflict (user_id, action, window_start)
  do update set count = res_rate_limits.count + 1
  returning count into v_count;
  if v_count > p_max then
    raise exception 'rate_limit_exceeded: % (max % per % seconds)', p_action, p_max, p_window_seconds;
  end if;
  return true;
end;
$function$;

-- `authenticated` / `service_role` are Supabase-managed roles.
do $$ begin
  if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated; end if;
  if not exists (select 1 from pg_roles where rolname='service_role') then create role service_role; end if;
  if not exists (select 1 from pg_roles where rolname='anon') then create role anon; end if;
end $$;
