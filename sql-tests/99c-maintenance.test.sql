\set ON_ERROR_STOP on
-- The maintenance dispatcher.
--
-- The failure this guards against is not "a task errors" — it is "a task
-- errors and the whole run stops, so the other seven silently never happen
-- while the scheduler still reports that it ran". Numbered to run late so the
-- real functions exist where the harness builds them.

-- ── A run completes, and reports on every task ─────────────────────────────
select 'a_run_reports_on_every_task' as check,
  (select count(*) from public.res_run_maintenance()) = 8 as pass;

select 'every_task_is_recorded_with_its_outcome' as check,
  (select count(*) from res_maintenance_runs) >= 8 as pass;

select 'timings_are_recorded' as check,
  (select count(*) from res_maintenance_runs where duration_ms is null) = 0 as pass;

-- Baseline: which tasks succeed in THIS harness, before anything is broken.
create temp table baseline as
  select task, ok from res_maintenance_runs;

-- ── THE ONE THAT MATTERS: one failure does not stop the rest ───────────────
-- A task is deliberately broken, and the run must still complete every other
-- one. Without the per-task exception block, this aborts and seven jobs
-- quietly stop happening.
create or replace function public.res_prune_client_errors()
returns integer language plpgsql as $$
begin
  raise exception 'deliberate failure for the maintenance test';
end;
$$;

delete from res_maintenance_runs;

select 'a_failing_task_does_not_abort_the_run' as check,
  (select count(*) from public.res_run_maintenance()) = 8 as pass;

select 'the_failure_is_recorded_rather_than_swallowed' as check,
  exists (select 1 from res_maintenance_runs
          where task = 'res_prune_client_errors' and not ok
            and error like '%deliberate failure%') as pass;

-- Isolation is proved by comparison, not by a fixed count: this harness only
-- builds some of the eight functions, so the rest legitimately report "not
-- installed". What must hold is that breaking ONE task changes only that
-- task's outcome.
select 'breaking_one_task_changed_only_that_task' as check,
  (select count(*) from res_maintenance_runs r
    join baseline b on b.task = r.task
   where r.ok is distinct from b.ok) = 1 as pass;

select 'and_the_one_that_changed_is_the_one_that_was_broken' as check,
  (select r.task from res_maintenance_runs r
    join baseline b on b.task = r.task
   where r.ok is distinct from b.ok) = 'res_prune_client_errors' as pass;

-- The operator view has to make a failure obvious rather than bury it.
select 'the_status_view_reports_the_failure' as check,
  (select failures from public.res_maintenance_status(48)
   where task = 'res_prune_client_errors') = 1 as pass;

select 'the_status_view_carries_the_error_text' as check,
  (select last_error from public.res_maintenance_status(48)
   where task = 'res_prune_client_errors') like '%deliberate failure%' as pass;

-- Restore it so later reruns of the suite are unaffected.
create or replace function public.res_prune_client_errors()
returns integer language plpgsql security definer set search_path = public as $$
declare v_count integer;
begin
  delete from res_client_errors where created_at < now() - interval '90 days';
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- ── A missing function is a notice, not a crash ────────────────────────────
-- The dispatcher names tasks as strings, so a renamed or not-yet-applied
-- function must degrade rather than take the whole run down.
drop function if exists public.res_release_stale_claims();
delete from res_maintenance_runs;

select 'a_missing_task_is_reported_not_fatal' as check,
  (select count(*) from public.res_run_maintenance()) = 8 as pass;

select 'a_missing_task_says_so' as check,
  (select error from res_maintenance_runs where task = 'res_release_stale_claims') = 'not installed' as pass;

-- ── Nobody but the platform runs maintenance ───────────────────────────────
select 'residents_cannot_run_or_read_maintenance' as check,
  not has_function_privilege('authenticated', 'public.res_run_maintenance()', 'execute')
  and not has_function_privilege('authenticated', 'public.res_maintenance_status(integer)', 'execute')
  and not has_table_privilege('authenticated', 'public.res_maintenance_runs', 'select')
  and not has_table_privilege('anon', 'public.res_maintenance_runs', 'select') as pass;
