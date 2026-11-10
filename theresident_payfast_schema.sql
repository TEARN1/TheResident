-- ═══════════════════════════════════════════════════════════════════════════
-- The Resident: PayFast Payment Gateway Schema & Webhook Processor
--
-- Apply this file in the Supabase SQL Editor to support PayFast Instant
-- Transaction Notifications (ITN), idempotent subscription activations,
-- listing boosts, and audit logging.
-- ═══════════════════════════════════════════════════════════════════════════

create extension if not exists "uuid-ossp";

-- Ensure boost columns exist on boosted tables
alter table if exists public.res_market_items
  add column if not exists featured_until timestamptz;

alter table if exists public.res_notice_events
  add column if not exists featured_until timestamptz,
  add column if not exists paid_visibility_until timestamptz;

-- ── 1. TRANSACTIONS TABLE ──────────────────────────────────────────────────
-- Records every PayFast payment event / ITN callback for financial auditing.
create table if not exists public.res_payfast_transactions (
  id uuid primary key default uuid_generate_v4(),
  m_payment_id text not null unique,               -- The Resident's order reference
  pf_payment_id text,                              -- PayFast's internal payment reference
  user_id uuid references auth.users(id) on delete set null,
  item text not null,                              -- priority, premium, plus, room_boost, etc.
  target_id text,                                  -- optional entity ID (listing_id, notice_id)
  payment_status text not null,                    -- COMPLETE, FAILED, PENDING, CANCELLED
  amount numeric(10, 2) not null default 0.00,     -- ZAR amount
  fee numeric(10, 2) default 0.00,                 -- PayFast fee deducted
  raw_data jsonb default '{}'::jsonb,              -- Complete ITN payload
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists res_payfast_transactions_user_idx
  on public.res_payfast_transactions (user_id, created_at desc);

create index if not exists res_payfast_transactions_m_id_idx
  on public.res_payfast_transactions (m_payment_id);

-- Enable Row Level Security (only service_role writes; users may read own receipts)
alter table public.res_payfast_transactions enable row level security;

drop policy if exists res_payfast_transactions_select on public.res_payfast_transactions;
create policy res_payfast_transactions_select on public.res_payfast_transactions
  for select
  to authenticated
  using (user_id = auth.uid());

-- ── 2. IDEMPOTENT TRANSACTION APPLICATION RPC ──────────────────────────────
-- Restricted strictly to service_role (verified server-side ITN webhook only).
create or replace function public.res_apply_payfast_payment(
  p_payment_id text,
  p_pf_payment_id text default null,
  p_user_id uuid default null,
  p_item text default null,
  p_target_id text default null,
  p_status text default null,
  p_amount numeric default 0,
  p_raw_data jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_existing_id uuid;
  v_existing_status text;
  v_caller_role text;
  v_result jsonb;
begin
  -- Belt-and-suspenders guard: reject anon and authenticated browser clients
  -- even if a broad GRANT sweep is ever run on public functions later.
  v_caller_role := coalesce(current_setting('request.jwt.claim.role', true), '');
  if v_caller_role != 'service_role' and session_user not in ('postgres', 'supabase_admin') then
    raise exception 'permission denied: res_apply_payfast_payment requires service_role';
  end if;

  -- Look for existing transaction record
  select id, payment_status into v_existing_id, v_existing_status
  from public.res_payfast_transactions
  where m_payment_id = p_payment_id;

  if v_existing_id is not null then
    -- Idempotency: if already processed as COMPLETE, do not re-extend period
    update public.res_payfast_transactions
    set
      pf_payment_id = coalesce(p_pf_payment_id, pf_payment_id),
      payment_status = coalesce(p_status, payment_status),
      amount = case when p_amount > 0 then p_amount else amount end,
      raw_data = case when p_raw_data != '{}'::jsonb then p_raw_data else raw_data end,
      updated_at = now()
    where id = v_existing_id;

    if v_existing_status = 'COMPLETE' and p_status = 'COMPLETE' then
      return jsonb_build_object(
        'success', true,
        'idempotent', true,
        'payment_id', p_payment_id,
        'status', v_existing_status,
        'item', p_item
      );
    end if;
  else
    -- Insert new transaction record
    insert into public.res_payfast_transactions (
      m_payment_id,
      pf_payment_id,
      user_id,
      item,
      target_id,
      payment_status,
      amount,
      raw_data,
      created_at,
      updated_at
    ) values (
      p_payment_id,
      p_pf_payment_id,
      p_user_id,
      coalesce(p_item, 'unknown'),
      p_target_id,
      coalesce(p_status, 'UNKNOWN'),
      coalesce(p_amount, 0.00),
      p_raw_data,
      now(),
      now()
    );
  end if;

  -- If payment status is COMPLETE, apply product effects
  if p_status = 'COMPLETE' and p_user_id is not null then
    -- A. Provider visibility subscriptions
    if p_item in ('priority', 'premium') then
      insert into public.res_subscriptions (
        user_id,
        product,
        tier,
        status,
        current_period_end,
        updated_at
      ) values (
        p_user_id,
        'provider',
        p_item,
        'active',
        now() + interval '30 days',
        now()
      )
      on conflict (user_id, product) do update set
        tier = excluded.tier,
        status = 'active',
        current_period_end = now() + interval '30 days',
        updated_at = now();

    -- B. Household Plus subscription
    elsif p_item = 'plus' then
      insert into public.res_subscriptions (
        user_id,
        product,
        tier,
        status,
        current_period_end,
        updated_at
      ) values (
        p_user_id,
        'household',
        null,
        'active',
        now() + interval '30 days',
        now()
      )
      on conflict (user_id, product) do update set
        status = 'active',
        current_period_end = now() + interval '30 days',
        updated_at = now();

    -- C. Room listing 7-day boost
    elsif p_item = 'room_boost' and p_target_id is not null and p_target_id ~ '^[0-9a-fA-F-]{36}$' then
      update public.res_listings
      set featured_until = now() + interval '7 days'
      where id = p_target_id::uuid;

    -- D. Market listing 48-hour boost
    elsif p_item = 'market_boost' and p_target_id is not null and p_target_id ~ '^[0-9a-fA-F-]{36}$' then
      begin
        update public.res_market_items
        set featured_until = now() + interval '48 hours',
            created_at = now()
        where id = p_target_id::uuid;
      exception when others then
        null;
      end;

    -- E. Notice 24-hour top-of-wall boost
    elsif p_item = 'notice_boost' and p_target_id is not null and p_target_id ~ '^[0-9a-fA-F-]{36}$' then
      begin
        update public.res_notice_events
        set featured_until = now() + interval '24 hours'
        where id = p_target_id::uuid;
      exception when others then
        null;
      end;

    -- F. Notice +24-hour visibility extension
    elsif p_item = 'notice_extend_visibility' and p_target_id is not null and p_target_id ~ '^[0-9a-fA-F-]{36}$' then
      begin
        update public.res_notice_events
        set paid_visibility_until = greatest(coalesce(paid_visibility_until, now()), now()) + interval '24 hours'
        where id = p_target_id::uuid;
      exception when others then
        null;
      end;

    -- G. Verification speed-up
    elsif p_item = 'verification_speedup' then
      begin
        -- Paying moves the profile up the review queue. Only a person reviewing
        -- the documents changes verification_status.
        update public.res_profiles
        set verification_priority_requested_at = coalesce(verification_priority_requested_at, now())
        where id = p_user_id;
      exception when others then
        null;
      end;

    -- H. Official broadcast blast boost (24h pin)
    elsif p_item = 'broadcast_blast_boost' and p_target_id is not null and p_target_id ~ '^[0-9a-fA-F-]{36}$' then
      begin
        update public.res_org_broadcasts
        set created_at = now()
        where id = p_target_id::uuid;
      exception when others then
        null;
      end;
    end if;
  end if;

  v_result := jsonb_build_object(
    'success', true,
    'payment_id', p_payment_id,
    'status', coalesce(p_status, 'PROCESSED'),
    'item', p_item
  );

  return v_result;
end;
$$;

-- ── 3. STRICT PRIVILEGE LOCKDOWN ───────────────────────────────────────────
-- Never allow PUBLIC, anon, or authenticated browser users to invoke payment
-- fulfillment directly; only the backend ITN route holding service_role may.
revoke all on function public.res_apply_payfast_payment(
  text, text, uuid, text, text, text, numeric, jsonb
) from public, anon, authenticated;

grant execute on function public.res_apply_payfast_payment(
  text, text, uuid, text, text, text, numeric, jsonb
) to service_role;

do $$
declare
  v_leaked text;
begin
  select string_agg(distinct grantee, ', ') into v_leaked
  from information_schema.role_routine_grants
  where routine_schema = 'public'
    and routine_name = 'res_apply_payfast_payment'
    and grantee in ('PUBLIC', 'anon', 'authenticated');

  if v_leaked is not null then
    raise exception 'res_apply_payfast_payment still granted to client role(s): %', v_leaked;
  end if;
end $$;
