-- theresident_area_billing_schema.sql
--
-- Phase F of docs/OFFICIAL-BROADCAST-STRATEGY.md: area broadcasting becomes a
-- paid capability, after a six-month free probation per official body.
--
-- THE ONE RULE THAT OVERRIDES BILLING. A `critical` notice — evacuation,
-- disaster, missing child — sends whether or not anyone has paid, and whether
-- or not the probation has expired. A municipality whose card was declined
-- must still be able to tell people to leave. Charging for the ability to warn
-- someone their street is on fire is not a business model this app will have.
-- Everything below `critical` is gated; `critical` never is.
--
-- WHY A SEPARATE TABLE FROM res_subscriptions. That table is keyed
-- (user_id, product) — it licenses a person. Area broadcasting licenses an
-- OFFICE: a ward councillor's unit may have several senders, and the licence
-- must survive the councillor's account being replaced by their successor.
-- So billing is keyed by unit, not by user.
--
-- FREE FOREVER, UNCHANGED: follow-based broadcasting. Any unit, verified or
-- not, can still post to people who chose to follow it. Nothing in this file
-- touches that path. Only location-based reach — messaging people who never
-- opted in — is what is being sold.
--
-- Paste into the Supabase SQL editor. Additive only.

-- ── 1. WHAT AN OFFICE PAYS ─────────────────────────────────────────────────
--
-- Priced by the level of the jurisdiction, because reach is the thing being
-- bought. Mirrors src/utils/pricing.ts, which is the source of truth for the
-- rand amounts; the plan KEY is what matters here.
create or replace function public.res_area_plan_for_level(p_level text)
returns text
language sql
immutable
set search_path = public
as $$
  select case p_level
    when 'ward' then 'area_ward'
    when 'service_area' then 'area_institution'
    when 'municipality' then 'area_municipal'
    when 'district' then 'area_municipal'
    when 'province' then 'area_provincial'
    when 'national' then 'area_national'
    else 'area_institution'
  end;
$$;

revoke all on function public.res_area_plan_for_level(text) from public, anon;
grant execute on function public.res_area_plan_for_level(text) to authenticated, service_role;

-- ── 2. THE LICENCE ─────────────────────────────────────────────────────────

create table if not exists public.res_org_unit_billing (
  unit_id uuid primary key references public.res_org_units(id) on delete cascade,
  -- 'probation'  free trial running
  -- 'active'     paid and current
  -- 'lapsed'     trial ended or payment stopped
  -- 'exempt'     never billed — for bodies that must always reach people
  status text not null default 'probation'
    check (status in ('probation', 'active', 'lapsed', 'exempt')),
  plan text,
  probation_started_at timestamptz not null default now(),
  probation_ends_at timestamptz not null default now() + interval '6 months',
  paystack_customer_code text,
  paystack_subscription_code text,
  current_period_end timestamptz,
  -- Why an exemption was granted, so it is a decision on the record rather
  -- than an unexplained free account.
  exempt_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.res_org_unit_billing enable row level security;

-- A unit's own senders may see their billing state — they need to know the
-- trial is ending. Nobody else does: what an office pays is not public the
-- way its broadcasts are.
drop policy if exists res_unit_billing_select on public.res_org_unit_billing;
create policy res_unit_billing_select on public.res_org_unit_billing
  for select to authenticated
  using (public.res_user_is_sender_of_or_above(unit_id, (select auth.uid())));

-- No insert/update/delete policy: written only by the Paystack webhook and
-- the functions below, both service_role. A unit cannot mark itself paid.
revoke all on public.res_org_unit_billing from anon, authenticated;
grant select on public.res_org_unit_billing to authenticated;

create index if not exists res_org_unit_billing_status_idx
  on public.res_org_unit_billing (status, probation_ends_at);

-- ── 3. PROBATION STARTS WHEN THE OFFICE CAN ACTUALLY USE IT ────────────────
--
-- Not at signup: a unit with no verified status and no boundary cannot send
-- to an area at all, so starting its free six months then would burn the trial
-- while the thing being trialled is unusable. The clock starts the moment the
-- unit is both verified and bound to a jurisdiction.
create or replace function public.res_ensure_area_probation(p_unit uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into res_org_unit_billing (unit_id, status, plan)
  select u.id, 'probation', public.res_area_plan_for_level(j.level)
  from res_org_units u
  join res_jurisdictions j on j.id = u.jurisdiction_id
  where u.id = p_unit and u.verified = true
  on conflict (unit_id) do nothing;
end;
$$;

revoke all on function public.res_ensure_area_probation(uuid) from public, anon, authenticated;
grant execute on function public.res_ensure_area_probation(uuid) to service_role;

create or replace function public.res_start_area_probation_on_verify()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.verified = true and new.jurisdiction_id is not null then
    perform public.res_ensure_area_probation(new.id);
  end if;
  return new;
end;
$$;

revoke all on function public.res_start_area_probation_on_verify() from public, anon, authenticated;

drop trigger if exists res_org_units_start_probation on public.res_org_units;
create trigger res_org_units_start_probation
  after insert or update of verified, jurisdiction_id on public.res_org_units
  for each row execute function public.res_start_area_probation_on_verify();

-- KNOWN LIMIT: probation is per unit, so creating a SECOND unit for the same
-- ward would start a second free six months. Nothing here prevents that,
-- because the thing that actually gates it is human: a unit cannot broadcast
-- to an area until someone verifies it and binds it to a jurisdiction. If
-- verification ever becomes self-serve, this needs a jurisdiction-level check
-- before it becomes a real hole.

-- ── 4. MAY THIS OFFICE SEND? ───────────────────────────────────────────────
--
-- Returns the state rather than a bare boolean, because the composer has to
-- tell an official WHY and how long they have left — "your free period ends in
-- 12 days" is the message that gets a licence renewed; a disabled button is
-- not.
create or replace function public.res_area_billing_state(p_unit uuid)
returns table (
  state text,
  plan text,
  days_remaining integer,
  allows_routine boolean
)
language sql
stable
security definer
set search_path = public
as $$
  -- Scoped to the office's own senders, matching the RLS policy on the table.
  -- Without this, `security definer` would make whether any given office is
  -- paying, lapsed or on trial readable by every signed-in user — a small
  -- leak, but one that says something about a public body's finances that is
  -- nobody else's business, and it would contradict the table's own policy.
  select
    case
      when b.unit_id is null then 'none'
      when b.status = 'exempt' then 'exempt'
      when b.status = 'active'
        and (b.current_period_end is null or b.current_period_end > now()) then 'active'
      when b.status = 'probation' and b.probation_ends_at > now() then 'probation'
      else 'lapsed'
    end as state,
    b.plan,
    case
      when b.status = 'probation' and b.probation_ends_at > now()
        then greatest(0, ceil(extract(epoch from (b.probation_ends_at - now())) / 86400)::integer)
      when b.status = 'active' and b.current_period_end is not null
        then greatest(0, ceil(extract(epoch from (b.current_period_end - now())) / 86400)::integer)
      else null
    end as days_remaining,
    -- Routine notices need a live licence. `critical` bypasses this entirely
    -- and is never consulted against it — see the send path.
    (b.unit_id is not null and (
       b.status = 'exempt'
       or (b.status = 'active' and (b.current_period_end is null or b.current_period_end > now()))
       or (b.status = 'probation' and b.probation_ends_at > now())
    )) as allows_routine
  from (select p_unit as unit_id) k
  left join res_org_unit_billing b on b.unit_id = k.unit_id
  where public.res_user_is_sender_of_or_above(p_unit, auth.uid());
$$;

revoke all on function public.res_area_billing_state(uuid) from public, anon;
grant execute on function public.res_area_billing_state(uuid) to authenticated, service_role;

-- ── 5. SERVICE-ROLE WRITES ─────────────────────────────────────────────────
--
-- Called by the Paystack webhook. Kept as an RPC rather than a direct table
-- write so the shape of a licence change lives in one place.
create or replace function public.res_set_area_billing(
  p_unit uuid,
  p_status text,
  p_plan text default null,
  p_customer_code text default null,
  p_subscription_code text default null,
  p_period_end timestamptz default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into res_org_unit_billing (
    unit_id, status, plan, paystack_customer_code,
    paystack_subscription_code, current_period_end, updated_at
  ) values (
    p_unit, p_status, p_plan, p_customer_code,
    p_subscription_code, p_period_end, now()
  )
  on conflict (unit_id) do update set
    status = excluded.status,
    plan = coalesce(excluded.plan, res_org_unit_billing.plan),
    paystack_customer_code = coalesce(excluded.paystack_customer_code, res_org_unit_billing.paystack_customer_code),
    paystack_subscription_code = coalesce(excluded.paystack_subscription_code, res_org_unit_billing.paystack_subscription_code),
    current_period_end = coalesce(excluded.current_period_end, res_org_unit_billing.current_period_end),
    updated_at = now();
end;
$$;

revoke all on function public.res_set_area_billing(uuid, text, text, text, text, timestamptz) from public, anon, authenticated;
grant execute on function public.res_set_area_billing(uuid, text, text, text, text, timestamptz) to service_role;

-- Exempting a body is a deliberate act with a stated reason. Not self-serve.
create or replace function public.res_exempt_unit_from_area_billing(p_unit uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(trim(p_reason), '') = '' then
    raise exception 'exemption_needs_a_reason';
  end if;
  insert into res_org_unit_billing (unit_id, status, exempt_reason, updated_at)
  values (p_unit, 'exempt', trim(p_reason), now())
  on conflict (unit_id) do update set
    status = 'exempt', exempt_reason = trim(p_reason), updated_at = now();
end;
$$;

revoke all on function public.res_exempt_unit_from_area_billing(uuid, text) from public, anon, authenticated;
grant execute on function public.res_exempt_unit_from_area_billing(uuid, text) to service_role;

-- Sweeps expired probations to 'lapsed' so the state is durable rather than
-- only ever derived. res_area_billing_state already treats an expired
-- probation as lapsed, so this is bookkeeping, not enforcement — running it
-- late can never let an unlicensed send through.
create or replace function public.res_expire_area_probations()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  update res_org_unit_billing
     set status = 'lapsed', updated_at = now()
   where status = 'probation' and probation_ends_at <= now();
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.res_expire_area_probations() from public, anon, authenticated;
grant execute on function public.res_expire_area_probations() to service_role;
