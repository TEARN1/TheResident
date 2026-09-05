-- Stand-ins for what the live project provides but this repo does not own.
--
-- This used to also carry cut-down copies of eight res_* tables. Those became
-- a liability the moment the schema was consolidated: `create table if not
-- exists` means the FIRST definition wins, so a 4-column stand-in for
-- res_gossip_posts silently shadowed the real 9-column table and every policy
-- referencing `hidden` failed. The real schema now builds here in full, so the
-- only stand-ins left are the three Gruvs-owned objects (profiles,
-- notifications, events), the two Gruvs helper functions, auth.uid(), and
-- res_check_rate_limit — none of which this repo is the source of truth for.
create extension if not exists "uuid-ossp";
-- Jurisdiction boundaries are real geometry, so the harness needs PostGIS to
-- execute theresident_jurisdictions_schema.sql for real rather than skipping
-- the one rule that matters most (Debian/Ubuntu: postgresql-16-postgis-3).
create extension if not exists postgis;

create schema if not exists auth;
create table if not exists auth._current (uid uuid);
create or replace function auth.uid() returns uuid
language sql stable as $$ select uid from auth._current limit 1 $$;

create table if not exists public.profiles (
  id uuid primary key default uuid_generate_v4(),
  city text,
  display_name text,
  username text,
  avatar_url text,
  is_verified boolean default false,
  -- res_account_ready() gates posting on account age, so the stand-in needs
  -- created_at even though nothing in The Resident reads it directly.
  created_at timestamptz default now()
);

-- Gruvs-owned helpers the Resident's schema calls but does not own.
--
-- touch_updated_at() is the shared updated_at trigger used across the whole
-- database; award_xp() is the gamification hook. Both are attached to or
-- called from Resident objects, so the schema will not load without them.
-- These stand-ins reproduce the contract (touch stamps updated_at; award_xp
-- accepts the call and does nothing) rather than the implementation — the
-- real behaviour belongs to Gruvs and is not this suite's to assert.
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $touch$
begin
  new.updated_at := now();
  return new;
end;
$touch$;

create or replace function public.award_xp(p_user uuid, p_amount int, p_reason text default null)
returns void language plpgsql as $xp$
begin
  -- deliberately inert in tests
  return;
end;
$xp$;

-- Gruvs-owned. Referenced only as an FK target: res_notice_events.event_id and
-- res_security_logs.event_id both point at it. The Resident never reads or
-- writes it (CONTRACT.md §3), so the stand-in carries only the id the foreign
-- keys need — enough to make the constraint resolvable, not enough to invite
-- a test to depend on shape this project does not own.
create table if not exists public.events (
  id uuid primary key default uuid_generate_v4()
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
