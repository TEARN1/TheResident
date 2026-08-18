-- ═══════════════════════════════════════════════════════════════════════════
-- 20260815001800_register_drift_job
--
-- Daily rather than hourly, deliberately. Schema does not change on its own —
-- somebody changes it — so hourly checking would add eleven extra chances a
-- day to send a message that says nothing. Once a day is enough to catch a
-- hand-edit before automation has run on it for long.
-- ═══════════════════════════════════════════════════════════════════════════

insert into public.res_jobs
  (name, description, schedule, tier, batch_size, max_rows_per_run, timeout_seconds, table_allowlist)
values
  (
    'drift_check',
    'Compares the live schema against the accepted snapshot and names exactly what changed. Additive change (new tables/columns, i.e. a migration not yet re-accepted) is reported but never opens an incident — a check that fires on every normal deploy is one nobody reads.',
    '25 6 * * *',
    'auto', 1, 100, 60,
    '{}'
  )
on conflict (name) do update
  set description      = excluded.description,
      schedule         = excluded.schedule;
      -- `enabled` deliberately untouched on re-run.

-- Re-accept the schema now that drift_check itself has changed it. Without
-- this, the first run would report its own registration row as drift, which
-- would be a memorable way to prove the point about crying wolf.
select public.res_accept_schema('re-accepted after registering drift_check');
