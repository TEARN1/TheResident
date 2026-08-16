-- ═══════════════════════════════════════════════════════════════════════════
-- 20260815000200_audit_log
--
-- Layer 0, Step 0.4 of docs/SELF-MANAGING.md.
--
-- The single most important table in the self-managing design. It is the
-- difference between a system you can debug and reverse, and one where you
-- can only observe that something changed and guess why.
--
-- Append-only by construction: no client role gets any grant at all, and a
-- trigger rejects UPDATE and DELETE even from service_role. If automation
-- could edit its own history, the history would be worthless.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.res_audit_log (
  id           bigserial primary key,
  at           timestamptz not null default now(),

  -- Who acted. 'job' is scheduled automation, 'policy' is a rule engine
  -- proposal that was executed, 'operator' is the LLM triage path, 'system'
  -- is a trigger or reconciler with no single named cause.
  actor_kind   text not null check (actor_kind in ('user','job','policy','operator','system')),
  actor_id     uuid,          -- profiles.id when actor_kind = 'user'
  job_name     text,          -- res_jobs.name when actor_kind = 'job'

  action       text not null, -- 'listing.expire', 'request.auto_expire'
  entity       text not null, -- 'res_listings'
  entity_id    uuid,

  before       jsonb,
  after        jsonb,

  -- Not null on purpose. If a job cannot articulate why it acted, it should
  -- not be acting.
  reason       text not null,

  -- Reversibility is designed in from the first write, not retrofitted after
  -- the first bad run. reverse_spec is the exact payload res_revert() replays.
  reversible   boolean not null default false,
  reverse_spec jsonb,
  reverted_by  bigint references public.res_audit_log(id),

  -- Groups every write made by one job run, so a whole bad run can be
  -- reverted in a single call.
  correlation  uuid,

  tier         text check (tier in ('auto','propose','human'))
);

create index if not exists idx_res_audit_entity      on public.res_audit_log (entity, entity_id, at desc);
create index if not exists idx_res_audit_job         on public.res_audit_log (job_name, at desc);
create index if not exists idx_res_audit_correlation on public.res_audit_log (correlation);
create index if not exists idx_res_audit_at          on public.res_audit_log (at desc);

-- ── Append-only enforcement ────────────────────────────────────────────────
create or replace function public.res_audit_log_immutable()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- reverted_by is the one permitted mutation: marking an entry as undone is
  -- itself part of the history, and the revert also writes its own new row.
  if tg_op = 'UPDATE'
     and to_jsonb(new) - 'reverted_by' = to_jsonb(old) - 'reverted_by' then
    return new;
  end if;
  raise exception 'res_audit_log is append-only (attempted %)', tg_op;
end;
$$;

drop trigger if exists trg_res_audit_immutable on public.res_audit_log;
create trigger trg_res_audit_immutable
  before update or delete on public.res_audit_log
  for each row execute function public.res_audit_log_immutable();

-- ── Access: service_role only ──────────────────────────────────────────────
alter table public.res_audit_log enable row level security;

revoke all on public.res_audit_log from public, anon, authenticated;
revoke all on sequence public.res_audit_log_id_seq from public, anon, authenticated;
grant select, insert, update on public.res_audit_log to service_role;
grant usage on sequence public.res_audit_log_id_seq to service_role;

-- No policy is created deliberately: RLS enabled with zero policies means
-- non-service roles can read nothing, which is the intent. Audit history is
-- operator data, not user data.

-- ── Write helper ───────────────────────────────────────────────────────────
-- Everything that mutates via automation calls this in the SAME transaction
-- as the mutation. No audit row, no write (enforced by the Guard, Layer 7).
create or replace function public.res_audit(
  p_actor_kind   text,
  p_action       text,
  p_entity       text,
  p_entity_id    uuid,
  p_reason       text,
  p_before       jsonb default null,
  p_after        jsonb default null,
  p_job_name     text default null,
  p_actor_id     uuid default null,
  p_correlation  uuid default null,
  p_tier         text default null,
  p_reversible   boolean default false,
  p_reverse_spec jsonb default null
) returns bigint
language plpgsql security definer
set search_path = public
as $$
declare v_id bigint;
begin
  if p_reason is null or length(trim(p_reason)) = 0 then
    raise exception 'res_audit: reason is required';
  end if;

  insert into public.res_audit_log (
    actor_kind, actor_id, job_name, action, entity, entity_id,
    before, after, reason, correlation, tier, reversible, reverse_spec)
  values (
    p_actor_kind, p_actor_id, p_job_name, p_action, p_entity, p_entity_id,
    p_before, p_after, p_reason, p_correlation, p_tier, p_reversible, p_reverse_spec)
  returning id into v_id;

  return v_id;
end;
$$;

revoke execute on function public.res_audit(text,text,text,uuid,text,jsonb,jsonb,text,uuid,uuid,text,boolean,jsonb) from public, anon, authenticated;
grant   execute on function public.res_audit(text,text,text,uuid,text,jsonb,jsonb,text,uuid,uuid,text,boolean,jsonb) to service_role;

comment on table public.res_audit_log is
  'Append-only record of every automated change. Service-role only. See docs/SELF-MANAGING.md Layer 0.';
