-- The Resident — persistent security audit log.
-- Safe to re-run: every statement is idempotent. Paste into Supabase →
-- SQL Editor → Run.
--
-- WHY THIS EXISTS
-- `addLog` has existed since the first commit but only ever wrote to
-- in-memory Redux: never synced, never persisted, never rendered in any
-- UI, and (after the logout state-wipe) cleared on sign-out as well as on
-- every refresh. SECURITY.md nonetheless described it as "the solo
-- maintainer's way of seeing what happened without having been online when
-- it did", and MAINTENANCE.md made reviewing it a weekly task. Both were
-- impossible: the entries never left the user's browser tab. This table is
-- what makes those claims true.

create extension if not exists "uuid-ossp";

create table if not exists public.res_security_logs (
  id uuid primary key default uuid_generate_v4(),
  -- Null for events that happen BEFORE anyone is authenticated, which is
  -- most of the interesting ones: auth_failed, brute_force_blocked.
  user_id uuid references public.profiles(id) on delete set null,
  event_type text not null check (event_type in (
    'xss_blocked', 'rate_limit_triggered', 'idor_prevented',
    'auth_success', 'auth_failed', 'brute_force_blocked',
    'upload_malware_blocked', 'sqli_blocked',
    'role_switched', 'org_broadcast_sent',
    'auth_password_reset_requested', 'auth_password_changed'
  )),
  action text not null,
  details text,
  -- Deliberately NOT client-supplied. The client cannot know its own public
  -- IP; the old code sent a hardcoded '127.0.0.1', which was worse than
  -- nothing because it looked like real data. Populated server-side only
  -- (middleware/edge) when a route has it, otherwise left null and honest.
  ip_address text,
  user_agent text,
  created_at timestamptz default now()
);

-- `create table if not exists` above does nothing when the table already
-- exists, so it can never widen the event_type CHECK on a project where an
-- earlier version of this file was already run. Recreating the constraint
-- by name is the only idempotent idiom Postgres offers, and is what keeps
-- this file safe to re-run as new event types are added (the two password
-- ones below arrived after the first version shipped).
alter table public.res_security_logs drop constraint if exists res_security_logs_event_type_check;
alter table public.res_security_logs
  add constraint res_security_logs_event_type_check
  check (event_type in (
    'xss_blocked', 'rate_limit_triggered', 'idor_prevented',
    'auth_success', 'auth_failed', 'brute_force_blocked',
    'upload_malware_blocked', 'sqli_blocked',
    'role_switched', 'org_broadcast_sent',
    'auth_password_reset_requested', 'auth_password_changed'
  ));

create index if not exists res_security_logs_created_idx on public.res_security_logs (created_at desc);
create index if not exists res_security_logs_type_idx on public.res_security_logs (event_type, created_at desc);
create index if not exists res_security_logs_user_idx on public.res_security_logs (user_id, created_at desc);

-- ── Abuse control ───────────────────────────────────────────────────────────
-- This table must accept inserts from `anon`, because the events worth
-- having (failed logins, brute-force lockouts, blocked XSS on the signup
-- form) all occur before authentication. That makes it a spam target, so
-- it is rate-limited the same way res_org_broadcasts is — per authenticated
-- user where we have one, and globally-per-minute for anonymous inserts so
-- one script cannot bloat the table.
create or replace function public.res_check_security_log_rate_limit()
returns trigger
language plpgsql security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  if new.user_id is not null then
    select count(*) into v_count
    from res_security_logs
    where user_id = new.user_id
      and created_at > now() - interval '1 minute';
    if v_count >= 60 then
      raise exception 'rate_limited: too many security log entries for this user';
    end if;
  else
    select count(*) into v_count
    from res_security_logs
    where user_id is null
      and created_at > now() - interval '1 minute';
    if v_count >= 300 then
      raise exception 'rate_limited: too many anonymous security log entries';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists res_security_logs_rate_limit on public.res_security_logs;
create trigger res_security_logs_rate_limit
  before insert on public.res_security_logs
  for each row execute function public.res_check_security_log_rate_limit();

-- ── Retention ───────────────────────────────────────────────────────────────
-- Unbounded growth on a free tier is its own outage. 180 days is long enough
-- to cover the quarterly review cadence in MAINTENANCE.md with room to spare.
-- Call manually, or from a scheduled job if one is ever added.
create or replace function public.res_prune_security_logs()
returns integer
language plpgsql security definer
set search_path = public
as $$
declare
  v_deleted integer;
begin
  delete from res_security_logs where created_at < now() - interval '180 days';
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

revoke execute on function public.res_prune_security_logs() from public, anon;
grant execute on function public.res_prune_security_logs() to service_role;

-- ── RLS ─────────────────────────────────────────────────────────────────────
alter table public.res_security_logs enable row level security;

-- Insert-only for everyone else. An authenticated caller may only attribute
-- an entry to themselves; anonymous callers must leave user_id null, so a
-- log entry can never be forged against another account.
drop policy if exists res_security_logs_insert_auth on public.res_security_logs;
create policy res_security_logs_insert_auth on public.res_security_logs
  for insert to authenticated
  with check (user_id is null or user_id = auth.uid());

drop policy if exists res_security_logs_insert_anon on public.res_security_logs;
create policy res_security_logs_insert_anon on public.res_security_logs
  for insert to anon
  with check (user_id is null);

-- Deliberately NO select policy for anon/authenticated: an audit trail that
-- its subject can read (or that an attacker can read to confirm what was
-- detected) is worth less. Read it from the Supabase dashboard, which uses
-- the service role and bypasses RLS.

-- ── Verification ────────────────────────────────────────────────────────────
select 'table' as check, count(*)::text as result
from information_schema.tables
where table_schema = 'public' and table_name = 'res_security_logs'
union all
select 'rls enabled', relrowsecurity::text from pg_class where relname = 'res_security_logs'
union all
select 'policies', count(*)::text from pg_policies
where schemaname = 'public' and tablename = 'res_security_logs';
