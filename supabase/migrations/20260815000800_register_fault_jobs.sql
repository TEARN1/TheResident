-- ═══════════════════════════════════════════════════════════════════════════
-- 20260815000800_register_fault_jobs
--
-- Registers escalate_faults. Ships DISABLED like every other job, behind the
-- global automation.enabled switch as well.
--
-- Cadence is 5 minutes rather than hourly for one reason: immediate-danger
-- faults (a downed conductor, an open substation, a sewage spill) escalate on
-- the first report without waiting for corroboration, so the loop between
-- "someone reports it" and "the provider is told" has to be short enough to
-- matter. An ordinary outage would be fine hourly; a live wire is not.
-- ═══════════════════════════════════════════════════════════════════════════

insert into public.res_jobs
  (name, description, schedule, tier, batch_size, max_rows_per_run, timeout_seconds, table_allowlist)
values
  (
    'escalate_faults',
    'Scores the vouches on every open fault and escalates to the provider once the evidence threshold is met — or records exactly what is still missing, so residents know how to help. Also verifies resolutions, reopens false closures, and lapses faults nobody re-confirms.',
    '*/5 * * * *',
    'auto', 200, 1000, 90,
    array['res_faults']
  )
on conflict (name) do update
  set description      = excluded.description,
      schedule         = excluded.schedule,
      batch_size       = excluded.batch_size,
      max_rows_per_run = excluded.max_rows_per_run,
      table_allowlist  = excluded.table_allowlist;
      -- `enabled` deliberately untouched: re-running a migration must never
      -- switch automation on behind your back.
