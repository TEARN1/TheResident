-- ═══════════════════════════════════════════════════════════════════════════
-- 20260815001100_register_sponsorship_job
--
-- Registers expire_sponsorships. Disabled on arrival, like every other job,
-- and also behind the global automation.enabled switch.
--
-- Daily at 06:20 rather than hourly: a placement ending is not urgent to the
-- minute, and a renewal reminder that arrives once in the morning is a message
-- a person reads. The stagger keeps it clear of the other scheduled work.
-- ═══════════════════════════════════════════════════════════════════════════

insert into public.res_jobs
  (name, description, schedule, tier, batch_size, max_rows_per_run, timeout_seconds, table_allowlist)
values
  (
    'expire_sponsorships',
    'Ends paid placements when their term is up, and warns the sponsor a week before so a placement never lapses silently on a paying customer. Can end a placement but never start one — activation is an operator action, because payment lands off-platform.',
    '20 6 * * *',
    'auto', 200, 500, 60,
    array['res_sponsorships']
  )
on conflict (name) do update
  set description      = excluded.description,
      schedule         = excluded.schedule,
      batch_size       = excluded.batch_size,
      max_rows_per_run = excluded.max_rows_per_run,
      table_allowlist  = excluded.table_allowlist;
      -- `enabled` deliberately untouched on re-run.
