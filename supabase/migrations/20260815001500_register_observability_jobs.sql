-- ═══════════════════════════════════════════════════════════════════════════
-- 20260815001500_register_observability_jobs
--
-- Both disabled on arrival, like every other job.
--
-- Enable these FIRST, before any job that changes data. They write nothing to
-- domain tables, so they are safe to run early — and once they are running you
-- can see what the data-changing jobs do when you switch them on, instead of
-- finding out afterwards.
-- ═══════════════════════════════════════════════════════════════════════════

insert into public.res_jobs
  (name, description, schedule, tier, batch_size, max_rows_per_run, timeout_seconds, table_allowlist)
values
  (
    'metrics_rollup',
    'Counts the last hour into res_metrics, then compares it against the previous week and opens an incident when something is genuinely out of character. Also checks the conditions that are wrong by definition rather than by statistics — an unprocessed critical alert, schema drift, a job failing repeatedly.',
    '5 * * * *',
    'auto', 1, 100, 60,
    '{}'
  ),
  (
    'daily_digest',
    'One message each morning: what automation did, what it could not decide, and what looks wrong. The middle section is the point — a system that only reports its successes is indistinguishable from one that has quietly stopped.',
    '0 7 * * *',
    'auto', 1, 50, 60,
    '{}'
  )
on conflict (name) do update
  set description      = excluded.description,
      schedule         = excluded.schedule,
      max_rows_per_run = excluded.max_rows_per_run;
      -- `enabled` deliberately untouched on re-run.

-- Who receives the digest. Empty by default: the job reports "no recipients
-- configured" rather than silently succeeding, so a digest nobody set up does
-- not look like a digest with nothing to say.
insert into public.res_policies (key, description, params, enabled) values
(
  'automation.digest_recipients',
  'profiles.id values that receive the daily digest. A policy row rather than a hardcoded id, so adding a second person is a config change and not a deploy.',
  '{"user_ids": []}'::jsonb,
  true
)
on conflict (key) do nothing;
