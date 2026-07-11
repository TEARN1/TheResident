-- ═══════════════════════════════════════════════════════════════════════════
-- proposed_resident_schema_v2.sql — Canonical Unified Schema
--
-- Combines the namespace-hardened Base 12 tables with Phase 4 Community Tables:
--   • Locality Foundation: res_communities, res_community_members
--   • Safety Net: res_alerts, res_alert_responders
--   • Local Market: res_market_items, res_vendors, res_group_buys, res_group_buy_pledges
--   • Mutual Aid & Care: res_skills, res_lost_found, res_care_circle
--   • Shared Resources: res_shared_resources, res_neighbourhood_status
-- ═══════════════════════════════════════════════════════════════════════════

create extension if not exists "uuid-ossp";

-- ── 0. Guarded migration: rename v1 tables if present ───────────────────────
do $$
begin
  if to_regclass('public.lift_clubs') is not null and to_regclass('public.res_lift_clubs') is null then
    alter table public.resident_profiles  rename to res_profiles;
    alter table public.listings           rename to res_listings;
    alter table public.room_requests      rename to res_room_requests;
    alter table public.lift_clubs         rename to res_lift_clubs;
    alter table public.handyman_services  rename to res_handyman_services;
    alter table public.service_dispatches rename to res_service_dispatches;
    alter table public.utility_tokens     rename to res_utility_tokens;
    alter table public.tool_library       rename to res_tool_library;
    alter table public.chore_schedule     rename to res_chore_schedule;
    alter table public.community_disputes rename to res_community_disputes;
    alter table public.roommate_seekers   rename to res_roommate_seekers;
    alter table public.notice_events      rename to res_notice_events;
  end if;
end $$;

-- ── 1. BASE TABLES ───────────────────────────────────────────────────────────

-- res_profiles: User role details
create table if not exists public.res_profiles (
  id uuid references public.profiles(id) on delete cascade primary key,
  role text not null check (role in ('tenant', 'landlord', 'visitor')),
  bio text,
  gender text check (gender in ('men', 'women', 'any')),
  children_count integer default 0,
  employment_status text,
  has_pets boolean default false,
  verification_doc_url text,
  landlord_gender_pref text check (landlord_gender_pref in ('men', 'women', 'couple', 'any')),
  landlord_children_allowed boolean default true,
  landlord_max_children integer default 0,
  landlord_smoking_allowed boolean default false,
  landlord_pets_allowed boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- res_listings: Room rental directory
create table if not exists public.res_listings (
  id uuid primary key default uuid_generate_v4(),
  landlord_id uuid references public.profiles(id) on delete cascade not null,
  title text not null,
  description text,
  price numeric not null,
  currency text default 'ZAR',
  location text not null,
  suburb text,
  city text,
  lat double precision,
  lon double precision,
  safety_rating text check (safety_rating in ('high', 'medium', 'low')) default 'medium',
  safety_notes text,
  landlord_lives_here boolean default false,
  images text[] default '{}',
  wifi boolean default false,
  parking boolean default false,
  bathroom text check (bathroom in ('shared', 'private', 'ensuite')) default 'shared',
  req_gender_pref text check (req_gender_pref in ('men', 'women', 'couple', 'any')) default 'any',
  req_children_allowed boolean default true,
  req_max_children integer default 0,
  req_smoking_allowed boolean default false,
  req_pets_allowed boolean default false,
  status text check (status in ('open', 'taken', 'paused')) default 'open',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- res_room_requests: Room applications
create table if not exists public.res_room_requests (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid references public.profiles(id) on delete cascade not null,
  listing_id uuid references public.res_listings(id) on delete cascade not null,
  landlord_id uuid references public.profiles(id) on delete cascade not null,
  status text check (status in ('pending', 'approved', 'rejected')) default 'pending',
  message text,
  created_at timestamptz default now(),
  unique (tenant_id, listing_id)
);

-- res_lift_clubs: Lift club / transport coordination
create table if not exists public.res_lift_clubs (
  id uuid primary key default uuid_generate_v4(),
  driver_id uuid references public.profiles(id) on delete cascade not null,
  origin text not null,
  destination text not null,
  origin_lat double precision,
  origin_lon double precision,
  dest_lat double precision,
  dest_lon double precision,
  departure_time text,
  days text,
  price_per_seat numeric not null,
  currency text default 'ZAR',
  available_seats integer not null check (available_seats >= 0),
  total_seats integer not null check (total_seats > 0),
  event_id uuid references public.events(id) on delete set null,
  purpose text check (purpose in ('commute', 'school_run', 'event', 'moving', 'errand')) default 'commute',
  carries_parcels boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- res_handyman_services: Handyman business catalog
create table if not exists public.res_handyman_services (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid references public.profiles(id) on delete cascade not null,
  business_name text not null,
  category text not null,
  location text not null,
  suburb text,
  city text,
  lat double precision,
  lon double precision,
  rating numeric default 5.0 check (rating >= 0 and rating <= 5),
  contact_number text,
  website_url text,
  price_estimate text,
  description text,
  image text,
  reviews_count integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- res_service_dispatches: Job bookings
create table if not exists public.res_service_dispatches (
  id uuid primary key default uuid_generate_v4(),
  service_id uuid references public.res_handyman_services(id) on delete cascade not null,
  sender_id uuid references public.profiles(id) on delete cascade not null,
  message text,
  status text check (status in ('pending', 'accepted', 'completed')) default 'pending',
  proof_file_url text,
  created_at timestamptz default now()
);

-- res_utility_tokens: Voucher trade advertisements
create table if not exists public.res_utility_tokens (
  id uuid primary key default uuid_generate_v4(),
  landlord_id uuid references public.profiles(id) on delete cascade not null,
  meter_label text,
  price numeric not null,
  currency text default 'ZAR',
  status text check (status in ('available', 'claimed')) default 'available',
  claimed_by uuid references public.profiles(id) on delete set null,
  claimed_at timestamptz,
  created_at timestamptz default now()
);

-- res_tool_library: Local P2P tool inventory
create table if not exists public.res_tool_library (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid references public.profiles(id) on delete cascade not null,
  title text not null,
  description text,
  price_per_day numeric not null,
  currency text default 'ZAR',
  deposit numeric default 0,
  location text,
  suburb text,
  status text check (status in ('available', 'rented')) default 'available',
  rented_by uuid references public.profiles(id) on delete set null,
  rented_until date,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- res_chore_schedule: Co-living household chores
create table if not exists public.res_chore_schedule (
  id uuid primary key default uuid_generate_v4(),
  listing_id uuid references public.res_listings(id) on delete cascade not null,
  roommate_id uuid references public.profiles(id) on delete cascade not null,
  task_name text not null,
  day_of_week text,
  status text check (status in ('pending', 'completed')) default 'pending',
  completed_at timestamptz,
  created_at timestamptz default now()
);

-- res_community_disputes: Co-living disputes
create table if not exists public.res_community_disputes (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  description text,
  category text check (category in ('Noise', 'Messiness', 'Utility overuse', 'Chore avoidance', 'Security breach', 'Other')) default 'Other',
  reported_by_id uuid references public.profiles(id) on delete cascade not null,
  against_user_id uuid references public.profiles(id) on delete set null,
  mediator_id uuid references public.profiles(id) on delete set null,
  status text check (status in ('pending', 'mediating', 'resolved')) default 'pending',
  resolution_details text,
  created_at timestamptz default now()
);

-- res_roommate_seekers: Room seeker ads
create table if not exists public.res_roommate_seekers (
  id uuid references public.profiles(id) on delete cascade primary key,
  gender text check (gender in ('men', 'women')),
  children_count integer default 0,
  budget numeric,
  currency text default 'ZAR',
  location text,
  suburb text,
  bio text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- res_notice_events: Local notice boards
create table if not exists public.res_notice_events (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  description text,
  type text check (type in ('notice', 'event')),
  posted_by_id uuid references public.profiles(id) on delete cascade not null,
  event_date date,
  rsvps uuid[] default '{}',
  created_at timestamptz default now()
);

-- ── 2. PHASE 4 COMMUNITY TABLES ──────────────────────────────────────────────

-- res_communities: Hyperlocal joinable units
create table if not exists public.res_communities (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  kind text check (kind in ('street', 'block', 'complex', 'estate', 'suburb')) not null,
  suburb text,
  city text,
  lat double precision,
  lon double precision,
  radius_m numeric,
  is_private boolean default false,
  created_by uuid references public.profiles(id) on delete cascade not null,
  created_at timestamptz default now()
);

-- res_community_members: Joined members mapping
create table if not exists public.res_community_members (
  id uuid primary key default uuid_generate_v4(),
  community_id uuid references public.res_communities(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  role text check (role in ('member', 'admin', 'founder')) default 'member' not null,
  joined_at timestamptz default now(),
  unique (community_id, user_id)
);

-- res_alerts: Community safety panic/incident alerts
create table if not exists public.res_alerts (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  kind text check (kind in ('panic', 'incident', 'suspicious', 'safe_walk')) not null,
  title text not null,
  description text,
  lat double precision,
  lon double precision,
  community_id uuid references public.res_communities(id) on delete set null,
  suburb text,
  city text,
  severity text check (severity in ('low', 'medium', 'high', 'critical')) default 'medium' not null,
  status text check (status in ('active', 'resolved', 'false_alarm')) default 'active' not null,
  created_at timestamptz default now(),
  resolved_at timestamptz
);

-- res_alert_responders: Verified members responding to alerts
create table if not exists public.res_alert_responders (
  id uuid primary key default uuid_generate_v4(),
  alert_id uuid references public.res_alerts(id) on delete cascade not null,
  responder_id uuid references public.profiles(id) on delete cascade not null,
  status text check (status in ('coming', 'arrived', 'stood_down')) default 'coming' not null,
  note text,
  created_at timestamptz default now()
);

-- res_market_items: Buy, sell, or giveaway items
create table if not exists public.res_market_items (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  title text not null,
  description text,
  category text not null,
  price numeric, -- NULL = free/giveaway
  currency text default 'ZAR',
  condition text check (condition in ('new', 'good', 'fair', 'poor')) default 'good',
  images text[] default '{}',
  status text check (status in ('available', 'pending', 'gone')) default 'available' not null,
  community_id uuid references public.res_communities(id) on delete set null,
  suburb text,
  city text,
  lat double precision,
  lon double precision,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- res_vendors: Spaza shops and local vendors
create table if not exists public.res_vendors (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  name text not null,
  kind text check (kind in ('spaza', 'airtime', 'gas', 'food', 'produce', 'other')) not null,
  sells text[] default '{}',
  hours text,
  contact_via_dm boolean default true,
  phone text,
  community_id uuid references public.res_communities(id) on delete set null,
  suburb text,
  city text,
  lat double precision,
  lon double precision,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- res_group_buys: Group buy / stokvel coordination details
create table if not exists public.res_group_buys (
  id uuid primary key default uuid_generate_v4(),
  organizer_id uuid references public.profiles(id) on delete cascade not null,
  title text not null,
  description text,
  target_quantity integer not null check (target_quantity > 0),
  current_quantity integer default 0 check (current_quantity >= 0),
  display_price numeric not null,
  currency text default 'ZAR',
  deadline timestamptz not null,
  status text check (status in ('open', 'completed', 'cancelled')) default 'open' not null,
  community_id uuid references public.res_communities(id) on delete set null,
  suburb text,
  city text,
  lat double precision,
  lon double precision,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- res_group_buy_pledges: Pledges for bulk buy orders
create table if not exists public.res_group_buy_pledges (
  id uuid primary key default uuid_generate_v4(),
  group_buy_id uuid references public.res_group_buys(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  quantity integer not null check (quantity > 0),
  note text,
  created_at timestamptz default now(),
  unique (group_buy_id, user_id)
);

-- res_skills: Skills/Services directory (hair, cleaning, childcare...)
create table if not exists public.res_skills (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  title text not null,
  category text not null,
  description text,
  rate_note text,
  availability text,
  community_id uuid references public.res_communities(id) on delete set null,
  suburb text,
  city text,
  lat double precision,
  lon double precision,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- res_lost_found: Lost & Found items/pets catalog
create table if not exists public.res_lost_found (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  kind text check (kind in ('lost', 'found')) not null,
  category text check (category in ('person', 'pet', 'item')) not null,
  title text not null,
  description text,
  images text[] default '{}',
  last_seen text,
  status text check (status in ('open', 'reunited')) default 'open' not null,
  community_id uuid references public.res_communities(id) on delete set null,
  suburb text,
  city text,
  lat double precision,
  lon double precision,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- res_care_circle: Vulnerable / Elder check-in circle
create table if not exists public.res_care_circle (
  id uuid primary key default uuid_generate_v4(),
  subject_id uuid references public.profiles(id) on delete cascade not null,
  carer_id uuid references public.profiles(id) on delete cascade not null,
  cadence text check (cadence in ('daily', 'weekly')) default 'daily' not null,
  last_ok_at timestamptz default now(),
  status text check (status in ('active', 'paused')) default 'active' not null,
  note text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- res_shared_resources: Water points, WiFi hotspots, generators directory
create table if not exists public.res_shared_resources (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid references public.profiles(id) on delete cascade not null,
  kind text check (kind in ('water_point', 'borehole', 'wifi_hotspot', 'generator', 'other')) not null,
  title text not null,
  access_note text,
  availability text,
  is_free boolean default true,
  price_note text,
  community_id uuid references public.res_communities(id) on delete set null,
  suburb text,
  city text,
  lat double precision,
  lon double precision,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- res_neighbourhood_status: Live crowd signal (power, water, network status)
create table if not exists public.res_neighbourhood_status (
  id uuid primary key default uuid_generate_v4(),
  reporter_id uuid references public.profiles(id) on delete cascade not null,
  kind text check (kind in ('power', 'water', 'network')) not null,
  status text check (status in ('up', 'down', 'stage')) not null,
  detail text,
  community_id uuid references public.res_communities(id) on delete set null,
  suburb text,
  city text,
  lat double precision,
  lon double precision,
  created_at timestamptz default now()
);

-- ── 3. INDEXES ───────────────────────────────────────────────────────────────
create index if not exists idx_res_listings_landlord   on public.res_listings (landlord_id);
create index if not exists idx_res_listings_suburb     on public.res_listings (suburb);
create index if not exists idx_res_requests_tenant     on public.res_room_requests (tenant_id);
create index if not exists idx_res_requests_landlord   on public.res_room_requests (landlord_id);
create index if not exists idx_res_lifts_driver        on public.res_lift_clubs (driver_id);
create index if not exists idx_res_handyman_owner      on public.res_handyman_services (owner_id);
create index if not exists idx_res_dispatch_sender     on public.res_service_dispatches (sender_id);
create index if not exists idx_res_tokens_landlord     on public.res_utility_tokens (landlord_id);
create index if not exists idx_res_tools_owner         on public.res_tool_library (owner_id);
create index if not exists idx_res_chores_listing      on public.res_chore_schedule (listing_id);
create index if not exists idx_res_disputes_reporter   on public.res_community_disputes (reported_by_id);
create index if not exists idx_res_notices_poster      on public.res_notice_events (posted_by_id);

-- Phase 4 Indexes
create index if not exists idx_res_communities_creator on public.res_communities (created_by);
create index if not exists idx_res_comm_members_user   on public.res_community_members (user_id);
create index if not exists idx_res_alerts_user         on public.res_alerts (user_id);
create index if not exists idx_res_alerts_community    on public.res_alerts (community_id);
create index if not exists idx_res_responders_alert    on public.res_alert_responders (alert_id);
create index if not exists idx_res_market_user         on public.res_market_items (user_id);
create index if not exists idx_res_market_community    on public.res_market_items (community_id);
create index if not exists idx_res_vendors_user        on public.res_vendors (user_id);
create index if not exists idx_res_groupbuys_organizer on public.res_group_buys (organizer_id);
create index if not exists idx_res_lostfound_user      on public.res_lost_found (user_id);
create index if not exists idx_res_care_subject        on public.res_care_circle (subject_id);
create index if not exists idx_res_care_carer          on public.res_care_circle (carer_id);
create index if not exists idx_res_resources_owner     on public.res_shared_resources (owner_id);

-- ── 4. updated_at triggers (touch_updated_at function) ───────────────────────
do $$
declare t text;
begin
  foreach t in array array['res_profiles','res_listings','res_lift_clubs',
                           'res_handyman_services','res_tool_library','res_roommate_seekers',
                           'res_market_items', 'res_vendors', 'res_group_buys',
                           'res_skills', 'res_lost_found', 'res_care_circle', 'res_shared_resources']
  loop
    execute format('drop trigger if exists trg_touch_%1$s on public.%1$s', t);
    execute format('create trigger trg_touch_%1$s before update on public.%1$s
                    for each row execute function public.touch_updated_at()', t);
  end loop;
end $$;

-- ── 5. SECURITY FUNCTIONS / RPCs ──────────────────────────────────────────────

-- Household membership check
create or replace function public.res_is_household_member(p_listing uuid, p_user uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from res_listings l where l.id = p_listing and l.landlord_id = p_user
  ) or exists (
    select 1 from res_room_requests r
    where r.listing_id = p_listing and r.tenant_id = p_user and r.status = 'approved'
  );
$$;

-- Notice RSVP toggle
create or replace function public.res_toggle_rsvp(p_notice_id uuid)
returns boolean
language plpgsql security definer
set search_path = public
as $$
declare joined boolean;
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  update res_notice_events
     set rsvps = case when auth.uid() = any(rsvps)
                      then array_remove(rsvps, auth.uid())
                      else array_append(rsvps, auth.uid()) end
   where id = p_notice_id
  returning auth.uid() = any(rsvps) into joined;
  return coalesce(joined, false);
end;
$$;

-- Community membership check helper
create or replace function public.res_is_community_member(p_community uuid, p_user uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from res_community_members
    where community_id = p_community and user_id = p_user
  );
$$;

-- Panic Alert Broadcaster RPC
create or replace function public.res_broadcast_alert(p_alert_id uuid)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_alert record;
  v_recipient uuid;
begin
  select * into v_alert from res_alerts where id = p_alert_id;
  if not found then
    raise exception 'alert not found';
  end if;

  -- Find verified profiles who are members of the community
  -- or located nearby (for simplicity, we scope to the same community, suburb, or city)
  for v_recipient in
    select p.id
    from profiles p
    left join res_community_members cm on cm.user_id = p.id
    where p.id <> v_alert.user_id
      and p.is_verified = true
      and (
        (v_alert.community_id is not null and cm.community_id = v_alert.community_id)
        or (v_alert.community_id is null and v_alert.suburb is not null and p.city = v_alert.city)
      )
  loop
    insert into notifications (recipient_id, actor_id, type, title, body, data)
    values (
      v_recipient,
      v_alert.user_id,
      'res_alert_panic',
      '🚨 NEIGHBOURHOOD ALERT: ' || v_alert.title,
      v_alert.description,
      jsonb_build_object('alert_id', v_alert.id, 'kind', v_alert.kind)
    );
  end loop;
end;
$$;

-- Good-Neighbour reputation XP award wrapper
create or replace function public.res_award_good_neighbour(p_user_id uuid, p_xp integer)
returns void
language plpgsql security definer
set search_path = public
as $$
begin
  if p_xp < 0 or p_xp > 100 then
    raise exception 'invalid xp amount';
  end if;
  perform public.award_xp(p_user_id, p_xp);
end;
$$;

-- Revoke default executes and grant explicitly
revoke execute on function public.res_is_household_member(uuid, uuid) from public, anon;
revoke execute on function public.res_toggle_rsvp(uuid) from public, anon;
revoke execute on function public.res_is_community_member(uuid, uuid) from public, anon;
revoke execute on function public.res_broadcast_alert(uuid) from public, anon;
revoke execute on function public.res_award_good_neighbour(uuid, integer) from public, anon;

grant execute on function public.res_is_household_member(uuid, uuid) to authenticated, service_role;
grant execute on function public.res_toggle_rsvp(uuid) to authenticated, service_role;
grant execute on function public.res_is_community_member(uuid, uuid) to authenticated, service_role;
grant execute on function public.res_broadcast_alert(uuid) to authenticated, service_role;
grant execute on function public.res_award_good_neighbour(uuid, integer) to authenticated, service_role;

-- ── 6. ROW LEVEL SECURITY (RLS) ───────────────────────────────────────────────
alter table public.res_profiles           enable row level security;
alter table public.res_listings           enable row level security;
alter table public.res_room_requests      enable row level security;
alter table public.res_lift_clubs         enable row level security;
alter table public.res_handyman_services  enable row level security;
alter table public.res_service_dispatches enable row level security;
alter table public.res_utility_tokens     enable row level security;
alter table public.res_tool_library       enable row level security;
alter table public.res_chore_schedule     enable row level security;
alter table public.res_community_disputes enable row level security;
alter table public.res_roommate_seekers   enable row level security;
alter table public.res_notice_events      enable row level security;
alter table public.res_communities        enable row level security;
alter table public.res_community_members  enable row level security;
alter table public.res_alerts             enable row level security;
alter table public.res_alert_responders   enable row level security;
alter table public.res_market_items       enable row level security;
alter table public.res_vendors            enable row level security;
alter table public.res_group_buys         enable row level security;
alter table public.res_group_buy_pledges  enable row level security;
alter table public.res_skills             enable row level security;
alter table public.res_lost_found         enable row level security;
alter table public.res_care_circle        enable row level security;
alter table public.res_shared_resources   enable row level security;
alter table public.res_neighbourhood_status enable row level security;

-- All policies require authenticated role.

-- res_profiles
drop policy if exists res_profiles_select on public.res_profiles;
create policy res_profiles_select on public.res_profiles
  for select to authenticated
  using (
    id = auth.uid()
    or exists (
      select 1 from public.res_room_requests r
      where (r.tenant_id = res_profiles.id and r.landlord_id = auth.uid())
         or (r.landlord_id = res_profiles.id and r.tenant_id = auth.uid())
    )
  );
drop policy if exists res_profiles_insert on public.res_profiles;
create policy res_profiles_insert on public.res_profiles
  for insert to authenticated with check (id = auth.uid());
drop policy if exists res_profiles_update on public.res_profiles;
create policy res_profiles_update on public.res_profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- res_listings
drop policy if exists res_listings_select on public.res_listings;
create policy res_listings_select on public.res_listings
  for select to authenticated using (true);
drop policy if exists res_listings_write on public.res_listings;
create policy res_listings_write on public.res_listings
  for insert to authenticated with check (landlord_id = auth.uid());
drop policy if exists res_listings_update on public.res_listings;
create policy res_listings_update on public.res_listings
  for update to authenticated using (landlord_id = auth.uid()) with check (landlord_id = auth.uid());
drop policy if exists res_listings_delete on public.res_listings;
create policy res_listings_delete on public.res_listings
  for delete to authenticated using (landlord_id = auth.uid());

-- res_room_requests
drop policy if exists res_requests_select on public.res_room_requests;
create policy res_requests_select on public.res_room_requests
  for select to authenticated using (tenant_id = auth.uid() or landlord_id = auth.uid());
drop policy if exists res_requests_insert on public.res_room_requests;
create policy res_requests_insert on public.res_room_requests
  for insert to authenticated with check (tenant_id = auth.uid());
drop policy if exists res_requests_update on public.res_room_requests;
create policy res_requests_update on public.res_room_requests
  for update to authenticated using (tenant_id = auth.uid() or landlord_id = auth.uid()) with check (tenant_id = auth.uid() or landlord_id = auth.uid());

-- res_lift_clubs
drop policy if exists res_lifts_select on public.res_lift_clubs;
create policy res_lifts_select on public.res_lift_clubs
  for select to authenticated using (true);
drop policy if exists res_lifts_insert on public.res_lift_clubs;
create policy res_lifts_insert on public.res_lift_clubs
  for insert to authenticated with check (driver_id = auth.uid());
drop policy if exists res_lifts_update on public.res_lift_clubs;
create policy res_lifts_update on public.res_lift_clubs
  for update to authenticated using (driver_id = auth.uid()) with check (driver_id = auth.uid());

-- res_handyman_services
drop policy if exists res_handyman_select on public.res_handyman_services;
create policy res_handyman_select on public.res_handyman_services
  for select to authenticated using (true);
drop policy if exists res_handyman_insert on public.res_handyman_services;
create policy res_handyman_insert on public.res_handyman_services
  for insert to authenticated with check (owner_id = auth.uid());
drop policy if exists res_handyman_update on public.res_handyman_services;
create policy res_handyman_update on public.res_handyman_services
  for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- res_service_dispatches
drop policy if exists res_dispatch_select on public.res_service_dispatches;
create policy res_dispatch_select on public.res_service_dispatches
  for select to authenticated
  using (
    sender_id = auth.uid()
    or exists (select 1 from public.res_handyman_services s
               where s.id = res_service_dispatches.service_id and s.owner_id = auth.uid())
  );
drop policy if exists res_dispatch_insert on public.res_service_dispatches;
create policy res_dispatch_insert on public.res_service_dispatches
  for insert to authenticated with check (sender_id = auth.uid());

-- res_utility_tokens
drop policy if exists res_tokens_select on public.res_utility_tokens;
create policy res_tokens_select on public.res_utility_tokens
  for select to authenticated using (true);
drop policy if exists res_tokens_insert on public.res_utility_tokens;
create policy res_tokens_insert on public.res_utility_tokens
  for insert to authenticated with check (landlord_id = auth.uid());
drop policy if exists res_tokens_update on public.res_utility_tokens;
create policy res_tokens_update on public.res_utility_tokens
  for update to authenticated
  using (landlord_id = auth.uid() or claimed_by = auth.uid() or (status = 'available' and auth.uid() is not null))
  with check (landlord_id = auth.uid() or claimed_by = auth.uid());

-- res_tool_library
drop policy if exists res_tools_select on public.res_tool_library;
create policy res_tools_select on public.res_tool_library
  for select to authenticated using (true);
drop policy if exists res_tools_insert on public.res_tool_library;
create policy res_tools_insert on public.res_tool_library
  for insert to authenticated with check (owner_id = auth.uid());
drop policy if exists res_tools_update on public.res_tool_library;
create policy res_tools_update on public.res_tool_library
  for update to authenticated using (owner_id = auth.uid() or rented_by = auth.uid()) with check (owner_id = auth.uid() or rented_by = auth.uid());

-- res_chore_schedule
drop policy if exists res_chores_select on public.res_chore_schedule;
create policy res_chores_select on public.res_chore_schedule
  for select to authenticated using (public.res_is_household_member(listing_id, auth.uid()));
drop policy if exists res_chores_insert on public.res_chore_schedule;
create policy res_chores_insert on public.res_chore_schedule
  for insert to authenticated with check (public.res_is_household_member(listing_id, auth.uid()));
drop policy if exists res_chores_update on public.res_chore_schedule;
create policy res_chores_update on public.res_chore_schedule
  for update to authenticated using (public.res_is_household_member(listing_id, auth.uid())) with check (public.res_is_household_member(listing_id, auth.uid()));

-- res_community_disputes
drop policy if exists res_disputes_select on public.res_community_disputes;
create policy res_disputes_select on public.res_community_disputes
  for select to authenticated using (reported_by_id = auth.uid() or against_user_id = auth.uid() or mediator_id = auth.uid());
drop policy if exists res_disputes_insert on public.res_community_disputes;
create policy res_disputes_insert on public.res_community_disputes
  for insert to authenticated with check (reported_by_id = auth.uid());

-- res_roommate_seekers
drop policy if exists res_seekers_select on public.res_roommate_seekers;
create policy res_seekers_select on public.res_roommate_seekers
  for select to authenticated using (true);
drop policy if exists res_seekers_write on public.res_roommate_seekers;
create policy res_seekers_write on public.res_roommate_seekers
  for insert to authenticated with check (id = auth.uid());
drop policy if exists res_seekers_update on public.res_roommate_seekers;
create policy res_seekers_update on public.res_roommate_seekers
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- res_notice_events
drop policy if exists res_notices_select on public.res_notice_events;
create policy res_notices_select on public.res_notice_events
  for select to authenticated using (true);
drop policy if exists res_notices_insert on public.res_notice_events;
create policy res_notices_insert on public.res_notice_events
  for insert to authenticated with check (posted_by_id = auth.uid());
drop policy if exists res_notices_update on public.res_notice_events;
create policy res_notices_update on public.res_notice_events
  for update to authenticated using (posted_by_id = auth.uid()) with check (posted_by_id = auth.uid());

-- res_communities
drop policy if exists res_communities_select on public.res_communities;
create policy res_communities_select on public.res_communities
  for select to authenticated using (true);
drop policy if exists res_communities_insert on public.res_communities;
create policy res_communities_insert on public.res_communities
  for insert to authenticated with check (created_by = auth.uid());
drop policy if exists res_communities_update on public.res_communities;
create policy res_communities_update on public.res_communities
  for update to authenticated using (created_by = auth.uid()) with check (created_by = auth.uid());

-- res_community_members
drop policy if exists res_members_select on public.res_community_members;
create policy res_members_select on public.res_community_members
  for select to authenticated using (true);
drop policy if exists res_members_insert on public.res_community_members;
create policy res_members_insert on public.res_community_members
  for insert to authenticated with check (user_id = auth.uid());
drop policy if exists res_members_delete on public.res_community_members;
create policy res_members_delete on public.res_community_members
  for delete to authenticated using (user_id = auth.uid() or exists (select 1 from public.res_communities c where c.id = res_community_members.community_id and c.created_by = auth.uid()));

-- res_alerts
drop policy if exists res_alerts_select on public.res_alerts;
create policy res_alerts_select on public.res_alerts
  for select to authenticated using (true);
drop policy if exists res_alerts_insert on public.res_alerts;
create policy res_alerts_insert on public.res_alerts
  for insert to authenticated with check (user_id = auth.uid());
drop policy if exists res_alerts_update on public.res_alerts;
create policy res_alerts_update on public.res_alerts
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- res_alert_responders: Only verified users may insert responses.
drop policy if exists res_responders_select on public.res_alert_responders;
create policy res_responders_select on public.res_alert_responders
  for select to authenticated using (true);
drop policy if exists res_responders_insert on public.res_alert_responders;
create policy res_responders_insert on public.res_alert_responders
  for insert to authenticated
  with check (
    responder_id = auth.uid()
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.is_verified = true
    )
  );
drop policy if exists res_responders_update on public.res_alert_responders;
create policy res_responders_update on public.res_alert_responders
  for update to authenticated using (responder_id = auth.uid()) with check (responder_id = auth.uid());

-- res_market_items
drop policy if exists res_market_select on public.res_market_items;
create policy res_market_select on public.res_market_items
  for select to authenticated using (true);
drop policy if exists res_market_insert on public.res_market_items;
create policy res_market_insert on public.res_market_items
  for insert to authenticated with check (user_id = auth.uid());
drop policy if exists res_market_update on public.res_market_items;
create policy res_market_update on public.res_market_items
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists res_market_delete on public.res_market_items;
create policy res_market_delete on public.res_market_items
  for delete to authenticated using (user_id = auth.uid());

-- res_vendors
drop policy if exists res_vendors_select on public.res_vendors;
create policy res_vendors_select on public.res_vendors
  for select to authenticated using (true);
drop policy if exists res_vendors_insert on public.res_vendors;
create policy res_vendors_insert on public.res_vendors
  for insert to authenticated with check (user_id = auth.uid());
drop policy if exists res_vendors_update on public.res_vendors;
create policy res_vendors_update on public.res_vendors
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- res_group_buys
drop policy if exists res_groupbuys_select on public.res_group_buys;
create policy res_groupbuys_select on public.res_group_buys
  for select to authenticated using (true);
drop policy if exists res_groupbuys_insert on public.res_group_buys;
create policy res_groupbuys_insert on public.res_group_buys
  for insert to authenticated with check (organizer_id = auth.uid());
drop policy if exists res_groupbuys_update on public.res_group_buys;
create policy res_groupbuys_update on public.res_group_buys
  for update to authenticated using (organizer_id = auth.uid()) with check (organizer_id = auth.uid());

-- res_group_buy_pledges
drop policy if exists res_pledges_select on public.res_group_buy_pledges;
create policy res_pledges_select on public.res_group_buy_pledges
  for select to authenticated using (true);
drop policy if exists res_pledges_insert on public.res_group_buy_pledges;
create policy res_pledges_insert on public.res_group_buy_pledges
  for insert to authenticated with check (user_id = auth.uid());
drop policy if exists res_pledges_update on public.res_group_buy_pledges;
create policy res_pledges_update on public.res_group_buy_pledges
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- res_skills
drop policy if exists res_skills_select on public.res_skills;
create policy res_skills_select on public.res_skills
  for select to authenticated using (true);
drop policy if exists res_skills_insert on public.res_skills;
create policy res_skills_insert on public.res_skills
  for insert to authenticated with check (user_id = auth.uid());
drop policy if exists res_skills_update on public.res_skills;
create policy res_skills_update on public.res_skills
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- res_lost_found
drop policy if exists res_lostfound_select on public.res_lost_found;
create policy res_lostfound_select on public.res_lost_found
  for select to authenticated using (true);
drop policy if exists res_lostfound_insert on public.res_lost_found;
create policy res_lostfound_insert on public.res_lost_found
  for insert to authenticated with check (user_id = auth.uid());
drop policy if exists res_lostfound_update on public.res_lost_found;
create policy res_lostfound_update on public.res_lost_found
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- res_care_circle
drop policy if exists res_care_select on public.res_care_circle;
create policy res_care_select on public.res_care_circle
  for select to authenticated using (subject_id = auth.uid() or carer_id = auth.uid());
drop policy if exists res_care_insert on public.res_care_circle;
create policy res_care_insert on public.res_care_circle
  for insert to authenticated with check (carer_id = auth.uid());
drop policy if exists res_care_update on public.res_care_circle;
create policy res_care_update on public.res_care_circle
  for update to authenticated using (subject_id = auth.uid() or carer_id = auth.uid()) with check (subject_id = auth.uid() or carer_id = auth.uid());

-- res_shared_resources
drop policy if exists res_resources_select on public.res_shared_resources;
create policy res_resources_select on public.res_shared_resources
  for select to authenticated using (true);
drop policy if exists res_resources_insert on public.res_shared_resources;
create policy res_resources_insert on public.res_shared_resources
  for insert to authenticated with check (owner_id = auth.uid());
drop policy if exists res_resources_update on public.res_shared_resources;
create policy res_resources_update on public.res_shared_resources
  for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- res_neighbourhood_status
drop policy if exists res_status_select on public.res_neighbourhood_status;
create policy res_status_select on public.res_neighbourhood_status
  for select to authenticated using (true);
drop policy if exists res_status_insert on public.res_neighbourhood_status;
create policy res_status_insert on public.res_neighbourhood_status
  for insert to authenticated with check (reporter_id = auth.uid());
