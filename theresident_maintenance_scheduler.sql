-- theresident_maintenance_scheduler.sql
--
-- Backlog B1: The Resident had ten maintenance functions and no scheduler.
-- cron.job held three entries, all of them Gruvs'. Every function below had
-- been written and had never executed once, so listings never expired, tools
-- never came back, logs grew without bound, and — written this same week —
-- free trials never lapsed.
--
-- TWO CORRECTIONS TO THE ORIGINAL DIAGNOSIS, found by reading signatures
-- rather than assuming:
--   * res_rotate_chores(p_listing, p_tasks, p_days) takes arguments. It is a
--     per-household setup call, not a sweep, and does not belong on a
--     schedule at all — it belongs in a UI that nothing currently provides.
--   * res_care_overdue() returns a TABLE. It reports who has missed a
--     check-in; it does not act. Scheduling it alone would achieve nothing.
--     It needs a caller that notifies somebody, which is separate work.
-- So eight functions are scheduled here, not ten.
--
-- ONE FAILURE MUST NOT STOP THE REST. Each task runs in its own block with
-- its own exception handler. A maintenance run that aborts halfway because
-- one table is locked is how a scheduler quietly stops doing seven other jobs
-- while still reporting that it ran.
--
-- AND IT HAS TO BE VISIBLE. A scheduler nobody can see the results of is the
-- same as no scheduler — the failure mode is silence in both cases. Every run
-- records what it did, how long it took, and what failed.
--
-- Paste into the Supabase SQL editor. Additive only.

create table if not exists public.res_maintenance_runs (
  id bigint generated always as identity primary key,
  task text not null,
  ok boolean not null,
  affected integer,
  error text,
  ran_at timestamptz not null default now(),
  duration_ms integer
);

create index if not exists res_maintenance_runs_recent_idx
  on public.res_maintenance_runs (ran_at desc);
create index if not exists res_maintenance_runs_failures_idx
  on public.res_maintenance_runs (task, ran_at desc) where not ok;

alter table public.res_maintenance_runs enable row level security;

-- Operational data. No policy and no grants: readable through the summary
-- function by service_role, and by nothing else.
revoke all on public.res_maintenance_runs from anon, authenticated;

create or replace function public.res_run_maintenance()
returns table (task text, ok boolean, affected integer, error text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tasks constant text[] := array[
    -- Content that should stop being shown once it is stale.
    'res_expire_stale_listings',
    'res_expire_market_items',
    'res_expire_stale_alerts',
    -- Things held by someone who has stopped acting on them.
    'res_auto_return_tools',
    'res_release_stale_claims',
    -- Billing state that is derived correctly but should also be durable.
    'res_expire_area_probations',
    -- Retention promises that are otherwise fiction.
    'res_prune_security_logs',
    'res_prune_client_errors'
  ];
  v_task text;
  v_affected integer;
  v_started timestamptz;
  v_error text;
begin
  foreach v_task in array v_tasks loop
    v_started := clock_timestamp();
    v_affected := null;
    v_error := null;

    begin
      -- Each in its own block: a run that aborts halfway is a scheduler that
      -- silently stops doing the remaining jobs while still looking alive.
      execute format('select %I()', v_task) into v_affected;
    exception
      when undefined_function then
        v_error := 'not installed';
      when others then
        v_error := left(sqlerrm, 500);
    end;

    insert into res_maintenance_runs (task, ok, affected, error, duration_ms)
    values (
      v_task, v_error is null, v_affected, v_error,
      (extract(epoch from (clock_timestamp() - v_started)) * 1000)::integer
    );

    task := v_task;
    ok := v_error is null;
    affected := v_affected;
    error := v_error;
    return next;
  end loop;
end;
$$;

revoke all on function public.res_run_maintenance() from public, anon, authenticated;
grant execute on function public.res_run_maintenance() to service_role;

-- What an operator looks at: did last night's run work, and what changed.
create or replace function public.res_maintenance_status(p_hours integer default 48)
returns table (
  task text,
  runs bigint,
  failures bigint,
  last_run timestamptz,
  last_ok boolean,
  last_affected integer,
  last_error text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    r.task,
    count(*) as runs,
    count(*) filter (where not r.ok) as failures,
    max(r.ran_at) as last_run,
    (array_agg(r.ok order by r.ran_at desc))[1] as last_ok,
    (array_agg(r.affected order by r.ran_at desc))[1] as last_affected,
    (array_agg(r.error order by r.ran_at desc))[1] as last_error
  from res_maintenance_runs r
  where r.ran_at > now() - make_interval(hours => greatest(1, least(p_hours, 720)))
  group by r.task
  order by count(*) filter (where not r.ok) desc, r.task;
$$;

revoke all on function public.res_maintenance_status(integer) from public, anon, authenticated;
grant execute on function public.res_maintenance_status(integer) to service_role;

-- The run log is itself retained data, so it prunes too. Ninety days keeps
-- enough history to notice a task that has been failing quietly for weeks.
create or replace function public.res_prune_maintenance_runs()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare v_count integer;
begin
  delete from res_maintenance_runs where ran_at < now() - interval '90 days';
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.res_prune_maintenance_runs() from public, anon, authenticated;
grant execute on function public.res_prune_maintenance_runs() to service_role;

-- ── Scheduling ─────────────────────────────────────────────────────────────
--
-- Run these once, after the functions above exist. Applied on the live
-- project on 2026-09-03 as jobs 4 and 5.
--
-- 02:20 UTC is deliberately BETWEEN the two Gruvs maintenance jobs (02:10 and
-- 02:40) rather than on top of either, so a slow run never overlaps theirs on
-- a database both apps share.
--
--   select cron.schedule('resident-maintenance', '20 2 * * *',
--                        'select public.res_run_maintenance()');
--
-- The run log is retained data too. Weekly, and later than the daily run so
-- it never prunes a log the same transaction is writing.
--
--   select cron.schedule('resident-prune-maintenance-log', '50 3 * * 0',
--                        'select public.res_prune_maintenance_runs()');
--
-- To check it afterwards:
--   select * from public.res_maintenance_status(48);
--   select jobid, jobname, schedule, active from cron.job;
