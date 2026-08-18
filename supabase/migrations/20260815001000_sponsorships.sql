-- ═══════════════════════════════════════════════════════════════════════════
-- 20260815001000_sponsorships — paid placement for local businesses
--
-- See docs/SPONSORSHIP-PLAN.md. The short version:
--
--   A sponsorship buys POSITION, never EXISTENCE. A paying business gets a
--   labelled slot above the list for its suburb and category; every other
--   business stays in a list that is still complete and unchanged. That is the
--   rule already written into src/utils/subscriptions.ts, and this is where it
--   becomes structural.
--
-- Three things this migration deliberately does NOT do:
--
--   1. No money. rate_zar_cents records what was AGREED off-platform (EFT,
--      cash, WhatsApp). There is no balance, no charge, no refund path —
--      CONTRACT.md §6 holds. res_purchases/res_subscriptions stay untouched.
--   2. No new advertisement content. A sponsorship points at a listing that
--      already exists and was already moderated. There is no image, no copy
--      and no outbound link to review.
--   3. No self-serve checkout. local_business_sponsorship is priced at R150/mo
--      and marked contact_sales in src/utils/pricing.ts; sales are a
--      conversation. Rows are created by hand until that stops scaling.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.res_sponsorships (
  id              uuid primary key default gen_random_uuid(),

  -- What is promoted. Always a real listing, never free-floating creative.
  subject_table   text not null check (subject_table in (
                    'res_handyman_services','res_vendors','res_skills','res_market_items')),
  subject_id      uuid not null,
  sponsor_user_id uuid not null references public.profiles(id) on delete cascade,

  -- Where it appears. The check constraint IS the safety rule: faults, alerts,
  -- care circle and disputes are absent by construction, so no future code
  -- change can place an advert beside a panic alert without a migration that
  -- says so out loud.
  surface         text not null check (surface in ('services','vendors','skills','market')),
  suburb          text not null,
  category        text,                       -- null = the whole surface for that suburb
  slot            int  not null check (slot between 1 and 10),

  status          text not null default 'pending',
  starts_at       timestamptz not null default now(),
  ends_at         timestamptz not null,

  -- A RECORD of what was agreed, not a balance. See the header.
  rate_zar_cents  int not null default 15000 check (rate_zar_cents >= 0),
  payment_note    text,                       -- 'EFT ref 88213, 2026-08-16'
  sold_by         uuid references public.profiles(id) on delete set null,

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  archived_at     timestamptz,
  managed_by      text,

  constraint res_sponsorships_term_valid check (ends_at > starts_at)
);

-- Scarcity, enforced by the database rather than by hoping the UI checks.
-- Two live sponsorships cannot hold the same position, so a slot can never be
-- sold twice — which is the failure that would cost you a customer.
create unique index if not exists idx_res_sponsorships_slot_unique
  on public.res_sponsorships (surface, suburb, coalesce(category, ''), slot)
  where status in ('pending', 'active');

create index if not exists idx_res_sponsorships_lookup
  on public.res_sponsorships (surface, suburb, status, slot)
  where archived_at is null;
create index if not exists idx_res_sponsorships_subject
  on public.res_sponsorships (subject_table, subject_id);
create index if not exists idx_res_sponsorships_ends
  on public.res_sponsorships (ends_at) where status = 'active';

drop trigger if exists trg_touch_res_sponsorships on public.res_sponsorships;
create trigger trg_touch_res_sponsorships before update on public.res_sponsorships
  for each row execute function public.touch_updated_at();

-- ── Policy knobs ───────────────────────────────────────────────────────────
insert into public.res_policies (key, description, params, enabled) values
(
  'sponsorship.slots',
  'Sponsored positions per suburb x category. Scarcity is the product: if every business can be sponsored, sponsorship means nothing and the price can never rise.',
  '{"maxPerSuburbCategory": 2}'::jsonb,
  true
),
(
  'sponsorship.surfaces',
  'Surfaces that may carry a sponsored slot. An allowlist, so a screen added later is un-sellable until someone deliberately adds it. Safety and civic screens are never listed here.',
  '{"allowed": ["services","vendors","skills","market"]}'::jsonb,
  true
),
(
  'sponsorship.renewal_notice_days',
  'Days before the end of a term to flag a renewal, so a placement never lapses silently on a paying customer.',
  '{"days": 7}'::jsonb,
  true
)
on conflict (key) do nothing;

-- ── Row level security ─────────────────────────────────────────────────────
alter table public.res_sponsorships enable row level security;

-- Anyone signed in may READ live placements: a sponsored slot is public by
-- definition, and it must be visible to be disclosed.
drop policy if exists res_sponsorships_select on public.res_sponsorships;
create policy res_sponsorships_select on public.res_sponsorships
  for select to authenticated
  using (archived_at is null and status in ('active', 'pending'));

-- No client INSERT/UPDATE/DELETE at all. Sales are a human conversation and
-- placements are created by service_role; a client that could insert one could
-- give itself free advertising.
revoke insert, update, delete on public.res_sponsorships from authenticated, anon;
grant select on public.res_sponsorships to authenticated;
grant select, insert, update on public.res_sponsorships to service_role;

-- ── Read path ──────────────────────────────────────────────────────────────
-- Returns the live sponsored placements for one list, already joined to the
-- promoted listing's name so the caller needs one round trip.
--
-- The filters matter as much as the rows: a placement whose business has been
-- archived disappears immediately, so a suspended business can never keep a
-- paid position it should have lost.
create or replace function public.res_sponsored_for(
  p_surface text,
  p_suburb text,
  p_category text default null
) returns table (
  id uuid, slot int, subject_table text, subject_id uuid,
  subject_name text, sponsor_user_id uuid, ends_at timestamptz
)
language plpgsql stable security definer
set search_path = public
as $$
declare
  v_allowed jsonb;
  v_max int;
begin
  select params->'allowed' into v_allowed from res_policies
   where key = 'sponsorship.surfaces' and enabled;

  -- Fail loudly rather than returning nothing. A caller asking to put adverts
  -- on the panic-alert screen is a bug that must not pass quietly.
  if v_allowed is null or not (v_allowed ? p_surface) then
    raise exception
      'res_sponsored_for: % is not a sellable surface (safety and civic screens are never for sale)',
      p_surface;
  end if;

  select coalesce((params->>'maxPerSuburbCategory')::int, 2) into v_max
    from res_policies where key = 'sponsorship.slots';

  return query
  select s.id, s.slot, s.subject_table, s.subject_id,
         case s.subject_table
           when 'res_handyman_services' then (select h.business_name from res_handyman_services h where h.id = s.subject_id)
           when 'res_vendors'           then (select v.name          from res_vendors v           where v.id = s.subject_id)
           when 'res_skills'            then (select k.title         from res_skills k            where k.id = s.subject_id)
           when 'res_market_items'      then (select m.title         from res_market_items m      where m.id = s.subject_id)
         end as subject_name,
         s.sponsor_user_id, s.ends_at
    from res_sponsorships s
   where s.surface = p_surface
     and s.suburb = p_suburb
     and s.category is not distinct from p_category
     and s.status = 'active'
     and s.archived_at is null
     and s.starts_at <= now()
     and s.ends_at > now()
     and s.slot <= v_max
     -- The promoted listing must still exist and be live.
     and case s.subject_table
           when 'res_handyman_services' then exists (select 1 from res_handyman_services h where h.id = s.subject_id and h.archived_at is null)
           when 'res_vendors'           then exists (select 1 from res_vendors v           where v.id = s.subject_id and v.archived_at is null)
           when 'res_skills'            then exists (select 1 from res_skills k            where k.id = s.subject_id and k.archived_at is null)
           when 'res_market_items'      then exists (select 1 from res_market_items m      where m.id = s.subject_id and m.archived_at is null and m.status <> 'gone')
           else false
         end
   order by s.slot asc;
end;
$$;

-- ── Inventory helper, for selling ──────────────────────────────────────────
-- Answers "what can I still sell in this suburb?" — the question you need
-- answered while standing in a shop.
create or replace function public.res_sponsorship_inventory(
  p_surface text, p_suburb text, p_category text default null
) returns jsonb
language plpgsql stable security definer
set search_path = public
as $$
declare
  v_max int;
  v_taken int;
begin
  select coalesce((params->>'maxPerSuburbCategory')::int, 2) into v_max
    from res_policies where key = 'sponsorship.slots';

  select count(*) into v_taken from res_sponsorships s
   where s.surface = p_surface and s.suburb = p_suburb
     and s.category is not distinct from p_category
     and s.status in ('pending','active')
     and s.archived_at is null;

  return jsonb_build_object(
    'surface', p_surface, 'suburb', p_suburb, 'category', p_category,
    'total_slots', v_max, 'taken', v_taken,
    'remaining', greatest(0, v_max - v_taken));
end;
$$;

revoke execute on function public.res_sponsored_for(text,text,text) from public, anon;
revoke execute on function public.res_sponsorship_inventory(text,text,text) from public, anon;
grant execute on function public.res_sponsored_for(text,text,text) to authenticated, service_role;
grant execute on function public.res_sponsorship_inventory(text,text,text) to authenticated, service_role;

comment on table public.res_sponsorships is
  'Paid placement. Buys position above a list, never a place in it, and never affects trust, moderation or search relevance. rate_zar_cents records an off-platform agreement — the app holds no money (CONTRACT.md §6).';
