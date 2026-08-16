-- ═══════════════════════════════════════════════════════════════════════════
-- 20260815000600_register_jobs
--
-- Registers the first two jobs and their cron entries.
--
-- Both ship DISABLED, and the global automation.enabled switch is also off, so
-- applying this migration changes no data and runs nothing. Two independent
-- switches have to be thrown deliberately before automation touches a row.
--
-- Enabling sequence (docs/SELF-MANAGING.md, P3 → P4):
--   1. update res_jobs set enabled = true where name = 'heartbeat';
--   2. update res_policies set enabled = true where key = 'automation.enabled';
--   3. soak 48h; confirm res_job_runs is clean and leases release
--   4. dry-run expire_traffic_reports and READ the output yourself
--   5. enable expire_traffic_reports
-- ═══════════════════════════════════════════════════════════════════════════

insert into public.res_jobs
  (name, description, schedule, tier, batch_size, max_rows_per_run, timeout_seconds, table_allowlist)
values
  (
    'heartbeat',
    'Writes nothing. Soaks the substrate before any data-changing job runs on it, and afterwards keeps proving the scheduler is alive — a scheduler with no traffic is indistinguishable from one that silently stopped.',
    '*/15 * * * *',
    'auto', 1, 1, 30,
    '{}'
  ),
  (
    'expire_traffic_reports',
    'Archives crowd-reported hazards past a per-type freshness window (congestion 2h … pothole 30d). Stale safety data is worse than none: it teaches people to ignore the map.',
    '13 * * * *',        -- :13, staggered so jobs never stampede on the hour
    'auto', 200, 1000, 60,
    array['res_traffic_reports']
  )
on conflict (name) do update
  set description      = excluded.description,
      schedule         = excluded.schedule,
      batch_size       = excluded.batch_size,
      max_rows_per_run = excluded.max_rows_per_run,
      table_allowlist  = excluded.table_allowlist;
      -- deliberately NOT updating `enabled`: re-running a migration must never
      -- switch automation on behind your back.

-- ── Cron entries ───────────────────────────────────────────────────────────
-- pg_cron and pg_net are both already installed on this project.
--
-- The scheduler URL and secret live in database settings rather than in this
-- file, because a migration is committed to git and a bearer token must not
-- be. Set them once, per environment:
--
--   alter database postgres set app.scheduler_url    = 'https://<ref>.supabase.co/functions/v1/res-scheduler';
--   alter database postgres set app.scheduler_secret = '<generated secret>';
--
-- and set the same secret as SCHEDULER_SECRET in the edge function's env. The
-- function refuses every request when that variable is unset — it fails closed
-- rather than falling back to open.

do $$
declare
  v_url    text := current_setting('app.scheduler_url', true);
  v_secret text := current_setting('app.scheduler_secret', true);
  v_job    record;
begin
  if v_url is null or v_secret is null then
    raise notice
      'app.scheduler_url / app.scheduler_secret not set — cron entries skipped. '
      'Set them and re-run this DO block to schedule the jobs.';
    return;
  end if;

  for v_job in select name, schedule from public.res_jobs loop
    -- Unschedule first so re-running is idempotent and a changed schedule
    -- actually takes effect.
    perform cron.unschedule('res_' || v_job.name)
      where exists (select 1 from cron.job where jobname = 'res_' || v_job.name);

    perform cron.schedule(
      'res_' || v_job.name,
      v_job.schedule,
      format(
        $cron$select net.http_post(
          url := %L,
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || %L),
          body := jsonb_build_object('job', %L)
        );$cron$,
        v_url, v_secret, v_job.name)
    );
  end loop;

  raise notice 'cron entries created for % job(s)', (select count(*) from public.res_jobs);
end $$;
