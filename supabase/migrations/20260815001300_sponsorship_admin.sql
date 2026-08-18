-- ═══════════════════════════════════════════════════════════════════════════
-- 20260815001300_sponsorship_admin — selling without hand-writing SQL
--
-- Creating a placement previously meant composing an INSERT by hand with the
-- right subject_table, a free slot and a correct term. That is fine for two
-- sponsors and a reliable source of mistakes by fifteen: a mistyped slot
-- silently sells the same position twice, and a wrong ends_at gives away a
-- month.
--
-- These functions do the arithmetic and the checking. They are service_role
-- only — a sale is still a human conversation, payment still lands
-- off-platform, and nothing here moves money (CONTRACT.md §6).
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Sell a slot ────────────────────────────────────────────────────────────
create or replace function public.res_sell_sponsorship(
  p_subject_table text,
  p_subject_id    uuid,
  p_surface       text,
  p_suburb        text,
  p_months        int default 1,
  p_category      text default null,
  p_rate_cents    int default 15000,
  p_payment_note  text default null,
  p_starts_at     timestamptz default now()
) returns jsonb
language plpgsql security definer
set search_path = public
as $fn$
declare
  v_max   int;
  v_slot  int;
  v_owner uuid;
  v_id    uuid;
begin
  if p_months < 1 or p_months > 24 then
    raise exception 'term must be between 1 and 24 months';
  end if;

  if p_subject_table not in ('res_handyman_services','res_vendors','res_skills','res_market_items') then
    raise exception 'unknown subject table %', p_subject_table;
  end if;

  -- The promoted listing must exist, and we take the owner from it rather than
  -- from a parameter: a placement pointing at nothing renders as a blank
  -- sponsored row, which is worse than having no sponsor at all.
  if p_subject_table = 'res_handyman_services' then
    select owner_id into v_owner from res_handyman_services where id = p_subject_id;
  else
    execute format('select user_id from public.%I where id = $1', p_subject_table)
      into v_owner using p_subject_id;
  end if;

  if v_owner is null then
    raise exception 'no % listing with id % — a sponsorship must promote a real listing',
      p_subject_table, p_subject_id;
  end if;

  select coalesce((params->>'maxPerSuburbCategory')::int, 2) into v_max
    from res_policies where key = 'sponsorship.slots';

  -- First free slot. Null when sold out rather than overflowing, so a third
  -- sale cannot quietly devalue the two already made.
  select s.n into v_slot
    from generate_series(1, v_max) as s(n)
   where not exists (
     select 1 from res_sponsorships x
      where x.surface = p_surface and x.suburb = p_suburb
        and x.category is not distinct from p_category
        and x.slot = s.n and x.status in ('pending','active') and x.archived_at is null)
   order by s.n
   limit 1;

  if v_slot is null then
    raise exception '% / % is sold out (all % slots taken)',
      p_suburb, coalesce(p_category, 'all categories'), v_max;
  end if;

  insert into res_sponsorships (
    subject_table, subject_id, sponsor_user_id, surface, suburb, category,
    slot, status, starts_at, ends_at, rate_zar_cents, payment_note, sold_by)
  values (
    p_subject_table, p_subject_id, v_owner, p_surface, p_suburb, p_category,
    v_slot, 'pending', p_starts_at,
    p_starts_at + make_interval(months => p_months),
    p_rate_cents, p_payment_note, auth.uid())
  returning id into v_id;

  perform res_audit('operator', 'sponsorship.sold', 'res_sponsorships', v_id,
    format('slot %s sold in %s for %s month(s) at R%s',
           v_slot, p_suburb, p_months, p_rate_cents / 100.0),
    null,
    jsonb_build_object('slot', v_slot, 'suburb', p_suburb, 'months', p_months),
    null, auth.uid(), null, 'human', false, null);

  return jsonb_build_object(
    'id', v_id, 'slot', v_slot, 'status', 'pending',
    'ends_at', p_starts_at + make_interval(months => p_months),
    'next_step', 'confirm payment, then call res_activate_sponsorship');
end;
$fn$;

-- ── Activate once the money has landed ─────────────────────────────────────
-- Separate from selling on purpose. The gap between "agreed" and "paid" is
-- exactly where placements get given away by accident.
create or replace function public.res_activate_sponsorship(
  p_id uuid, p_payment_note text default null
) returns jsonb
language plpgsql security definer
set search_path = public
as $fn$
begin
  if p_payment_note is not null then
    update res_sponsorships set payment_note = p_payment_note where id = p_id;
  end if;

  -- Through the one door, so the move is rule-checked and audited like every
  -- other status change in the system.
  return res_transition('res_sponsorships', p_id, 'active',
    coalesce(p_payment_note, 'payment confirmed off-platform'),
    'operator', null, null, 'human');
end;
$fn$;

create or replace function public.res_cancel_sponsorship(p_id uuid, p_reason text)
returns jsonb
language plpgsql security definer
set search_path = public
as $fn$
begin
  return res_transition('res_sponsorships', p_id, 'cancelled', p_reason,
                        'operator', null, null, 'human');
end;
$fn$;

-- ── What is left to sell ───────────────────────────────────────────────────
-- The list you work from. Built from suburbs that already have listings, so
-- you are never trying to sell a slot somewhere with nothing in it.
create or replace function public.res_sponsorship_open_inventory()
returns table (surface text, suburb text, total_slots int, taken int, remaining int)
language sql stable security definer
set search_path = public
as $fn$
  with v_max as (
    select coalesce((params->>'maxPerSuburbCategory')::int, 2) as n
      from res_policies where key = 'sponsorship.slots'
  ),
  places as (
    select 'services'::text as surface, suburb from res_handyman_services where suburb is not null
    union select 'vendors', suburb from res_vendors      where suburb is not null
    union select 'skills',  suburb from res_skills       where suburb is not null
    union select 'market',  suburb from res_market_items where suburb is not null
  )
  select p.surface, p.suburb, m.n,
         count(s.id)::int,
         greatest(0, m.n - count(s.id))::int
    from places p
   cross join v_max m
    left join res_sponsorships s
      on s.surface = p.surface and s.suburb = p.suburb and s.category is null
     and s.status in ('pending','active') and s.archived_at is null
   group by p.surface, p.suburb, m.n
   order by 5 desc, p.suburb;
$fn$;

revoke execute on function public.res_sell_sponsorship(text,uuid,text,text,int,text,int,text,timestamptz) from public, anon, authenticated;
revoke execute on function public.res_activate_sponsorship(uuid,text) from public, anon, authenticated;
revoke execute on function public.res_cancel_sponsorship(uuid,text) from public, anon, authenticated;
revoke execute on function public.res_sponsorship_open_inventory() from public, anon, authenticated;

grant execute on function public.res_sell_sponsorship(text,uuid,text,text,int,text,int,text,timestamptz) to service_role;
grant execute on function public.res_activate_sponsorship(uuid,text) to service_role;
grant execute on function public.res_cancel_sponsorship(uuid,text) to service_role;
grant execute on function public.res_sponsorship_open_inventory() to service_role;

comment on function public.res_sell_sponsorship is
  'Sells the next free slot and returns it as pending. Payment is confirmed separately via res_activate_sponsorship — the gap is deliberate.';
