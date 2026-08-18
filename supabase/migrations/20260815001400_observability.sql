-- ═══════════════════════════════════════════════════════════════════════════
-- 20260815001400_observability — Layer 6 of docs/SELF-MANAGING.md
--
-- A system that cannot see itself is unattended, not autonomous. Two tables
-- and a collector, so the app can answer three questions every morning without
-- anybody opening a SQL editor:
--
--   what did I do          → res_audit_log, already there
--   what could I not decide → the queues below
--   what looks wrong        → res_metrics + res_incidents
--
-- Aggregates only. res_metrics counts things per hour; it never records who
-- did them. The audit log already holds the per-action detail, and duplicating
-- identity into a metrics table would create a second, weaker-protected copy
-- of the same personal data for no gain.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.res_metrics (
  name    text not null,
  bucket  timestamptz not null,           -- start of the hour
  value   numeric not null,
  dims    jsonb not null default '{}'::jsonb,
  primary key (name, bucket, dims)
);

create index if not exists idx_res_metrics_name_bucket
  on public.res_metrics (name, bucket desc);

-- Partitioning was considered and deliberately skipped: at one row per metric
-- per hour this table grows by roughly 60k rows a year, which is nothing. The
-- prune job below keeps 90 days.

create table if not exists public.res_incidents (
  id          bigserial primary key,
  kind        text not null,
  severity    int not null check (severity between 1 and 4),
  message     text not null,
  detail      jsonb,
  opened_at   timestamptz not null default now(),
  closed_at   timestamptz,
  auto_closed boolean not null default false,
  ack_by      uuid references public.profiles(id) on delete set null,
  ack_at      timestamptz
);

create index if not exists idx_res_incidents_open
  on public.res_incidents (severity, opened_at desc) where closed_at is null;

-- One open incident per kind at a time. Without this a job failing every five
-- minutes opens 288 incidents a day and the digest becomes unreadable — which
-- is the same as having no digest.
create unique index if not exists idx_res_incidents_one_open_per_kind
  on public.res_incidents (kind) where closed_at is null;

alter table public.res_metrics   enable row level security;
alter table public.res_incidents enable row level security;

revoke all on public.res_metrics   from public, anon, authenticated;
revoke all on public.res_incidents from public, anon, authenticated;
grant select, insert, update, delete on public.res_metrics   to service_role;
grant select, insert, update on public.res_incidents to service_role;
grant usage on sequence public.res_incidents_id_seq to service_role;

-- ── Recording ──────────────────────────────────────────────────────────────
create or replace function public.res_record_metric(
  p_name text, p_value numeric, p_bucket timestamptz default date_trunc('hour', now()),
  p_dims jsonb default '{}'::jsonb
) returns void
language sql security definer
set search_path = public
as $fn$
  insert into res_metrics (name, bucket, value, dims)
  values (p_name, p_bucket, p_value, p_dims)
  on conflict (name, bucket, dims) do update set value = excluded.value;
$fn$;

-- Opens an incident, or leaves the existing open one alone.
--
-- Returning the id either way lets a caller be idempotent without checking
-- first, which matters because the collector runs on a schedule and will
-- rediscover the same problem every hour until it is fixed.
create or replace function public.res_open_incident(
  p_kind text, p_severity int, p_message text, p_detail jsonb default null
) returns bigint
language plpgsql security definer
set search_path = public
as $fn$
declare v_id bigint;
begin
  select id into v_id from res_incidents where kind = p_kind and closed_at is null;
  if found then
    -- Refresh the message so the digest shows current numbers, but keep
    -- opened_at so "this has been broken for six hours" stays true.
    update res_incidents set message = p_message, detail = coalesce(p_detail, detail)
     where id = v_id;
    return v_id;
  end if;

  insert into res_incidents (kind, severity, message, detail)
  values (p_kind, p_severity, p_message, p_detail)
  returning id into v_id;

  perform res_audit('system', 'incident.open', 'res_incidents', null,
    format('[sev %s] %s', p_severity, p_message), null,
    jsonb_build_object('kind', p_kind, 'severity', p_severity),
    null, null, null, null, false, null);

  return v_id;
end;
$fn$;

create or replace function public.res_close_incident(
  p_kind text, p_auto boolean default true
) returns void
language plpgsql security definer
set search_path = public
as $fn$
begin
  update res_incidents
     set closed_at = now(), auto_closed = p_auto
   where kind = p_kind and closed_at is null;
end;
$fn$;

-- ── The morning read ───────────────────────────────────────────────────────
-- Everything the digest needs, in one call, so the job is a formatter rather
-- than a pile of queries.
create or replace function public.res_daily_snapshot(p_since interval default '24 hours')
returns jsonb
language plpgsql stable security definer
set search_path = public
as $fn$
declare
  v_did       jsonb;
  v_incidents jsonb;
  v_pending   jsonb;
begin
  -- What automation did.
  select coalesce(jsonb_object_agg(action, n), '{}'::jsonb) into v_did
    from (select action, count(*) as n from res_audit_log
           where at > now() - p_since and actor_kind = 'job'
           group by action order by 2 desc limit 20) t;

  -- What looks wrong.
  select coalesce(jsonb_agg(jsonb_build_object(
           'kind', kind, 'severity', severity, 'message', message,
           'open_since', opened_at) order by severity, opened_at), '[]'::jsonb)
    into v_incidents
    from res_incidents where closed_at is null;

  -- What is waiting on a human. Deliberately the things only a person can
  -- resolve — automation has already done everything it is allowed to.
  select jsonb_build_object(
    'faults_awaiting_provider', (
      select count(*) from res_faults
       where status = 'escalated' and acknowledged_at is null and archived_at is null),
    'faults_needing_more_confirmations', (
      select count(*) from res_faults
       where status in ('reported','corroborated') and archived_at is null),
    'sponsorships_pending_payment', (
      select count(*) from res_sponsorships where status = 'pending'),
    'sponsorships_ending_this_week', (
      select count(*) from res_sponsorships
       where status = 'active' and ends_at < now() + interval '7 days'),
    'disputes_unmediated', (
      select count(*) from res_community_disputes where status = 'pending')
  ) into v_pending;

  return jsonb_build_object(
    'generated_at', now(),
    'did', v_did,
    'needs_you', v_pending,
    'looks_wrong', v_incidents);
end;
$fn$;

revoke execute on function public.res_record_metric(text,numeric,timestamptz,jsonb) from public, anon, authenticated;
revoke execute on function public.res_open_incident(text,int,text,jsonb) from public, anon, authenticated;
revoke execute on function public.res_close_incident(text,boolean) from public, anon, authenticated;
revoke execute on function public.res_daily_snapshot(interval) from public, anon, authenticated;

grant execute on function public.res_record_metric(text,numeric,timestamptz,jsonb) to service_role;
grant execute on function public.res_open_incident(text,int,text,jsonb) to service_role;
grant execute on function public.res_close_incident(text,boolean) to service_role;
grant execute on function public.res_daily_snapshot(interval) to service_role;

comment on table public.res_metrics is
  'Hourly counts. Aggregates only — never who did something, only how many times it happened.';
comment on index public.idx_res_incidents_one_open_per_kind is
  'One open incident per kind. A job failing every 5 minutes must not open 288 incidents a day and make the digest unreadable.';
