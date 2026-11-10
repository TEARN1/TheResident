-- ═══════════════════════════════════════════════════════════════════════════
-- 20261108120000_payfast_security_hardening
--
-- Locks down res_apply_payfast_payment strictly to service_role (revoking
-- PUBLIC, anon, and authenticated), enforces an internal service_role JWT
-- claim check as defense-in-depth, adds idempotency on duplicate COMPLETE
-- ITN deliveries, and fulfills notice_boost + notice_extend_visibility.
-- ═══════════════════════════════════════════════════════════════════════════

alter table if exists public.res_market_items
  add column if not exists featured_until timestamptz;

alter table if exists public.res_notice_events
  add column if not exists featured_until timestamptz,
  add column if not exists paid_visibility_until timestamptz;

create table if not exists public.res_payfast_transactions (
  id uuid primary key default uuid_generate_v4(),
  m_payment_id text not null unique,
  pf_payment_id text,
  user_id uuid references auth.users(id) on delete set null,
  item text not null,
  target_id text,
  payment_status text not null,
  amount numeric(10, 2) not null default 0.00,
  fee numeric(10, 2) default 0.00,
  raw_data jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists res_payfast_transactions_user_idx
  on public.res_payfast_transactions (user_id, created_at desc);

create index if not exists res_payfast_transactions_m_id_idx
  on public.res_payfast_transactions (m_payment_id);

alter table public.res_payfast_transactions enable row level security;

drop policy if exists res_payfast_transactions_select on public.res_payfast_transactions;
create policy res_payfast_transactions_select on public.res_payfast_transactions
  for select
  to authenticated
  using (user_id = auth.uid());

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
begin
  v_caller_role := coalesce(current_setting('request.jwt.claim.role', true), '');
  if v_caller_role != 'service_role' and session_user not in ('postgres', 'supabase_admin') then
    raise exception 'permission denied: res_apply_payfast_payment requires service_role';
  end if;

  select id, payment_status into v_existing_id, v_existing_status
  from public.res_payfast_transactions
  where m_payment_id = p_payment_id;

  if v_existing_id is not null then
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
    insert into public.res_payfast_transactions (
      m_payment_id, pf_payment_id, user_id, item, target_id,
      payment_status, amount, raw_data, created_at, updated_at
    ) values (
      p_payment_id, p_pf_payment_id, p_user_id, coalesce(p_item, 'unknown'),
      p_target_id, coalesce(p_status, 'UNKNOWN'), coalesce(p_amount, 0.00),
      p_raw_data, now(), now()
    );
  end if;

  if p_status = 'COMPLETE' and p_user_id is not null then
    if p_item in ('priority', 'premium') then
      insert into public.res_subscriptions (
        user_id, product, tier, status, current_period_end, updated_at
      ) values (
        p_user_id, 'provider', p_item, 'active', now() + interval '30 days', now()
      )
      on conflict (user_id, product) do update set
        tier = excluded.tier,
        status = 'active',
        current_period_end = now() + interval '30 days',
        updated_at = now();

    elsif p_item = 'plus' then
      insert into public.res_subscriptions (
        user_id, product, tier, status, current_period_end, updated_at
      ) values (
        p_user_id, 'household', null, 'active', now() + interval '30 days', now()
      )
      on conflict (user_id, product) do update set
        status = 'active',
        current_period_end = now() + interval '30 days',
        updated_at = now();

    elsif p_item = 'room_boost' and p_target_id is not null and p_target_id ~ '^[0-9a-fA-F-]{36}$' then
      update public.res_listings
      set featured_until = now() + interval '7 days'
      where id = p_target_id::uuid;

    elsif p_item = 'market_boost' and p_target_id is not null and p_target_id ~ '^[0-9a-fA-F-]{36}$' then
      begin
        update public.res_market_items
        set featured_until = now() + interval '48 hours',
            created_at = now()
        where id = p_target_id::uuid;
      exception when others then null;
      end;

    elsif p_item = 'notice_boost' and p_target_id is not null and p_target_id ~ '^[0-9a-fA-F-]{36}$' then
      begin
        update public.res_notice_events
        set featured_until = now() + interval '24 hours'
        where id = p_target_id::uuid;
      exception when others then null;
      end;

    elsif p_item = 'notice_extend_visibility' and p_target_id is not null and p_target_id ~ '^[0-9a-fA-F-]{36}$' then
      begin
        update public.res_notice_events
        set paid_visibility_until = greatest(coalesce(paid_visibility_until, now()), now()) + interval '24 hours'
        where id = p_target_id::uuid;
      exception when others then null;
      end;

    elsif p_item = 'verification_speedup' then
      begin
        -- Paying moves the profile up the review queue. Only a person reviewing
        -- the documents changes verification_status.
        update public.res_profiles
        set verification_priority_requested_at = coalesce(verification_priority_requested_at, now())
        where id = p_user_id;
      exception when others then null;
      end;

    elsif p_item = 'broadcast_blast_boost' and p_target_id is not null and p_target_id ~ '^[0-9a-fA-F-]{36}$' then
      begin
        update public.res_org_broadcasts
        set created_at = now()
        where id = p_target_id::uuid;
      exception when others then null;
      end;
    end if;
  end if;

  return jsonb_build_object(
    'success', true,
    'payment_id', p_payment_id,
    'status', coalesce(p_status, 'PROCESSED'),
    'item', p_item
  );
end;
$$;

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
