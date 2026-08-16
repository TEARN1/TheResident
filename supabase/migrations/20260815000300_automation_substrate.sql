-- ═══════════════════════════════════════════════════════════════════════════
-- 20260815000300_automation_substrate
--
-- Layer 2 of docs/SELF-MANAGING.md: the clock, the claim, the batch, the
-- record. No business logic lives here — this is the machinery every job
-- runs on, so that a job author writes a query and an action, and gets
-- leasing, capping, auditing, circuit-breaking and a kill switch for free.
--
-- Everything ships DISABLED. Enabling a job is a deliberate, separate act.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Policies (also the home of the global kill switch) ──────────────────
create table if not exists public.res_policies (
  key         text primary key,
  description text not null,
  params      jsonb not null default '{}'::jsonb,
  enabled     boolean not null default true,
  updated_by  uuid,
  updated_at  timestamptz not null default now()
);

alter table public.res_policies enable row level security;
revoke all on public.res_policies from public, anon, authenticated;
grant select, insert, update on public.res_policies to service_role;

-- The kill switch. Checked first in every dispatch, before anything else.
insert into public.res_policies (key, description, params, enabled)
values (
  'automation.enabled',
  'Global kill switch. When false, res_scheduler_begin refuses every job. One row, checked first, always.',
  '{}'::jsonb,
  false   -- ships OFF; turned on deliberately after the heartbeat soak
)
on conflict (key) do nothing;

insert into public.res_policies (key, description, params, enabled)
values (
  'automation.rate_of_change_limit',
  'Halt all automation if it modifies more than pct_per_day of any table in 24h. The circuit breaker for the whole system.',
  '{"pct_per_day": 25}'::jsonb,
  true
),
(
  'automation.notification_cap',
  'Maximum automated notifications a single user may receive per day across all jobs. Prevents five individually-correct jobs from together feeling like spam.',
  '{"per_user_per_day": 8}'::jsonb,
  true
)
on conflict (key) do nothing;

-- ── 2. Job registry ────────────────────────────────────────────────────────
create table if not exists public.res_jobs (
  name                 text primary key,
  description          text not null,
  schedule             text not null,               -- cron expression
  enabled              boolean not null default false,
  tier                 text not null default 'auto'
                       check (tier in ('auto','propose','human')),

  -- Blast radius. batch_size is one statement's worth; max_rows_per_run caps
  -- the whole run. Exceeding the run cap aborts rather than committing a
  -- partial mass mutation.
  batch_size           int not null default 200 check (batch_size between 1 and 5000),
  max_rows_per_run     int not null default 1000 check (max_rows_per_run between 1 and 100000),
  timeout_seconds      int not null default 60,

  -- Crash-safe lock: a lease expires on its own, so a killed function never
  -- leaves a stuck job behind.
  lease_until          timestamptz,
  lease_owner          uuid,

  last_run_at          timestamptz,
  last_status          text check (last_status in ('ok','partial','failed','skipped')),
  last_error           text,
  consecutive_failures int not null default 0,
  circuit_open_until   timestamptz,

  -- Tables this job is allowed to touch. The Guard denies anything else, and
  -- `profiles` may never appear here (CONTRACT.md §3).
  table_allowlist      text[] not null default '{}',

  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

alter table public.res_jobs enable row level security;
revoke all on public.res_jobs from public, anon, authenticated;
grant select, insert, update on public.res_jobs to service_role;

-- Hard guarantee, not a convention: no job can ever be granted write access
-- to the Gruvs-owned profiles table (CONTRACT.md §2/§3).
create or replace function public.res_jobs_allowlist_guard()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.table_allowlist && array['profiles','auth.users','res_purchases','res_subscriptions'] then
    raise exception
      'res_jobs.table_allowlist may not contain %, it is owned by another system or is money-bearing (CONTRACT.md §2/§6)',
      new.table_allowlist;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_res_jobs_allowlist on public.res_jobs;
create trigger trg_res_jobs_allowlist
  before insert or update on public.res_jobs
  for each row execute function public.res_jobs_allowlist_guard();

drop trigger if exists trg_touch_res_jobs on public.res_jobs;
create trigger trg_touch_res_jobs before update on public.res_jobs
  for each row execute function public.touch_updated_at();

-- ── 3. Run history ─────────────────────────────────────────────────────────
create table if not exists public.res_job_runs (
  id            bigserial primary key,
  job_name      text not null references public.res_jobs(name) on delete cascade,
  correlation   uuid not null default gen_random_uuid(),
  started_at    timestamptz not null default now(),
  finished_at   timestamptz,
  status        text check (status in ('running','ok','partial','failed','skipped')),
  dry_run       boolean not null default false,
  rows_scanned  int not null default 0,
  rows_affected int not null default 0,
  detail        jsonb,
  error         text
);

create index if not exists idx_res_job_runs_job on public.res_job_runs (job_name, started_at desc);
create index if not exists idx_res_job_runs_corr on public.res_job_runs (correlation);

alter table public.res_job_runs enable row level security;
revoke all on public.res_job_runs from public, anon, authenticated;
grant select, insert, update on public.res_job_runs to service_role;
grant usage on sequence public.res_job_runs_id_seq to service_role;

-- ── 4. Effect keys (idempotency for side effects) ──────────────────────────
-- Guarded updates are naturally idempotent; notifications are not. Insert the
-- key first, and if it conflicts, skip the send. This is what stops "job
-- retried, user got 40 push notifications at 3am".
create table if not exists public.res_effect_keys (
  key text primary key,
  at  timestamptz not null default now()
);

create index if not exists idx_res_effect_keys_at on public.res_effect_keys (at);

alter table public.res_effect_keys enable row level security;
revoke all on public.res_effect_keys from public, anon, authenticated;
grant select, insert, delete on public.res_effect_keys to service_role;

-- ── 5. Lease / lifecycle RPCs ──────────────────────────────────────────────

-- Begin a run. Returns null when the job must not run, with the reason
-- already recorded. The kill switch is checked FIRST, always.
create or replace function public.res_scheduler_begin(
  p_job text,
  p_owner uuid,
  p_dry_run boolean default false
) returns table (run_id bigint, correlation uuid, batch_size int, max_rows int)
language plpgsql security definer
set search_path = public
as $$
declare
  v_job    record;
  v_global boolean;
  v_run    record;
  v_corr   uuid := gen_random_uuid();
begin
  -- 1. Global kill switch, before anything else.
  select enabled into v_global from res_policies where key = 'automation.enabled';
  if coalesce(v_global, false) = false then
    update res_jobs set last_status = 'skipped', last_error = 'automation disabled globally'
     where name = p_job;
    return;
  end if;

  -- 2. Job enabled, and circuit closed. A dry run bypasses neither.
  select * into v_job from res_jobs where name = p_job;
  if not found then
    raise exception 'unknown job %', p_job;
  end if;
  if not v_job.enabled then
    update res_jobs set last_status = 'skipped', last_error = 'job disabled' where name = p_job;
    return;
  end if;
  if v_job.circuit_open_until is not null and v_job.circuit_open_until > now() then
    update res_jobs set last_status = 'skipped', last_error = 'circuit open' where name = p_job;
    return;
  end if;

  -- 3. Acquire the lease. Zero rows updated means someone else holds it.
  update res_jobs
     set lease_until = now() + make_interval(secs => timeout_seconds),
         lease_owner = p_owner
   where name = p_job
     and (lease_until is null or lease_until < now());

  if not found then
    return;  -- another instance is running this job; exit quietly
  end if;

  insert into res_job_runs (job_name, correlation, status, dry_run)
  values (p_job, v_corr, 'running', p_dry_run)
  returning * into v_run;

  return query select v_run.id, v_corr, v_job.batch_size, v_job.max_rows_per_run;
end;
$$;

-- Close a run, release the lease, and trip the circuit after 3 failures.
create or replace function public.res_scheduler_end(
  p_run_id bigint,
  p_status text,
  p_rows_scanned int default 0,
  p_rows_affected int default 0,
  p_detail jsonb default null,
  p_error text default null
) returns void
language plpgsql security definer
set search_path = public
as $$
declare v_job text;
begin
  update res_job_runs
     set finished_at = now(), status = p_status, rows_scanned = p_rows_scanned,
         rows_affected = p_rows_affected, detail = p_detail, error = p_error
   where id = p_run_id
  returning job_name into v_job;

  if v_job is null then
    raise exception 'unknown run %', p_run_id;
  end if;

  update res_jobs
     set lease_until = null,
         lease_owner = null,
         last_run_at = now(),
         last_status = p_status,
         last_error  = p_error,
         consecutive_failures =
           case when p_status = 'failed' then consecutive_failures + 1 else 0 end,
         circuit_open_until =
           case when p_status = 'failed' and consecutive_failures + 1 >= 3
                then now() + interval '30 minutes'
                else null end
   where name = v_job;
end;
$$;

-- ── 6. Revert ──────────────────────────────────────────────────────────────
-- Built BEFORE the first job runs, not after the first bad run. Reverting a
-- whole correlation undoes an entire job run in one call.
create or replace function public.res_revert(p_audit_id bigint, p_reason text)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_entry record;
  v_sql   text;
  v_cols  text;
begin
  select * into v_entry from res_audit_log where id = p_audit_id;
  if not found then
    raise exception 'audit entry % not found', p_audit_id;
  end if;
  if not v_entry.reversible then
    raise exception 'audit entry % is not reversible', p_audit_id;
  end if;
  if v_entry.reverted_by is not null then
    raise exception 'audit entry % was already reverted by %', p_audit_id, v_entry.reverted_by;
  end if;
  if v_entry.before is null then
    raise exception 'audit entry % has no before-state to restore', p_audit_id;
  end if;

  -- Restore only the columns the entry actually recorded as changed.
  select string_agg(format('%I = ($1->>%L)::text', k, k), ', ')
    into v_cols
    from jsonb_object_keys(v_entry.before) as k
   where k not in ('id','created_at');

  if v_cols is null then
    raise exception 'audit entry % records no restorable columns', p_audit_id;
  end if;

  v_sql := format('update public.%I set %s where id = $2', v_entry.entity, v_cols);
  execute v_sql using v_entry.before, v_entry.entity_id;

  update res_audit_log set reverted_by = (
    select res_audit(
      'operator', v_entry.action || '.revert', v_entry.entity, v_entry.entity_id,
      p_reason, v_entry.after, v_entry.before, v_entry.job_name, null,
      v_entry.correlation, 'human', false, null)
  ) where id = p_audit_id;

  return jsonb_build_object('reverted', p_audit_id, 'entity', v_entry.entity, 'entity_id', v_entry.entity_id);
end;
$$;

revoke execute on function public.res_scheduler_begin(text,uuid,boolean) from public, anon, authenticated;
revoke execute on function public.res_scheduler_end(bigint,text,int,int,jsonb,text) from public, anon, authenticated;
revoke execute on function public.res_revert(bigint,text) from public, anon, authenticated;

grant execute on function public.res_scheduler_begin(text,uuid,boolean) to service_role;
grant execute on function public.res_scheduler_end(bigint,text,int,int,jsonb,text) to service_role;
grant execute on function public.res_revert(bigint,text) to service_role;

comment on table public.res_jobs is
  'Job registry. Ships disabled; see docs/SELF-MANAGING.md Layer 2.';
