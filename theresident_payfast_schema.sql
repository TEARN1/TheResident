-- ═══════════════════════════════════════════════════════════════════════════
-- The Resident: PayFast Payment Gateway Schema & Webhook Processor
-- 
-- Apply this file in the Supabase SQL Editor to support PayFast Instant
-- Transaction Notifications (ITN), idempotent subscription activations,
-- listing boosts, and audit logging.
-- ═══════════════════════════════════════════════════════════════════════════

create extension if not exists "uuid-ossp";

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
  fee numeric(10, 2) default 0.00,                -- PayFast fee deducted
  raw_data jsonb default '{}'::jsonb,              -- Complete ITN payload
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists res_payfast_transactions_user_idx 
  on public.res_payfast_transactions (user_id, created_at desc);

create index if not exists res_payfast_transactions_m_id_idx 
  on public.res_payfast_transactions (m_payment_id);

-- Enable Row Level Security
alter table public.res_payfast_transactions enable row level security;

-- Users may view their own payment receipts
drop policy if exists res_payfast_transactions_select on public.res_payfast_transactions;
create policy res_payfast_transactions_select on public.res_payfast_transactions
  for select
  to authenticated
  using (user_id = auth.uid());

-- ── 2. IDEMPOTENT TRANSACTION APPLICATION RPC ──────────────────────────────
-- Called securely by the ITN handler (service_role or authenticated API route).
-- Updates transactions table and applies subscription / boost / verification updates.
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
  v_result jsonb;
begin
  -- Look for existing transaction record
  select id, payment_status into v_existing_id, v_existing_status
  from public.res_payfast_transactions
  where m_payment_id = p_payment_id;

  if v_existing_id is not null then
    -- Update existing record
    update public.res_payfast_transactions
    set
      pf_payment_id = coalesce(p_pf_payment_id, pf_payment_id),
      payment_status = coalesce(p_status, payment_status),
      amount = case when p_amount > 0 then p_amount else amount end,
      raw_data = case when p_raw_data != '{}'::jsonb then p_raw_data else raw_data end,
      updated_at = now()
    where id = v_existing_id;
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
      -- If featured/boosted column exists on res_market_items
      begin
        update public.res_market_items
        set created_at = now()
        where id = p_target_id::uuid;
      exception when others then
        null;
      end;

    -- E. Verification speed-up
    elsif p_item = 'verification_speedup' then
      begin
        update public.res_profiles
        set verification_status = 'reviewed'
        where id = p_user_id;
      exception when others then
        null;
      end;

    -- F. Official broadcast blast boost (24h pin)
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

-- Grant execution to API clients
grant execute on function public.res_apply_payfast_payment to authenticated, anon, service_role;
