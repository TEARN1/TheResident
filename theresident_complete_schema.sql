-- ===========================================================================
-- THE RESIDENT — COMPLETE DATABASE SCHEMA
-- ===========================================================================
--
-- Every table, policy, function, trigger, index and grant that makes up The
-- Resident, in one file, in dependency order. Paste it whole into the
-- Supabase SQL editor; there is nothing else to paste and no order to get
-- right.
--
-- This replaces 32 separate .sql files. They were applied by hand, one at a
-- time, in an order that lived only in sql-tests/run.sh — and that list had
-- already drifted (the newest lockdown was missing from it). Consolidating
-- them is what surfaced the four defects noted below; none of them was
-- visible while the schema could not be built from source in one go.
--
-- SAFE TO RE-RUN. Every statement is `if not exists`, `create or replace`, or
-- a drop-then-create pair. Applying it to a database that already has the
-- schema changes nothing. Verified by applying it twice to an empty
-- PostgreSQL 16 + PostGIS and diffing: second pass emits notices, no errors.
--
-- WHAT IS NOT IN HERE. theresident_import_boundaries.sql — that loads
-- municipal boundary data over pg_net and reads a specific http response row.
-- It is a one-shot operational script, not schema, and re-running it would
-- re-import boundaries. It stays a separate file on purpose.
--
-- REQUIRES: uuid-ossp and postgis. Assumes the Gruvs-owned `profiles`,
-- `notifications` and `events` tables and the `touch_updated_at()` /
-- `award_xp()` helpers already exist — The Resident does not own those
-- (CONTRACT.md §3) and this file neither creates nor modifies them.
--
-- ---------------------------------------------------------------------------
-- CONTENTS
-- ---------------------------------------------------------------------------
--   01. resident_schema.sql
--       Core tables: profiles, listings, market, alerts, communities, lifts, skills
--   02. theresident_undocumented_tables_schema.sql
--       Tables that existed in production before this repo tracked them
--   03. theresident_legal_name_column.sql
--       res_profiles.legal_name (the column the profile page was writing to blind)
--   04. theresident_care_circle_flag.sql
--       Check-in flag for the care circle
--   05. theresident_safety_scoping.sql
--       Narrows alert visibility to the reporter's own suburb
--   06. theresident_security_log_schema.sql
--       res_security_logs — sign-in and account events, anon-insertable
--   07. theresident_org_broadcast_schema.sql
--       Org units, follows, memberships, follow-based broadcasts
--   08. theresident_service_desk_schema.sql
--       Service Desk: fault reports, timeline, corroboration, provider performance
--   09. theresident_directory_urgency_schema.sql
--       Broadcast priority, receipts, fan-out into the notifications rail
--   10. theresident_room_inventory_schema.sql
--       Landlord-private rooms and occupants, with occupant-set visibility
--   11. theresident_property_delete_and_verification_meaning.sql
--       Safe property deletion and what "verified" actually asserts
--   12. theresident_kin_verification_link.sql
--       Next-of-kin confirmation by shareable link
--   13. theresident_gossip_reactions.sql
--       Reactions on gossip posts
--   14. theresident_home_area_schema.sql
--       res_home_areas — the Resident-owned coarse home point
--   15. theresident_jurisdictions_schema.sql
--       res_jurisdictions — authority as a polygon
--   16. theresident_area_audience_schema.sql
--       Resolving who is inside a target area (home pin, then suburb text)
--   17. theresident_area_broadcast_send_schema.sql
--       The send path: gates, fan-out, receipts, permanent public record
--   18. theresident_web_push_dispatch_schema.sql
--       Dispatching a broadcast to real device push
--   19. theresident_area_billing_schema.sql
--       Per-office area-messaging licence and six-month probation
--   20. theresident_official_verification_schema.sql
--       Platform admins, verification requests, audit trail
--   21. theresident_org_unit_column_lockdown.sql
--       Column-level grants so a sender cannot verify themselves
--   22. theresident_traffic_reports_policy_cleanup.sql
--       Removes duplicate traffic policies and the anon write grants
--   23. theresident_foreign_key_indexes.sql
--       Indexes for every foreign key that lacked one
--   24. theresident_maintenance_scheduler.sql
--       res_run_maintenance() and its run log
--   25. theresident_urgent_banner_area_notices.sql
--       Area notices in the urgent banner queue
--   26. theresident_client_error_logging.sql
--       res_client_errors — client-side error capture
--   27. theresident_rate_limit_write_paths.sql
--       Rate limits on the remaining direct write paths
--   28. theresident_rls_initplan_perf_fix.sql
--       auth.uid() -> (select auth.uid()) on tables built this cycle
--   29. theresident_rls_initplan_perf_fix_legacy_tables.sql
--       The same fix across the 44 older tables
--   30. theresident_db_hardening.sql
--       search_path pinning and function privilege tightening
--   31. theresident_anon_grant_lockdown.sql
--       Pins the anon-callable function surface to a deliberate short list
--   32. theresident_grant_policy_lockdown.sql
--       Revokes every write grant with no RLS policy behind it
--
-- ---------------------------------------------------------------------------
-- DEFECTS FOUND BY BUILDING THIS FILE
-- ---------------------------------------------------------------------------
--   * theresident_traffic_reports_policy_cleanup.sql split one CREATE POLICY
--     across three `execute` calls, so it sent three incomplete statements and
--     failed on the second. That file had never been re-runnable.
--   * res_pending_urgent_broadcasts() changed return type when area notices
--     were added; CREATE OR REPLACE cannot do that, so re-running failed.
--     It is now dropped before each definition.
--   * Eight tables (res_blocks, res_community_invites, res_direct_messages,
--     res_infra_partner_admins, res_lift_bookings, res_purchases,
--     res_rate_limits, res_reports) and one function (res_account_ready)
--     existed in production and in no file here. A clean build stopped dead
--     on them. Now transcribed from the live catalogs.
--   * The test prelude carried cut-down copies of eight res_* tables. Because
--     `if not exists` lets the first definition win, a 4-column stand-in for
--     res_gossip_posts shadowed the real 9-column table, so the suite had
--     been testing a table that does not exist in production.
--
-- ===========================================================================



-- ==========================================================================
-- 01. resident_schema.sql
-- ==========================================================================

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
  -- Deliberately Resident-owned, separate from the Gruvs-owned profiles.name
  -- shown elsewhere in the app (CONTRACT.md §2) — this app never writes that
  -- column outside initial signup. Set once a resident wants a formal name
  -- on record for verification/landlord-facing contexts distinct from
  -- whatever display name they use on The Gruvs.
  legal_name text,
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
  -- Independent of `status` (which tracks whether the check-in cadence
  -- itself is running): whether the subject has flagged that they need
  -- help. See theresident_care_circle_flag.sql.
  flag text check (flag in ('none', 'needs_assistance')) default 'none' not null,
  flagged_at timestamptz,
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
begin
  select * into v_alert from res_alerts where id = p_alert_id;
  if not found then
    raise exception 'alert not found';
  end if;

  -- Find verified profiles who are members of the community or located
  -- nearby (for simplicity, we scope to the same community, suburb, or
  -- city) — one set-based insert rather than a per-recipient loop.
  insert into notifications (recipient_id, actor_id, type, title, body, data)
  select
    p.id,
    v_alert.user_id,
    'res_alert_panic',
    '🚨 NEIGHBOURHOOD ALERT: ' || v_alert.title,
    v_alert.description,
    jsonb_build_object('alert_id', v_alert.id, 'kind', v_alert.kind)
  from profiles p
  left join res_community_members cm on cm.user_id = p.id
  where p.id <> v_alert.user_id
    and p.is_verified = true
    and (
      (v_alert.community_id is not null and cm.community_id = v_alert.community_id)
      or (v_alert.community_id is null and v_alert.suburb is not null and p.city = v_alert.city)
    );
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
  for select to authenticated using (
    user_id = auth.uid()
    -- alertToRow never sets community_id/city today, so rows with neither
    -- fall back to visible-to-all rather than becoming invisible to
    -- everyone but their creator. See theresident_safety_scoping.sql.
    or (community_id is null and city is null)
    or (community_id is not null and public.res_is_community_member(community_id, auth.uid()))
    or (
      community_id is null
      and city is not null
      and exists (select 1 from public.profiles p where p.id = auth.uid() and p.city = res_alerts.city)
    )
  );
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
  for select to authenticated using (
    reporter_id = auth.uid()
    -- neighbourhoodStatusToRow never sets community_id/city today, so rows
    -- with neither fall back to visible-to-all. See
    -- theresident_safety_scoping.sql.
    or (community_id is null and city is null)
    or (community_id is not null and public.res_is_community_member(community_id, auth.uid()))
    or (
      community_id is null
      and city is not null
      and exists (select 1 from public.profiles p where p.id = auth.uid() and p.city = res_neighbourhood_status.city)
    )
  );
drop policy if exists res_status_insert on public.res_neighbourhood_status;
create policy res_status_insert on public.res_neighbourhood_status
  for insert to authenticated with check (reporter_id = auth.uid());

-- ── 7. APP DELTAS (applied as migration notice_reactions_and_missing_policies) ─

-- Vibe / echo reactions on notice boards (uuid[] like rsvps)
alter table public.res_notice_events
  add column if not exists vibes uuid[] default '{}',
  add column if not exists echos uuid[] default '{}';

-- Reaction toggles run as security definer because res_notice_events
-- update-RLS is poster-only (same pattern as res_toggle_rsvp).
create or replace function public.res_toggle_vibe(p_notice_id uuid)
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
     set vibes = case when auth.uid() = any(vibes)
                      then array_remove(vibes, auth.uid())
                      else array_append(vibes, auth.uid()) end
   where id = p_notice_id
  returning auth.uid() = any(vibes) into joined;
  return coalesce(joined, false);
end;
$$;

create or replace function public.res_toggle_echo(p_notice_id uuid)
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
     set echos = case when auth.uid() = any(echos)
                      then array_remove(echos, auth.uid())
                      else array_append(echos, auth.uid()) end
   where id = p_notice_id
  returning auth.uid() = any(echos) into joined;
  return coalesce(joined, false);
end;
$$;

revoke execute on function public.res_toggle_vibe(uuid) from public, anon;
revoke execute on function public.res_toggle_echo(uuid) from public, anon;
grant execute on function public.res_toggle_vibe(uuid) to authenticated, service_role;
grant execute on function public.res_toggle_echo(uuid) to authenticated, service_role;

-- Chore-week reset deletes a household's chores before re-inserting
drop policy if exists res_chores_delete on public.res_chore_schedule;
create policy res_chores_delete on public.res_chore_schedule
  for delete to authenticated using (public.res_is_household_member(listing_id, auth.uid()));

-- Dispute mediation/resolution updates status + resolution_details
drop policy if exists res_disputes_update on public.res_community_disputes;
create policy res_disputes_update on public.res_community_disputes
  for update to authenticated
  using (reported_by_id = auth.uid() or mediator_id = auth.uid())
  with check (reported_by_id = auth.uid() or mediator_id = auth.uid());

-- ── 8. ATOMIC COUNTERS (migration atomic_seat_and_pledge_counters) ────────────
-- The client used to read a count, add to it in JavaScript and write the result
-- back, so two concurrent users could each book the same last seat. The
-- mutation now happens inside the database with the guard in the WHERE clause.

create or replace function public.res_book_seat(p_lift_id uuid)
returns integer
language plpgsql security definer
set search_path = public
as $$
declare v_seats integer;
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;

  update res_lift_clubs
     set available_seats = available_seats - 1
   where id = p_lift_id
     and available_seats > 0
  returning available_seats into v_seats;

  if v_seats is null then
    if not exists (select 1 from res_lift_clubs where id = p_lift_id) then
      raise exception 'lift not found';
    end if;
    raise exception 'no seats available';
  end if;

  return v_seats;
end;
$$;

create or replace function public.res_release_seat(p_lift_id uuid)
returns integer
language plpgsql security definer
set search_path = public
as $$
declare v_seats integer;
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;

  update res_lift_clubs
     set available_seats = available_seats + 1
   where id = p_lift_id
     and available_seats < total_seats
  returning available_seats into v_seats;

  if v_seats is null then
    raise exception 'seat cannot be released';
  end if;

  return v_seats;
end;
$$;

-- The pledge row is the source of truth (unique per user per buy, so
-- re-pledging updates); current_quantity is recomputed from the sum of pledges
-- rather than incremented, which makes the counter self-healing.
create or replace function public.res_pledge_group_buy(p_group_buy_id uuid, p_quantity integer)
returns integer
language plpgsql security definer
set search_path = public
as $$
declare
  v_total integer;
  v_target integer;
  v_deadline timestamptz;
  v_status text;
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'quantity must be positive';
  end if;

  select target_quantity, deadline, status
    into v_target, v_deadline, v_status
    from res_group_buys
   where id = p_group_buy_id
     for update;

  if not found then
    raise exception 'group buy not found';
  end if;
  if v_status <> 'open' then
    raise exception 'group buy is not open';
  end if;
  if v_deadline < now() then
    raise exception 'group buy deadline has passed';
  end if;

  insert into res_group_buy_pledges (group_buy_id, user_id, quantity)
  values (p_group_buy_id, auth.uid(), p_quantity)
  on conflict (group_buy_id, user_id)
  do update set quantity = excluded.quantity;

  select coalesce(sum(quantity), 0) into v_total
    from res_group_buy_pledges
   where group_buy_id = p_group_buy_id;

  update res_group_buys
     set current_quantity = v_total,
         status = case when v_total >= v_target then 'completed' else status end
   where id = p_group_buy_id;

  return v_total;
end;
$$;

revoke execute on function public.res_book_seat(uuid) from public, anon;
revoke execute on function public.res_release_seat(uuid) from public, anon;
revoke execute on function public.res_pledge_group_buy(uuid, integer) from public, anon;

grant execute on function public.res_book_seat(uuid) to authenticated, service_role;
grant execute on function public.res_release_seat(uuid) to authenticated, service_role;
grant execute on function public.res_pledge_group_buy(uuid, integer) to authenticated, service_role;

-- VibeMap Schema Extensions
alter table if exists public.res_listings 
  add column if not exists approach_photo_url text,
  add column if not exists micro_landmark text,
  add column if not exists last_verified_at timestamptz default now(),
  add column if not exists verified_by_user_id uuid references public.profiles(id) on delete set null;

alter table if exists public.res_vendors 
  add column if not exists approach_photo_url text,
  add column if not exists micro_landmark text,
  add column if not exists last_verified_at timestamptz default now(),
  add column if not exists verified_by_user_id uuid references public.profiles(id) on delete set null;

alter table if exists public.res_shared_resources 
  add column if not exists approach_photo_url text,
  add column if not exists micro_landmark text,
  add column if not exists last_verified_at timestamptz default now(),
  add column if not exists verified_by_user_id uuid references public.profiles(id) on delete set null;

-- res_traffic_reports: Crowdsourced speed delays, roadblocks, potholes, dead robots
create table if not exists public.res_traffic_reports (
  id uuid primary key default uuid_generate_v4(),
  reporter_id uuid references public.profiles(id) on delete cascade not null,
  suburb text,
  city text,
  lat double precision not null,
  lon double precision not null,
  report_type text check (report_type in ('congestion', 'pothole', 'roadblock', 'accident', 'dead_robots', 'other')) not null,
  description text,
  created_at timestamptz default now()
);

-- RLS for res_traffic_reports
alter table public.res_traffic_reports enable row level security;

drop policy if exists "traffic_read_policy" on public.res_traffic_reports;
create policy "traffic_read_policy" 
  on public.res_traffic_reports for select 
  to authenticated, anon 
  using (true);

drop policy if exists "traffic_insert_policy" on public.res_traffic_reports;
create policy "traffic_insert_policy" 
  on public.res_traffic_reports for insert 
  to authenticated 
  with check (auth.uid() = reporter_id);


-- ==========================================================================
-- 02. theresident_undocumented_tables_schema.sql
-- ==========================================================================

-- ═══════════════════════════════════════════════════════════════════════════
-- The Resident — the 12 Resident-owned tables that were never versioned.
--
-- WHY THIS FILE EXISTS
-- These tables all back shipped features, and all of them existed ONLY in
-- the live Supabase project — no schema in the repo, so the database could
-- not be rebuilt from source and their RLS could not be audited from here.
-- SECURITY.md's "26 tables, every one has RLS" was true but covered only
-- part of the app.
--
-- They drifted because they bypass src/store/dbMappers.ts (which carries
-- explicit per-table column allow-lists and is what keeps the other tables
-- honest) and are queried directly from feature components instead. They
-- arrived in two large multi-feature commits — 0f9612c "build out the
-- 19-item backlog" and 9901f4a "subscriptions, pay-for-priority tiers" —
-- where the tables were created ad-hoc in the Supabase dashboard and
-- resident_schema.sql was never updated to match.
--
-- ⚠️  READ THIS BEFORE RUNNING ⚠️
-- This schema was RECONSTRUCTED from how the client queries each table. It
-- is therefore a best-effort reconstruction, not an export. It cannot see:
--   • columns the client never selects or writes
--   • exact types (a client can't tell numeric from int8), defaults,
--     or nullability
--   • constraints, triggers, and indexes
--   • the RLS policies actually in force
--
-- So:
--   STEP 1 is a read-only diff — run it first and compare.
--   STEP 2 is `create table if not exists`, a guaranteed no-op against the
--          live project. Its real purpose is rebuilding a fresh environment.
--   STEP 3 (RLS) is DESTRUCTIVE — drop+create is the only idempotent idiom
--          Postgres offers for policies, so running it REPLACES whatever is
--          live. It is commented out on purpose. Run STEP 1, compare, and
--          only then uncomment what you've confirmed.
-- ═══════════════════════════════════════════════════════════════════════════

create extension if not exists "uuid-ossp";


-- ═══ STEP 1 ═══ Read-only. Dump the live shape so you can compare. ═════════
-- Run this ALONE first. Nothing below it will change anything until you
-- deliberately run it.

select
  c.table_name,
  c.column_name,
  c.data_type,
  c.is_nullable,
  c.column_default
from information_schema.columns c
where c.table_schema = 'public'
  and c.table_name in (
    'res_gossip_posts', 'res_gossip_comments', 'res_trust_connections',
    'res_saved_pins', 'res_saved_searches', 'res_reviews', 'res_reputation',
    'res_subscriptions', 'res_notification_prefs', 'res_properties',
    'res_moderation_actions', 'res_infra_providers'
  )
order by c.table_name, c.ordinal_position;

-- Live RLS posture for the same 12 tables — compare against STEP 3 before
-- uncommenting any of it. An empty `policies` count with rls_enabled = true
-- means the table is currently readable/writable by NOBODY except the
-- service role; rls_enabled = false means it is wide open to any
-- authenticated user, which is the case actually worth finding here.
select
  t.tablename,
  cl.relrowsecurity as rls_enabled,
  count(p.policyname) as policies
from pg_tables t
join pg_class cl on cl.relname = t.tablename
left join pg_policies p on p.tablename = t.tablename and p.schemaname = 'public'
where t.schemaname = 'public'
  and t.tablename in (
    'res_gossip_posts', 'res_gossip_comments', 'res_trust_connections',
    'res_saved_pins', 'res_saved_searches', 'res_reviews', 'res_reputation',
    'res_subscriptions', 'res_notification_prefs', 'res_properties',
    'res_moderation_actions', 'res_infra_providers'
  )
group by t.tablename, cl.relrowsecurity
order by t.tablename;


-- ═══ STEP 2 ═══ Table definitions. No-op on the live project. ═════════════
-- Safe to run: `if not exists` cannot alter an existing table. This section
-- exists so a fresh environment can be built from this repo alone.

-- ── Gossip feed ────────────────────────────────────────────────────────────
-- Written via the res_comment_gossip RPC for comments; posts are inserted
-- directly. `community_id` is nullable — the composer passes null for a
-- suburb-wide post (src/app/dashboard/gossip/page.tsx).
create table if not exists public.res_gossip_posts (
  id uuid primary key default uuid_generate_v4(),
  author_id uuid references public.profiles(id) on delete cascade not null,
  community_id uuid references public.res_communities(id) on delete set null,
  body text not null,
  media_url text,
  media_type text check (media_type in ('image', 'video')),
  background_style text,
  hidden boolean default false,
  created_at timestamptz default now()
);

create table if not exists public.res_gossip_comments (
  id uuid primary key default uuid_generate_v4(),
  post_id uuid references public.res_gossip_posts(id) on delete cascade not null,
  author_id uuid references public.profiles(id) on delete cascade not null,
  body text not null,
  hidden boolean default false,
  created_at timestamptz default now()
);

-- Keyset pagination in the gossip feed orders by (created_at desc, id desc).
create index if not exists res_gossip_posts_feed_idx on public.res_gossip_posts (created_at desc, id desc);
create index if not exists res_gossip_comments_post_idx on public.res_gossip_comments (post_id, created_at);

-- ── Trust circle ───────────────────────────────────────────────────────────
-- Deliberately separate from the Gruvs follow graph (follows/mutual_follows):
-- blending them would let mutual-follow-farming fake a trust circle. Written
-- via res_request_trust_connection; read for the 2-hop gate (res_trust_gate)
-- and the Next-of-Kin grace check (src/utils/trust.ts).
create table if not exists public.res_trust_connections (
  id uuid primary key default uuid_generate_v4(),
  requester_id uuid references public.profiles(id) on delete cascade not null,
  connection_id uuid references public.profiles(id) on delete cascade not null,
  status text not null check (status in ('pending', 'confirmed', 'declined')) default 'pending',
  created_at timestamptz default now(),
  confirmed_at timestamptz,
  check (requester_id <> connection_id),
  unique (requester_id, connection_id)
);

create index if not exists res_trust_connections_requester_idx on public.res_trust_connections (requester_id, status);
create index if not exists res_trust_connections_connection_idx on public.res_trust_connections (connection_id, status);

-- ── Reputation ─────────────────────────────────────────────────────────────
-- Server-authoritative, bumped via res_bump_reputation — never written from
-- the client, which only ever reads `score` (src/utils/trust.ts).
create table if not exists public.res_reputation (
  user_id uuid references public.profiles(id) on delete cascade primary key,
  score integer not null default 0,
  updated_at timestamptz default now()
);

-- ── Personal map pins ──────────────────────────────────────────────────────
create table if not exists public.res_saved_pins (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  label text not null default 'Saved place',
  lat double precision not null,
  lon double precision not null,
  created_at timestamptz default now()
);

create index if not exists res_saved_pins_user_idx on public.res_saved_pins (user_id, created_at desc);

-- ── Saved searches ─────────────────────────────────────────────────────────
-- `filters` is an opaque JSON blob of the housing filter panel's state;
-- res_match_saved_searches runs server-side against new listings.
create table if not exists public.res_saved_searches (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  name text not null default 'Untitled search',
  filters jsonb not null default '{}'::jsonb,
  notify boolean default true,
  last_opened_at timestamptz,
  created_at timestamptz default now()
);

create index if not exists res_saved_searches_user_idx on public.res_saved_searches (user_id, created_at desc);

-- ── Reviews ────────────────────────────────────────────────────────────────
-- Polymorphic subject so one table covers user, listing, and service reviews
-- (src/app/dashboard/components/social/ReviewsList.tsx reads subject_type
-- = 'user'). No client-side insert path exists today — reviews are written
-- server-side.
create table if not exists public.res_reviews (
  id uuid primary key default uuid_generate_v4(),
  author_id uuid references public.profiles(id) on delete cascade not null,
  subject_type text not null check (subject_type in ('user', 'listing', 'service')),
  subject_id uuid not null,
  rating integer not null check (rating between 1 and 5),
  body text,
  created_at timestamptz default now()
);

create index if not exists res_reviews_subject_idx on public.res_reviews (subject_type, subject_id, created_at desc);

-- ── Subscriptions ──────────────────────────────────────────────────────────
-- Written ONLY by the Paystack webhook edge function (service_role). The
-- client reads its own row and otherwise goes through the
-- res_public_provider_tier RPC, so a tier can never be self-assigned.
create table if not exists public.res_subscriptions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  product text not null,
  tier text check (tier in ('priority', 'premium')),
  status text not null check (status in ('active', 'cancelled', 'expired', 'pending')) default 'pending',
  current_period_end timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (user_id, product)
);

-- ── Notification preferences ───────────────────────────────────────────────
-- Upserted by the owner. Panic alerts deliberately ignore muted_types and
-- quiet hours — see the notification pipeline, not this table.
create table if not exists public.res_notification_prefs (
  user_id uuid references public.profiles(id) on delete cascade primary key,
  muted_types text[] default '{}',
  quiet_hours_start integer check (quiet_hours_start between 0 and 23),
  quiet_hours_end integer check (quiet_hours_end between 0 and 23),
  digest boolean default false,
  updated_at timestamptz default now()
);

-- ── Landlord properties ────────────────────────────────────────────────────
-- A property groups several res_listings rooms under one address, and
-- carries the landlord's document-review state.
create table if not exists public.res_properties (
  id uuid primary key default uuid_generate_v4(),
  landlord_id uuid references public.profiles(id) on delete cascade not null,
  address text not null,
  suburb text,
  city text,
  lat double precision,
  lon double precision,
  total_rooms integer default 0,
  doc_review_status text check (doc_review_status in ('none', 'pending', 'reviewed')) default 'none',
  doc_review_note text,
  verification_doc_url text,
  address_geocode_mismatch boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists res_properties_landlord_idx on public.res_properties (landlord_id);

-- ── Community moderation audit ─────────────────────────────────────────────
-- Written by the moderation RPCs, read by community admins/founders only.
create table if not exists public.res_moderation_actions (
  id uuid primary key default uuid_generate_v4(),
  community_id uuid references public.res_communities(id) on delete cascade not null,
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  subject_type text not null,
  subject_id uuid,
  reason text,
  created_at timestamptz default now()
);

create index if not exists res_moderation_actions_community_idx on public.res_moderation_actions (community_id, created_at desc);

-- ── Infrastructure providers ───────────────────────────────────────────────
-- Reference data (municipality, Eskom, water utility) that official
-- res_neighbourhood_status entries point at. Read-only for users.
-- Corrected against the live table. This definition had drifted twice: the
-- `kind` values were (electricity, water, municipal, other) where production
-- uses the set that matches res_neighbourhood_status.kind exactly, and there
-- was a `region` column production has never had. Both fixed here; contact
-- details are added in section 34.
create table if not exists public.res_infra_providers (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  kind text not null check (kind in ('power', 'water', 'network', 'fiber', 'road')),
  created_at timestamptz not null default now()
);


-- ═══ STEP 3 ═══ RLS. DESTRUCTIVE — read the header, run STEP 1 first. ═════
-- Commented out deliberately. `drop policy if exists` + `create policy` is
-- the only idempotent idiom Postgres offers, which means running this
-- REPLACES whatever is live — and these tables are already serving real
-- traffic under policies this repo has never seen. Compare against STEP 1's
-- output, then uncomment only what you've confirmed.
--
-- The intent below is reconstructed from what the client code assumes:
--   • savedPins.ts states RLS already restricts rows to user_id = auth.uid()
--   • subscriptions.ts states res_subscriptions is service_role-write only
--   • trust-circle/page.tsx states writes go through explicit RPCs
--
/*
alter table public.res_gossip_posts        enable row level security;
alter table public.res_gossip_comments     enable row level security;
alter table public.res_trust_connections   enable row level security;
alter table public.res_saved_pins          enable row level security;
alter table public.res_saved_searches      enable row level security;
alter table public.res_reviews             enable row level security;
alter table public.res_reputation          enable row level security;
alter table public.res_subscriptions       enable row level security;
alter table public.res_notification_prefs  enable row level security;
alter table public.res_properties          enable row level security;
alter table public.res_moderation_actions  enable row level security;
alter table public.res_infra_providers     enable row level security;

-- Gossip: visible to any authenticated neighbour unless hidden by a
-- moderator; you may only post as yourself and only delete your own.
drop policy if exists res_gossip_posts_select on public.res_gossip_posts;
create policy res_gossip_posts_select on public.res_gossip_posts
  for select to authenticated using (hidden = false or author_id = auth.uid());
drop policy if exists res_gossip_posts_insert on public.res_gossip_posts;
create policy res_gossip_posts_insert on public.res_gossip_posts
  for insert to authenticated with check (author_id = auth.uid());
drop policy if exists res_gossip_posts_delete on public.res_gossip_posts;
create policy res_gossip_posts_delete on public.res_gossip_posts
  for delete to authenticated using (author_id = auth.uid());

drop policy if exists res_gossip_comments_select on public.res_gossip_comments;
create policy res_gossip_comments_select on public.res_gossip_comments
  for select to authenticated using (hidden = false or author_id = auth.uid());
drop policy if exists res_gossip_comments_insert on public.res_gossip_comments;
create policy res_gossip_comments_insert on public.res_gossip_comments
  for insert to authenticated with check (author_id = auth.uid());

-- Trust connections: only the two parties to a connection can see it.
drop policy if exists res_trust_connections_select on public.res_trust_connections;
create policy res_trust_connections_select on public.res_trust_connections
  for select to authenticated
  using (requester_id = auth.uid() or connection_id = auth.uid());

-- Strictly private, self-service tables.
drop policy if exists res_saved_pins_all on public.res_saved_pins;
create policy res_saved_pins_all on public.res_saved_pins
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists res_saved_searches_all on public.res_saved_searches;
create policy res_saved_searches_all on public.res_saved_searches
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists res_notification_prefs_all on public.res_notification_prefs;
create policy res_notification_prefs_all on public.res_notification_prefs
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Reviews and reputation: world-readable credibility signals; neither is
-- client-writable (reviews are written server-side, reputation via
-- res_bump_reputation) so no insert/update policy is granted.
drop policy if exists res_reviews_select on public.res_reviews;
create policy res_reviews_select on public.res_reviews
  for select to authenticated using (true);

drop policy if exists res_reputation_select on public.res_reputation;
create policy res_reputation_select on public.res_reputation
  for select to authenticated using (true);

-- Subscriptions: read your own only. No insert/update policy at all — a
-- tier must never be self-assignable; the Paystack webhook writes it with
-- the service role, which bypasses RLS.
drop policy if exists res_subscriptions_select on public.res_subscriptions;
create policy res_subscriptions_select on public.res_subscriptions
  for select to authenticated using (user_id = auth.uid());

-- Properties: owned and managed by the landlord.
drop policy if exists res_properties_all on public.res_properties;
create policy res_properties_all on public.res_properties
  for all to authenticated using (landlord_id = auth.uid()) with check (landlord_id = auth.uid());

-- Moderation log: readable only by admins/founders of that community, and
-- never client-writable (the moderation RPCs write it).
drop policy if exists res_moderation_actions_select on public.res_moderation_actions;
create policy res_moderation_actions_select on public.res_moderation_actions
  for select to authenticated
  using (exists (
    select 1 from public.res_community_members m
    where m.community_id = res_moderation_actions.community_id
      and m.user_id = auth.uid()
      and m.role in ('admin', 'founder')
  ));

-- Provider reference data: read-only for everyone.
drop policy if exists res_infra_providers_select on public.res_infra_providers;
create policy res_infra_providers_select on public.res_infra_providers
  for select to authenticated using (true);
*/

-- ---------------------------------------------------------------------------
-- Eight more tables that exist in production and nowhere in this repo
-- ---------------------------------------------------------------------------
--
-- Found by consolidating the schema into one file: the legacy RLS perf fix
-- rewrites policies on these eight, but no file in the repo ever created
-- them, so a clean build from source stopped at "relation public.res_blocks
-- does not exist". That is the same drift this file was opened to close —
-- the repo is supposed to be the schema-of-record, and for these it was not.
--
-- Column types, defaults, checks, keys and indexes below are transcribed from
-- the live database (pg_attribute / pg_constraint / pg_indexes), not inferred
-- from how the client uses them. `if not exists` throughout, so applying this
-- to the live project is a no-op; it only matters when rebuilding from zero.
--
-- RLS policies for these tables are NOT repeated here. They already live in
-- theresident_rls_initplan_perf_fix_legacy_tables.sql, which drops and
-- recreates each one; duplicating them would mean two places to keep in step.

-- Personal blocklist. The check keeps a user from blocking themselves.
create table if not exists public.res_blocks (
  id uuid primary key default uuid_generate_v4(),
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz default now(),
  unique (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
create index if not exists idx_res_blocks_blocker on public.res_blocks (blocker_id);
create index if not exists res_blocks_blocked_id_idx on public.res_blocks (blocked_id);

-- Join-by-code invitations to a community. `uses`/`max_uses` and `revoked`
-- are what make a code expire by exhaustion rather than only by date.
create table if not exists public.res_community_invites (
  id uuid primary key default uuid_generate_v4(),
  community_id uuid not null references public.res_communities(id) on delete cascade,
  code text not null unique,
  created_by uuid not null references public.profiles(id) on delete cascade,
  max_uses integer not null default 1 check (max_uses > 0),
  uses integer not null default 0 check (uses >= 0),
  expires_at timestamptz,
  revoked boolean not null default false,
  created_at timestamptz default now()
);
create index if not exists idx_res_invites_code on public.res_community_invites (code);
create index if not exists res_community_invites_community_id_idx on public.res_community_invites (community_id);
create index if not exists res_community_invites_created_by_idx on public.res_community_invites (created_by);

-- One-to-one messages. `is_request` marks a first contact from someone the
-- recipient has no connection with, so it can be held separately.
create table if not exists public.res_direct_messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) >= 1 and char_length(body) <= 4000),
  is_request boolean not null default false,
  created_at timestamptz not null default now(),
  constraint res_dm_no_self_message check (sender_id <> recipient_id)
);
create index if not exists res_direct_messages_recipient_idx on public.res_direct_messages (recipient_id, created_at desc);
create index if not exists res_direct_messages_sender_idx on public.res_direct_messages (sender_id, created_at desc);

-- Who may act for an infrastructure provider. This is the join that turns a
-- Service Desk report from a record into something a provider can respond to.
create table if not exists public.res_infra_partner_admins (
  provider_id uuid not null references public.res_infra_providers(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  primary key (provider_id, user_id)
);
create index if not exists res_infra_partner_admins_user_id_idx on public.res_infra_partner_admins (user_id);

-- Seats on a lift club run. Unique per (lift, rider, date) so one rider
-- cannot double-book the same trip.
create table if not exists public.res_lift_bookings (
  id uuid primary key default uuid_generate_v4(),
  lift_id uuid not null references public.res_lift_clubs(id) on delete cascade,
  rider_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'booked'
    check (status in ('booked', 'waitlisted', 'cancelled')),
  trip_date date,
  checked_in boolean not null default false,
  no_show boolean not null default false,
  created_at timestamptz default now(),
  unique (lift_id, rider_id, trip_date)
);
create index if not exists idx_res_bookings_lift on public.res_lift_bookings (lift_id);
create index if not exists idx_res_bookings_rider on public.res_lift_bookings (rider_id);

-- One-off Paystack purchases (as distinct from res_subscriptions, which is
-- recurring). target_id points at whatever the purchase applies to.
create table if not exists public.res_purchases (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  item text not null
    check (item in ('verification_speedup', 'market_boost', 'room_boost')),
  target_id uuid,
  amount_zar_cents integer not null,
  paystack_reference text,
  created_at timestamptz not null default now()
);
create index if not exists res_purchases_user_id_idx on public.res_purchases (user_id);

-- The generic limiter behind res_check_rate_limit(action, limit, window).
-- Keyed by the window so a new window is a new row rather than an update.
create table if not exists public.res_rate_limits (
  user_id uuid not null references public.profiles(id) on delete cascade,
  action text not null,
  window_start timestamptz not null,
  count integer not null default 0,
  primary key (user_id, action, window_start)
);
create index if not exists idx_res_ratelimit_lookup on public.res_rate_limits (user_id, action, window_start);

-- Abuse reports. Distinct from res_service_reports, which is infrastructure
-- faults — this is "this post/person is spam/scam/abuse". The unique key
-- means one report per person per subject.
create table if not exists public.res_reports (
  id uuid primary key default uuid_generate_v4(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  subject_type text not null,
  subject_id uuid not null,
  reason text not null
    check (reason in ('spam', 'scam', 'abuse', 'unsafe', 'wrong_info', 'other')),
  detail text,
  status text not null default 'open'
    check (status in ('open', 'reviewed', 'actioned', 'dismissed')),
  created_at timestamptz default now(),
  unique (reporter_id, subject_type, subject_id)
);
create index if not exists idx_res_reports_subject on public.res_reports (subject_type, subject_id);

alter table public.res_blocks               enable row level security;
alter table public.res_community_invites    enable row level security;
alter table public.res_direct_messages      enable row level security;
alter table public.res_infra_partner_admins enable row level security;
alter table public.res_lift_bookings        enable row level security;
alter table public.res_purchases            enable row level security;
alter table public.res_rate_limits          enable row level security;
alter table public.res_reports              enable row level security;

-- Account-age / verification gate, used by the gossip-post and comment
-- policies to keep brand-new accounts from posting immediately. Live in
-- production, defined nowhere in this repo until now — found the same way
-- the eight tables above were, by building the schema from source.
-- Transcribed from pg_get_functiondef, not rewritten.
create or replace function public.res_account_ready(
  p_user uuid,
  p_min_hours integer,
  p_require_verified boolean
) returns boolean
language sql
security definer
set search_path to 'public'
as $$
  select exists (
    select 1 from profiles
     where id = p_user
       and created_at <= now() - (p_min_hours || ' hours')::interval
       and (not p_require_verified or is_verified = true)
  );
$$;


-- ==========================================================================
-- 03. theresident_legal_name_column.sql
-- ==========================================================================

-- theresident_legal_name_column.sql
--
-- The "Legal Name" save on the profile page has always shown "Saved" —
-- setLegalName's sync handler (src/store/index.ts) writes `legal_name` to
-- res_profiles unconditionally, and the UI's confirmation fires on dispatch,
-- not on write success — but the live res_profiles table has never had a
-- legal_name column at all (confirmed via information_schema.columns).
-- Every save has been silently failing.
--
-- Paste into the Supabase SQL editor. Additive only.

alter table public.res_profiles
  add column if not exists legal_name text;


-- ==========================================================================
-- 04. theresident_care_circle_flag.sql
-- ==========================================================================

-- theresident_care_circle_flag.sql
--
-- Fixes audit finding #53: a "needs assistance" Care Circle check-in was
-- never actually persisted. res_care_circle.status only ever allowed
-- 'active'/'paused' (whether the check-in cadence itself is running), which
-- has no room for "the subject just flagged that they need help" — a
-- different axis entirely. The app's write handler for a needs_assistance
-- check-in silently did nothing rather than violate that check constraint,
-- so the most safety-critical state a vulnerable person could set reverted
-- to whatever was last in the DB on the next refresh, with no error shown.
--
-- Adds a separate `flag` column rather than widening the `status` check
-- constraint, so "is this check-in circle active" and "does the subject
-- currently need help" stay independent — a paused circle can still carry
-- an unresolved flag, and marking someone OK clears it without touching
-- whether their check-in cadence is active or paused.
--
-- Paste this into the Supabase SQL editor and run it. Additive only — no
-- existing column, row, or policy is touched or dropped.

alter table public.res_care_circle
  add column if not exists flag text check (flag in ('none', 'needs_assistance')) default 'none' not null,
  add column if not exists flagged_at timestamptz;


-- ==========================================================================
-- 05. theresident_safety_scoping.sql
-- ==========================================================================

-- theresident_safety_scoping.sql
--
-- Fixes items #3 and #4 from the "Resident Scaling Risks" audit:
--
--   #3. res_alerts and res_neighbourhood_status had `for select to
--       authenticated using (true)` — any signed-in user of either app
--       sharing this Supabase project (The Gruvs or The Resident) could
--       read every panic alert and every outage report ever filed,
--       anywhere. Narrowed to: your own rows, rows in a community you
--       belong to, or (when an alert/status has a city on it) rows in
--       your own city.
--
--       IMPORTANT: today the app never sets community_id or city when
--       creating an alert or status report (alertToRow / neighbourhood
--       StatusToRow in src/store/dbMappers.ts only send suburb, lat,
--       lon — not those two columns). An earlier version of this file
--       narrowed access to ONLY those two signals, which would have
--       made every alert/status report invisible to everyone except
--       its own creator, since community_id and city are always null
--       in practice. Fixed: rows with neither signal set fall back to
--       the original authenticated-can-read-all behaviour, so nothing
--       regresses today; the narrowing takes effect automatically once
--       a future change starts populating community_id/city on insert.
--
--   #4. res_broadcast_alert fanned out notifications with a plpgsql
--       for-loop doing one `insert into notifications` per recipient.
--       Rewritten as a single set-based `insert ... select`, same
--       recipient logic, one query instead of N round-trips through
--       the PL/pgSQL executor.
--
--       Same caveat applies here too and predates this change: because
--       community_id/city are never set on insert, res_broadcast_alert's
--       community/city match never fires today, so panic-alert push
--       notifications are effectively a no-op in production right now.
--       That's a separate, pre-existing gap (the alert row itself has
--       always been visible to everyone via the old `using (true)`
--       policy; it's only the *notification* that silently never sent).
--       Not fixed here — closing it means deciding how an alert's
--       community/city should be captured at creation time, which is a
--       product decision, not a one-line SQL patch.
--
-- Paste this into the Supabase SQL editor and run it. It only touches
-- res_alerts / res_neighbourhood_status policies and the
-- res_broadcast_alert function body — no table or column changes, and
-- nothing here is destructive.

-- ── #3: narrow res_alerts SELECT ──────────────────────────────────────────
drop policy if exists res_alerts_select on public.res_alerts;
create policy res_alerts_select on public.res_alerts
  for select to authenticated using (
    user_id = auth.uid()
    or (community_id is null and city is null)
    or (community_id is not null and public.res_is_community_member(community_id, auth.uid()))
    or (
      community_id is null
      and city is not null
      and exists (select 1 from public.profiles p where p.id = auth.uid() and p.city = res_alerts.city)
    )
  );

-- ── #3: narrow res_neighbourhood_status SELECT ────────────────────────────
drop policy if exists res_status_select on public.res_neighbourhood_status;
create policy res_status_select on public.res_neighbourhood_status
  for select to authenticated using (
    reporter_id = auth.uid()
    or (community_id is null and city is null)
    or (community_id is not null and public.res_is_community_member(community_id, auth.uid()))
    or (
      community_id is null
      and city is not null
      and exists (select 1 from public.profiles p where p.id = auth.uid() and p.city = res_neighbourhood_status.city)
    )
  );

-- ── #4: set-based res_broadcast_alert ──────────────────────────────────────
create or replace function public.res_broadcast_alert(p_alert_id uuid)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_alert record;
begin
  select * into v_alert from res_alerts where id = p_alert_id;
  if not found then
    raise exception 'alert not found';
  end if;

  -- Same recipient rule as before (community match, or same-city fallback
  -- when the alert has no community_id) — now one insert instead of a
  -- per-recipient loop.
  insert into notifications (recipient_id, actor_id, type, title, body, data)
  select
    p.id,
    v_alert.user_id,
    'res_alert_panic',
    '🚨 NEIGHBOURHOOD ALERT: ' || v_alert.title,
    v_alert.description,
    jsonb_build_object('alert_id', v_alert.id, 'kind', v_alert.kind)
  from profiles p
  left join res_community_members cm on cm.user_id = p.id
  where p.id <> v_alert.user_id
    and p.is_verified = true
    and (
      (v_alert.community_id is not null and cm.community_id = v_alert.community_id)
      or (v_alert.community_id is null and v_alert.suburb is not null and p.city = v_alert.city)
    );
end;
$$;

revoke execute on function public.res_broadcast_alert(uuid) from public, anon;
grant execute on function public.res_broadcast_alert(uuid) to authenticated, service_role;


-- ==========================================================================
-- 06. theresident_security_log_schema.sql
-- ==========================================================================

-- The Resident — persistent security audit log.
-- Safe to re-run: every statement is idempotent. Paste into Supabase →
-- SQL Editor → Run.
--
-- WHY THIS EXISTS
-- `addLog` has existed since the first commit but only ever wrote to
-- in-memory Redux: never synced, never persisted, never rendered in any
-- UI, and (after the logout state-wipe) cleared on sign-out as well as on
-- every refresh. SECURITY.md nonetheless described it as "the solo
-- maintainer's way of seeing what happened without having been online when
-- it did", and MAINTENANCE.md made reviewing it a weekly task. Both were
-- impossible: the entries never left the user's browser tab. This table is
-- what makes those claims true.

create extension if not exists "uuid-ossp";

create table if not exists public.res_security_logs (
  id uuid primary key default uuid_generate_v4(),
  -- Null for events that happen BEFORE anyone is authenticated, which is
  -- most of the interesting ones: auth_failed, brute_force_blocked.
  user_id uuid references public.profiles(id) on delete set null,
  event_type text not null check (event_type in (
    'xss_blocked', 'rate_limit_triggered', 'idor_prevented',
    'auth_success', 'auth_failed', 'brute_force_blocked',
    'upload_malware_blocked', 'sqli_blocked',
    'role_switched', 'org_broadcast_sent'
  )),
  action text not null,
  details text,
  -- Deliberately NOT client-supplied. The client cannot know its own public
  -- IP; the old code sent a hardcoded '127.0.0.1', which was worse than
  -- nothing because it looked like real data. Populated server-side only
  -- (middleware/edge) when a route has it, otherwise left null and honest.
  ip_address text,
  user_agent text,
  created_at timestamptz default now()
);

create index if not exists res_security_logs_created_idx on public.res_security_logs (created_at desc);
create index if not exists res_security_logs_type_idx on public.res_security_logs (event_type, created_at desc);
create index if not exists res_security_logs_user_idx on public.res_security_logs (user_id, created_at desc);

-- ── Abuse control ───────────────────────────────────────────────────────────
-- This table must accept inserts from `anon`, because the events worth
-- having (failed logins, brute-force lockouts, blocked XSS on the signup
-- form) all occur before authentication. That makes it a spam target, so
-- it is rate-limited the same way res_org_broadcasts is — per authenticated
-- user where we have one, and globally-per-minute for anonymous inserts so
-- one script cannot bloat the table.
create or replace function public.res_check_security_log_rate_limit()
returns trigger
language plpgsql security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  if new.user_id is not null then
    select count(*) into v_count
    from res_security_logs
    where user_id = new.user_id
      and created_at > now() - interval '1 minute';
    if v_count >= 60 then
      raise exception 'rate_limited: too many security log entries for this user';
    end if;
  else
    select count(*) into v_count
    from res_security_logs
    where user_id is null
      and created_at > now() - interval '1 minute';
    if v_count >= 300 then
      raise exception 'rate_limited: too many anonymous security log entries';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists res_security_logs_rate_limit on public.res_security_logs;
create trigger res_security_logs_rate_limit
  before insert on public.res_security_logs
  for each row execute function public.res_check_security_log_rate_limit();

-- ── Retention ───────────────────────────────────────────────────────────────
-- Unbounded growth on a free tier is its own outage. 180 days is long enough
-- to cover the quarterly review cadence in MAINTENANCE.md with room to spare.
-- Call manually, or from a scheduled job if one is ever added.
create or replace function public.res_prune_security_logs()
returns integer
language plpgsql security definer
set search_path = public
as $$
declare
  v_deleted integer;
begin
  delete from res_security_logs where created_at < now() - interval '180 days';
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

revoke execute on function public.res_prune_security_logs() from public, anon;
grant execute on function public.res_prune_security_logs() to service_role;

-- ── RLS ─────────────────────────────────────────────────────────────────────
alter table public.res_security_logs enable row level security;

-- Insert-only for everyone else. An authenticated caller may only attribute
-- an entry to themselves; anonymous callers must leave user_id null, so a
-- log entry can never be forged against another account.
drop policy if exists res_security_logs_insert_auth on public.res_security_logs;
create policy res_security_logs_insert_auth on public.res_security_logs
  for insert to authenticated
  with check (user_id is null or user_id = auth.uid());

drop policy if exists res_security_logs_insert_anon on public.res_security_logs;
create policy res_security_logs_insert_anon on public.res_security_logs
  for insert to anon
  with check (user_id is null);

-- Deliberately NO select policy for anon/authenticated: an audit trail that
-- its subject can read (or that an attacker can read to confirm what was
-- detected) is worth less. Read it from the Supabase dashboard, which uses
-- the service role and bypasses RLS.

-- ── Verification ────────────────────────────────────────────────────────────
select 'table' as check, count(*)::text as result
from information_schema.tables
where table_schema = 'public' and table_name = 'res_security_logs'
union all
select 'rls enabled', relrowsecurity::text from pg_class where relname = 'res_security_logs'
union all
select 'policies', count(*)::text from pg_policies
where schemaname = 'public' and tablename = 'res_security_logs';


-- ==========================================================================
-- 07. theresident_org_broadcast_schema.sql
-- ==========================================================================

-- Batch 10: Org/Business Broadcast Messaging — schema, RLS, and RPCs.
-- Apply this in the Supabase SQL editor the same way resident_schema.sql
-- and theresident_db_hardening.sql were applied (this repo has no Supabase CLI/
-- credentials access, so it cannot be applied automatically).
--
-- Free, in-app + email only (no SMS/push gateway — those need a paid
-- provider). Audience is opt-in: a parent/customer must explicitly follow
-- the org unit that can message them, never scraped or auto-subscribed.
--
-- Model: a self-referencing tree of "org units" (Department of Education ->
-- HOD -> School -> Teacher, or a Business -> Branch). A broadcast posted at
-- unit U reaches everyone who follows U OR follows any DESCENDANT of U —
-- i.e. a Department-level post cascades down to Teacher-level followers,
-- but a Teacher-level post never reaches a different school's followers.

-- ── 1. TABLES ──────────────────────────────────────────────────────────────

create table if not exists public.res_org_units (
  id uuid primary key default uuid_generate_v4(),
  parent_id uuid references public.res_org_units(id) on delete cascade,
  name text not null,
  tier text not null check (tier in ('department', 'hod', 'school', 'teacher', 'business', 'branch')),
  owner_user_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz default now()
);

create table if not exists public.res_org_memberships (
  id uuid primary key default uuid_generate_v4(),
  unit_id uuid references public.res_org_units(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  role text not null check (role in ('sender', 'member')) default 'member',
  created_at timestamptz default now(),
  unique (unit_id, user_id)
);

create table if not exists public.res_org_follows (
  id uuid primary key default uuid_generate_v4(),
  unit_id uuid references public.res_org_units(id) on delete cascade not null,
  follower_user_id uuid references public.profiles(id) on delete cascade not null,
  email_opt_in boolean default false,
  created_at timestamptz default now(),
  unique (unit_id, follower_user_id)
);

create table if not exists public.res_org_broadcasts (
  id uuid primary key default uuid_generate_v4(),
  unit_id uuid references public.res_org_units(id) on delete cascade not null,
  sender_id uuid references public.profiles(id) on delete cascade not null,
  title text not null,
  body text not null,
  created_at timestamptz default now()
);

create index if not exists res_org_units_parent_idx on public.res_org_units(parent_id);
create index if not exists res_org_follows_unit_idx on public.res_org_follows(unit_id);
create index if not exists res_org_follows_follower_idx on public.res_org_follows(follower_user_id);
create index if not exists res_org_broadcasts_unit_idx on public.res_org_broadcasts(unit_id, created_at desc);

-- ── 2. HELPER FUNCTIONS ────────────────────────────────────────────────────

-- True if p_ancestor is p_unit itself, or any ancestor of it (walks the
-- parent_id chain upward). Used both directions: "can I see this broadcast"
-- (is the poster's unit an ancestor-or-self of a unit I follow) and "can I
-- post as this unit" (is my sender membership on an ancestor-or-self of it).
create or replace function public.res_is_unit_ancestor_or_self(p_ancestor uuid, p_unit uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  with recursive chain as (
    select id, parent_id from res_org_units where id = p_unit
    union all
    select u.id, u.parent_id from res_org_units u
    join chain c on u.id = c.parent_id
  )
  select exists (select 1 from chain where id = p_ancestor);
$$;

-- True if p_user has a 'sender' membership on p_target_unit itself, or on
-- any ancestor of it (a Department-level sender can post as a School beneath it).
create or replace function public.res_user_is_sender_of_or_above(p_target_unit uuid, p_user uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from res_org_memberships m
    where m.user_id = p_user
      and m.role = 'sender'
      and public.res_is_unit_ancestor_or_self(m.unit_id, p_target_unit)
  );
$$;

-- Everyone who should receive a broadcast posted at p_unit: followers of
-- p_unit itself, plus followers of any descendant unit. Informational (used
-- for an audience-size preview and the eventual email fan-out) — the real
-- access control is res_org_broadcasts_select below, not this function.
create or replace function public.res_resolve_broadcast_audience(p_unit uuid)
returns table (follower_user_id uuid, email_opt_in boolean)
language sql stable security definer
set search_path = public
as $$
  with recursive descendants as (
    select id from res_org_units where id = p_unit
    union all
    select u.id from res_org_units u join descendants d on u.parent_id = d.id
  )
  select f.follower_user_id, bool_or(f.email_opt_in) as email_opt_in
  from res_org_follows f
  where f.unit_id in (select id from descendants)
  group by f.follower_user_id;
$$;

-- New unit's creator automatically becomes its first sender — otherwise
-- nobody could ever post to a unit they just created.
create or replace function public.res_org_unit_auto_sender()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  insert into res_org_memberships (unit_id, user_id, role)
  values (new.id, new.owner_user_id, 'sender')
  on conflict (unit_id, user_id) do update set role = 'sender';
  return new;
end;
$$;

drop trigger if exists res_org_units_after_insert on public.res_org_units;
create trigger res_org_units_after_insert
  after insert on public.res_org_units
  for each row execute function public.res_org_unit_auto_sender();

-- Caps broadcasts per unit per hour — mirrors the existing map closure-
-- report rate limit pattern (utils/mapZones.ts), prevents one bad actor
-- account from spamming an entire school/customer base. Client code should
-- treat a 'rate_limited' error message the same way VibeMap.tsx already does.
create or replace function public.res_check_broadcast_rate_limit()
returns trigger
language plpgsql security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  select count(*) into v_count
  from res_org_broadcasts
  where unit_id = new.unit_id
    and created_at > now() - interval '1 hour';
  if v_count >= 5 then
    raise exception 'rate_limited: too many broadcasts from this unit in the last hour';
  end if;
  return new;
end;
$$;

drop trigger if exists res_org_broadcasts_rate_limit on public.res_org_broadcasts;
create trigger res_org_broadcasts_rate_limit
  before insert on public.res_org_broadcasts
  for each row execute function public.res_check_broadcast_rate_limit();

grant execute on function public.res_is_unit_ancestor_or_self(uuid, uuid) to authenticated, service_role;
grant execute on function public.res_user_is_sender_of_or_above(uuid, uuid) to authenticated, service_role;
grant execute on function public.res_resolve_broadcast_audience(uuid) to authenticated, service_role;

-- ── 3. ROW LEVEL SECURITY ──────────────────────────────────────────────────

alter table public.res_org_units       enable row level security;
alter table public.res_org_memberships enable row level security;
alter table public.res_org_follows     enable row level security;
alter table public.res_org_broadcasts  enable row level security;

-- res_org_units: world-readable (needed to browse/pick the tree). Creating
-- a unit requires owning it and, if it has a parent, being a sender of that
-- parent (or an ancestor of it) already.
drop policy if exists res_org_units_select on public.res_org_units;
create policy res_org_units_select on public.res_org_units
  for select to authenticated using (true);

drop policy if exists res_org_units_insert on public.res_org_units;
create policy res_org_units_insert on public.res_org_units
  for insert to authenticated
  with check (
    owner_user_id = auth.uid()
    and (parent_id is null or public.res_user_is_sender_of_or_above(parent_id, auth.uid()))
  );

drop policy if exists res_org_units_update on public.res_org_units;
create policy res_org_units_update on public.res_org_units
  for update to authenticated
  using (public.res_user_is_sender_of_or_above(id, auth.uid()))
  with check (public.res_user_is_sender_of_or_above(id, auth.uid()));

-- res_org_memberships: visible to the member themself, or to any sender of
-- that unit or an ancestor of it. Only an existing sender-of-or-above can
-- add new members (bootstrapped by the auto-sender trigger above).
drop policy if exists res_org_memberships_select on public.res_org_memberships;
create policy res_org_memberships_select on public.res_org_memberships
  for select to authenticated
  using (
    user_id = auth.uid()
    or public.res_user_is_sender_of_or_above(unit_id, auth.uid())
  );

drop policy if exists res_org_memberships_insert on public.res_org_memberships;
create policy res_org_memberships_insert on public.res_org_memberships
  for insert to authenticated
  with check (public.res_user_is_sender_of_or_above(unit_id, auth.uid()));

drop policy if exists res_org_memberships_delete on public.res_org_memberships;
create policy res_org_memberships_delete on public.res_org_memberships
  for delete to authenticated
  using (public.res_user_is_sender_of_or_above(unit_id, auth.uid()));

-- res_org_follows: strictly self-service — nobody else can see, create, or
-- remove another person's follow/link ("Link your child to a class",
-- "Follow this business" is explicit, visible, and revocable per-user only).
drop policy if exists res_org_follows_select on public.res_org_follows;
create policy res_org_follows_select on public.res_org_follows
  for select to authenticated using (follower_user_id = auth.uid());

drop policy if exists res_org_follows_insert on public.res_org_follows;
create policy res_org_follows_insert on public.res_org_follows
  for insert to authenticated with check (follower_user_id = auth.uid());

drop policy if exists res_org_follows_delete on public.res_org_follows;
create policy res_org_follows_delete on public.res_org_follows
  for delete to authenticated using (follower_user_id = auth.uid());

-- res_org_broadcasts: a viewer sees a broadcast if they follow its unit, or
-- follow any unit that broadcast's unit is an ancestor of (i.e. they follow
-- a descendant) — this is the "Department post reaches Teacher-level
-- follower" cascade. Posting requires a sender membership on the target
-- unit or an ancestor of it.
drop policy if exists res_org_broadcasts_select on public.res_org_broadcasts;
create policy res_org_broadcasts_select on public.res_org_broadcasts
  for select to authenticated
  using (
    sender_id = auth.uid()
    or exists (
      select 1 from res_org_follows f
      where f.follower_user_id = auth.uid()
        and public.res_is_unit_ancestor_or_self(res_org_broadcasts.unit_id, f.unit_id)
    )
  );

drop policy if exists res_org_broadcasts_insert on public.res_org_broadcasts;
create policy res_org_broadcasts_insert on public.res_org_broadcasts
  for insert to authenticated
  with check (
    sender_id = auth.uid()
    and public.res_user_is_sender_of_or_above(unit_id, auth.uid())
  );


-- ==========================================================================
-- 08. theresident_service_desk_schema.sql
-- ==========================================================================

-- theresident_service_desk_schema.sql
--
-- The Service Desk: residents report an infrastructure fault to the
-- organisation responsible for fixing it, and the app measures how long that
-- organisation actually takes.
--
-- WHY THIS EXISTS, AND WHY IT IS NOT A DUPLICATE OF WHAT WE ALREADY HAVE:
--   • res_neighbourhood_status answers "is the power out right now?" (a live
--     crowd signal, 8h minimum window, mirrored onto the map).
--   • map_zones answers "is this road blocked?" (transient hazards, votes).
--   • res_service_reports answers "WHO owes me a fix, and HOW LONG are they
--     taking?" — a durable, referenced, measured record. Different question,
--     different lifetime, different audience.
--
-- DESIGN NOTE — this is deliberately NOT an escalation/warning system. The
-- brief was explicit: "the company must know how long it takes for them to fix
-- a problem." So every status transition is timestamped and the aggregate is
-- published per provider (median time to acknowledge, median time to resolve,
-- oldest open). An overdue report is stated as a fact, not as a threat the app
-- has no power to carry out.
--
-- WORKS WITHOUT PROVIDER BUY-IN. No municipality or ISP will have an account on
-- day one. A report is useful immediately — it gets a reference, neighbours
-- corroborate it, the clock runs — and simply gets richer if a provider ever
-- claims their record through res_infra_partner_admins (which already exists
-- live).
--
-- Paste into the Supabase SQL editor. Additive only: no existing table, column,
-- policy or function is dropped or altered destructively.

-- ── 1. WHERE THE REPORTER LIVES ────────────────────────────────────────────
-- res_profiles has no location today, so "my neighbours' reports" has nothing
-- to match on. This is the same trap theresident_safety_scoping.sql fell into:
-- narrowing reads to a column nothing ever writes makes rows invisible. Here
-- the submit RPC below backfills these from the report itself, so the column
-- populates as a side effect of the first report rather than needing a
-- migration or a new onboarding step.
alter table public.res_profiles
  add column if not exists suburb text,
  add column if not exists city text;

-- ── 2. TABLES ──────────────────────────────────────────────────────────────

create sequence if not exists public.res_service_report_ref_seq;

create table if not exists public.res_service_reports (
  id uuid primary key default uuid_generate_v4(),
  -- Human-quotable on the phone to a call centre: "reference SR-2026-00042".
  reference text unique not null,
  reporter_id uuid references public.profiles(id) on delete cascade not null,

  -- Optional: the provider is a nice-to-have, not a requirement. A resident
  -- knows the sewer is overflowing; they may not know which department owns it.
  provider_id uuid references public.res_infra_providers(id) on delete set null,
  -- What the resident typed when no provider record matched. Keeping the raw
  -- string means we can seed the directory from real demand later.
  provider_name_raw text,

  category text not null check (category in (
    'power', 'water', 'sewerage', 'network', 'fiber',
    'road', 'waste', 'streetlight', 'other'
  )),
  title text not null,
  detail text,
  severity text not null default 'medium'
    check (severity in ('low', 'medium', 'high', 'critical')),

  -- Required by the submit RPC — the visibility rule in §5 depends on it.
  suburb text,
  city text,
  lat double precision,
  lon double precision,

  status text not null default 'submitted' check (status in (
    'submitted', 'acknowledged', 'in_progress', 'resolved', 'closed', 'rejected'
  )),

  -- Snapshotted at submit time, NOT read live from a settings table: if the
  -- target for "sewerage/high" is retuned next year, an old report must still
  -- be judged against the promise that applied when it was filed.
  target_hours integer not null,

  -- The measurement columns. Every one is a real transition timestamp; all
  -- durations are derived from these, never stored pre-computed.
  acknowledged_at timestamptz,
  first_response_at timestamptz,
  resolved_at timestamptz,
  closed_at timestamptz,

  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

create table if not exists public.res_service_report_updates (
  id uuid primary key default uuid_generate_v4(),
  report_id uuid references public.res_service_reports(id) on delete cascade not null,
  -- null for rows written by the system rather than a person.
  author_id uuid references public.profiles(id) on delete set null,
  kind text not null check (kind in ('comment', 'status_change', 'system', 'corroboration')),
  body text,
  from_status text,
  to_status text,
  created_at timestamptz default now() not null
);

-- The "me too". This is the leverage: it turns one complaint into
-- "47 households, 3 weeks" without anyone having to organise a petition.
create table if not exists public.res_service_report_confirmations (
  id uuid primary key default uuid_generate_v4(),
  report_id uuid references public.res_service_reports(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  created_at timestamptz default now() not null,
  unique (report_id, user_id)
);

create index if not exists res_service_reports_suburb_idx  on public.res_service_reports (suburb, created_at desc);
create index if not exists res_service_reports_city_idx    on public.res_service_reports (city, created_at desc);
create index if not exists res_service_reports_provider_idx on public.res_service_reports (provider_id, status);
create index if not exists res_service_reports_reporter_idx on public.res_service_reports (reporter_id, created_at desc);
create index if not exists res_service_report_updates_idx  on public.res_service_report_updates (report_id, created_at);
create index if not exists res_service_report_confirm_idx  on public.res_service_report_confirmations (report_id);

-- ── 3. REFERENCE NUMBERS ───────────────────────────────────────────────────

create or replace function public.res_service_report_set_reference()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.reference is null or new.reference = '' then
    new.reference := 'SR-' || to_char(now(), 'YYYY') || '-'
                  || lpad(nextval('res_service_report_ref_seq')::text, 5, '0');
  end if;
  return new;
end;
$$;

drop trigger if exists res_service_reports_reference on public.res_service_reports;
create trigger res_service_reports_reference
  before insert on public.res_service_reports
  for each row execute function public.res_service_report_set_reference();

create or replace function public.res_service_report_touch()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists res_service_reports_touch on public.res_service_reports;
create trigger res_service_reports_touch
  before update on public.res_service_reports
  for each row execute function public.res_service_report_touch();

-- ── 4. RESPONSE-TIME TARGETS ───────────────────────────────────────────────
-- What counts as "taking too long", per category and severity. These are the
-- app's own stated expectations, not a legally binding SLA — the point is to
-- have a consistent yardstick so "slow" means the same thing every time.
-- Mirrored in src/utils/serviceReports.ts (defaultTargetHours) for the UI and
-- unit-tested there; this function is the authority.
create or replace function public.res_default_target_hours(p_category text, p_severity text)
returns integer
language sql
immutable
set search_path = public
as $$
  select case p_category
    when 'sewerage'   then case p_severity when 'critical' then 12 when 'high' then 24 when 'medium' then 48  else 72  end
    when 'water'      then case p_severity when 'critical' then 12 when 'high' then 24 when 'medium' then 48  else 72  end
    when 'power'      then case p_severity when 'critical' then 8  when 'high' then 24 when 'medium' then 48  else 72  end
    when 'network'    then case p_severity when 'critical' then 24 when 'high' then 48 when 'medium' then 72  else 120 end
    when 'fiber'      then case p_severity when 'critical' then 24 when 'high' then 48 when 'medium' then 72  else 120 end
    when 'road'       then case p_severity when 'critical' then 24 when 'high' then 72 when 'medium' then 168 else 336 end
    when 'waste'      then case p_severity when 'critical' then 24 when 'high' then 48 when 'medium' then 96  else 168 end
    when 'streetlight' then case p_severity when 'critical' then 48 when 'high' then 96 when 'medium' then 168 else 336 end
    else                    case p_severity when 'critical' then 24 when 'high' then 48 when 'medium' then 72  else 168 end
  end;
$$;

-- ── 5. ROW LEVEL SECURITY ──────────────────────────────────────────────────

alter table public.res_service_reports             enable row level security;
alter table public.res_service_report_updates      enable row level security;
alter table public.res_service_report_confirmations enable row level security;

-- True when the signed-in user should see reports for this suburb/city.
-- Deliberately a function so all three tables share one definition and it can
-- be tightened in one place.
create or replace function public.res_shares_locality(p_suburb text, p_city text)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from res_profiles rp
    where rp.id = auth.uid()
      and (
        (p_suburb is not null and rp.suburb is not null and lower(rp.suburb) = lower(p_suburb))
        or (p_city is not null and rp.city is not null and lower(rp.city) = lower(p_city))
      )
  );
$$;

-- True when the signed-in user is staff for the provider a report is aimed at.
create or replace function public.res_is_provider_admin(p_provider uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select p_provider is not null and exists (
    select 1 from res_infra_partner_admins a
    where a.provider_id = p_provider and a.user_id = auth.uid()
  );
$$;

grant execute on function public.res_shares_locality(text, text) to authenticated, service_role;
grant execute on function public.res_is_provider_admin(uuid) to authenticated, service_role;
grant execute on function public.res_default_target_hours(text, text) to authenticated, service_role;

-- NOTE the deliberate absence of a blanket "or (suburb is null and city is
-- null)" fallback here. theresident_safety_scoping.sql needed one because its
-- client never wrote those columns; res_submit_service_report below REQUIRES
-- both, so a report with neither cannot exist and no fallback is warranted.
drop policy if exists res_service_reports_select on public.res_service_reports;
create policy res_service_reports_select on public.res_service_reports
  for select to authenticated using (
    reporter_id = auth.uid()
    or public.res_is_provider_admin(provider_id)
    or public.res_shares_locality(suburb, city)
  );

-- Writes go exclusively through the security-definer RPCs in §6 so that
-- reference numbers, target snapshots, timeline rows and transition timestamps
-- can never be forged or skipped by a client.
drop policy if exists res_service_reports_insert on public.res_service_reports;
drop policy if exists res_service_reports_update on public.res_service_reports;

drop policy if exists res_service_report_updates_select on public.res_service_report_updates;
create policy res_service_report_updates_select on public.res_service_report_updates
  for select to authenticated using (
    exists (
      select 1 from res_service_reports r
      where r.id = res_service_report_updates.report_id
        and (
          r.reporter_id = auth.uid()
          or public.res_is_provider_admin(r.provider_id)
          or public.res_shares_locality(r.suburb, r.city)
        )
    )
  );

drop policy if exists res_service_report_confirm_select on public.res_service_report_confirmations;
create policy res_service_report_confirm_select on public.res_service_report_confirmations
  for select to authenticated using (
    exists (
      select 1 from res_service_reports r
      where r.id = res_service_report_confirmations.report_id
        and (
          r.reporter_id = auth.uid()
          or public.res_is_provider_admin(r.provider_id)
          or public.res_shares_locality(r.suburb, r.city)
        )
    )
  );

-- ── 6. RPCs ────────────────────────────────────────────────────────────────

create or replace function public.res_submit_service_report(
  p_category text,
  p_title text,
  p_detail text,
  p_severity text,
  p_suburb text,
  p_city text,
  p_provider uuid,
  p_provider_name_raw text,
  p_lat double precision,
  p_lon double precision
)
returns public.res_service_reports
language plpgsql security definer
set search_path = public
as $$
declare
  v_row res_service_reports;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if coalesce(trim(p_title), '') = '' then
    raise exception 'title_required: describe the problem in a few words';
  end if;
  if coalesce(trim(p_suburb), '') = '' or coalesce(trim(p_city), '') = '' then
    raise exception 'locality_required: we need the suburb and city so your neighbours can confirm it';
  end if;

  -- Reuse the existing generic limiter rather than adding another bespoke
  -- trigger. Raises 'rate_limit_exceeded: ...' which humanizeDbError maps.
  perform public.res_check_rate_limit('service_report', 5, 3600);

  insert into res_service_reports (
    reporter_id, provider_id, provider_name_raw, category, title, detail,
    severity, suburb, city, lat, lon, target_hours
  ) values (
    auth.uid(), p_provider, nullif(trim(coalesce(p_provider_name_raw, '')), ''),
    p_category, trim(p_title), nullif(trim(coalesce(p_detail, '')), ''),
    coalesce(p_severity, 'medium'), trim(p_suburb), trim(p_city), p_lat, p_lon,
    public.res_default_target_hours(p_category, coalesce(p_severity, 'medium'))
  )
  returning * into v_row;

  insert into res_service_report_updates (report_id, author_id, kind, body, to_status)
  values (v_row.id, auth.uid(), 'system', 'Report filed.', 'submitted');

  -- Teach the app where this resident lives, so neighbourhood visibility works
  -- for them from now on without a separate profile-editing chore.
  update res_profiles
     set suburb = coalesce(nullif(trim(suburb), ''), trim(p_suburb)),
         city   = coalesce(nullif(trim(city), ''), trim(p_city))
   where id = auth.uid();

  return v_row;
end;
$$;

create or replace function public.res_confirm_service_report(p_report uuid)
returns integer
language plpgsql security definer
set search_path = public
as $$
declare
  v_report res_service_reports;
  v_count integer;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;

  select * into v_report from res_service_reports where id = p_report;
  if not found then raise exception 'report_not_found'; end if;
  if v_report.reporter_id = auth.uid() then
    raise exception 'own_report: you filed this one — it already counts';
  end if;
  -- Only people who can see it may corroborate it.
  if not (public.res_is_provider_admin(v_report.provider_id)
          or public.res_shares_locality(v_report.suburb, v_report.city)) then
    raise exception 'not_your_area';
  end if;

  perform public.res_check_rate_limit('service_confirm', 30, 3600);

  insert into res_service_report_confirmations (report_id, user_id)
  values (p_report, auth.uid())
  on conflict (report_id, user_id) do nothing;

  select count(*) into v_count from res_service_report_confirmations where report_id = p_report;
  return v_count;
end;
$$;

create or replace function public.res_set_service_report_status(
  p_report uuid,
  p_status text,
  p_note text
)
returns public.res_service_reports
language plpgsql security definer
set search_path = public
as $$
declare
  v_report res_service_reports;
  v_is_provider boolean;
  v_is_reporter boolean;
  v_old_status text;
  v_now timestamptz := now();
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;

  select * into v_report from res_service_reports where id = p_report;
  if not found then raise exception 'report_not_found'; end if;
  -- Captured BEFORE the update below, which overwrites v_report via
  -- RETURNING — without this the timeline would record from_status and
  -- to_status as the same value.
  v_old_status := v_report.status;

  v_is_provider := public.res_is_provider_admin(v_report.provider_id);
  v_is_reporter := v_report.reporter_id = auth.uid();

  -- The reporter owns closing/reopening their own report (it was their problem,
  -- they know when it is actually fixed). Everything else is the provider's.
  if not v_is_provider and not (v_is_reporter and p_status in ('closed', 'submitted')) then
    raise exception 'not_your_report: only % can set that status',
      coalesce((select name from res_infra_providers where id = v_report.provider_id), 'the provider');
  end if;

  update res_service_reports
     set status = p_status,
         -- first_response_at is whenever the provider FIRST did anything at
         -- all, which is the number residents actually feel. It is set once
         -- and never moved.
         first_response_at = case
           when v_is_provider and first_response_at is null then v_now
           else first_response_at end,
         acknowledged_at = case
           when p_status = 'acknowledged' and acknowledged_at is null then v_now
           else acknowledged_at end,
         resolved_at = case
           when p_status = 'resolved' then v_now
           when p_status = 'submitted' then null   -- reopened
           else resolved_at end,
         closed_at = case
           when p_status = 'closed' then v_now
           when p_status = 'submitted' then null
           else closed_at end
   where id = p_report
   returning * into v_report;

  insert into res_service_report_updates (report_id, author_id, kind, body, from_status, to_status)
  values (p_report, auth.uid(), 'status_change', nullif(trim(coalesce(p_note, '')), ''),
          v_old_status, p_status);

  return v_report;
end;
$$;

create or replace function public.res_comment_service_report(p_report uuid, p_body text)
returns public.res_service_report_updates
language plpgsql security definer
set search_path = public
as $$
declare
  v_report res_service_reports;
  v_row res_service_report_updates;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if coalesce(trim(p_body), '') = '' then raise exception 'empty_comment'; end if;

  select * into v_report from res_service_reports where id = p_report;
  if not found then raise exception 'report_not_found'; end if;
  if not (v_report.reporter_id = auth.uid()
          or public.res_is_provider_admin(v_report.provider_id)
          or public.res_shares_locality(v_report.suburb, v_report.city)) then
    raise exception 'not_your_area';
  end if;

  perform public.res_check_rate_limit('service_comment', 20, 3600);

  insert into res_service_report_updates (report_id, author_id, kind, body)
  values (p_report, auth.uid(), 'comment', trim(p_body))
  returning * into v_row;

  -- A provider replying counts as their first response.
  if public.res_is_provider_admin(v_report.provider_id) and v_report.first_response_at is null then
    update res_service_reports set first_response_at = now() where id = p_report;
  end if;

  return v_row;
end;
$$;

-- ── 7. THE TRACK RECORD ────────────────────────────────────────────────────
-- "The company must know how long it takes for them to fix a problem."
-- security definer so it can aggregate across reports the caller cannot read
-- individually — it returns only counts and medians, never report contents.
create or replace function public.res_provider_performance(p_provider uuid default null)
returns table (
  provider_id uuid,
  provider_name text,
  open_count integer,
  resolved_count integer,
  median_ack_hours numeric,
  median_resolve_hours numeric,
  oldest_open_days numeric,
  overdue_count integer
)
language sql stable security definer
set search_path = public
as $$
  select
    p.id,
    p.name,
    count(*) filter (where r.status in ('submitted','acknowledged','in_progress'))::integer,
    count(*) filter (where r.status in ('resolved','closed'))::integer,
    -- Parenthesised before the cast: `agg(...) filter (...)::numeric` binds the
    -- cast to the filter expression rather than the aggregate result.
    round((percentile_cont(0.5) within group (
      order by extract(epoch from (r.acknowledged_at - r.created_at)) / 3600.0
    ) filter (where r.acknowledged_at is not null))::numeric, 1),
    round((percentile_cont(0.5) within group (
      order by extract(epoch from (r.resolved_at - r.created_at)) / 3600.0
    ) filter (where r.resolved_at is not null))::numeric, 1),
    round((max(extract(epoch from (now() - r.created_at)) / 86400.0)
      filter (where r.status in ('submitted','acknowledged','in_progress')))::numeric, 1),
    count(*) filter (
      where r.status in ('submitted','acknowledged','in_progress')
        and now() > r.created_at + make_interval(hours => r.target_hours)
    )::integer
  from res_infra_providers p
  join res_service_reports r on r.provider_id = p.id
  where p_provider is null or p.id = p_provider
  group by p.id, p.name
  order by p.name;
$$;

-- ── 8. GRANTS ──────────────────────────────────────────────────────────────
revoke execute on function public.res_submit_service_report(text,text,text,text,text,text,uuid,text,double precision,double precision) from public, anon;
revoke execute on function public.res_confirm_service_report(uuid) from public, anon;
revoke execute on function public.res_set_service_report_status(uuid,text,text) from public, anon;
revoke execute on function public.res_comment_service_report(uuid,text) from public, anon;
revoke execute on function public.res_provider_performance(uuid) from public, anon;

grant execute on function public.res_submit_service_report(text,text,text,text,text,text,uuid,text,double precision,double precision) to authenticated, service_role;
grant execute on function public.res_confirm_service_report(uuid) to authenticated, service_role;
grant execute on function public.res_set_service_report_status(uuid,text,text) to authenticated, service_role;
grant execute on function public.res_comment_service_report(uuid,text) to authenticated, service_role;
grant execute on function public.res_provider_performance(uuid) to authenticated, service_role;


-- ==========================================================================
-- 09. theresident_directory_urgency_schema.sql
-- ==========================================================================

-- theresident_directory_urgency_schema.sql
--
-- Two things, both extending the org-broadcast feature that is already live
-- (res_org_units / res_org_memberships / res_org_follows / res_org_broadcasts
-- all exist in the database — SECURITY.md's claim that the file "has not been
-- applied" is stale and is corrected in this change).
--
-- 1. THE DIRECTORY. The tier list only allowed department/hod/school/teacher/
--    business/branch, so there was no way to model a municipality, a utility,
--    an ISP, or the grade/class level a parent actually wants to follow. Adds
--    those tiers plus the fields a browsable directory needs.
--
-- 2. URGENCY THAT ACTUALLY ARRIVES. Today postBroadcast() inserts a row and
--    that is all: no notification, no bell, no sound. A follower learns about
--    an announcement only by visiting Community and scrolling. This adds a
--    priority, a per-recipient receipt so a critical item can persist until it
--    is explicitly acknowledged, and the fan-out that puts it in the shared
--    notifications rail.
--
-- SECURITY NOTE — IMPERSONATION. Any signed-in user can create a unit named
-- "Eskom" or "Department of Education" and broadcast as it. That is a live
-- hole today. This adds a `verified` flag, and — importantly — refuses to let
-- an UNVERIFIED unit send at urgent/critical priority at all. Anyone can still
-- make a unit and talk to people who chose to follow them; nobody can
-- impersonate an institution and force an interrupt onto someone's phone.
--
-- Paste into the Supabase SQL editor. Additive; nothing is dropped.

-- ── 1. DIRECTORY FIELDS ────────────────────────────────────────────────────

alter table public.res_org_units
  add column if not exists sector text,
  add column if not exists verified boolean not null default false,
  add column if not exists contact_email text,
  add column if not exists contact_phone text,
  add column if not exists suburb text,
  add column if not exists city text,
  add column if not exists description text;

do $$ begin
  if not exists (
    select 1 from pg_constraint where conname = 'res_org_units_sector_check'
  ) then
    alter table public.res_org_units add constraint res_org_units_sector_check
      check (sector is null or sector in
        ('education', 'utility', 'government', 'business', 'health', 'transport', 'other'));
  end if;
end $$;

-- Widen the tier list. Replaces the constraint rather than adding a second one
-- (two CHECKs would AND together and reject everything new).
alter table public.res_org_units drop constraint if exists res_org_units_tier_check;
alter table public.res_org_units add constraint res_org_units_tier_check
  check (tier in (
    'department', 'hod', 'school', 'teacher', 'business', 'branch',
    'municipality', 'ward', 'utility', 'isp',
    'university', 'faculty', 'grade', 'class',
    'clinic', 'other'
  ));

create index if not exists res_org_units_sector_idx on public.res_org_units (sector, name);
create index if not exists res_org_units_locality_idx on public.res_org_units (city, suburb);

-- ── 2. PRIORITY + RECEIPTS ─────────────────────────────────────────────────

alter table public.res_org_broadcasts
  add column if not exists priority text not null default 'normal',
  add column if not exists category text,
  add column if not exists expires_at timestamptz;

do $$ begin
  if not exists (
    select 1 from pg_constraint where conname = 'res_org_broadcasts_priority_check'
  ) then
    alter table public.res_org_broadcasts add constraint res_org_broadcasts_priority_check
      check (priority in ('normal', 'important', 'urgent', 'critical'));
  end if;
end $$;

-- One row per (broadcast, recipient). `acknowledged_at` is what lets an urgent
-- item keep signalling until the person has actually dealt with it, rather
-- than until they happened to scroll past it. Deliberately a DB row and not
-- localStorage: "I saw the school's emergency notice" must survive a new
-- device, which is exactly what the existing sessionStorage-dismissed banners
-- do not do.
create table if not exists public.res_org_broadcast_receipts (
  id uuid primary key default uuid_generate_v4(),
  broadcast_id uuid references public.res_org_broadcasts(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  seen_at timestamptz,
  acknowledged_at timestamptz,
  created_at timestamptz default now() not null,
  unique (broadcast_id, user_id)
);

create index if not exists res_org_broadcast_receipts_user_idx
  on public.res_org_broadcast_receipts (user_id, acknowledged_at);

alter table public.res_org_broadcast_receipts enable row level security;

-- Strictly self-service, matching res_org_follows: your receipts are yours.
drop policy if exists res_broadcast_receipts_select on public.res_org_broadcast_receipts;
create policy res_broadcast_receipts_select on public.res_org_broadcast_receipts
  for select to authenticated using (user_id = auth.uid());

drop policy if exists res_broadcast_receipts_insert on public.res_org_broadcast_receipts;
create policy res_broadcast_receipts_insert on public.res_org_broadcast_receipts
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists res_broadcast_receipts_update on public.res_org_broadcast_receipts;
create policy res_broadcast_receipts_update on public.res_org_broadcast_receipts
  for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ── 3. ONLY VERIFIED UNITS MAY INTERRUPT ───────────────────────────────────

create or replace function public.res_check_broadcast_priority()
returns trigger
language plpgsql security definer
set search_path = public
as $$
declare
  v_verified boolean;
begin
  if new.priority in ('urgent', 'critical') then
    select verified into v_verified from res_org_units where id = new.unit_id;
    if not coalesce(v_verified, false) then
      raise exception 'unit_not_verified: only a verified organisation can send at % priority', new.priority;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists res_org_broadcasts_priority_gate on public.res_org_broadcasts;
create trigger res_org_broadcasts_priority_gate
  before insert on public.res_org_broadcasts
  for each row execute function public.res_check_broadcast_priority();

-- ── 4. FAN-OUT INTO THE SHARED NOTIFICATIONS RAIL ──────────────────────────
-- `notifications` is Gruvs-owned (CONTRACT.md §2/§4): we write rows, we never
-- alter its shape. Priority and the ack requirement ride in the existing `data`
-- jsonb and the deep link in the existing `action_url`, so this needs no
-- schema change on their side. Both `body`/`message` and `read`/`is_read` are
-- populated because the live table carries both spellings and different
-- clients read different ones.
create or replace function public.res_fanout_broadcast()
returns trigger
language plpgsql security definer
set search_path = public
as $$
declare
  v_unit_name text;
  v_audience integer;
begin
  -- 'normal' stays quiet by design: it appears in the Community feed and
  -- nowhere else. Only deliberate escalation reaches the bell.
  if new.priority = 'normal' then
    return new;
  end if;

  select name into v_unit_name from res_org_units where id = new.unit_id;

  select count(*) into v_audience
  from res_resolve_broadcast_audience(new.unit_id)
  where follower_user_id <> new.sender_id;

  -- A runaway fan-out would be indistinguishable from an attack on the shared
  -- rail. Refuse loudly rather than inserting a hundred thousand rows.
  if v_audience > 20000 then
    raise exception 'audience_too_large: % recipients — contact support to send at this scale', v_audience;
  end if;

  insert into notifications (recipient_id, actor_id, type, title, body, message, data, action_url, read, is_read)
  select
    a.follower_user_id,
    new.sender_id,
    'res_org_broadcast',
    coalesce(v_unit_name, 'Announcement') || ': ' || new.title,
    new.body,
    new.body,
    jsonb_build_object(
      'priority', new.priority,
      'requires_ack', new.priority = 'critical',
      'broadcast_id', new.id,
      'unit_id', new.unit_id,
      'category', new.category
    ),
    '/dashboard/community?tab=notices&broadcast=' || new.id::text,
    false,
    false
  from res_resolve_broadcast_audience(new.unit_id) a
  where a.follower_user_id <> new.sender_id;

  return new;
end;
$$;

drop trigger if exists res_org_broadcasts_fanout on public.res_org_broadcasts;
create trigger res_org_broadcasts_fanout
  after insert on public.res_org_broadcasts
  for each row execute function public.res_fanout_broadcast();

-- ── 5. ACKNOWLEDGING ───────────────────────────────────────────────────────

create or replace function public.res_ack_broadcast(p_broadcast uuid)
returns void
language plpgsql security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;

  insert into res_org_broadcast_receipts (broadcast_id, user_id, seen_at, acknowledged_at)
  values (p_broadcast, auth.uid(), now(), now())
  on conflict (broadcast_id, user_id)
  do update set acknowledged_at = coalesce(res_org_broadcast_receipts.acknowledged_at, now()),
                seen_at = coalesce(res_org_broadcast_receipts.seen_at, now());

  -- Acknowledging the announcement also clears its bell entry, so the two
  -- cannot disagree about whether it has been dealt with.
  update notifications
     set read = true, is_read = true, read_at = now()
   where recipient_id = auth.uid()
     and type = 'res_org_broadcast'
     and data->>'broadcast_id' = p_broadcast::text;
end;
$$;

/**
 * Unacknowledged urgent/critical announcements for the signed-in user. The
 * banner reads this; RLS on res_org_broadcasts already limits it to units the
 * caller actually follows.
 */
-- Dropped first, not just replaced: this function's shape changed when area
-- notices were added (it gained `source` and `target_label`), and
-- CREATE OR REPLACE cannot change a function's return type. Without the
-- drop, re-running the schema fails with "cannot change return type of
-- existing function".
drop function if exists public.res_pending_urgent_broadcasts();
create or replace function public.res_pending_urgent_broadcasts()
returns table (
  id uuid,
  unit_id uuid,
  unit_name text,
  title text,
  body text,
  priority text,
  created_at timestamptz
)
language sql stable security definer
set search_path = public
as $$
  select b.id, b.unit_id, u.name, b.title, b.body, b.priority, b.created_at
  from res_org_broadcasts b
  join res_org_units u on u.id = b.unit_id
  left join res_org_broadcast_receipts r
         on r.broadcast_id = b.id and r.user_id = auth.uid()
  where b.priority in ('urgent', 'critical')
    and r.acknowledged_at is null
    and (b.expires_at is null or b.expires_at > now())
    and exists (
      select 1 from res_org_follows f
      where f.follower_user_id = auth.uid()
        and public.res_is_unit_ancestor_or_self(b.unit_id, f.unit_id)
    )
  order by
    case b.priority when 'critical' then 0 else 1 end,
    b.created_at desc
  limit 20;
$$;

revoke execute on function public.res_ack_broadcast(uuid) from public, anon;
revoke execute on function public.res_pending_urgent_broadcasts() from public, anon;
grant execute on function public.res_ack_broadcast(uuid) to authenticated, service_role;
grant execute on function public.res_pending_urgent_broadcasts() to authenticated, service_role;


-- ==========================================================================
-- 10. theresident_room_inventory_schema.sql
-- ==========================================================================

-- theresident_room_inventory_schema.sql
--
-- A landlord's private room inventory: how many rooms they have, which are
-- vacant, photos, advantages/disadvantages, who currently lives there, and why
-- a room costs what it does.
--
-- WHY A NEW TABLE, NOT MORE COLUMNS ON res_listings. Every res_listings row is
-- world-readable today (`select using (true)` in resident_schema.sql) — the
-- moment a room exists as a listing, it's public. There is no way for a
-- landlord to jot down a room privately. res_rooms is that private tool;
-- res_advertise_room() below is the one deliberate door from private to
-- public, reusing the res_listings.property_id link that already exists and
-- is already populated, just never had anything to publish FROM.
--
-- OCCUPANT PRIVACY IS SELF-SERVICE, NOT LANDLORD-IMPOSED. The landlord always
-- sees who lives in their own rooms — it's their property. What the landlord
-- cannot do is decide whether a housemate sees another housemate's name: that
-- switch belongs to the occupant themselves (res_set_occupant_visibility,
-- callable only by auth.uid() = tenant_id), defaulting to the safer
-- 'landlord_only' until they choose to soften it.
--
-- Paste into the Supabase SQL editor. Additive only.

-- ── 1. TABLES ──────────────────────────────────────────────────────────────

create table if not exists public.res_rooms (
  id uuid primary key default uuid_generate_v4(),
  property_id uuid references public.res_properties(id) on delete cascade not null,
  landlord_id uuid references public.profiles(id) on delete cascade not null,
  label text not null,
  -- Capped at 6 in the submit RPC below — the first genuine multi-photo
  -- gallery in this app; every existing uploader (MarketTab, gossip, profile)
  -- is deliberately single-image, so this is a new precedent, not an
  -- established one, and stays bounded on purpose.
  photos text[] not null default '{}',
  price numeric,
  currency text not null default 'ZAR',
  advantages text,
  disadvantages text,
  -- "Why does this room cost what it does?" — the landlord's own words, shown
  -- next to the price rather than left for a prospective tenant to guess.
  price_note text,
  status text not null default 'vacant' check (status in ('vacant', 'occupied')),
  -- Set once by res_advertise_room(); the room stays private until this is
  -- non-null.
  listing_id uuid references public.res_listings(id) on delete set null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

create table if not exists public.res_room_occupants (
  id uuid primary key default uuid_generate_v4(),
  room_id uuid references public.res_rooms(id) on delete cascade not null,
  -- Nullable: a landlord can record "Sipho, R2500/mo" for someone who isn't
  -- on the app at all. When it IS set, that person gets to control
  -- `visibility` themselves — see §4.
  tenant_id uuid references public.profiles(id) on delete set null,
  occupant_name_raw text,
  moved_in_at timestamptz not null default now(),
  -- Null while they still live there. Ending a stay stamps this rather than
  -- deleting the row, so — unlike res_room_requests today — a tenancy
  -- actually has a history once this ships.
  moved_out_at timestamptz,
  rent_amount numeric,
  notes text,
  visibility text not null default 'landlord_only'
    check (visibility in ('landlord_only', 'shared_with_housemates')),
  created_at timestamptz default now() not null,
  constraint res_room_occupants_person check (tenant_id is not null or occupant_name_raw is not null)
);

create index if not exists res_rooms_property_idx on public.res_rooms (property_id);
create index if not exists res_rooms_landlord_idx on public.res_rooms (landlord_id);
create index if not exists res_room_occupants_room_idx on public.res_room_occupants (room_id);
create index if not exists res_room_occupants_tenant_idx on public.res_room_occupants (tenant_id) where tenant_id is not null;
-- At most one CURRENT occupant record per (room, tenant) — moved_out_at is
-- part of the key so a returning tenant can get a fresh row.
create unique index if not exists res_room_occupants_current_idx
  on public.res_room_occupants (room_id, tenant_id)
  where tenant_id is not null and moved_out_at is null;

create or replace function public.res_room_touch()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists res_rooms_touch on public.res_rooms;
create trigger res_rooms_touch
  before update on public.res_rooms
  for each row execute function public.res_room_touch();

-- ── 2. OWNERSHIP HELPER ────────────────────────────────────────────────────
-- True when the caller owns the property this room (or occupant) belongs to.
-- A single function so every policy and RPC below agrees on what "yours"
-- means, rather than each repeating the join.
create or replace function public.res_owns_room(p_room uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (select 1 from res_rooms r where r.id = p_room and r.landlord_id = auth.uid());
$$;

-- True when the caller is a CURRENT occupant (moved_out_at is null) of any
-- room on the same property as p_room. A plain policy cannot express this —
-- querying res_room_occupants from within its own select policy recurses
-- (Postgres re-evaluates the policy for the nested reference). A security
-- definer function sidesteps that the same way res_owns_room does: it runs as
-- the function owner, which bypasses RLS on the table it queries internally.
create or replace function public.res_is_current_housemate(p_room uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1
    from res_rooms theirs
    join res_rooms mine on mine.property_id = theirs.property_id
    join res_room_occupants my_occupancy
      on my_occupancy.room_id = mine.id
     and my_occupancy.tenant_id = auth.uid()
     and my_occupancy.moved_out_at is null
    where theirs.id = p_room
  );
$$;

grant execute on function public.res_owns_room(uuid) to authenticated, service_role;
grant execute on function public.res_is_current_housemate(uuid) to authenticated, service_role;

-- ── 3. RLS ─────────────────────────────────────────────────────────────────

alter table public.res_rooms          enable row level security;
alter table public.res_room_occupants enable row level security;

-- Matches res_properties_all exactly: fully private to the landlord who owns
-- it. No separate insert/update policy needed since `for all` covers both,
-- and every write also goes through the RPCs in §4 for the parts (photo
-- count, reference-style validation) a bare policy can't enforce.
drop policy if exists res_rooms_all on public.res_rooms;
create policy res_rooms_all on public.res_rooms
  for all to authenticated
  using (landlord_id = auth.uid())
  with check (landlord_id = auth.uid());

-- Occupant rows: the landlord sees everyone in their own rooms; a linked
-- occupant sees their own row regardless of visibility (it's about them);
-- anyone else sharing the SAME property sees it only once that occupant has
-- opted into 'shared_with_housemates'. Writes go through the RPCs only.
drop policy if exists res_room_occupants_select on public.res_room_occupants;
create policy res_room_occupants_select on public.res_room_occupants
  for select to authenticated using (
    public.res_owns_room(room_id)
    or tenant_id = auth.uid()
    or (visibility = 'shared_with_housemates' and public.res_is_current_housemate(room_id))
  );

-- ── 4. RPCs ────────────────────────────────────────────────────────────────

create or replace function public.res_create_room(
  p_property uuid,
  p_label text,
  p_price numeric,
  p_currency text,
  p_advantages text,
  p_disadvantages text,
  p_price_note text,
  p_photos text[]
)
returns public.res_rooms
language plpgsql security definer
set search_path = public
as $$
declare
  v_row res_rooms;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if coalesce(trim(p_label), '') = '' then raise exception 'label_required'; end if;
  if not exists (select 1 from res_properties where id = p_property and landlord_id = auth.uid()) then
    raise exception 'not_your_property';
  end if;
  if coalesce(array_length(p_photos, 1), 0) > 6 then
    raise exception 'too_many_photos: 6 maximum per room';
  end if;

  insert into res_rooms (
    property_id, landlord_id, label, price, currency, advantages, disadvantages, price_note, photos
  ) values (
    p_property, auth.uid(), trim(p_label), p_price, coalesce(p_currency, 'ZAR'),
    nullif(trim(coalesce(p_advantages, '')), ''), nullif(trim(coalesce(p_disadvantages, '')), ''),
    nullif(trim(coalesce(p_price_note, '')), ''), coalesce(p_photos, '{}')
  )
  returning * into v_row;

  return v_row;
end;
$$;

create or replace function public.res_update_room(
  p_room uuid,
  p_label text,
  p_price numeric,
  p_currency text,
  p_advantages text,
  p_disadvantages text,
  p_price_note text,
  p_photos text[]
)
returns public.res_rooms
language plpgsql security definer
set search_path = public
as $$
declare
  v_row res_rooms;
begin
  if not public.res_owns_room(p_room) then raise exception 'not_your_room'; end if;
  if coalesce(array_length(p_photos, 1), 0) > 6 then
    raise exception 'too_many_photos: 6 maximum per room';
  end if;

  update res_rooms set
    label = coalesce(nullif(trim(p_label), ''), label),
    price = coalesce(p_price, price),
    currency = coalesce(p_currency, currency),
    advantages = nullif(trim(coalesce(p_advantages, '')), ''),
    disadvantages = nullif(trim(coalesce(p_disadvantages, '')), ''),
    price_note = nullif(trim(coalesce(p_price_note, '')), ''),
    photos = coalesce(p_photos, photos)
  where id = p_room
  returning * into v_row;

  return v_row;
end;
$$;

create or replace function public.res_add_room_occupant(
  p_room uuid,
  p_tenant uuid,
  p_occupant_name_raw text,
  p_rent_amount numeric,
  p_notes text
)
returns public.res_room_occupants
language plpgsql security definer
set search_path = public
as $$
declare
  v_row res_room_occupants;
begin
  if not public.res_owns_room(p_room) then raise exception 'not_your_room'; end if;
  if p_tenant is null and coalesce(trim(p_occupant_name_raw), '') = '' then
    raise exception 'occupant_identity_required: give a name, or link a resident';
  end if;

  insert into res_room_occupants (room_id, tenant_id, occupant_name_raw, rent_amount, notes)
  values (p_room, p_tenant, nullif(trim(coalesce(p_occupant_name_raw, '')), ''), p_rent_amount,
          nullif(trim(coalesce(p_notes, '')), ''))
  returning * into v_row;

  update res_rooms set status = 'occupied' where id = p_room;

  return v_row;
end;
$$;

create or replace function public.res_end_room_occupancy(p_occupant uuid)
returns public.res_room_occupants
language plpgsql security definer
set search_path = public
as $$
declare
  v_row res_room_occupants;
  v_room uuid;
begin
  select room_id into v_room from res_room_occupants where id = p_occupant;
  if v_room is null then raise exception 'occupant_not_found'; end if;
  if not public.res_owns_room(v_room) then raise exception 'not_your_room'; end if;

  update res_room_occupants set moved_out_at = now()
  where id = p_occupant and moved_out_at is null
  returning * into v_row;

  -- Only flips back to vacant if nobody else current remains — a room can
  -- have more than one occupant on record.
  if not exists (select 1 from res_room_occupants where room_id = v_room and moved_out_at is null) then
    update res_rooms set status = 'vacant' where id = v_room;
  end if;

  return v_row;
end;
$$;

-- Callable ONLY by the occupant themselves. This is the whole point: the
-- landlord cannot soften or tighten this on someone else's behalf.
create or replace function public.res_set_occupant_visibility(p_occupant uuid, p_visibility text)
returns public.res_room_occupants
language plpgsql security definer
set search_path = public
as $$
declare
  v_row res_room_occupants;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if p_visibility not in ('landlord_only', 'shared_with_housemates') then
    raise exception 'invalid_visibility';
  end if;

  update res_room_occupants
     set visibility = p_visibility
   where id = p_occupant and tenant_id = auth.uid()
  returning * into v_row;

  if v_row.id is null then raise exception 'not_your_occupancy'; end if;
  return v_row;
end;
$$;

-- The one deliberate door from private inventory to a public listing. Reuses
-- res_listings.property_id, which already exists and was already populated
-- by the create-listing form — this just finally gives it something to
-- publish FROM instead of only TO.
create or replace function public.res_advertise_room(p_room uuid)
returns public.res_listings
language plpgsql security definer
set search_path = public
as $$
declare
  v_room res_rooms;
  v_property res_properties;
  v_listing res_listings;
begin
  if not public.res_owns_room(p_room) then raise exception 'not_your_room'; end if;

  select * into v_room from res_rooms where id = p_room;
  if v_room.listing_id is not null then
    raise exception 'already_advertised';
  end if;

  select * into v_property from res_properties where id = v_room.property_id;

  insert into res_listings (
    landlord_id, title, description, price, currency, location, suburb,
    images, property_id
  ) values (
    auth.uid(), v_room.label,
    coalesce(v_room.advantages, '') ||
      case when v_room.disadvantages is not null then E'\n\n' || v_room.disadvantages else '' end,
    coalesce(v_room.price, 0), v_room.currency, coalesce(v_property.address, ''),
    coalesce(v_property.suburb, ''), coalesce(v_room.photos, '{}'), v_room.property_id
  )
  returning * into v_listing;

  update res_rooms set listing_id = v_listing.id where id = p_room;

  return v_listing;
end;
$$;

-- ── 5. GRANTS ──────────────────────────────────────────────────────────────
revoke execute on function public.res_create_room(uuid,text,numeric,text,text,text,text,text[]) from public, anon;
revoke execute on function public.res_update_room(uuid,text,numeric,text,text,text,text,text[]) from public, anon;
revoke execute on function public.res_add_room_occupant(uuid,uuid,text,numeric,text) from public, anon;
revoke execute on function public.res_end_room_occupancy(uuid) from public, anon;
revoke execute on function public.res_set_occupant_visibility(uuid,text) from public, anon;
revoke execute on function public.res_advertise_room(uuid) from public, anon;

grant execute on function public.res_create_room(uuid,text,numeric,text,text,text,text,text[]) to authenticated, service_role;
grant execute on function public.res_update_room(uuid,text,numeric,text,text,text,text,text[]) to authenticated, service_role;
grant execute on function public.res_add_room_occupant(uuid,uuid,text,numeric,text) to authenticated, service_role;
grant execute on function public.res_end_room_occupancy(uuid) to authenticated, service_role;
grant execute on function public.res_set_occupant_visibility(uuid,text) to authenticated, service_role;
grant execute on function public.res_advertise_room(uuid) to authenticated, service_role;


-- ==========================================================================
-- 11. theresident_property_delete_and_verification_meaning.sql
-- ==========================================================================

-- theresident_property_delete_and_verification_meaning.sql
--
-- Two gaps flagged from UI feedback:
--   1. A landlord has no way to delete a property. Doing it with a plain
--      DELETE from the client would either fail on the FK from res_rooms/
--      res_listings, or (if those were ON DELETE CASCADE) silently wipe a
--      tenant's tenancy history with no record. This RPC cascades safely
--      through only the landlord's own rows, in dependency order, inside one
--      transaction (implicit in a single security-definer function body).
--   2. "How do we know it's true" (verification) had no explanation in the
--      UI — this file adds nothing new to the schema for that, the fix is
--      client-side copy next to the existing badge (see the .tsx change in
--      the same commit). Left here as a pointer so the two aren't scattered
--      across unrelated commits.
--
-- Paste into the Supabase SQL editor. Additive only; no existing objects
-- are altered.

create or replace function public.res_delete_property(p_property uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
begin
  select landlord_id into v_owner from public.res_properties where id = p_property;
  if v_owner is null then
    raise exception 'Property not found';
  end if;
  if v_owner <> auth.uid() then
    raise exception 'Not your property';
  end if;

  -- Occupant history is deleted with the room, not orphaned — there is no
  -- other owner who could still read it once the room itself is gone.
  delete from public.res_room_occupants
    where room_id in (select id from public.res_rooms where property_id = p_property);

  delete from public.res_rooms where property_id = p_property;

  -- A room's public listing (res_listings) is the landlord's own row too
  -- (res_listings.landlord_id = auth.uid() is already enforced elsewhere) —
  -- cascading it here means a deleted property can't leave a dangling,
  -- still-bookable listing pointing at nothing.
  delete from public.res_listings where property_id = p_property;

  delete from public.res_properties where id = p_property;
end;
$$;

revoke all on function public.res_delete_property(uuid) from public;
grant execute on function public.res_delete_property(uuid) to authenticated;


-- ==========================================================================
-- 12. theresident_kin_verification_link.sql
-- ==========================================================================

-- theresident_kin_verification_link.sql
--
-- The existing Next of Kin feature (res_trust_connections, res_request_trust_
-- connection/res_confirm_trust_connection) already requires BOTH people to
-- have Resident accounts and to explicitly act — that's real mutual
-- confirmation, not a one-sided claim.
--
-- What's missing is the case the user actually asked for: "give them a
-- unique link ... so they can be asked 'is this your brother/sister' ...
-- so we can be sure they're related" — someone who may not have the app at
-- all (a sibling, a parent) getting a link they can open with no login and
-- answer a single yes/no question about a relationship claim.
--
-- This is a SEPARATE, lighter-weight table from res_trust_connections on
-- purpose: it doesn't create or require a Resident account for the
-- responder, doesn't feed the trust-circle 2-hop gate, and is answerable by
-- someone who never signs up. It exists purely as a corroboration record a
-- resident can point to ("my sister confirmed this link").
--
-- Paste into the Supabase SQL editor. Additive only.

create table if not exists public.res_kin_verification_links (
  id uuid primary key default uuid_generate_v4(),
  requester_id uuid references public.profiles(id) on delete cascade not null,
  claimed_name text not null,
  claimed_relationship text not null,
  -- The public, unguessable part of the link. Not the primary key so a
  -- leaked id (e.g. in a log line) can't be used to look the row up —
  -- only the token can.
  token uuid not null unique default uuid_generate_v4(),
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'denied')),
  responder_note text,
  created_at timestamptz not null default now(),
  responded_at timestamptz
);

create index if not exists res_kin_verification_links_requester_idx
  on public.res_kin_verification_links (requester_id, created_at desc);

alter table public.res_kin_verification_links enable row level security;

-- The requester can see their own links (to check status) — nobody else can
-- list or browse this table directly. The public-facing page never selects
-- the table itself; it goes through res_get_kin_verification_link(token)
-- below, which is the only way to reach a single row by token.
drop policy if exists res_kin_verification_links_select on public.res_kin_verification_links;
create policy res_kin_verification_links_select on public.res_kin_verification_links
  for select using (requester_id = auth.uid());

-- Creates a new claim + shareable link. Must be signed in — this is the
-- resident vouching for who they claim their kin is, not an anonymous act.
create or replace function public.res_create_kin_verification_link(
  p_claimed_name text,
  p_relationship text
)
returns public.res_kin_verification_links
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.res_kin_verification_links;
begin
  if auth.uid() is null then
    raise exception 'Must be signed in';
  end if;
  if trim(coalesce(p_claimed_name, '')) = '' then
    raise exception 'Name is required';
  end if;
  if trim(coalesce(p_relationship, '')) = '' then
    raise exception 'Relationship is required';
  end if;

  insert into public.res_kin_verification_links (requester_id, claimed_name, claimed_relationship)
    values (auth.uid(), trim(p_claimed_name), trim(p_relationship))
    returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.res_create_kin_verification_link(text, text) from public;
grant execute on function public.res_create_kin_verification_link(text, text) to authenticated;

-- Public, no-login read of a single claim by its token — for the /verify-kin
-- page. Deliberately returns only what a stranger needs to answer the
-- question: the requester's display name, the claim, and whether it's
-- already been answered. Never the requester's id, email, or any other
-- profile field.
create or replace function public.res_get_kin_verification_link(p_token uuid)
returns table (
  requester_name text,
  claimed_name text,
  claimed_relationship text,
  status text
)
language sql
security definer
set search_path = public
stable
as $$
  select
    coalesce(pr.display_name, pr.username, 'A Resident user'),
    l.claimed_name,
    l.claimed_relationship,
    l.status
  from public.res_kin_verification_links l
  join public.profiles pr on pr.id = l.requester_id
  where l.token = p_token;
$$;

revoke all on function public.res_get_kin_verification_link(uuid) from public;
grant execute on function public.res_get_kin_verification_link(uuid) to anon, authenticated;

-- Public, no-login response. Answerable exactly once — a second call on an
-- already-answered token is rejected rather than allowed to overwrite the
-- first answer.
create or replace function public.res_respond_kin_verification_link(
  p_token uuid,
  p_confirmed boolean,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
begin
  select status into v_status from public.res_kin_verification_links where token = p_token;
  if v_status is null then
    raise exception 'Link not found';
  end if;
  if v_status <> 'pending' then
    raise exception 'This link has already been answered';
  end if;

  update public.res_kin_verification_links
    set status = case when p_confirmed then 'confirmed' else 'denied' end,
        responder_note = p_note,
        responded_at = now()
    where token = p_token;
end;
$$;

revoke all on function public.res_respond_kin_verification_link(uuid, boolean, text) from public;
grant execute on function public.res_respond_kin_verification_link(uuid, boolean, text) to anon, authenticated;


-- ==========================================================================
-- 13. theresident_gossip_reactions.sql
-- ==========================================================================

-- theresident_gossip_reactions.sql
--
-- "Can we brainstorm this, it's too basic, a lot is missing here" — about
-- the Gossip Feed. The single most obviously-missing piece on a feed that
-- only supports comments: there is no way to react to a post at all, so
-- every post either gets a comment or gets nothing, with no lightweight
-- way to say "seen, agreed" the way every other feed in the app (Marketplace,
-- Notice Board reviews) already lets people signal something cheaply.
--
-- Scoped deliberately to one reaction type (a heart/like toggle), matching
-- how res_gossip_posts itself is written directly from the client rather
-- than through an RPC — this is the same shape, not a new pattern.
--
-- Paste into the Supabase SQL editor. Additive only.

create table if not exists public.res_gossip_post_reactions (
  post_id uuid references public.res_gossip_posts(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create index if not exists res_gossip_post_reactions_post_idx
  on public.res_gossip_post_reactions (post_id);

alter table public.res_gossip_post_reactions enable row level security;

-- Counts and "who reacted" are the whole point of a reaction, same as a
-- like count anywhere else — public read, matching res_gossip_posts itself.
drop policy if exists res_gossip_post_reactions_select on public.res_gossip_post_reactions;
create policy res_gossip_post_reactions_select on public.res_gossip_post_reactions
  for select using (true);

drop policy if exists res_gossip_post_reactions_insert on public.res_gossip_post_reactions;
create policy res_gossip_post_reactions_insert on public.res_gossip_post_reactions
  for insert with check (user_id = auth.uid());

drop policy if exists res_gossip_post_reactions_delete on public.res_gossip_post_reactions;
create policy res_gossip_post_reactions_delete on public.res_gossip_post_reactions
  for delete using (user_id = auth.uid());


-- ==========================================================================
-- 14. theresident_home_area_schema.sql
-- ==========================================================================

-- theresident_home_area_schema.sql
--
-- Phase A of the official-area-broadcast strategy
-- (docs/OFFICIAL-BROADCAST-STRATEGY.md): give a resident a Resident-owned
-- home area.
--
-- WHY THIS IS THE FIRST THING BUILT. To send "one message to everyone in this
-- ward" the database has to be able to answer "is this person inside that
-- polygon". Today it cannot: res_profiles carries only free-text suburb/city,
-- and the shared profiles table's lat/lon are Gruvs-private — CONTRACT.md §3
-- forbids The Resident from ever reading them. So there is no point to test
-- against a boundary, and no amount of map UI changes that. This table is
-- that missing point.
--
-- LAT/LON DOUBLES, NOT A POSTGIS GEOMETRY. CONTRACT.md §4 is explicit:
-- "Location: { lat, lon } double columns, WGS84" — every Resident-owned table
-- (res_alerts, res_listings, res_saved_pins) already follows it, and the one
-- geometry column in this database (map_zones.geom) is on a Gruvs-owned table.
-- Containment in a later phase still works without change:
--   ST_Covers(j.boundary, ST_MakePoint(h.lon, h.lat)::geography)
-- so this stays contract-compliant AND testable in the local sql-tests
-- harness, which has no PostGIS.
--
-- PRIVACY POSTURE, ENFORCED NOT PROMISED:
--   * Opt-in. Nothing writes this row except the resident's own deliberate act.
--   * RLS is strictly self — the policy below is the ONLY way to reach the
--     table, and it compares user_id to the caller. No official, and no other
--     resident, can select another person's row at all.
--   * Default granularity is 'coarse': the point is rounded to ~1km before it
--     is ever stored, so the database holds "roughly this neighbourhood",
--     which is all a ward-containment test needs. 'exact' exists for people
--     who want precise local results and choose it themselves.
--   * When area broadcasting is built, audience resolution runs inside a
--     security-definer function that returns recipient IDs only — never
--     coordinates. This table is never exposed to a sender.
--
-- Paste into the Supabase SQL editor. Additive only.

-- ── 1. TABLE ───────────────────────────────────────────────────────────────

create table if not exists public.res_home_areas (
  -- One home area per resident: the primary key IS the user, so setting it
  -- again updates rather than accumulating a location history. Deliberate —
  -- we want where you live, not where you have been.
  user_id uuid primary key references public.profiles(id) on delete cascade,

  lat double precision not null,
  lon double precision not null,

  -- 'coarse' (default) stores the point rounded to 2 decimal places, roughly
  -- a 1.1km grid. Named granularity rather than `precision` because that word
  -- is a Postgres keyword (`double precision`) and reads ambiguously here.
  granularity text not null default 'coarse'
    check (granularity in ('coarse', 'exact')),

  -- Denormalised from the same reverse-geocode that produced the pin. These
  -- are what make the suburb fallback work for area targeting, and they give
  -- res_profiles.suburb/city an authoritative source instead of the
  -- side-effect backfill the Service Desk submit RPC does today.
  suburb text,
  city text,
  -- Human-readable address, shown back to the resident so the UI can say
  -- "12 Vine Street, Kreuzberg" instead of a pair of coordinates.
  label text,

  set_at timestamptz not null default now()
);

-- ── 2. RLS — STRICTLY SELF ─────────────────────────────────────────────────

alter table public.res_home_areas enable row level security;

-- One policy, for ALL commands, comparing user_id to the caller. There is no
-- read path for anyone else: not another resident, not a landlord, not a
-- verified official. auth.uid() is wrapped in a subselect so Postgres
-- evaluates it once per query rather than once per row (see
-- theresident_rls_initplan_perf_fix.sql).
drop policy if exists res_home_areas_all on public.res_home_areas;
create policy res_home_areas_all on public.res_home_areas
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- ── 3. COARSENING ──────────────────────────────────────────────────────────
-- Mirrored in src/utils/homeArea.ts (coarsen) so the UI can show the resident
-- exactly what will be stored before they save it. This function is the
-- authority; the client copy is for display only.
create or replace function public.res_coarsen_coord(p_value double precision)
returns double precision
language sql
immutable
set search_path = public
as $$
  select round(p_value::numeric, 2)::double precision;
$$;

grant execute on function public.res_coarsen_coord(double precision) to authenticated, service_role;

-- ── 4. RPCs ────────────────────────────────────────────────────────────────

create or replace function public.res_set_home_area(
  p_lat double precision,
  p_lon double precision,
  p_granularity text default 'coarse',
  p_suburb text default null,
  p_city text default null,
  p_label text default null
)
returns public.res_home_areas
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.res_home_areas;
  v_lat double precision;
  v_lon double precision;
  v_granularity text;
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;

  if p_lat is null or p_lon is null then
    raise exception 'coordinates_required';
  end if;
  if p_lat < -90 or p_lat > 90 or p_lon < -180 or p_lon > 180 then
    raise exception 'coordinates_out_of_range: lat must be -90..90 and lon -180..180';
  end if;

  v_granularity := coalesce(nullif(trim(p_granularity), ''), 'coarse');
  if v_granularity not in ('coarse', 'exact') then
    raise exception 'invalid_granularity';
  end if;

  -- Rounding happens HERE, before the insert — a coarse home area is never
  -- stored precisely and then displayed roughly. The imprecision is real.
  if v_granularity = 'coarse' then
    v_lat := public.res_coarsen_coord(p_lat);
    v_lon := public.res_coarsen_coord(p_lon);
  else
    v_lat := p_lat;
    v_lon := p_lon;
  end if;

  insert into public.res_home_areas (user_id, lat, lon, granularity, suburb, city, label, set_at)
  values (
    auth.uid(), v_lat, v_lon, v_granularity,
    nullif(trim(coalesce(p_suburb, '')), ''),
    nullif(trim(coalesce(p_city, '')), ''),
    nullif(trim(coalesce(p_label, '')), ''),
    now()
  )
  on conflict (user_id) do update set
    lat = excluded.lat,
    lon = excluded.lon,
    granularity = excluded.granularity,
    suburb = excluded.suburb,
    city = excluded.city,
    label = excluded.label,
    set_at = now()
  returning * into v_row;

  -- Suburb normalisation. Setting a home area is the most authoritative
  -- statement a resident makes about where they live, so unlike the Service
  -- Desk's opportunistic backfill (which only fills blanks), this OVERWRITES
  -- res_profiles.suburb/city. It keeps the free-text fallback used for area
  -- targeting in step with the pin, and fixes the drift that comes from those
  -- columns having been populated as a side effect of filing a report.
  if v_row.suburb is not null or v_row.city is not null then
    update public.res_profiles
       set suburb = coalesce(v_row.suburb, suburb),
           city   = coalesce(v_row.city, city)
     where id = auth.uid();
  end if;

  return v_row;
end;
$$;

revoke all on function public.res_set_home_area(double precision, double precision, text, text, text, text) from public, anon;
grant execute on function public.res_set_home_area(double precision, double precision, text, text, text, text) to authenticated, service_role;

-- Removing your home area is a first-class action, not a support request:
-- opt-in is only meaningful if opt-out is one click.
create or replace function public.res_clear_home_area()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  delete from public.res_home_areas where user_id = auth.uid();
end;
$$;

revoke all on function public.res_clear_home_area() from public, anon;
grant execute on function public.res_clear_home_area() to authenticated, service_role;


-- ==========================================================================
-- 15. theresident_jurisdictions_schema.sql
-- ==========================================================================

-- theresident_jurisdictions_schema.sql
--
-- Phase B of docs/OFFICIAL-BROADCAST-STRATEGY.md: give official bodies a
-- boundary, and make that boundary the thing that limits them.
--
-- THE IDEA THIS FILE IMPLEMENTS. Authority is a polygon, not a permission.
-- A ward councillor's jurisdiction is their ward; a mayor's is the
-- municipality; a premier's is the province; the president's is the country;
-- a library's or police station's is a service area. One rule then governs
-- the entire ladder:
--
--     You may broadcast to any area fully contained within your own
--     jurisdiction, and nowhere else.
--
-- A mayor can target one ward or the whole city, because both sit inside
-- their polygon. A councillor cannot reach past their ward no matter what
-- they draw — not because a rule forbids it, but because the geometry does.
-- There is no per-tier permission matrix to maintain and nothing to trust.
--
-- ST_COVERS, NOT ST_WITHIN. The strategy document said ST_Within; that is
-- wrong for the geography type, which supports ST_Covers/ST_CoveredBy/
-- ST_Intersects/ST_DWithin but not ST_Within. ST_Covers(jurisdiction, target)
-- reads "the jurisdiction covers the target" — every point of the target lies
-- inside the jurisdiction — which is exactly the rule above.
--
-- AND THE COMPARISON IS DONE IN THE GEOMETRY DOMAIN, NOT GEOGRAPHY. This is
-- not a stylistic choice, it is a correctness fix the local test harness
-- caught: on `geography`, polygon-covers-polygon is not reliably supported —
-- a geography polygon does not even cover ITSELF
-- (`ST_Covers(g, g)` returns false, verified in sql-tests/90). Left in
-- geography, "send to my whole ward" — the most common action in the whole
-- feature — would have been silently refused in production.
--
-- So: boundaries are STORED as geography (right for the point-in-polygon in
-- res_my_jurisdictions below, and for radius targeting with ST_DWithin
-- later), while polygon containment CASTS BOTH SIDES to ::geometry, where
-- covers-itself, covers-inside, refuses-outside and refuses-straddling all
-- behave correctly. Point-in-polygon stays on geography, which is the case
-- PostGIS does fully support.
--
-- WHY GEOGRAPHY HERE WHEN res_home_areas USES lat/lon DOUBLES. CONTRACT.md §4
-- mandates `{ lat, lon }` double columns for a LOCATION — a point where
-- something is. A jurisdiction is not a location, it is a shape, and there is
-- no lat/lon representation of a ward boundary. So boundaries are geography,
-- and resident points are constructed at comparison time with
-- ST_MakePoint(lon, lat)::geography. Both conventions are respected.
--
-- Paste into the Supabase SQL editor. Additive only.

-- ── 1. TABLE ───────────────────────────────────────────────────────────────

create table if not exists public.res_jurisdictions (
  id uuid primary key default uuid_generate_v4(),
  name text not null,

  -- 'service_area' is how an institution (library, clinic, police station,
  -- school) joins the same machinery as government: a differently-shaped
  -- polygon, identical containment rule.
  level text not null check (level in (
    'ward', 'municipality', 'district', 'province', 'national', 'service_area'
  )),

  -- The official code from the source data (e.g. a Municipal Demarcation
  -- Board ward code). Lets an import re-run update rather than duplicate,
  -- and lets a human check a row against the official register.
  external_ref text,

  -- Wards nest in municipalities, municipalities in districts, and so on.
  -- Not used for the containment check itself (geometry answers that on its
  -- own) — it is for browsing and for labelling "Ward 12, City of Tshwane".
  parent_id uuid references public.res_jurisdictions(id) on delete set null,

  boundary geography(MultiPolygon, 4326) not null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- The index that makes containment cheap at national scale. Without it every
-- audience preview would scan every boundary.
create index if not exists res_jurisdictions_boundary_idx
  on public.res_jurisdictions using gist (boundary);
create index if not exists res_jurisdictions_level_idx
  on public.res_jurisdictions (level, name);
create index if not exists res_jurisdictions_parent_idx
  on public.res_jurisdictions (parent_id);
-- Re-importing the same official dataset updates rows instead of doubling them.
create unique index if not exists res_jurisdictions_ref_idx
  on public.res_jurisdictions (level, external_ref) where external_ref is not null;

-- ── 2. RLS ─────────────────────────────────────────────────────────────────
-- Boundaries are public record — ward and municipal boundaries are published
-- by the Municipal Demarcation Board. Residents need to read them to see
-- which area they are in; officials need them to pick a target. So: readable
-- by any signed-in user, and writable by NOBODY through the client. There is
-- deliberately no insert/update/delete policy, which means only service_role
-- (the import script) can populate this table. A boundary is not user content.

alter table public.res_jurisdictions enable row level security;

drop policy if exists res_jurisdictions_select on public.res_jurisdictions;
create policy res_jurisdictions_select on public.res_jurisdictions
  for select to authenticated using (true);

-- Supabase's default privileges grant ALL on a new table to anon and
-- authenticated, so "writable by nobody" needs a revoke, not just the absence
-- of a policy. The SELECT-only policy already refuses writes; this is the
-- second lock behind it, and it was missing on the live project until a grant
-- sweep found it. Boundaries are loaded through res_upsert_jurisdiction,
-- which is service_role only.
revoke all on public.res_jurisdictions from anon, authenticated;
grant select on public.res_jurisdictions to authenticated;

-- ── 3. BIND A BODY TO ITS BOUNDARY ─────────────────────────────────────────

alter table public.res_org_units
  add column if not exists jurisdiction_id uuid
    references public.res_jurisdictions(id) on delete set null;

create index if not exists res_org_units_jurisdiction_idx
  on public.res_org_units (jurisdiction_id) where jurisdiction_id is not null;

-- ── 4. THE CONTAINMENT RULE ────────────────────────────────────────────────
-- The single gate every area broadcast will pass through in Phase D. It is
-- written now, and tested now, so that the rule exists before anything can
-- send. Three conditions, all required:
--
--   1. the unit is VERIFIED — this is the anti-impersonation gate. Anyone can
--      still create a unit called "Eskom" and broadcast to followers who
--      opted in; nobody unverified can broadcast to a geographic area at all.
--   2. the unit is BOUND to a jurisdiction — authority has to be recorded
--      before it can be exercised.
--   3. the target is COVERED by that jurisdiction.
--
-- security definer so the check is identical for every caller and cannot be
-- softened by a client's own RLS view of the tables.
create or replace function public.res_can_broadcast_to_area(
  p_unit uuid,
  p_target geography
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from res_org_units u
    join res_jurisdictions j on j.id = u.jurisdiction_id
    where u.id = p_unit
      and u.verified = true
      and p_target is not null
      -- ::geometry deliberate — see the header note on geography polygon
      -- containment. Do not "simplify" this back to geography.
      and ST_Covers(j.boundary::geometry, p_target::geometry)
  );
$$;

revoke all on function public.res_can_broadcast_to_area(uuid, geography) from public, anon;
grant execute on function public.res_can_broadcast_to_area(uuid, geography) to authenticated, service_role;

-- A readable explanation of WHY a target was refused, for the composer UI.
-- Returning a reason rather than a bare false is the difference between "you
-- can't do that" and "your account isn't verified yet".
create or replace function public.res_area_broadcast_block_reason(
  p_unit uuid,
  p_target geography
)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_unit res_org_units;
  v_boundary geography;
begin
  select * into v_unit from res_org_units where id = p_unit;
  if not found then
    return 'unknown_unit';
  end if;
  if not coalesce(v_unit.verified, false) then
    return 'not_verified';
  end if;
  if v_unit.jurisdiction_id is null then
    return 'no_jurisdiction';
  end if;
  select boundary into v_boundary from res_jurisdictions where id = v_unit.jurisdiction_id;
  if v_boundary is null then
    return 'no_jurisdiction';
  end if;
  if p_target is null then
    return 'no_target';
  end if;
  if not ST_Covers(v_boundary::geometry, p_target::geometry) then
    return 'outside_jurisdiction';
  end if;
  return null; -- allowed
end;
$$;

revoke all on function public.res_area_broadcast_block_reason(uuid, geography) from public, anon;
grant execute on function public.res_area_broadcast_block_reason(uuid, geography) to authenticated, service_role;

-- ── 5. "WHICH AREA AM I IN?" ───────────────────────────────────────────────
-- Self-scoped only: it reads the CALLER'S OWN home area and nobody else's.
-- Takes no coordinates, so it cannot be used to ask "who is in this polygon"
-- — that question belongs to the audience resolver in Phase D, which returns
-- recipient ids and never coordinates.
--
-- Worth showing a resident, both because it is useful ("Ward 12, City of
-- Tshwane") and because it makes concrete what setting a home area actually
-- opted them into.
create or replace function public.res_my_jurisdictions()
returns table (
  id uuid,
  name text,
  level text,
  external_ref text
)
language sql
stable
security definer
set search_path = public
as $$
  select j.id, j.name, j.level, j.external_ref
  from res_home_areas h
  join res_jurisdictions j
    on ST_Covers(j.boundary, ST_MakePoint(h.lon, h.lat)::geography)
  where h.user_id = auth.uid()
  order by
    case j.level
      when 'ward' then 1 when 'service_area' then 2 when 'municipality' then 3
      when 'district' then 4 when 'province' then 5 else 6
    end,
    j.name;
$$;

revoke all on function public.res_my_jurisdictions() from public, anon;
grant execute on function public.res_my_jurisdictions() to authenticated, service_role;

-- ── 6. IMPORT ──────────────────────────────────────────────────────────────
-- Boundaries arrive as GeoJSON from an official source (South Africa: the
-- Municipal Demarcation Board publishes ward, local/district municipality and
-- province boundaries). The Supabase JS client cannot construct a geography
-- value directly, so import goes through this RPC.
--
-- service_role ONLY — deliberately not granted to `authenticated`. Populating
-- the map of who governs what is an administrative act performed by
-- scripts/import-boundaries.mjs, never something a signed-in user can do.
--
-- Upsert on (level, external_ref) so re-running an import after a boundary
-- redetermination updates the existing row instead of creating a duplicate
-- ward that would then double-notify everyone inside it.
create or replace function public.res_upsert_jurisdiction(
  p_name text,
  p_level text,
  p_external_ref text,
  p_geojson text,
  p_parent_ref text default null,
  p_parent_level text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_parent uuid;
  v_geom geometry;
begin
  if coalesce(trim(p_name), '') = '' then
    raise exception 'name_required';
  end if;

  v_geom := ST_SetSRID(ST_GeomFromGeoJSON(p_geojson), 4326);
  if v_geom is null then
    raise exception 'invalid_geojson';
  end if;
  -- Sources mix Polygon and MultiPolygon freely; normalise so the column type
  -- and every downstream comparison see one shape.
  v_geom := ST_Multi(v_geom);
  if ST_IsEmpty(v_geom) then
    raise exception 'empty_boundary';
  end if;

  if p_parent_ref is not null and p_parent_level is not null then
    select id into v_parent from res_jurisdictions
      where level = p_parent_level and external_ref = p_parent_ref;
  end if;

  insert into res_jurisdictions (name, level, external_ref, parent_id, boundary)
  values (trim(p_name), p_level, nullif(trim(coalesce(p_external_ref, '')), ''),
          v_parent, v_geom::geography)
  on conflict (level, external_ref) where external_ref is not null
  do update set
    name = excluded.name,
    parent_id = coalesce(excluded.parent_id, res_jurisdictions.parent_id),
    boundary = excluded.boundary,
    updated_at = now()
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.res_upsert_jurisdiction(text, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.res_upsert_jurisdiction(text, text, text, text, text, text) to service_role;


-- ==========================================================================
-- 16. theresident_area_audience_schema.sql
-- ==========================================================================

-- theresident_area_audience_schema.sql
--
-- Phase C of docs/OFFICIAL-BROADCAST-STRATEGY.md: work out WHO is inside a
-- target area, and let an official see that number before they send.
--
-- THE PREVIEW IS THE POINT. The strategy calls for the send button to stay
-- disabled until the sender has seen "this will reach about 4,200 residents in
-- Ward 12". It stops the accidental province-wide send, it makes an official
-- think about proportionality, and it is the natural place to meter usage when
-- billing arrives.
--
-- TWO POPULATIONS, COUNTED SEPARATELY AND HONESTLY.
--   * PINNED residents have a home area, so containment is exact geometry.
--   * UNPINNED residents can only be matched on the free text in
--     res_profiles.suburb/city. That is genuinely fuzzy — "Kreuzberg" typed by
--     a resident may or may not be the Kreuzberg the sender means — so it is
--     never silently blended into one number. The preview reports both, and
--     the composer shows them separately. An official deserves to know how
--     much of their reach is certain.
--
-- COORDINATES NEVER LEAVE. Both functions are security definer and return
-- recipient IDs or counts. There is no argument or return path that exposes
-- where any individual lives, which is what makes res_home_areas' strictly-
-- self RLS meaningful rather than decorative.
--
-- NOT A DEMOGRAPHIC PROBE. Without a gate, "how many people live inside this
-- polygon" would be a free population-density API for anyone with an account.
-- So the preview requires the caller to be a sender for the unit AND the unit
-- to pass the Phase B containment gate. You can only count the people you were
-- already allowed to message.
--
-- Paste into the Supabase SQL editor. Additive only.

-- ── 1. WHO IS IN THERE ─────────────────────────────────────────────────────

create or replace function public.res_resolve_area_audience(
  p_target geography,
  p_priority text default 'important',
  p_category text default null,
  p_suburbs text[] default null,
  p_cities text[] default null
)
returns table (user_id uuid, matched_by text)
language sql
stable
security definer
set search_path = public
as $$
  with muted as (
    -- 'critical' is the one tier a resident cannot silence — evacuation,
    -- disaster, missing child. Everything else honours muted_types, either
    -- for area broadcasts generally or for this category specifically, so
    -- someone can mute "library events" without muting the police station.
    select np.user_id
    from res_notification_prefs np
    where p_priority is distinct from 'critical'
      and (
        np.muted_types @> array['res_area_broadcast']
        or (p_category is not null
            and np.muted_types @> array['res_area_broadcast:' || p_category])
      )
  ),
  pinned as (
    -- Exact: the resident put a pin down and it falls inside the target.
    select h.user_id
    from res_home_areas h
    where p_target is not null
      and ST_Covers(p_target, ST_MakePoint(h.lon, h.lat)::geography)
  ),
  by_text as (
    -- Fuzzy: no pin, but their stated suburb or city matches one the sender's
    -- area covers. Case-insensitive and trimmed, because this column is typed
    -- by people. Deliberately excludes anyone already matched by pin.
    select rp.id as user_id
    from res_profiles rp
    where not exists (select 1 from pinned p where p.user_id = rp.id)
      and (
        (p_suburbs is not null and rp.suburb is not null
           and lower(trim(rp.suburb)) = any (select lower(trim(s)) from unnest(p_suburbs) s))
        or (p_cities is not null and rp.city is not null
           and lower(trim(rp.city)) = any (select lower(trim(c)) from unnest(p_cities) c))
      )
  )
  select user_id, 'home_area' as matched_by from pinned
  where user_id not in (select user_id from muted)
  union all
  select user_id, 'suburb_text' as matched_by from by_text
  where user_id not in (select user_id from muted);
$$;

-- `authenticated` is revoked EXPLICITLY, not just via public. Revoking from
-- public alone left this callable by every signed-in user on the live project
-- (caught by a grant check after the first apply) — and this is the one
-- function here that returns a list of real people rather than a count. Only
-- the gated preview below, and the send path in Phase D, may reach it.
revoke all on function public.res_resolve_area_audience(geography, text, text, text[], text[]) from public, anon, authenticated;
grant execute on function public.res_resolve_area_audience(geography, text, text, text[], text[]) to service_role;

-- ── 2. THE PREVIEW ─────────────────────────────────────────────────────────
-- What the composer calls. Gated twice over: you must be a sender for the
-- unit, and the unit must be allowed to target this area at all.

create or replace function public.res_preview_area_audience(
  p_unit uuid,
  p_target geography,
  p_priority text default 'important',
  p_category text default null,
  p_suburbs text[] default null,
  p_cities text[] default null
)
returns table (
  pinned_count integer,
  text_matched_count integer,
  total_count integer,
  block_reason text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_reason text;
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;

  -- You may only count the people you are allowed to message.
  if not public.res_user_is_sender_of_or_above(p_unit, auth.uid()) then
    raise exception 'not_a_sender_for_this_unit';
  end if;

  v_reason := public.res_area_broadcast_block_reason(p_unit, p_target);
  if v_reason is not null then
    -- Refused: report why, and no numbers. A blocked sender learns nothing
    -- about who lives there.
    return query select 0, 0, 0, v_reason;
    return;
  end if;

  return query
  select
    count(*) filter (where a.matched_by = 'home_area')::integer,
    count(*) filter (where a.matched_by = 'suburb_text')::integer,
    count(*)::integer,
    null::text
  from public.res_resolve_area_audience(p_target, p_priority, p_category, p_suburbs, p_cities) a;
end;
$$;

revoke all on function public.res_preview_area_audience(uuid, geography, text, text, text[], text[]) from public, anon;
grant execute on function public.res_preview_area_audience(uuid, geography, text, text, text[], text[]) to authenticated, service_role;

-- ── 3. TARGETS AN OFFICIAL CAN PICK ────────────────────────────────────────
-- Turns the strategy's targeting mechanisms into geometry the functions above
-- understand, without the client ever constructing geography itself.

-- (a) and (b): "my whole area", or a named area inside it. Returns the
-- jurisdiction's own boundary, so targeting is exact rather than redrawn.
create or replace function public.res_jurisdiction_target(p_jurisdiction uuid)
returns geography
language sql
stable
security definer
set search_path = public
as $$
  select boundary from res_jurisdictions where id = p_jurisdiction;
$$;

revoke all on function public.res_jurisdiction_target(uuid) from public, anon;
grant execute on function public.res_jurisdiction_target(uuid) to authenticated, service_role;

-- (c) radius: "everyone within 3km of this library". Buffering in geography
-- gives real metres rather than degrees, which is why the boundary column is
-- geography in the first place.
create or replace function public.res_radius_target(
  p_lat double precision,
  p_lon double precision,
  p_metres double precision
)
returns geography
language sql
immutable
set search_path = public
as $$
  select ST_Buffer(ST_MakePoint(p_lon, p_lat)::geography, least(greatest(p_metres, 50), 50000));
$$;

revoke all on function public.res_radius_target(double precision, double precision, double precision) from public, anon;
grant execute on function public.res_radius_target(double precision, double precision, double precision) to authenticated, service_role;

-- The areas a sender may choose between: their own jurisdiction, plus every
-- jurisdiction nested inside it. This is what populates the targeting picker,
-- and it is the same containment rule expressed as a list.
create or replace function public.res_targetable_jurisdictions(p_unit uuid)
returns table (id uuid, name text, level text, is_own boolean)
language sql
stable
security definer
set search_path = public
as $$
  select j.id, j.name, j.level, (j.id = own.id) as is_own
  from res_org_units u
  join res_jurisdictions own on own.id = u.jurisdiction_id
  join res_jurisdictions j
    on j.id = own.id
    or ST_Covers(own.boundary::geometry, j.boundary::geometry)
  where u.id = p_unit
    and u.verified = true
    and public.res_user_is_sender_of_or_above(p_unit, auth.uid())
  order by (j.id = own.id) desc,
    case j.level
      when 'national' then 1 when 'province' then 2 when 'district' then 3
      when 'municipality' then 4 when 'ward' then 5 else 6
    end,
    j.name;
$$;

revoke all on function public.res_targetable_jurisdictions(uuid) from public, anon;
grant execute on function public.res_targetable_jurisdictions(uuid) to authenticated, service_role;


-- ==========================================================================
-- 17. theresident_area_broadcast_send_schema.sql
-- ==========================================================================

-- theresident_area_broadcast_send_schema.sql
--
-- Phase D of docs/OFFICIAL-BROADCAST-STRATEGY.md: actually send to an area,
-- deliver it, and keep a permanent public record of what was sent.
--
-- THE RECORD IS HALF THE FEATURE. Every area broadcast is stored with who
-- sent it, what area it covered, how many people it reached and when — and
-- that row is readable by everyone, forever. This is the same instinct as the
-- Service Desk's "how long did they take to fix it": an official who can
-- reach thousands of residents unprompted should be answerable for how often
-- they do it and what they said. It is not an audit log hidden in a table
-- nobody reads; it is shown on the sender's profile.
--
-- THE CLIENT NEVER HANDS US A SHAPE. The send RPC takes a jurisdiction id, or
-- a point and a radius — never geography. Phase C's preview accepts a
-- geography argument because the containment gate makes that safe, but a send
-- is a write, and the smaller surface is the right one for a write.
--
-- Paste into the Supabase SQL editor. Additive only.

-- ── 1. THE SUBURB NAMES AN AREA ACTUALLY CONTAINS ──────────────────────────
--
-- The text fallback (reaching residents who never dropped a pin, by the
-- suburb they typed) needs to know what the suburbs inside a ward are called.
-- Nothing in the boundary data carries that, so the pinned residents tell us:
-- the suburb names on home areas inside the target ARE the names of the
-- suburbs inside the target. No new data, no gazetteer to maintain, and it
-- improves on its own as more residents pin.
--
-- Returns place names, never people. Still service_role-only, because "list
-- the suburbs inside this polygon" is one join away from being useful to
-- someone probing where the pins are.
create or replace function public.res_area_place_names(p_target geography)
returns table (suburbs text[], cities text[])
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce(array_agg(distinct h.suburb) filter (where h.suburb is not null and trim(h.suburb) <> ''), '{}'),
    coalesce(array_agg(distinct h.city) filter (where h.city is not null and trim(h.city) <> ''), '{}')
  from res_home_areas h
  where p_target is not null
    and ST_Covers(p_target, ST_MakePoint(h.lon, h.lat)::geography);
$$;

revoke all on function public.res_area_place_names(geography) from public, anon, authenticated;
grant execute on function public.res_area_place_names(geography) to service_role;

-- ── 2. THE PUBLIC RECORD ───────────────────────────────────────────────────

create table if not exists public.res_area_broadcasts (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.res_org_units(id) on delete cascade,
  sender_id uuid not null,
  -- What was targeted, kept in both forms: the geometry for the record, and
  -- a human label because "Ward 12" is what a resident needs to read.
  target geography(Geometry, 4326) not null,
  target_kind text not null check (target_kind in ('jurisdiction', 'radius')),
  jurisdiction_id uuid references public.res_jurisdictions(id) on delete set null,
  target_label text not null,
  radius_metres double precision,
  priority text not null default 'important'
    check (priority in ('normal', 'important', 'urgent', 'critical')),
  category text,
  title text not null,
  body text not null,
  -- Counted at send time and frozen. The audience moves as residents pin and
  -- unpin; what matters for the record is how many this actually went to.
  recipient_count integer not null default 0,
  pinned_count integer not null default 0,
  text_matched_count integer not null default 0,
  sent_at timestamptz not null default now(),
  expires_at timestamptz
);

create index if not exists res_area_broadcasts_unit_idx
  on public.res_area_broadcasts (unit_id, sent_at desc);
create index if not exists res_area_broadcasts_target_idx
  on public.res_area_broadcasts using gist (target);

alter table public.res_area_broadcasts enable row level security;

-- Deliberately world-readable to signed-in users. See the header: the record
-- of who broadcast to whom is the accountability half of this feature, so it
-- is not scoped to recipients.
drop policy if exists res_area_broadcasts_select on public.res_area_broadcasts;
create policy res_area_broadcasts_select on public.res_area_broadcasts
  for select to authenticated using (true);

-- No insert/update/delete policy at all: rows appear only through the send
-- RPC below, and nothing may edit or erase what was said afterwards.

-- Two separate facts, both learned the hard way on the live project:
--   1. A policy alone grants nothing. Without a GRANT the "permanent public
--      record" is readable by no one.
--   2. Supabase's default privileges hand anon and authenticated ALL on every
--      newly created table — including UPDATE and DELETE — so the grants this
--      file wants must be stated by REVOKING first and granting back. Adding
--      only the grant leaves the rest quietly open.
-- SELECT only, deliberately: the absent INSERT/UPDATE/DELETE grants are the
-- second lock behind the absent RLS policies, so an official cannot soften or
-- erase what they broadcast even if a policy is ever loosened by mistake.
revoke all on public.res_area_broadcasts from anon, authenticated;
grant select on public.res_area_broadcasts to authenticated;

create table if not exists public.res_area_broadcast_receipts (
  broadcast_id uuid not null references public.res_area_broadcasts(id) on delete cascade,
  user_id uuid not null,
  seen_at timestamptz,
  acknowledged_at timestamptz,
  primary key (broadcast_id, user_id)
);

alter table public.res_area_broadcast_receipts enable row level security;

drop policy if exists res_area_receipts_select on public.res_area_broadcast_receipts;
create policy res_area_receipts_select on public.res_area_broadcast_receipts
  for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists res_area_receipts_insert on public.res_area_broadcast_receipts;
create policy res_area_receipts_insert on public.res_area_broadcast_receipts
  for insert to authenticated with check (user_id = (select auth.uid()));

drop policy if exists res_area_receipts_update on public.res_area_broadcast_receipts;
create policy res_area_receipts_update on public.res_area_broadcast_receipts
  for update to authenticated using (user_id = (select auth.uid()));

revoke all on public.res_area_broadcast_receipts from anon, authenticated;
grant select, insert, update on public.res_area_broadcast_receipts to authenticated;

-- ── 3. DAILY CAPS BY LEVEL ─────────────────────────────────────────────────
--
-- The strategy's shape: a councillor may send more, smaller messages; a
-- premier fewer, larger ones. Reach and frequency trade off against each
-- other, so that "everyone in the province" is never routine.
create or replace function public.res_area_daily_cap(p_level text)
returns integer
language sql
immutable
set search_path = public
as $$
  select case p_level
    when 'ward' then 10
    when 'service_area' then 10
    when 'municipality' then 6
    when 'district' then 4
    when 'province' then 3
    when 'national' then 2
    else 4
  end;
$$;

revoke all on function public.res_area_daily_cap(text) from public, anon;
grant execute on function public.res_area_daily_cap(text) to authenticated, service_role;

-- ── 4. THE SEND ────────────────────────────────────────────────────────────

create or replace function public.res_send_area_broadcast(
  p_unit uuid,
  p_title text,
  p_body text,
  p_priority text default 'important',
  p_category text default null,
  p_jurisdiction uuid default null,
  p_lat double precision default null,
  p_lon double precision default null,
  p_metres double precision default null,
  p_expires_at timestamptz default null
)
returns public.res_area_broadcasts
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_target geography;
  v_kind text;
  v_label text;
  v_level text;
  v_reason text;
  v_unit_name text;
  v_verified boolean;
  v_places record;
  v_sent_today integer;
  v_cap integer;
  v_row public.res_area_broadcasts;
begin
  if v_uid is null then raise exception 'not signed in'; end if;
  if coalesce(trim(p_title), '') = '' or coalesce(trim(p_body), '') = '' then
    raise exception 'empty_broadcast';
  end if;
  if not public.res_user_is_sender_of_or_above(p_unit, v_uid) then
    raise exception 'not_a_sender_for_this_unit';
  end if;

  select name, verified into v_unit_name, v_verified from res_org_units where id = p_unit;
  -- Redundant with the containment gate below, which also checks verified —
  -- stated separately because impersonating an official is the single largest
  -- risk in this feature and it deserves to fail on its own line.
  if not coalesce(v_verified, false) then
    raise exception 'not_verified';
  end if;

  -- Build the target server-side from a specification, never from a shape
  -- handed over by the caller.
  if p_jurisdiction is not null then
    select boundary, name, level into v_target, v_label, v_level
    from res_jurisdictions where id = p_jurisdiction;
    if v_target is null then raise exception 'unknown_jurisdiction'; end if;
    v_kind := 'jurisdiction';
  elsif p_lat is not null and p_lon is not null then
    v_target := public.res_radius_target(p_lat, p_lon, coalesce(p_metres, 3000));
    v_kind := 'radius';
    v_label := 'Within ' || round(least(greatest(coalesce(p_metres, 3000), 50), 50000))::text || 'm of a point';
    -- A radius is rated at the level of the area it was drawn inside, so a
    -- 50km circle cannot be used to dodge a province's daily cap.
    select j.level into v_level
    from res_org_units u join res_jurisdictions j on j.id = u.jurisdiction_id
    where u.id = p_unit;
  else
    raise exception 'no_target';
  end if;

  -- The Phase B gate. Geometry decides, not rank.
  v_reason := public.res_area_broadcast_block_reason(p_unit, v_target);
  if v_reason is not null then
    raise exception 'area_blocked: %', v_reason;
  end if;

  -- Two limiters: the generic burst limit, then the per-level daily cap.
  -- Billing (Phase F). A 'critical' notice is NEVER gated: an evacuation
  -- must send whether or not anyone paid. Everything below it needs a live
  -- licence — probation, active or exempt. Defined in
  -- theresident_area_billing_schema.sql; if that file is not applied, the
  -- undefined_function branch leaves sending open, which is the correct
  -- failure direction for a feature that already worked before billing.
  if p_priority <> 'critical' then
    begin
      perform public.res_ensure_area_probation(p_unit);
      -- coalesce is load-bearing: res_area_billing_state is sender-scoped, so
      -- it returns NO ROWS rather than false if the scoping ever fails to
      -- match. `not (select ...)` on an empty result is NULL, and `if NULL`
      -- does not fire — which would fail OPEN. Default to refusing instead.
      if not coalesce((select allows_routine from public.res_area_billing_state(p_unit)), false) then
        raise exception 'area_licence_required: this office has no active area-messaging licence';
      end if;
    exception
      when undefined_function then null;
    end;
  end if;

  perform public.res_check_rate_limit('area_broadcast', 5, 3600);

  v_cap := public.res_area_daily_cap(v_level);
  select count(*) into v_sent_today
  from res_area_broadcasts
  where unit_id = p_unit and sent_at > now() - interval '24 hours';
  if v_sent_today >= v_cap then
    raise exception 'daily_cap_reached: % per day at this level', v_cap;
  end if;

  select * into v_places from public.res_area_place_names(v_target);

  insert into res_area_broadcasts (
    unit_id, sender_id, target, target_kind, jurisdiction_id, target_label,
    radius_metres, priority, category, title, body, expires_at
  ) values (
    p_unit, v_uid, v_target, v_kind, p_jurisdiction, v_label,
    case when v_kind = 'radius' then least(greatest(coalesce(p_metres, 3000), 50), 50000) end,
    p_priority, p_category, trim(p_title), trim(p_body), p_expires_at
  ) returning * into v_row;

  -- Resolve once, into a temp set: the counts written to the record and the
  -- notifications delivered must be the same people, not two queries that
  -- could disagree if someone pins a home area mid-send.
  create temp table if not exists _area_audience (user_id uuid, matched_by text) on commit drop;
  delete from _area_audience;
  insert into _area_audience
  select a.user_id, a.matched_by
  from public.res_resolve_area_audience(
    v_target, p_priority, p_category, v_places.suburbs, v_places.cities
  ) a
  where a.user_id <> v_uid;

  select count(*) filter (where matched_by = 'home_area'),
         count(*) filter (where matched_by = 'suburb_text'),
         count(*)
    into v_row.pinned_count, v_row.text_matched_count, v_row.recipient_count
  from _area_audience;

  -- A runaway fan-out is indistinguishable from an attack on the shared rail.
  -- Refuse loudly; the whole send rolls back, record included.
  if v_row.recipient_count > 20000 then
    raise exception 'audience_too_large: % recipients — contact support to send at this scale', v_row.recipient_count;
  end if;

  update res_area_broadcasts
     set pinned_count = v_row.pinned_count,
         text_matched_count = v_row.text_matched_count,
         recipient_count = v_row.recipient_count
   where id = v_row.id;

  -- 'normal' stays in the feed and off the bell, matching the follow-based
  -- broadcasts. Escalation has to be deliberate.
  if p_priority <> 'normal' then
    insert into notifications (recipient_id, actor_id, type, title, body, message, data, action_url, read, is_read, expires_at)
    select
      a.user_id,
      v_uid,
      'res_area_broadcast',
      coalesce(v_unit_name, 'Notice') || ': ' || trim(p_title),
      trim(p_body),
      trim(p_body),
      jsonb_build_object(
        'priority', p_priority,
        'requires_ack', p_priority = 'critical',
        'area_broadcast_id', v_row.id,
        'unit_id', p_unit,
        'category', p_category,
        'target_label', v_label,
        'matched_by', a.matched_by
      ),
      '/dashboard/community?tab=notices&area=' || v_row.id::text,
      false,
      false,
      p_expires_at
    from _area_audience a;

    -- Mirror it out to devices. Defined in
    -- theresident_web_push_dispatch_schema.sql and deliberately incapable of
    -- failing the send: if push is not configured it returns 0 and the notice
    -- is still in the rail. Apply that file after this one.
    begin
      perform public.res_push_area_broadcast(v_row.id);
    exception when undefined_function then
      -- Push dispatch not installed yet. In-app delivery already happened.
      null;
    end;
  end if;

  return v_row;
end;
$$;

revoke all on function public.res_send_area_broadcast(uuid, text, text, text, text, uuid, double precision, double precision, double precision, timestamptz) from public, anon;
grant execute on function public.res_send_area_broadcast(uuid, text, text, text, text, uuid, double precision, double precision, double precision, timestamptz) to authenticated, service_role;

-- ── 5. ACKNOWLEDGING ───────────────────────────────────────────────────────

create or replace function public.res_ack_area_broadcast(p_broadcast uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  insert into res_area_broadcast_receipts (broadcast_id, user_id, seen_at, acknowledged_at)
  values (p_broadcast, auth.uid(), now(), now())
  on conflict (broadcast_id, user_id)
  do update set acknowledged_at = coalesce(res_area_broadcast_receipts.acknowledged_at, now()),
                seen_at = coalesce(res_area_broadcast_receipts.seen_at, now());
end;
$$;

revoke all on function public.res_ack_area_broadcast(uuid) from public, anon;
grant execute on function public.res_ack_area_broadcast(uuid) to authenticated, service_role;

-- ── 6. THE TRACK RECORD ────────────────────────────────────────────────────
--
-- What an official's send history looks like to anyone who cares to look.
-- Geometry is deliberately not returned — the label is what a resident reads,
-- and shipping polygons to every profile view is pointless weight.
create or replace function public.res_area_broadcast_history(p_unit uuid default null)
returns table (
  id uuid,
  unit_id uuid,
  unit_name text,
  target_label text,
  priority text,
  category text,
  title text,
  body text,
  recipient_count integer,
  sent_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select b.id, b.unit_id, u.name, b.target_label, b.priority, b.category,
         b.title, b.body, b.recipient_count, b.sent_at
  from res_area_broadcasts b
  join res_org_units u on u.id = b.unit_id
  where p_unit is null or b.unit_id = p_unit
  order by b.sent_at desc
  limit 100;
$$;

revoke all on function public.res_area_broadcast_history(uuid) from public, anon;
grant execute on function public.res_area_broadcast_history(uuid) to authenticated, service_role;

-- What a resident received. Self-scoped: reads the caller's own notifications
-- rail and nobody else's.
create or replace function public.res_my_area_notices()
returns table (
  id uuid,
  unit_name text,
  target_label text,
  priority text,
  category text,
  title text,
  body text,
  sent_at timestamptz,
  acknowledged_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select b.id, u.name, b.target_label, b.priority, b.category, b.title, b.body,
         b.sent_at, r.acknowledged_at
  from notifications n
  join res_area_broadcasts b on b.id = (n.data ->> 'area_broadcast_id')::uuid
  join res_org_units u on u.id = b.unit_id
  left join res_area_broadcast_receipts r
    on r.broadcast_id = b.id and r.user_id = auth.uid()
  where n.recipient_id = auth.uid()
    and n.type = 'res_area_broadcast'
  order by b.sent_at desc
  limit 100;
$$;

revoke all on function public.res_my_area_notices() from public, anon;
grant execute on function public.res_my_area_notices() to authenticated, service_role;


-- ==========================================================================
-- 18. theresident_web_push_dispatch_schema.sql
-- ==========================================================================

-- theresident_web_push_dispatch_schema.sql
--
-- Phase E of docs/OFFICIAL-BROADCAST-STRATEGY.md: make an urgent area notice
-- actually reach a phone with the app closed.
--
-- THE GAP THIS CLOSES. Everything through Phase D lands in the notifications
-- rail, which the app reads when it is opened. For a bin-day reminder that is
-- fine. For "gas leak on Main Road, evacuate now" it is close to not
-- delivering at all. This calls the web-push-send edge function so the
-- resident's device wakes up.
--
-- IT MUST NEVER BLOCK THE SEND. Push is a mirror of a notification that has
-- already been written, not the delivery itself. If the VAPID secrets are
-- missing, the key is wrong, or the push service is down, the broadcast still
-- succeeded and the notice is still in the rail — so every failure here is
-- swallowed deliberately and the send commits regardless. The alternative,
-- rolling back a delivered evacuation notice because a push gateway
-- misbehaved, is plainly worse.
--
-- WHY ONLY urgent AND critical. Anything quieter does not justify vibrating a
-- phone; that is the same line res_fanout_broadcast already draws for the bell.
--
-- SETUP REQUIRED BEFORE THIS DOES ANYTHING (see the panel in the profile page
-- and the README section):
--   1. Supabase Dashboard → Edge Functions → Secrets:
--        VAPID_PRIVATE_KEY, VAPID_SUBJECT
--   2. Vault → new secret named 'service_role_key' holding the project's
--      service role key, so this function can authenticate to its own edge
--      function. Vault is used rather than a hardcoded value because a service
--      role key in a schema file is a service role key in git.
--
-- Paste into the Supabase SQL editor. Additive only.

create or replace function public.res_push_area_broadcast(p_broadcast uuid)
returns integer
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_row res_area_broadcasts;
  v_unit_name text;
  v_recipients uuid[];
  v_key text;
  v_url text;
begin
  select * into v_row from res_area_broadcasts where id = p_broadcast;
  if v_row.id is null then return 0; end if;
  if v_row.priority not in ('urgent', 'critical') then return 0; end if;

  select name into v_unit_name from res_org_units where id = v_row.unit_id;

  -- The audience is read back from the notifications already written, not
  -- re-resolved. Re-resolving could reach someone who was not notified, which
  -- would mean a push with nothing behind it in the app.
  select array_agg(n.recipient_id) into v_recipients
  from notifications n
  where n.type = 'res_area_broadcast'
    and (n.data ->> 'area_broadcast_id')::uuid = p_broadcast;

  if v_recipients is null or array_length(v_recipients, 1) is null then return 0; end if;

  begin
    select decrypted_secret into v_key
    from vault.decrypted_secrets where name = 'service_role_key';
  exception when others then
    -- Vault not set up yet. Not an error worth failing a broadcast over.
    return 0;
  end;
  if v_key is null then return 0; end if;

  v_url := current_setting('app.settings.supabase_url', true);
  if v_url is null then
    select 'https://' || current_setting('request.headers', true)::json ->> 'host' into v_url;
  end if;
  -- Fall back to the project's known function host if neither is set.
  if v_url is null or v_url = 'https://' then
    v_url := 'https://feevvddvrjmfbhffccbf.supabase.co';
  end if;

  perform net.http_post(
    url := v_url || '/functions/v1/web-push-send',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_key
    ),
    body := jsonb_build_object(
      'userIds', to_jsonb(v_recipients),
      'title', coalesce(v_unit_name, 'Notice') || ': ' || v_row.title,
      'body', v_row.body,
      'url', '/dashboard/community?tab=notices&area=' || v_row.id::text,
      -- Collapse repeats of the same notice rather than stacking them.
      'tag', 'area-' || v_row.id::text,
      -- An emergency stays on screen until the resident deals with it, the
      -- same rule the in-app urgent banner follows.
      'requireInteraction', v_row.priority = 'critical'
    )
  );

  return array_length(v_recipients, 1);
exception when others then
  -- Deliberate catch-all. See the header: a push failure must never undo a
  -- broadcast that has already been delivered in-app.
  return 0;
end;
$$;

revoke all on function public.res_push_area_broadcast(uuid) from public, anon, authenticated;
grant execute on function public.res_push_area_broadcast(uuid) to service_role;


-- ==========================================================================
-- 19. theresident_area_billing_schema.sql
-- ==========================================================================

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


-- ==========================================================================
-- 20. theresident_official_verification_schema.sql
-- ==========================================================================

-- theresident_official_verification_schema.sql
--
-- The on-ramp for the whole officials feature (backlog A1 and A4).
--
-- WHAT WAS WRONG. res_org_units.verified and .jurisdiction_id are the two
-- fields that decide whether an office can reach an area, and neither had any
-- way to be set: no RPC, no UI, no script. Six phases of work — boundaries,
-- audience resolution, targeting, sending, push, billing — sat behind a door
-- with no handle. res_org_units had zero rows.
--
-- THE SHAPE. An official asks; a platform admin decides. Nothing here lets a
-- unit verify or bind itself, because "authority is a polygon" only holds if
-- somebody outside the office draws it. Approval does both things at once —
-- verified AND bound — because either alone is useless and the pair is what
-- res_targetable_jurisdictions actually needs.
--
-- WHY A NEW ADMIN TABLE. The only existing authority model is per-community
-- (res_community_members.role in admin/founder), which is scoped to one
-- community and cannot express "may verify a municipality". `is_admin` exists
-- but is Gruvs-owned, so per CONTRACT.md §2 it is not mine to reuse for this.
--
-- EVERY DECISION IS RECORDED. Verifying an office is the single most
-- consequential act in this app — it is what lets someone message people who
-- never opted in. res_org_unit_audit keeps who did it, when, and why, and
-- nothing can delete a row from it.
--
-- Paste into the Supabase SQL editor. Additive only.

-- ── 1. WHO MAY DECIDE ──────────────────────────────────────────────────────

create table if not exists public.res_platform_admins (
  user_id uuid primary key,
  note text,
  added_at timestamptz not null default now()
);

alter table public.res_platform_admins enable row level security;

-- An admin may see the admin list; nobody else may learn who the admins are.
drop policy if exists res_platform_admins_select on public.res_platform_admins;
create policy res_platform_admins_select on public.res_platform_admins
  for select to authenticated
  using (exists (select 1 from res_platform_admins a where a.user_id = (select auth.uid())));

-- No insert/update/delete policy: admins are added by service_role only, so
-- an admin cannot appoint another admin without going through the database.
revoke all on public.res_platform_admins from anon, authenticated;
grant select on public.res_platform_admins to authenticated;

create or replace function public.res_is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from res_platform_admins where user_id = auth.uid());
$$;

revoke all on function public.res_is_platform_admin() from public, anon;
grant execute on function public.res_is_platform_admin() to authenticated, service_role;

-- ── 2. THE RECORD OF EVERY DECISION ────────────────────────────────────────

create table if not exists public.res_org_unit_audit (
  id bigint generated always as identity primary key,
  unit_id uuid not null references public.res_org_units(id) on delete cascade,
  action text not null check (action in
    ('verification_requested','verified','unverified','jurisdiction_bound','jurisdiction_cleared','rejected')),
  actor_id uuid,
  detail text,
  at timestamptz not null default now()
);

create index if not exists res_org_unit_audit_unit_idx on public.res_org_unit_audit (unit_id, at desc);

alter table public.res_org_unit_audit enable row level security;

-- Readable by the office's own senders and by admins. Not world-readable: a
-- rejection reason may say something about a person.
drop policy if exists res_org_unit_audit_select on public.res_org_unit_audit;
create policy res_org_unit_audit_select on public.res_org_unit_audit
  for select to authenticated
  using (
    public.res_is_platform_admin()
    or public.res_user_is_sender_of_or_above(unit_id, (select auth.uid()))
  );

-- Append-only, and only through the functions below.
revoke all on public.res_org_unit_audit from anon, authenticated;
grant select on public.res_org_unit_audit to authenticated;

-- ── 3. AN OFFICIAL ASKS ────────────────────────────────────────────────────

create table if not exists public.res_unit_verification_requests (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.res_org_units(id) on delete cascade,
  requested_by uuid not null,
  -- What the applicant says they are, and how to check it. Deliberately free
  -- text plus a link rather than a rigid schema: the proof a ward councillor
  -- has is not the proof a library has.
  official_title text,
  evidence_url text,
  contact_email text,
  note text,
  -- The area they say they are responsible for. A suggestion, not a grant —
  -- the admin picks what is actually bound.
  requested_jurisdiction_id uuid references public.res_jurisdictions(id) on delete set null,
  status text not null default 'pending' check (status in ('pending','approved','rejected','withdrawn')),
  decided_by uuid,
  decided_at timestamptz,
  decision_note text,
  created_at timestamptz not null default now()
);

create index if not exists res_unit_verif_pending_idx
  on public.res_unit_verification_requests (status, created_at);
-- One live application per office; a decided one can be superseded.
create unique index if not exists res_unit_verif_one_pending
  on public.res_unit_verification_requests (unit_id) where status = 'pending';

alter table public.res_unit_verification_requests enable row level security;

drop policy if exists res_unit_verif_select on public.res_unit_verification_requests;
create policy res_unit_verif_select on public.res_unit_verification_requests
  for select to authenticated
  using (
    public.res_is_platform_admin()
    or public.res_user_is_sender_of_or_above(unit_id, (select auth.uid()))
  );

revoke all on public.res_unit_verification_requests from anon, authenticated;
grant select on public.res_unit_verification_requests to authenticated;

create or replace function public.res_request_unit_verification(
  p_unit uuid,
  p_official_title text default null,
  p_evidence_url text default null,
  p_contact_email text default null,
  p_note text default null,
  p_jurisdiction uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_id uuid;
begin
  if v_uid is null then raise exception 'not signed in'; end if;
  if not public.res_user_is_sender_of_or_above(p_unit, v_uid) then
    raise exception 'not_a_sender_for_this_unit';
  end if;
  if exists (select 1 from res_org_units where id = p_unit and verified = true) then
    raise exception 'already_verified';
  end if;

  -- Applying is cheap for the applicant and expensive for whoever reviews it.
  perform public.res_check_rate_limit('verification_request', 5, 86400);

  insert into res_unit_verification_requests (
    unit_id, requested_by, official_title, evidence_url, contact_email, note,
    requested_jurisdiction_id
  ) values (
    p_unit, v_uid, nullif(trim(p_official_title), ''), nullif(trim(p_evidence_url), ''),
    nullif(trim(p_contact_email), ''), nullif(trim(p_note), ''), p_jurisdiction
  )
  on conflict (unit_id) where status = 'pending'
  do update set
    official_title = excluded.official_title,
    evidence_url = excluded.evidence_url,
    contact_email = excluded.contact_email,
    note = excluded.note,
    requested_jurisdiction_id = excluded.requested_jurisdiction_id,
    created_at = now()
  returning id into v_id;

  insert into res_org_unit_audit (unit_id, action, actor_id, detail)
  values (p_unit, 'verification_requested', v_uid, nullif(trim(p_official_title), ''));

  return v_id;
end;
$$;

revoke all on function public.res_request_unit_verification(uuid, text, text, text, text, uuid) from public, anon;
grant execute on function public.res_request_unit_verification(uuid, text, text, text, text, uuid) to authenticated, service_role;

-- An applicant may withdraw; they may never approve.
create or replace function public.res_withdraw_unit_verification(p_unit uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if not public.res_user_is_sender_of_or_above(p_unit, auth.uid()) then
    raise exception 'not_a_sender_for_this_unit';
  end if;
  update res_unit_verification_requests
     set status = 'withdrawn', decided_at = now(), decided_by = auth.uid()
   where unit_id = p_unit and status = 'pending';
end;
$$;

revoke all on function public.res_withdraw_unit_verification(uuid) from public, anon;
grant execute on function public.res_withdraw_unit_verification(uuid) to authenticated, service_role;

-- ── 4. AN ADMIN DECIDES ────────────────────────────────────────────────────
--
-- Approval sets verified AND binds the jurisdiction in one statement, because
-- either alone leaves the office unable to do anything: res_targetable_
-- jurisdictions requires both, and a half-approved unit looks approved to its
-- owner while silently reaching nobody.

create or replace function public.res_approve_unit_verification(
  p_unit uuid,
  p_jurisdiction uuid,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_level text;
begin
  if v_uid is null then raise exception 'not signed in'; end if;
  if not public.res_is_platform_admin() then raise exception 'not_a_platform_admin'; end if;

  select level into v_level from res_jurisdictions where id = p_jurisdiction;
  if v_level is null then raise exception 'unknown_jurisdiction'; end if;

  update res_org_units
     set verified = true, jurisdiction_id = p_jurisdiction
   where id = p_unit;
  if not found then raise exception 'unknown_unit'; end if;

  update res_unit_verification_requests
     set status = 'approved', decided_by = v_uid, decided_at = now(),
         decision_note = nullif(trim(p_note), '')
   where unit_id = p_unit and status = 'pending';

  insert into res_org_unit_audit (unit_id, action, actor_id, detail)
  values (p_unit, 'verified', v_uid, nullif(trim(p_note), '')),
         (p_unit, 'jurisdiction_bound', v_uid, v_level);

  -- The six-month clock starts here. The trigger on res_org_units also does
  -- this; calling it directly means approval does not depend on a trigger
  -- staying attached.
  begin
    perform public.res_ensure_area_probation(p_unit);
  exception when undefined_function then null;
  end;
end;
$$;

-- Granted to authenticated on purpose: the admin uses this from the app, and
-- the function gates on res_is_platform_admin() itself. service_role-only
-- would mean no admin could ever call it without the SQL editor, which is
-- the exact problem this file exists to fix.
revoke all on function public.res_approve_unit_verification(uuid, uuid, text) from public, anon;
grant execute on function public.res_approve_unit_verification(uuid, uuid, text) to authenticated, service_role;

create or replace function public.res_reject_unit_verification(p_unit uuid, p_note text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'not signed in'; end if;
  if not public.res_is_platform_admin() then raise exception 'not_a_platform_admin'; end if;
  -- A rejection the applicant cannot understand is a rejection they will
  -- simply resubmit.
  if coalesce(trim(p_note), '') = '' then raise exception 'rejection_needs_a_reason'; end if;

  update res_unit_verification_requests
     set status = 'rejected', decided_by = v_uid, decided_at = now(), decision_note = trim(p_note)
   where unit_id = p_unit and status = 'pending';

  insert into res_org_unit_audit (unit_id, action, actor_id, detail)
  values (p_unit, 'rejected', v_uid, trim(p_note));
end;
$$;

-- Granted to authenticated on purpose: the admin uses this from the app, and
-- the function gates on res_is_platform_admin() itself. service_role-only
-- would mean no admin could ever call it without the SQL editor, which is
-- the exact problem this file exists to fix.
revoke all on function public.res_reject_unit_verification(uuid, text) from public, anon;
grant execute on function public.res_reject_unit_verification(uuid, text) to authenticated, service_role;

-- Verification must be revocable. An office that misuses the channel, or an
-- official who leaves the post, has to be stoppable without deleting the unit
-- and losing its public broadcast record.
create or replace function public.res_revoke_unit_verification(p_unit uuid, p_note text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'not signed in'; end if;
  if not public.res_is_platform_admin() then raise exception 'not_a_platform_admin'; end if;
  if coalesce(trim(p_note), '') = '' then raise exception 'revocation_needs_a_reason'; end if;

  update res_org_units set verified = false where id = p_unit;
  if not found then raise exception 'unknown_unit'; end if;

  insert into res_org_unit_audit (unit_id, action, actor_id, detail)
  values (p_unit, 'unverified', v_uid, trim(p_note));
end;
$$;

-- Granted to authenticated on purpose: the admin uses this from the app, and
-- the function gates on res_is_platform_admin() itself. service_role-only
-- would mean no admin could ever call it without the SQL editor, which is
-- the exact problem this file exists to fix.
revoke all on function public.res_revoke_unit_verification(uuid, text) from public, anon;
grant execute on function public.res_revoke_unit_verification(uuid, text) to authenticated, service_role;

-- ── 5. WHAT AN ADMIN LOOKS AT ──────────────────────────────────────────────

create or replace function public.res_pending_verification_requests()
returns table (
  request_id uuid,
  unit_id uuid,
  unit_name text,
  unit_tier text,
  official_title text,
  evidence_url text,
  contact_email text,
  note text,
  requested_jurisdiction_id uuid,
  requested_jurisdiction_name text,
  requested_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select r.id, r.unit_id, u.name, u.tier, r.official_title, r.evidence_url,
         r.contact_email, r.note, r.requested_jurisdiction_id, j.name, r.created_at
  from res_unit_verification_requests r
  join res_org_units u on u.id = r.unit_id
  left join res_jurisdictions j on j.id = r.requested_jurisdiction_id
  where r.status = 'pending' and public.res_is_platform_admin()
  order by r.created_at;
$$;

revoke all on function public.res_pending_verification_requests() from public, anon;
grant execute on function public.res_pending_verification_requests() to authenticated, service_role;

-- Picking the area to bind. Text search over 267 areas, narrowest first, so an
-- admin types "Tshwane" rather than pasting a uuid.
create or replace function public.res_search_jurisdictions(p_query text, p_limit integer default 20)
returns table (id uuid, name text, level text, external_ref text, parent_name text)
language sql
stable
security definer
set search_path = public
as $$
  select j.id, j.name, j.level, j.external_ref, p.name
  from res_jurisdictions j
  left join res_jurisdictions p on p.id = j.parent_id
  where public.res_is_platform_admin()
    and (coalesce(trim(p_query), '') = '' or j.name ilike '%' || trim(p_query) || '%')
  order by
    case j.level when 'ward' then 1 when 'service_area' then 2 when 'municipality' then 3
                 when 'district' then 4 when 'province' then 5 else 6 end,
    j.name
  limit greatest(1, least(coalesce(p_limit, 20), 100));
$$;

revoke all on function public.res_search_jurisdictions(text, integer) from public, anon;
grant execute on function public.res_search_jurisdictions(text, integer) to authenticated, service_role;

-- What an applicant sees about their own application.
create or replace function public.res_my_unit_verification(p_unit uuid)
returns table (status text, decision_note text, decided_at timestamptz, requested_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select r.status, r.decision_note, r.decided_at, r.created_at
  from res_unit_verification_requests r
  where r.unit_id = p_unit
    and public.res_user_is_sender_of_or_above(p_unit, auth.uid())
  order by r.created_at desc
  limit 1;
$$;

revoke all on function public.res_my_unit_verification(uuid) from public, anon;
grant execute on function public.res_my_unit_verification(uuid) to authenticated, service_role;


-- ==========================================================================
-- 21. theresident_org_unit_column_lockdown.sql
-- ==========================================================================

-- theresident_org_unit_column_lockdown.sql
--
-- CLOSES A PRIVILEGE-ESCALATION HOLE.
--
-- res_org_units_update lets any sender of a unit update their own row, and
-- res_org_units_insert checks only that owner_user_id is the caller. Neither
-- says anything about WHICH columns — RLS has no column granularity. So until
-- this file, any signed-in user could run:
--
--   insert into res_org_units (name, tier, owner_user_id, verified, jurisdiction_id)
--   values ('Office of the President', 'municipality', auth.uid(), true, '<national id>');
--
-- and immediately be a verified national broadcaster: verified = true clears
-- the urgent/critical gate, and jurisdiction_id set to the national boundary
-- makes ST_Covers succeed for every area in the country. They could then send
-- a 'critical' notice — which bypasses muting AND billing by design — to every
-- resident who has set a home area.
--
-- This predates the officials work: before boundaries existed, verified and
-- jurisdiction_id did almost nothing. Phases B through F are what turned a
-- latent flaw into a live one, and the verification workflow added alongside
-- this file is worthless while the table itself remains writable.
--
-- THE FIX. Postgres cannot express "this policy covers these columns", but it
-- can express column-level GRANTs. Table-wide insert/update is revoked and
-- granted back column by column, leaving `verified` and `jurisdiction_id`
-- writable only by the security-definer functions in
-- theresident_official_verification_schema.sql, which run as the owner and
-- check res_is_platform_admin() first.
--
-- Everything an office legitimately edits about itself — its name, contact
-- details, description, sector — is untouched.
--
-- Paste into the Supabase SQL editor. Additive only.

revoke insert, update on public.res_org_units from authenticated;

-- Stated explicitly rather than relied on: the directory is meant to be
-- readable by every signed-in user (the SELECT policy is `using (true)`), and
-- a file that revokes should say what it leaves behind.
grant select on public.res_org_units to authenticated;

-- Everything except verified and jurisdiction_id. Listed explicitly rather
-- than computed, so adding a column later is a deliberate decision about
-- whether an office may set it itself.
grant insert (id, parent_id, name, tier, owner_user_id, created_at, sector,
              contact_email, contact_phone, suburb, city, description)
  on public.res_org_units to authenticated;

grant update (parent_id, name, tier, sector,
              contact_email, contact_phone, suburb, city, description)
  on public.res_org_units to authenticated;

-- owner_user_id is deliberately absent from the UPDATE list: handing an office
-- to someone else is a transfer, not an edit, and should go through a function
-- that records it. Insert still sets it, and the policy pins it to the caller.


-- ==========================================================================
-- 22. theresident_traffic_reports_policy_cleanup.sql
-- ==========================================================================

-- theresident_traffic_reports_policy_cleanup.sql
--
-- Backlog J3. res_traffic_reports carried five policies where three would do,
-- and the usual over-wide grants underneath them.
--
-- THE DUPLICATES. Two pairs were exact:
--   INSERT: "Auth Users Insert Traffic Reports" and "traffic_insert_policy",
--           identical checks — auth.uid() = reporter_id.
--   SELECT: "Public Read Traffic Reports" and "traffic_read_policy",
--           both `using (true)`.
-- Both of each pair is evaluated on every row for every query, and overlapping
-- permissive rules are how a policy quietly ends up meaning something nobody
-- intended: change one, and the other still permits what you thought you had
-- just stopped. The older, prose-named ones are dropped and the `traffic_*`
-- ones kept, because those name their role explicitly rather than falling back
-- to `public` (which is every role, including anon).
--
-- THE GRANTS. anon held INSERT and DELETE. RLS refused both in practice —
-- `auth.uid() = reporter_id` is NULL for a signed-out caller, and NULL is not
-- true — but that is the policy doing the work alone, with no second lock.
-- This is the fifth instance of the same root cause in this project: Supabase
-- grants ALL on a new table to anon and authenticated by default, so a schema
-- that grants without revoking first leaves the rest open.
--
-- Public READ is deliberate and kept: traffic reports are what makes the map
-- useful to somebody who has not signed up yet.
--
-- Paste into the Supabase SQL editor.

do $$
begin
  -- Guarded: this file is applied to the live project and to the local
  -- sql-tests harness, which does not build this table. Missing there means
  -- "not installed", not an error worth aborting over.
  if to_regclass('public.res_traffic_reports') is null then return; end if;

  execute 'drop policy if exists "Auth Users Insert Traffic Reports" on public.res_traffic_reports';
  execute 'drop policy if exists "Public Read Traffic Reports" on public.res_traffic_reports';
  execute 'drop policy if exists "Users Delete Own Traffic Reports" on public.res_traffic_reports';
  execute 'drop policy if exists traffic_delete_policy on public.res_traffic_reports';
  -- One statement. This was previously split across three `execute` calls,
  -- which sends three separate incomplete statements to the server and fails
  -- with a syntax error at "for" — the file has never been re-runnable.
  execute 'create policy traffic_delete_policy on public.res_traffic_reports'
       || ' for delete to authenticated'
       || ' using ((select auth.uid()) = reporter_id)';
  execute 'revoke all on public.res_traffic_reports from anon, authenticated';
  execute 'grant select on public.res_traffic_reports to anon';
  execute 'grant select, insert, delete on public.res_traffic_reports to authenticated';
end $$;


-- ==========================================================================
-- 23. theresident_foreign_key_indexes.sql
-- ==========================================================================

-- theresident_foreign_key_indexes.sql
--
-- Backlog J1: thirty-three foreign keys on res_ tables had no index that could
-- serve them.
--
-- WHY IT MATTERS MORE THAN IT LOOKS. An unindexed FK costs twice. Every join
-- through it is a sequential scan, which is invisible at two rows and
-- punishing at two hundred thousand. And every DELETE or UPDATE on the
-- REFERENCED table has to scan the whole referencing table to enforce the
-- constraint — so deleting one account walks res_gossip_posts, res_reviews,
-- res_listings and the rest end to end, which is exactly the operation that
-- must not become slow.
--
-- Two of these are from this week's own work (res_area_broadcasts and
-- res_unit_verification_requests), which is a fair illustration of how easily
-- it happens: an index is not part of writing a foreign key, so it only
-- appears if someone goes looking.
--
-- Indexes are named <table>_<column>_idx and created IF NOT EXISTS, so this
-- file is safe to re-run and safe to apply out of order. Each creation is
-- guarded: this file is applied both to the live project and to the local
-- sql-tests harness, which builds only a subset of the schema, and a missing
-- table there means "not installed here" rather than an error worth aborting
-- the remaining thirty-two indexes over.
--
-- Paste into the Supabase SQL editor. Additive only, and non-blocking in
-- practice at current row counts.

do $$
declare
  v record;
begin
  for v in select * from (values
    ('res_alert_responders', 'responder_id', 'res_alert_responders_responder_id_idx'),
    ('res_area_broadcasts', 'jurisdiction_id', 'res_area_broadcasts_jurisdiction_id_idx'),
    ('res_blocks', 'blocked_id', 'res_blocks_blocked_id_idx'),
    ('res_chore_schedule', 'roommate_id', 'res_chore_schedule_roommate_id_idx'),
    ('res_community_disputes', 'against_user_id', 'res_community_disputes_against_user_id_idx'),
    ('res_community_disputes', 'mediator_id', 'res_community_disputes_mediator_id_idx'),
    ('res_community_invites', 'community_id', 'res_community_invites_community_id_idx'),
    ('res_community_invites', 'created_by', 'res_community_invites_created_by_idx'),
    ('res_gossip_comments', 'author_id', 'res_gossip_comments_author_id_idx'),
    ('res_gossip_post_reactions', 'user_id', 'res_gossip_post_reactions_user_id_idx'),
    ('res_gossip_posts', 'author_id', 'res_gossip_posts_author_id_idx'),
    ('res_group_buy_pledges', 'user_id', 'res_group_buy_pledges_user_id_idx'),
    ('res_infra_partner_admins', 'user_id', 'res_infra_partner_admins_user_id_idx'),
    ('res_listings', 'event_id', 'res_listings_event_id_idx'),
    ('res_listings', 'property_id', 'res_listings_property_id_idx'),
    ('res_moderation_actions', 'actor_id', 'res_moderation_actions_actor_id_idx'),
    ('res_neighbourhood_status', 'provider_id', 'res_neighbourhood_status_provider_id_idx'),
    ('res_neighbourhood_status', 'reporter_id', 'res_neighbourhood_status_reporter_id_idx'),
    ('res_org_broadcasts', 'sender_id', 'res_org_broadcasts_sender_id_idx'),
    ('res_org_memberships', 'user_id', 'res_org_memberships_user_id_idx'),
    ('res_org_units', 'owner_user_id', 'res_org_units_owner_user_id_idx'),
    ('res_purchases', 'user_id', 'res_purchases_user_id_idx'),
    ('res_reviews', 'author_id', 'res_reviews_author_id_idx'),
    ('res_room_requests', 'listing_id', 'res_room_requests_listing_id_idx'),
    ('res_rooms', 'listing_id', 'res_rooms_listing_id_idx'),
    ('res_service_dispatches', 'service_id', 'res_service_dispatches_service_id_idx'),
    ('res_service_report_confirmations', 'user_id', 'res_service_report_confirmations_user_id_idx'),
    ('res_service_report_updates', 'author_id', 'res_service_report_updates_author_id_idx'),
    ('res_skills', 'user_id', 'res_skills_user_id_idx'),
    ('res_tool_library', 'rented_by', 'res_tool_library_rented_by_idx'),
    ('res_traffic_reports', 'reporter_id', 'res_traffic_reports_reporter_id_idx'),
    ('res_unit_verification_requests', 'requested_jurisdiction_id', 'res_unit_verification_requests_requested_jurisdiction_id_idx'),
    ('res_utility_tokens', 'claimed_by', 'res_utility_tokens_claimed_by_idx')
  ) as t(tbl, col, idx) loop
    -- Both guards are needed: the harness builds simplified stand-ins for
    -- some tables, so a table can exist there without the column this index
    -- is for.
    if to_regclass('public.' || v.tbl) is not null
       and exists (select 1 from information_schema.columns
                    where table_schema = 'public'
                      and table_name = v.tbl and column_name = v.col) then
      execute format('create index if not exists %I on public.%I (%I)', v.idx, v.tbl, v.col);
    end if;
  end loop;
end $$;


-- ==========================================================================
-- 24. theresident_maintenance_scheduler.sql
-- ==========================================================================

-- theresident_maintenance_scheduler.sql
--
-- Backlog B1: The Resident had ten maintenance functions and no scheduler.
-- cron.job held three entries, all of them Gruvs'. Every function below had
-- been written and had never executed once, so listings never expired, tools
-- never came back, logs grew without bound, and — written this same week —
-- free trials never lapsed.
--
-- TWO CORRECTIONS TO THE ORIGINAL DIAGNOSIS, found by reading signatures
-- rather than assuming:
--   * res_rotate_chores(p_listing, p_tasks, p_days) takes arguments. It is a
--     per-household setup call, not a sweep, and does not belong on a
--     schedule at all — it belongs in a UI that nothing currently provides.
--   * res_care_overdue() returns a TABLE. It reports who has missed a
--     check-in; it does not act. Scheduling it alone would achieve nothing.
--     It needs a caller that notifies somebody, which is separate work.
-- So eight functions are scheduled here, not ten.
--
-- ONE FAILURE MUST NOT STOP THE REST. Each task runs in its own block with
-- its own exception handler. A maintenance run that aborts halfway because
-- one table is locked is how a scheduler quietly stops doing seven other jobs
-- while still reporting that it ran.
--
-- AND IT HAS TO BE VISIBLE. A scheduler nobody can see the results of is the
-- same as no scheduler — the failure mode is silence in both cases. Every run
-- records what it did, how long it took, and what failed.
--
-- Paste into the Supabase SQL editor. Additive only.

create table if not exists public.res_maintenance_runs (
  id bigint generated always as identity primary key,
  task text not null,
  ok boolean not null,
  affected integer,
  error text,
  ran_at timestamptz not null default now(),
  duration_ms integer
);

create index if not exists res_maintenance_runs_recent_idx
  on public.res_maintenance_runs (ran_at desc);
create index if not exists res_maintenance_runs_failures_idx
  on public.res_maintenance_runs (task, ran_at desc) where not ok;

alter table public.res_maintenance_runs enable row level security;

-- Operational data. No policy and no grants: readable through the summary
-- function by service_role, and by nothing else.
revoke all on public.res_maintenance_runs from anon, authenticated;

create or replace function public.res_run_maintenance()
returns table (task text, ok boolean, affected integer, error text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tasks constant text[] := array[
    -- Content that should stop being shown once it is stale.
    'res_expire_stale_listings',
    'res_expire_market_items',
    'res_expire_stale_alerts',
    -- Things held by someone who has stopped acting on them.
    'res_auto_return_tools',
    'res_release_stale_claims',
    -- Billing state that is derived correctly but should also be durable.
    'res_expire_area_probations',
    -- Retention promises that are otherwise fiction.
    'res_prune_security_logs',
    'res_prune_client_errors'
  ];
  v_task text;
  v_affected integer;
  v_started timestamptz;
  v_error text;
begin
  foreach v_task in array v_tasks loop
    v_started := clock_timestamp();
    v_affected := null;
    v_error := null;

    begin
      -- Each in its own block: a run that aborts halfway is a scheduler that
      -- silently stops doing the remaining jobs while still looking alive.
      execute format('select %I()', v_task) into v_affected;
    exception
      when undefined_function then
        v_error := 'not installed';
      when others then
        v_error := left(sqlerrm, 500);
    end;

    insert into res_maintenance_runs (task, ok, affected, error, duration_ms)
    values (
      v_task, v_error is null, v_affected, v_error,
      (extract(epoch from (clock_timestamp() - v_started)) * 1000)::integer
    );

    task := v_task;
    ok := v_error is null;
    affected := v_affected;
    error := v_error;
    return next;
  end loop;
end;
$$;

revoke all on function public.res_run_maintenance() from public, anon, authenticated;
grant execute on function public.res_run_maintenance() to service_role;

-- What an operator looks at: did last night's run work, and what changed.
create or replace function public.res_maintenance_status(p_hours integer default 48)
returns table (
  task text,
  runs bigint,
  failures bigint,
  last_run timestamptz,
  last_ok boolean,
  last_affected integer,
  last_error text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    r.task,
    count(*) as runs,
    count(*) filter (where not r.ok) as failures,
    max(r.ran_at) as last_run,
    (array_agg(r.ok order by r.ran_at desc))[1] as last_ok,
    (array_agg(r.affected order by r.ran_at desc))[1] as last_affected,
    (array_agg(r.error order by r.ran_at desc))[1] as last_error
  from res_maintenance_runs r
  where r.ran_at > now() - make_interval(hours => greatest(1, least(p_hours, 720)))
  group by r.task
  order by count(*) filter (where not r.ok) desc, r.task;
$$;

revoke all on function public.res_maintenance_status(integer) from public, anon, authenticated;
grant execute on function public.res_maintenance_status(integer) to service_role;

-- The run log is itself retained data, so it prunes too. Ninety days keeps
-- enough history to notice a task that has been failing quietly for weeks.
create or replace function public.res_prune_maintenance_runs()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare v_count integer;
begin
  delete from res_maintenance_runs where ran_at < now() - interval '90 days';
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.res_prune_maintenance_runs() from public, anon, authenticated;
grant execute on function public.res_prune_maintenance_runs() to service_role;

-- ── Scheduling ─────────────────────────────────────────────────────────────
--
-- Run these once, after the functions above exist. Applied on the live
-- project on 2026-09-03 as jobs 4 and 5.
--
-- 02:20 UTC is deliberately BETWEEN the two Gruvs maintenance jobs (02:10 and
-- 02:40) rather than on top of either, so a slow run never overlaps theirs on
-- a database both apps share.
--
--   select cron.schedule('resident-maintenance', '20 2 * * *',
--                        'select public.res_run_maintenance()');
--
-- The run log is retained data too. Weekly, and later than the daily run so
-- it never prunes a log the same transaction is writing.
--
--   select cron.schedule('resident-prune-maintenance-log', '50 3 * * 0',
--                        'select public.res_prune_maintenance_runs()');
--
-- To check it afterwards:
--   select * from public.res_maintenance_status(48);
--   select jobid, jobname, schedule, active from cron.job;


-- ==========================================================================
-- 25. theresident_urgent_banner_area_notices.sql
-- ==========================================================================

-- theresident_urgent_banner_area_notices.sql
--
-- Backlog A2: a `critical` AREA notice never raised the urgent banner.
--
-- WHAT WAS WRONG. res_pending_urgent_broadcasts only reads res_org_broadcasts
-- — the follow-based table — so an evacuation sent to an area landed in the
-- bell and in the Area Notices panel but never in the banner that stays until
-- acknowledged. Phase D built the entire acknowledgement path for area
-- notices (res_ack_area_broadcast, res_area_broadcast_receipts, requires_ack
-- in the payload) and nothing surfaced it. The interrupt-level delivery that
-- justifies the whole feature was missing for the half of it that reaches
-- people who never opted in.
--
-- THE SHAPE. One function, two sources, a `source` column so the client knows
-- which acknowledgement to call. Merged in SQL rather than by two client
-- fetches because the banner shows strictly one notice at a time, worst
-- first, and that ordering has to be decided across both sets — otherwise a
-- routine follow notice can sit in front of an evacuation.
--
-- The area half is derived from the notifications already delivered, not
-- re-resolved from geometry: if a resident was not notified, a banner for it
-- would be a banner for something they cannot see anywhere else.
--
-- Paste into the Supabase SQL editor. Replaces the existing function; the
-- return type gains a column, so it is dropped first.

drop function if exists public.res_pending_urgent_broadcasts();

create or replace function public.res_pending_urgent_broadcasts()
returns table (
  id uuid,
  unit_id uuid,
  unit_name text,
  title text,
  body text,
  priority text,
  created_at timestamptz,
  -- 'follow' → acknowledge with res_ack_broadcast
  -- 'area'   → acknowledge with res_ack_area_broadcast
  source text,
  -- Null for follow-based notices; the area a notice covered, for the rest.
  target_label text
)
language sql
stable
security definer
set search_path = public
as $$
  -- The union is wrapped: Postgres will not take an expression in ORDER BY
  -- directly after a UNION, and this ordering is the whole point of merging
  -- the two sources in SQL rather than in the client.
  select q.id, q.unit_id, q.unit_name, q.title, q.body, q.priority,
         q.created_at, q.source, q.target_label
  from (
  -- Follow-based, unchanged.
  select b.id, b.unit_id, u.name as unit_name, b.title, b.body, b.priority,
         b.created_at, 'follow'::text as source, null::text as target_label
  from res_org_broadcasts b
  join res_org_units u on u.id = b.unit_id
  left join res_org_broadcast_receipts r
         on r.broadcast_id = b.id and r.user_id = auth.uid()
  where b.priority in ('urgent', 'critical')
    and r.acknowledged_at is null
    and (b.expires_at is null or b.expires_at > now())
    and exists (
      select 1 from res_org_follows f
      where f.follower_user_id = auth.uid()
        and public.res_is_unit_ancestor_or_self(b.unit_id, f.unit_id)
    )

  union all

  -- Area-based. Membership comes from the notification actually delivered to
  -- this resident, so the banner can never show something the rest of the app
  -- has no record of them receiving.
  select ab.id, ab.unit_id, u.name as unit_name, ab.title, ab.body, ab.priority,
         ab.sent_at as created_at, 'area'::text as source, ab.target_label
  from res_area_broadcasts ab
  join res_org_units u on u.id = ab.unit_id
  left join res_area_broadcast_receipts ar
         on ar.broadcast_id = ab.id and ar.user_id = auth.uid()
  where ab.priority in ('urgent', 'critical')
    and ar.acknowledged_at is null
    and (ab.expires_at is null or ab.expires_at > now())
    and exists (
      select 1 from notifications n
      where n.recipient_id = auth.uid()
        and n.type = 'res_area_broadcast'
        and (n.data ->> 'area_broadcast_id')::uuid = ab.id
    )
  ) q
  -- Worst first across BOTH sources. The banner shows one notice at a time,
  -- so this ordering is what decides whether an evacuation or a school notice
  -- is the one a resident sees.
  order by
    case q.priority when 'critical' then 0 else 1 end,
    q.created_at desc
  limit 20;
$$;

revoke all on function public.res_pending_urgent_broadcasts() from public, anon;
grant execute on function public.res_pending_urgent_broadcasts() to authenticated, service_role;


-- ==========================================================================
-- 26. theresident_client_error_logging.sql
-- ==========================================================================

-- theresident_client_error_logging.sql
--
-- Somewhere for a production crash to land. Until now a React error in a
-- resident's browser was invisible: no Sentry, no logging, and the only way
-- to learn about a broken screen was for someone to say so.
--
-- WHY A NEW TABLE WHEN client_errors ALREADY EXISTS. It does, and nothing in
-- The Resident writes to it — but CONTRACT.md §2 is unambiguous: unprefixed
-- tables belong to The Gruvs, and "every new Resident table is res_-prefixed".
-- The shared rails The Resident may write to are listed in §4 and
-- client_errors is not among them. Duplicating a table is the lesser problem;
-- consolidating them is a conversation with the Gruvs side, not a decision to
-- make unilaterally from this repo.
--
-- WHAT MUST NOT END UP IN HERE. Error text is written by the browser and can
-- contain whatever was on screen. The client redacts before sending (see
-- src/utils/errorReporting.ts) and this table is deliberately not readable by
-- residents at all — not even their own rows. It exists to be read by whoever
-- operates the app, through the service role. A crash report is diagnostic
-- data, not something to show a user or let another user find.
--
-- Paste into the Supabase SQL editor. Additive only.

create table if not exists public.res_client_errors (
  id bigint generated always as identity primary key,
  -- Nullable: a crash on a signed-out page is still worth knowing about.
  user_id uuid,
  -- A short, stable identifier for the kind of failure ('render',
  -- 'unhandled_rejection', 'window_error'), so the same bug groups together
  -- instead of scattering across message variations.
  label text not null,
  message text,
  context jsonb,
  path text,
  app_version text,
  created_at timestamptz not null default now()
);

create index if not exists res_client_errors_recent_idx
  on public.res_client_errors (created_at desc);
create index if not exists res_client_errors_label_idx
  on public.res_client_errors (label, created_at desc);

alter table public.res_client_errors enable row level security;

-- No policy at all, and no grants: nothing reachable through the API can read
-- or write this table directly. The only way in is the RPC below; the only way
-- out is the service role.
revoke all on public.res_client_errors from anon, authenticated;

create or replace function public.res_log_client_error(
  p_label text,
  p_message text default null,
  p_context jsonb default null,
  p_path text default null,
  p_app_version text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(trim(p_label), '') = '' then
    return; -- nothing useful to record; not worth an error about an error
  end if;

  -- A crash loop is exactly when this gets called hardest, so it is limited
  -- like any other write path. Generous enough to capture a real burst,
  -- tight enough that a runaway render loop cannot fill the table.
  begin
    perform public.res_check_rate_limit('client_error', 30, 3600);
  exception when others then
    -- Over the limit, or not signed in. Either way, swallow: an error
    -- reporter that throws is worse than one that misses a report.
    return;
  end;

  insert into res_client_errors (user_id, label, message, context, path, app_version)
  values (
    auth.uid(),
    left(trim(p_label), 60),
    left(p_message, 2000),
    p_context,
    left(p_path, 300),
    left(p_app_version, 40)
  );
exception when others then
  -- Same reasoning one level up. Reporting a crash must never cause one.
  return;
end;
$$;

revoke all on function public.res_log_client_error(text, text, jsonb, text, text) from public;
-- anon included on purpose: a crash on the public /verify-kin page or the
-- signed-out landing page is one of the more useful things to hear about, and
-- the function records auth.uid() (null) rather than trusting any caller
-- claim about who they are.
grant execute on function public.res_log_client_error(text, text, jsonb, text, text) to anon, authenticated, service_role;

-- What an operator actually looks at: which failures are happening, how often,
-- and how recently. Service role only.
create or replace function public.res_client_error_summary(p_hours integer default 24)
returns table (
  label text,
  occurrences bigint,
  affected_users bigint,
  last_seen timestamptz,
  sample_message text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    e.label,
    count(*) as occurrences,
    count(distinct e.user_id) as affected_users,
    max(e.created_at) as last_seen,
    (array_agg(e.message order by e.created_at desc))[1] as sample_message
  from res_client_errors e
  where e.created_at > now() - make_interval(hours => greatest(1, least(p_hours, 720)))
  group by e.label
  order by count(*) desc;
$$;

revoke all on function public.res_client_error_summary(integer) from public, anon, authenticated;
grant execute on function public.res_client_error_summary(integer) to service_role;

-- Crash reports are diagnostic, not archival. Ninety days is long enough to
-- spot a slow regression and short enough that this never becomes a quiet
-- store of what people were doing when something broke.
create or replace function public.res_prune_client_errors()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare v_count integer;
begin
  delete from res_client_errors where created_at < now() - interval '90 days';
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.res_prune_client_errors() from public, anon, authenticated;
grant execute on function public.res_prune_client_errors() to service_role;


-- ==========================================================================
-- 27. theresident_rate_limit_write_paths.sql
-- ==========================================================================

-- theresident_rate_limit_write_paths.sql
--
-- Adds the shared limiter to write RPCs that had none. Before this, 10 of 69
-- write paths were rate limited: the Service Desk, gossip and area broadcasts.
-- Everything else — reviews, trust-connection requests, map reports, property
-- and room creation, invites — could be called in a loop.
--
-- WHY THESE, AND NOT ALL OF THEM. A limiter is worth adding where abuse is
-- both cheap and lands in front of somebody else: a review on a stranger's
-- profile, a connection request, a marker on the shared map, a listing in the
-- housing feed. Toggles (vibe, echo, RSVP) are excluded — they are idempotent
-- and self-reversing, so hammering one wastes only the caller's time.
-- res_notify is excluded deliberately: it is an internal helper called by
-- other functions during fan-out, and limiting it would throttle legitimate
-- delivery rather than the person causing it.
--
-- HOW. Each function is rewritten from pg_get_functiondef, which reproduces
-- the complete definition — signature, volatility, security, search_path — so
-- nothing but the inserted line changes.
--
-- The limiter is inserted immediately after the function's OUTERMOST `begin`.
-- An earlier version of this file anchored on the shared
-- "if auth.uid() is null" check instead, and a dry run showed 5 of the 13
-- functions do not use that wording — they check ownership or admin
-- membership instead. Anchoring on `begin` is uniform, and costs nothing in
-- safety because res_check_rate_limit raises on its own when there is no
-- signed-in user.
--
-- The rewrite refuses loudly unless that anchor appears exactly once, rather
-- than guessing at a position: landing the limiter inside a nested block, or
-- after the write it is meant to precede, would be worse than not adding it.
--
-- Paste into the Supabase SQL editor. Idempotent: re-running skips functions
-- that already have a limiter.

do $$
declare
  -- A non-indented `begin` on its own line is the function's outermost block;
  -- nested plpgsql blocks are always indented by the style used here.
  v_anchor constant text := '(\r?\n)begin(\r?\n)';
  v_target record;
  v_def text;
  v_new text;
  v_hits integer;
begin
  for v_target in
    select * from (values
      -- (function, action key, max, window seconds)
      -- Reviews are permanent and attached to someone else's name.
      ('res_submit_review',               'review',           10, 3600),
      -- A request lands as a notification on a stranger.
      ('res_request_trust_connection',    'trust_request',    20, 86400),
      -- Generates a public, no-login link.
      ('res_create_kin_verification_link','kin_link',         10, 86400),
      -- Markers on the shared map everyone sees.
      ('res_report_map_zone',             'map_report',       20, 3600),
      ('res_report_road_segment',         'road_report',      20, 3600),
      ('res_report_infra_official',       'infra_report',     10, 3600),
      -- Content in the housing feed.
      ('res_create_property',             'create_property',  10, 86400),
      ('res_create_room',                 'create_room',      40, 86400),
      ('res_advertise_room',              'advertise_room',   20, 86400),
      -- Invites, waitlists and pledges reach other people.
      ('res_create_invite',               'create_invite',    20, 86400),
      ('res_request_move_assist',         'move_assist',      10, 86400),
      ('res_waitlist_request',            'waitlist',         20, 86400),
      ('res_pledge_group_buy',            'group_buy_pledge', 30, 86400)
    ) as t(fn, action, max_calls, window_seconds)
  loop
    select pg_get_functiondef(p.oid) into v_def
    from pg_proc p
    where p.proname = v_target.fn and p.pronamespace = 'public'::regnamespace
    limit 1;

    if v_def is null then
      raise notice 'skipping %: not installed here', v_target.fn;
      continue;
    end if;

    if position('res_check_rate_limit' in v_def) > 0 then
      raise notice 'skipping %: already limited', v_target.fn;
      continue;
    end if;

    select count(*) into v_hits from regexp_matches(v_def, v_anchor, 'g');
    if v_hits <> 1 then
      raise exception 'refusing to rewrite %: found % outermost begin blocks, expected exactly 1',
        v_target.fn, v_hits;
    end if;

    v_new := regexp_replace(
      v_def, v_anchor,
      format(E'\\1begin\\2  perform public.res_check_rate_limit(%L, %s, %s);\\2',
             v_target.action, v_target.max_calls, v_target.window_seconds)
    );

    if v_new = v_def then
      raise exception 'refusing to rewrite %: the anchor matched but nothing changed', v_target.fn;
    end if;

    execute v_new;
    raise notice 'rate limited % (% per % seconds)', v_target.fn, v_target.max_calls, v_target.window_seconds;
  end loop;
end $$;


-- ==========================================================================
-- 28. theresident_rls_initplan_perf_fix.sql
-- ==========================================================================

-- theresident_rls_initplan_perf_fix.sql
--
-- Supabase's own linter (get_advisors, performance) flagged every policy
-- below with `auth_rls_initplan`: calling `auth.uid()` directly inside a
-- policy makes Postgres re-evaluate it once per ROW instead of once per
-- QUERY. Wrapping it as `(select auth.uid())` lets the planner treat it as
-- a stable subplan evaluated once — same access rules, no behavior change,
-- just cheaper at scale. Scoped to the 12 tables built this session
-- (Service Desk, directory/urgency, room inventory, kin verification,
-- gossip reactions) — the same class of gap exists on ~40 older res_*
-- tables too, left for a separate pass since those predate this session.
--
-- Already applied directly to the live database via the Supabase MCP tool.
-- This file exists so the fix is versioned like every other schema change
-- in this repo, not because it still needs to be pasted anywhere.

drop policy if exists res_org_units_insert on public.res_org_units;
create policy res_org_units_insert on public.res_org_units
  for insert to authenticated
  with check (
    owner_user_id = (select auth.uid())
    and (parent_id is null or public.res_user_is_sender_of_or_above(parent_id, (select auth.uid())))
  );

drop policy if exists res_org_units_update on public.res_org_units;
create policy res_org_units_update on public.res_org_units
  for update to authenticated
  using (public.res_user_is_sender_of_or_above(id, (select auth.uid())))
  with check (public.res_user_is_sender_of_or_above(id, (select auth.uid())));

drop policy if exists res_org_memberships_select on public.res_org_memberships;
create policy res_org_memberships_select on public.res_org_memberships
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or public.res_user_is_sender_of_or_above(unit_id, (select auth.uid()))
  );

drop policy if exists res_org_memberships_insert on public.res_org_memberships;
create policy res_org_memberships_insert on public.res_org_memberships
  for insert to authenticated
  with check (public.res_user_is_sender_of_or_above(unit_id, (select auth.uid())));

drop policy if exists res_org_memberships_delete on public.res_org_memberships;
create policy res_org_memberships_delete on public.res_org_memberships
  for delete to authenticated
  using (public.res_user_is_sender_of_or_above(unit_id, (select auth.uid())));

drop policy if exists res_org_follows_select on public.res_org_follows;
create policy res_org_follows_select on public.res_org_follows
  for select to authenticated using (follower_user_id = (select auth.uid()));

drop policy if exists res_org_follows_insert on public.res_org_follows;
create policy res_org_follows_insert on public.res_org_follows
  for insert to authenticated with check (follower_user_id = (select auth.uid()));

drop policy if exists res_org_follows_delete on public.res_org_follows;
create policy res_org_follows_delete on public.res_org_follows
  for delete to authenticated using (follower_user_id = (select auth.uid()));

drop policy if exists res_org_broadcasts_select on public.res_org_broadcasts;
create policy res_org_broadcasts_select on public.res_org_broadcasts
  for select to authenticated
  using (
    sender_id = (select auth.uid())
    or exists (
      select 1 from res_org_follows f
      where f.follower_user_id = (select auth.uid())
        and public.res_is_unit_ancestor_or_self(res_org_broadcasts.unit_id, f.unit_id)
    )
  );

drop policy if exists res_org_broadcasts_insert on public.res_org_broadcasts;
create policy res_org_broadcasts_insert on public.res_org_broadcasts
  for insert to authenticated
  with check (
    sender_id = (select auth.uid())
    and public.res_user_is_sender_of_or_above(unit_id, (select auth.uid()))
  );

drop policy if exists res_broadcast_receipts_select on public.res_org_broadcast_receipts;
create policy res_broadcast_receipts_select on public.res_org_broadcast_receipts
  for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists res_broadcast_receipts_insert on public.res_org_broadcast_receipts;
create policy res_broadcast_receipts_insert on public.res_org_broadcast_receipts
  for insert to authenticated with check (user_id = (select auth.uid()));

drop policy if exists res_broadcast_receipts_update on public.res_org_broadcast_receipts;
create policy res_broadcast_receipts_update on public.res_org_broadcast_receipts
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy if exists res_service_reports_select on public.res_service_reports;
create policy res_service_reports_select on public.res_service_reports
  for select to authenticated using (
    reporter_id = (select auth.uid())
    or public.res_is_provider_admin(provider_id)
    or public.res_shares_locality(suburb, city)
  );

drop policy if exists res_service_report_updates_select on public.res_service_report_updates;
create policy res_service_report_updates_select on public.res_service_report_updates
  for select to authenticated using (
    exists (
      select 1 from res_service_reports r
      where r.id = res_service_report_updates.report_id
        and (
          r.reporter_id = (select auth.uid())
          or public.res_is_provider_admin(r.provider_id)
          or public.res_shares_locality(r.suburb, r.city)
        )
    )
  );

drop policy if exists res_service_report_confirm_select on public.res_service_report_confirmations;
create policy res_service_report_confirm_select on public.res_service_report_confirmations
  for select to authenticated using (
    exists (
      select 1 from res_service_reports r
      where r.id = res_service_report_confirmations.report_id
        and (
          r.reporter_id = (select auth.uid())
          or public.res_is_provider_admin(r.provider_id)
          or public.res_shares_locality(r.suburb, r.city)
        )
    )
  );

drop policy if exists res_rooms_all on public.res_rooms;
create policy res_rooms_all on public.res_rooms
  for all to authenticated
  using (landlord_id = (select auth.uid()))
  with check (landlord_id = (select auth.uid()));

drop policy if exists res_room_occupants_select on public.res_room_occupants;
create policy res_room_occupants_select on public.res_room_occupants
  for select to authenticated using (
    public.res_owns_room(room_id)
    or tenant_id = (select auth.uid())
    or (visibility = 'shared_with_housemates' and public.res_is_current_housemate(room_id))
  );

drop policy if exists res_kin_verification_links_select on public.res_kin_verification_links;
create policy res_kin_verification_links_select on public.res_kin_verification_links
  for select using (requester_id = (select auth.uid()));

drop policy if exists res_gossip_post_reactions_insert on public.res_gossip_post_reactions;
create policy res_gossip_post_reactions_insert on public.res_gossip_post_reactions
  for insert with check (user_id = (select auth.uid()));

drop policy if exists res_gossip_post_reactions_delete on public.res_gossip_post_reactions;
create policy res_gossip_post_reactions_delete on public.res_gossip_post_reactions
  for delete using (user_id = (select auth.uid()));


-- ==========================================================================
-- 29. theresident_rls_initplan_perf_fix_legacy_tables.sql
-- ==========================================================================

-- theresident_rls_initplan_perf_fix_legacy_tables.sql
--
-- theresident_rls_initplan_perf_fix.sql fixed the 12 tables built this
-- session; Supabase's linter also flags the same auth_rls_initplan issue on
-- 44 older res_* tables that predate it — every policy below calls
-- auth.uid() directly, so Postgres re-evaluates it once per ROW instead of
-- once per QUERY. Wrapping it as (select auth.uid()) fixes that: same
-- access rules, no behavior change, cheaper at scale.
--
-- Generated mechanically from a live pg_policies dump (tablename,
-- policyname, permissive, roles, cmd, qual, with_check for every affected
-- policy), substituting auth.uid() -> (select auth.uid()) and nothing else
-- — every USING/WITH CHECK clause, role list, and command type is preserved
-- exactly as it already existed live.
--
-- Already applied directly to the live database via the Supabase MCP tool.
-- This file exists so the fix is versioned like every other schema change
-- in this repo, not because it still needs to be pasted anywhere.

drop policy if exists "res_responders_insert" on public.res_alert_responders;
create policy "res_responders_insert" on public.res_alert_responders
  for INSERT to authenticated
  with check (((responder_id = (select auth.uid())) AND (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND (p.is_verified = true))))));

drop policy if exists "res_responders_update" on public.res_alert_responders;
create policy "res_responders_update" on public.res_alert_responders
  for UPDATE to authenticated
  using ((responder_id = (select auth.uid())))
  with check ((responder_id = (select auth.uid())));

drop policy if exists "res_alerts_insert" on public.res_alerts;
create policy "res_alerts_insert" on public.res_alerts
  for INSERT to authenticated
  with check ((user_id = (select auth.uid())));

drop policy if exists "res_alerts_update" on public.res_alerts;
create policy "res_alerts_update" on public.res_alerts
  for UPDATE to authenticated
  using ((user_id = (select auth.uid())))
  with check ((user_id = (select auth.uid())));

drop policy if exists "res_blocks_delete" on public.res_blocks;
create policy "res_blocks_delete" on public.res_blocks
  for DELETE to authenticated
  using ((blocker_id = (select auth.uid())));

drop policy if exists "res_blocks_insert" on public.res_blocks;
create policy "res_blocks_insert" on public.res_blocks
  for INSERT to authenticated
  with check ((blocker_id = (select auth.uid())));

drop policy if exists "res_blocks_select" on public.res_blocks;
create policy "res_blocks_select" on public.res_blocks
  for SELECT to authenticated
  using ((blocker_id = (select auth.uid())));

drop policy if exists "res_care_insert" on public.res_care_circle;
create policy "res_care_insert" on public.res_care_circle
  for INSERT to authenticated
  with check ((carer_id = (select auth.uid())));

drop policy if exists "res_care_select" on public.res_care_circle;
create policy "res_care_select" on public.res_care_circle
  for SELECT to authenticated
  using (((subject_id = (select auth.uid())) OR (carer_id = (select auth.uid()))));

drop policy if exists "res_care_update" on public.res_care_circle;
create policy "res_care_update" on public.res_care_circle
  for UPDATE to authenticated
  using (((subject_id = (select auth.uid())) OR (carer_id = (select auth.uid()))))
  with check (((subject_id = (select auth.uid())) OR (carer_id = (select auth.uid()))));

drop policy if exists "res_chores_delete" on public.res_chore_schedule;
create policy "res_chores_delete" on public.res_chore_schedule
  for DELETE to authenticated
  using (res_is_household_member(listing_id, (select auth.uid())));

drop policy if exists "res_chores_insert" on public.res_chore_schedule;
create policy "res_chores_insert" on public.res_chore_schedule
  for INSERT to authenticated
  with check (res_is_household_member(listing_id, (select auth.uid())));

drop policy if exists "res_chores_select" on public.res_chore_schedule;
create policy "res_chores_select" on public.res_chore_schedule
  for SELECT to authenticated
  using (res_is_household_member(listing_id, (select auth.uid())));

drop policy if exists "res_chores_update" on public.res_chore_schedule;
create policy "res_chores_update" on public.res_chore_schedule
  for UPDATE to authenticated
  using (res_is_household_member(listing_id, (select auth.uid())))
  with check (res_is_household_member(listing_id, (select auth.uid())));

drop policy if exists "res_communities_insert" on public.res_communities;
create policy "res_communities_insert" on public.res_communities
  for INSERT to authenticated
  with check ((created_by = (select auth.uid())));

drop policy if exists "res_communities_update" on public.res_communities;
create policy "res_communities_update" on public.res_communities
  for UPDATE to authenticated
  using ((created_by = (select auth.uid())))
  with check ((created_by = (select auth.uid())));

drop policy if exists "res_disputes_insert" on public.res_community_disputes;
create policy "res_disputes_insert" on public.res_community_disputes
  for INSERT to authenticated
  with check ((reported_by_id = (select auth.uid())));

drop policy if exists "res_disputes_select" on public.res_community_disputes;
create policy "res_disputes_select" on public.res_community_disputes
  for SELECT to authenticated
  using (((reported_by_id = (select auth.uid())) OR (against_user_id = (select auth.uid())) OR (mediator_id = (select auth.uid()))));

drop policy if exists "res_disputes_update" on public.res_community_disputes;
create policy "res_disputes_update" on public.res_community_disputes
  for UPDATE to authenticated
  using (((reported_by_id = (select auth.uid())) OR (mediator_id = (select auth.uid()))))
  with check (((reported_by_id = (select auth.uid())) OR (mediator_id = (select auth.uid()))));

drop policy if exists "res_invites_select" on public.res_community_invites;
create policy "res_invites_select" on public.res_community_invites
  for SELECT to authenticated
  using ((EXISTS ( SELECT 1
   FROM res_community_members m
  WHERE ((m.community_id = res_community_invites.community_id) AND (m.user_id = (select auth.uid())) AND (m.role = ANY (ARRAY['admin'::text, 'founder'::text]))))));

drop policy if exists "res_members_delete" on public.res_community_members;
create policy "res_members_delete" on public.res_community_members
  for DELETE to authenticated
  using (((user_id = (select auth.uid())) OR (EXISTS ( SELECT 1
   FROM res_communities c
  WHERE ((c.id = res_community_members.community_id) AND (c.created_by = (select auth.uid())))))));

drop policy if exists "res_members_insert" on public.res_community_members;
create policy "res_members_insert" on public.res_community_members
  for INSERT to authenticated
  with check ((user_id = (select auth.uid())));

drop policy if exists "res_dm_insert" on public.res_direct_messages;
create policy "res_dm_insert" on public.res_direct_messages
  for INSERT to authenticated
  with check ((sender_id = (select auth.uid())));

drop policy if exists "res_dm_select" on public.res_direct_messages;
create policy "res_dm_select" on public.res_direct_messages
  for SELECT to authenticated
  using (((sender_id = (select auth.uid())) OR (recipient_id = (select auth.uid()))));

drop policy if exists "res_gossip_comments_delete" on public.res_gossip_comments;
create policy "res_gossip_comments_delete" on public.res_gossip_comments
  for DELETE to authenticated
  using ((author_id = (select auth.uid())));

drop policy if exists "res_gossip_comments_insert" on public.res_gossip_comments;
create policy "res_gossip_comments_insert" on public.res_gossip_comments
  for INSERT to authenticated
  with check ((author_id = (select auth.uid())));

drop policy if exists "res_gossip_posts_delete" on public.res_gossip_posts;
create policy "res_gossip_posts_delete" on public.res_gossip_posts
  for DELETE to authenticated
  using ((author_id = (select auth.uid())));

drop policy if exists "res_gossip_posts_insert" on public.res_gossip_posts;
create policy "res_gossip_posts_insert" on public.res_gossip_posts
  for INSERT to authenticated
  with check (((author_id = (select auth.uid())) AND res_account_ready((select auth.uid()), 48, false)));

drop policy if exists "res_gossip_posts_select" on public.res_gossip_posts;
create policy "res_gossip_posts_select" on public.res_gossip_posts
  for SELECT to authenticated
  using (((NOT hidden) OR (author_id = (select auth.uid()))));

drop policy if exists "res_pledges_insert" on public.res_group_buy_pledges;
create policy "res_pledges_insert" on public.res_group_buy_pledges
  for INSERT to authenticated
  with check ((user_id = (select auth.uid())));

drop policy if exists "res_pledges_update" on public.res_group_buy_pledges;
create policy "res_pledges_update" on public.res_group_buy_pledges
  for UPDATE to authenticated
  using ((user_id = (select auth.uid())))
  with check ((user_id = (select auth.uid())));

drop policy if exists "res_groupbuys_insert" on public.res_group_buys;
create policy "res_groupbuys_insert" on public.res_group_buys
  for INSERT to authenticated
  with check ((organizer_id = (select auth.uid())));

drop policy if exists "res_groupbuys_update" on public.res_group_buys;
create policy "res_groupbuys_update" on public.res_group_buys
  for UPDATE to authenticated
  using ((organizer_id = (select auth.uid())))
  with check ((organizer_id = (select auth.uid())));

drop policy if exists "res_handyman_insert" on public.res_handyman_services;
create policy "res_handyman_insert" on public.res_handyman_services
  for INSERT to authenticated
  with check ((owner_id = (select auth.uid())));

drop policy if exists "res_handyman_update" on public.res_handyman_services;
create policy "res_handyman_update" on public.res_handyman_services
  for UPDATE to authenticated
  using ((owner_id = (select auth.uid())))
  with check ((owner_id = (select auth.uid())));

drop policy if exists "res_infra_partner_admins_select" on public.res_infra_partner_admins;
create policy "res_infra_partner_admins_select" on public.res_infra_partner_admins
  for SELECT to authenticated
  using ((user_id = (select auth.uid())));

drop policy if exists "res_bookings_select" on public.res_lift_bookings;
create policy "res_bookings_select" on public.res_lift_bookings
  for SELECT to authenticated
  using (((rider_id = (select auth.uid())) OR (EXISTS ( SELECT 1
   FROM res_lift_clubs l
  WHERE ((l.id = res_lift_bookings.lift_id) AND (l.driver_id = (select auth.uid())))))));

drop policy if exists "res_bookings_update" on public.res_lift_bookings;
create policy "res_bookings_update" on public.res_lift_bookings
  for UPDATE to authenticated
  using (((rider_id = (select auth.uid())) OR (EXISTS ( SELECT 1
   FROM res_lift_clubs l
  WHERE ((l.id = res_lift_bookings.lift_id) AND (l.driver_id = (select auth.uid())))))))
  with check (((rider_id = (select auth.uid())) OR (EXISTS ( SELECT 1
   FROM res_lift_clubs l
  WHERE ((l.id = res_lift_bookings.lift_id) AND (l.driver_id = (select auth.uid())))))));

drop policy if exists "res_lifts_insert" on public.res_lift_clubs;
create policy "res_lifts_insert" on public.res_lift_clubs
  for INSERT to authenticated
  with check ((driver_id = (select auth.uid())));

drop policy if exists "res_lifts_update" on public.res_lift_clubs;
create policy "res_lifts_update" on public.res_lift_clubs
  for UPDATE to authenticated
  using ((driver_id = (select auth.uid())))
  with check ((driver_id = (select auth.uid())));

drop policy if exists "res_listings_delete" on public.res_listings;
create policy "res_listings_delete" on public.res_listings
  for DELETE to authenticated
  using ((landlord_id = (select auth.uid())));

drop policy if exists "res_listings_update" on public.res_listings;
create policy "res_listings_update" on public.res_listings
  for UPDATE to authenticated
  using ((landlord_id = (select auth.uid())))
  with check ((landlord_id = (select auth.uid())));

drop policy if exists "res_listings_write" on public.res_listings;
create policy "res_listings_write" on public.res_listings
  for INSERT to authenticated
  with check ((landlord_id = (select auth.uid())));

drop policy if exists "res_lostfound_insert" on public.res_lost_found;
create policy "res_lostfound_insert" on public.res_lost_found
  for INSERT to authenticated
  with check ((user_id = (select auth.uid())));

drop policy if exists "res_lostfound_update" on public.res_lost_found;
create policy "res_lostfound_update" on public.res_lost_found
  for UPDATE to authenticated
  using ((user_id = (select auth.uid())))
  with check ((user_id = (select auth.uid())));

drop policy if exists "res_market_delete" on public.res_market_items;
create policy "res_market_delete" on public.res_market_items
  for DELETE to authenticated
  using ((user_id = (select auth.uid())));

drop policy if exists "res_market_insert" on public.res_market_items;
create policy "res_market_insert" on public.res_market_items
  for INSERT to authenticated
  with check ((user_id = (select auth.uid())));

drop policy if exists "res_market_update" on public.res_market_items;
create policy "res_market_update" on public.res_market_items
  for UPDATE to authenticated
  using ((user_id = (select auth.uid())))
  with check ((user_id = (select auth.uid())));

drop policy if exists "res_modlog_select" on public.res_moderation_actions;
create policy "res_modlog_select" on public.res_moderation_actions
  for SELECT to authenticated
  using ((EXISTS ( SELECT 1
   FROM res_community_members m
  WHERE ((m.community_id = res_moderation_actions.community_id) AND (m.user_id = (select auth.uid())) AND (m.role = ANY (ARRAY['admin'::text, 'founder'::text]))))));

drop policy if exists "res_status_insert" on public.res_neighbourhood_status;
create policy "res_status_insert" on public.res_neighbourhood_status
  for INSERT to authenticated
  with check ((reporter_id = (select auth.uid())));

drop policy if exists "res_notices_insert" on public.res_notice_events;
create policy "res_notices_insert" on public.res_notice_events
  for INSERT to authenticated
  with check ((posted_by_id = (select auth.uid())));

drop policy if exists "res_notices_update" on public.res_notice_events;
create policy "res_notices_update" on public.res_notice_events
  for UPDATE to authenticated
  using ((posted_by_id = (select auth.uid())))
  with check ((posted_by_id = (select auth.uid())));

drop policy if exists "res_prefs_all" on public.res_notification_prefs;
create policy "res_prefs_all" on public.res_notification_prefs
  for ALL to authenticated
  using ((user_id = (select auth.uid())))
  with check ((user_id = (select auth.uid())));

drop policy if exists "res_profiles_insert" on public.res_profiles;
create policy "res_profiles_insert" on public.res_profiles
  for INSERT to authenticated
  with check ((id = (select auth.uid())));

drop policy if exists "res_profiles_select" on public.res_profiles;
create policy "res_profiles_select" on public.res_profiles
  for SELECT to authenticated
  using (((id = (select auth.uid())) OR (EXISTS ( SELECT 1
   FROM res_room_requests r
  WHERE (((r.tenant_id = res_profiles.id) AND (r.landlord_id = (select auth.uid()))) OR ((r.landlord_id = res_profiles.id) AND (r.tenant_id = (select auth.uid()))))))));

drop policy if exists "res_profiles_update" on public.res_profiles;
create policy "res_profiles_update" on public.res_profiles
  for UPDATE to authenticated
  using ((id = (select auth.uid())))
  with check ((id = (select auth.uid())));

drop policy if exists "res_properties_insert" on public.res_properties;
create policy "res_properties_insert" on public.res_properties
  for INSERT to authenticated
  with check ((landlord_id = (select auth.uid())));

drop policy if exists "res_properties_update" on public.res_properties;
create policy "res_properties_update" on public.res_properties
  for UPDATE to authenticated
  using ((landlord_id = (select auth.uid())))
  with check ((landlord_id = (select auth.uid())));

drop policy if exists "res_purchases_select" on public.res_purchases;
create policy "res_purchases_select" on public.res_purchases
  for SELECT to authenticated
  using ((user_id = (select auth.uid())));

drop policy if exists "res_ratelimit_select" on public.res_rate_limits;
create policy "res_ratelimit_select" on public.res_rate_limits
  for SELECT to authenticated
  using ((user_id = (select auth.uid())));

drop policy if exists "res_reports_insert" on public.res_reports;
create policy "res_reports_insert" on public.res_reports
  for INSERT to authenticated
  with check ((reporter_id = (select auth.uid())));

drop policy if exists "res_reports_select" on public.res_reports;
create policy "res_reports_select" on public.res_reports
  for SELECT to authenticated
  using ((reporter_id = (select auth.uid())));

drop policy if exists "res_reviews_delete" on public.res_reviews;
create policy "res_reviews_delete" on public.res_reviews
  for DELETE to authenticated
  using ((author_id = (select auth.uid())));

drop policy if exists "res_reviews_update" on public.res_reviews;
create policy "res_reviews_update" on public.res_reviews
  for UPDATE to authenticated
  using (((author_id = (select auth.uid())) AND (created_at > (now() - '24:00:00'::interval))))
  with check ((author_id = (select auth.uid())));

drop policy if exists "res_requests_insert" on public.res_room_requests;
create policy "res_requests_insert" on public.res_room_requests
  for INSERT to authenticated
  with check ((tenant_id = (select auth.uid())));

drop policy if exists "res_requests_select" on public.res_room_requests;
create policy "res_requests_select" on public.res_room_requests
  for SELECT to authenticated
  using (((tenant_id = (select auth.uid())) OR (landlord_id = (select auth.uid()))));

drop policy if exists "res_requests_update" on public.res_room_requests;
create policy "res_requests_update" on public.res_room_requests
  for UPDATE to authenticated
  using (((tenant_id = (select auth.uid())) OR (landlord_id = (select auth.uid()))))
  with check (((tenant_id = (select auth.uid())) OR (landlord_id = (select auth.uid()))));

drop policy if exists "res_seekers_update" on public.res_roommate_seekers;
create policy "res_seekers_update" on public.res_roommate_seekers
  for UPDATE to authenticated
  using ((id = (select auth.uid())))
  with check ((id = (select auth.uid())));

drop policy if exists "res_seekers_write" on public.res_roommate_seekers;
create policy "res_seekers_write" on public.res_roommate_seekers
  for INSERT to authenticated
  with check ((id = (select auth.uid())));

drop policy if exists "res_saved_pins_all" on public.res_saved_pins;
create policy "res_saved_pins_all" on public.res_saved_pins
  for ALL to authenticated
  using ((user_id = (select auth.uid())))
  with check ((user_id = (select auth.uid())));

drop policy if exists "res_saved_all" on public.res_saved_searches;
create policy "res_saved_all" on public.res_saved_searches
  for ALL to authenticated
  using ((user_id = (select auth.uid())))
  with check ((user_id = (select auth.uid())));

drop policy if exists "res_security_logs_insert_auth" on public.res_security_logs;
create policy "res_security_logs_insert_auth" on public.res_security_logs
  for INSERT to authenticated
  with check (((user_id IS NULL) OR (user_id = (select auth.uid()))));

drop policy if exists "res_dispatch_insert" on public.res_service_dispatches;
create policy "res_dispatch_insert" on public.res_service_dispatches
  for INSERT to authenticated
  with check ((sender_id = (select auth.uid())));

drop policy if exists "res_dispatch_select" on public.res_service_dispatches;
create policy "res_dispatch_select" on public.res_service_dispatches
  for SELECT to authenticated
  using (((sender_id = (select auth.uid())) OR (EXISTS ( SELECT 1
   FROM res_handyman_services s
  WHERE ((s.id = res_service_dispatches.service_id) AND (s.owner_id = (select auth.uid())))))));

drop policy if exists "res_resources_insert" on public.res_shared_resources;
create policy "res_resources_insert" on public.res_shared_resources
  for INSERT to authenticated
  with check ((owner_id = (select auth.uid())));

drop policy if exists "res_resources_update" on public.res_shared_resources;
create policy "res_resources_update" on public.res_shared_resources
  for UPDATE to authenticated
  using ((owner_id = (select auth.uid())))
  with check ((owner_id = (select auth.uid())));

drop policy if exists "res_skills_insert" on public.res_skills;
create policy "res_skills_insert" on public.res_skills
  for INSERT to authenticated
  with check ((user_id = (select auth.uid())));

drop policy if exists "res_skills_update" on public.res_skills;
create policy "res_skills_update" on public.res_skills
  for UPDATE to authenticated
  using ((user_id = (select auth.uid())))
  with check ((user_id = (select auth.uid())));

drop policy if exists "res_subscriptions_select" on public.res_subscriptions;
create policy "res_subscriptions_select" on public.res_subscriptions
  for SELECT to authenticated
  using ((user_id = (select auth.uid())));

drop policy if exists "res_tools_insert" on public.res_tool_library;
create policy "res_tools_insert" on public.res_tool_library
  for INSERT to authenticated
  with check ((owner_id = (select auth.uid())));

drop policy if exists "res_tools_update" on public.res_tool_library;
create policy "res_tools_update" on public.res_tool_library
  for UPDATE to authenticated
  using (((owner_id = (select auth.uid())) OR (rented_by = (select auth.uid()))))
  with check (((owner_id = (select auth.uid())) OR (rented_by = (select auth.uid()))));

drop policy if exists "Auth Users Insert Traffic Reports" on public.res_traffic_reports;
create policy "Auth Users Insert Traffic Reports" on public.res_traffic_reports
  for INSERT
  with check (((select auth.uid()) = reporter_id));

drop policy if exists "Users Delete Own Traffic Reports" on public.res_traffic_reports;
create policy "Users Delete Own Traffic Reports" on public.res_traffic_reports
  for DELETE
  using (((select auth.uid()) = reporter_id));

drop policy if exists "traffic_insert_policy" on public.res_traffic_reports;
create policy "traffic_insert_policy" on public.res_traffic_reports
  for INSERT to authenticated
  with check (((select auth.uid()) = reporter_id));

drop policy if exists "res_trust_connections_insert" on public.res_trust_connections;
create policy "res_trust_connections_insert" on public.res_trust_connections
  for INSERT to authenticated
  with check ((requester_id = (select auth.uid())));

drop policy if exists "res_trust_connections_select" on public.res_trust_connections;
create policy "res_trust_connections_select" on public.res_trust_connections
  for SELECT to authenticated
  using (((requester_id = (select auth.uid())) OR (connection_id = (select auth.uid()))));

drop policy if exists "res_trust_connections_update" on public.res_trust_connections;
create policy "res_trust_connections_update" on public.res_trust_connections
  for UPDATE to authenticated
  using ((connection_id = (select auth.uid())))
  with check ((connection_id = (select auth.uid())));

drop policy if exists "res_tokens_insert" on public.res_utility_tokens;
create policy "res_tokens_insert" on public.res_utility_tokens
  for INSERT to authenticated
  with check ((landlord_id = (select auth.uid())));

drop policy if exists "res_tokens_update" on public.res_utility_tokens;
create policy "res_tokens_update" on public.res_utility_tokens
  for UPDATE to authenticated
  using (((landlord_id = (select auth.uid())) OR (claimed_by = (select auth.uid())) OR ((status = 'available'::text) AND ((select auth.uid()) IS NOT NULL))))
  with check (((landlord_id = (select auth.uid())) OR (claimed_by = (select auth.uid()))));

drop policy if exists "res_vendors_insert" on public.res_vendors;
create policy "res_vendors_insert" on public.res_vendors
  for INSERT to authenticated
  with check ((user_id = (select auth.uid())));

drop policy if exists "res_vendors_update" on public.res_vendors;
create policy "res_vendors_update" on public.res_vendors
  for UPDATE to authenticated
  using ((user_id = (select auth.uid())))
  with check ((user_id = (select auth.uid())));


-- ==========================================================================
-- 30. theresident_db_hardening.sql
-- ==========================================================================

-- The Resident — schema guard + security hardening
-- Project feevvddvrjmfbhffccbf (the ONE project, shared with The Gruvs).
-- Safe to re-run: every statement is idempotent. Paste into Supabase → SQL Editor → Run.

begin;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Listing types (rent / sale / guesthouse) + seasonal guest-house columns.
--    Already applied on the live project — these are no-ops there, and exist so
--    a fresh environment can be brought to the same state from one paste.
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.res_listings
  add column if not exists listing_type text not null default 'rent';

alter table public.res_listings
  add column if not exists event_id uuid references public.events(id) on delete set null;

alter table public.res_listings
  add column if not exists visible_until timestamptz;

-- Re-created rather than ALTERed: a CHECK can't be widened in place, and doing
-- it by name is what lets this whole script stay re-runnable.
alter table public.res_listings drop constraint if exists res_listings_listing_type_check;
alter table public.res_listings
  add constraint res_listings_listing_type_check
  check (listing_type in ('rent', 'sale', 'guesthouse'));

-- Housing filters on both of these on every browse; without indexes each one is
-- a sequential scan over the whole table.
create index if not exists res_listings_listing_type_idx on public.res_listings (listing_type);
create index if not exists res_listings_visible_until_idx on public.res_listings (visible_until);

commit;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. res_profiles.legal_name — a Resident-only "formal name" field, separate
--    from the Gruvs-owned profiles.name shown elsewhere in the app. This app
--    never writes that column outside initial signup (CONTRACT.md §2); a
--    resident who wants a formal identity on record for verification/
--    landlord-facing contexts sets this instead, without touching the shared
--    table. Already reflected in resident_schema.sql's CREATE TABLE for fresh
--    installs — this is the equivalent delta for the live project.
-- ─────────────────────────────────────────────────────────────────────────────
begin;

alter table public.res_profiles
  add column if not exists legal_name text;

commit;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. public.spatial_ref_sys — NOT fixable from here. Documented, not scripted.
--
--    It's PostGIS's coordinate-system reference data, and it's the one table on
--    the project with RLS disabled (Supabase's weekly security-advisor email
--    flags it every time). It looks fixable — `ALTER TABLE ... ENABLE ROW LEVEL
--    SECURITY` and `REVOKE ... FROM anon, authenticated` are both the textbook
--    remediation — but both were tried directly against this project and both
--    fail: the table and its grants are owned by `supabase_admin`, a role project
--    owners (`postgres`, which is what the SQL Editor runs as) cannot assume.
--    REVOKE against a grant you don't own silently no-ops instead of erroring,
--    which is why this looked fixable before it was actually tested end-to-end.
--
--    The only way to close this is a Supabase support ticket asking them to
--    enable RLS on spatial_ref_sys for this project — that needs their elevated
--    access, not anything runnable from the SQL Editor. Real-world risk is low:
--    this table holds public EPSG coordinate-system definitions, not user data;
--    worst case is someone vandalizing it and breaking map coordinate transforms
--    until it's restored, not a data leak.
-- ─────────────────────────────────────────────────────────────────────────────

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Verification — run this after the commits above and read the output.
--    Expect: three res_listings columns present, listing_type check listing
--    all three values, and legal_name present on res_profiles.
-- ─────────────────────────────────────────────────────────────────────────────
select 'columns' as check, string_agg(column_name, ', ' order by column_name) as result
from information_schema.columns
where table_schema = 'public' and table_name = 'res_listings'
  and column_name in ('listing_type', 'event_id', 'visible_until')

union all
select 'listing_type constraint', pg_get_constraintdef(oid)
from pg_constraint where conname = 'res_listings_listing_type_check'

union all
select 'res_profiles.legal_name', string_agg(column_name, ', ')
from information_schema.columns
where table_schema = 'public' and table_name = 'res_profiles' and column_name = 'legal_name';


-- ==========================================================================
-- 31. theresident_anon_grant_lockdown.sql
-- ==========================================================================

-- theresident_anon_grant_lockdown.sql
--
-- Closes a live hole: Resident-owned functions that were reachable by the
-- `anon` role — signed-out callers — because Supabase's default privileges
-- grant EXECUTE on every newly created function to `anon` and `authenticated`,
-- and the original files granted without revoking first.
--
-- THE ONE THAT MATTERS: res_resolve_broadcast_audience(unit) returns
-- (follower_user_id, email_opt_in). Anyone on the internet with the project's
-- publishable key could POST /rest/v1/rpc/res_resolve_broadcast_audience and
-- enumerate the followers of any school, clinic or business in the directory,
-- along with who opted into email. It is the follow-based twin of
-- res_resolve_area_audience, which was locked down when it was written.
--
-- The rest fall into three groups:
--   * Trigger bodies. These are invoked by triggers, never by callers.
--     PostgreSQL checks EXECUTE at CREATE TRIGGER, not at fire time, so
--     revoking here cannot stop an existing trigger from running.
--   * SECURITY DEFINER boolean helpers. Each answers a question about someone
--     else's data ("is this person an admin of that provider", "does this
--     person share my suburb"). Individually small; together they are an
--     oracle a signed-out caller should not have.
--   * Pure lookups with no data access. Harmless, revoked for tidiness so the
--     anon surface is a short, deliberate list rather than an accident.
--
-- DELIBERATELY LEFT REACHABLE BY anon:
--   res_get_kin_verification_link / res_respond_kin_verification_link — these
--   power /verify-kin/[token], a public no-login page where someone without a
--   Resident account answers one question about a claimed relationship. Both
--   are scoped by an unguessable token. Taking anon away would break that
--   feature, which is the whole point of it.
--
-- Paste into the Supabase SQL editor. Additive only — no behaviour changes for
-- signed-in users.

-- Each revoke is guarded, because this file is applied both to the live
-- project and to the local sql-tests harness, which builds only a subset of
-- the schema. A missing function means "not installed here", not an error
-- worth aborting the whole lockdown over — and aborting would leave the
-- functions after it still open.
do $$
declare
  v_sig text;
  v_roles text;
begin
  foreach v_sig in array array[
    -- The leak: returns (follower_user_id, email_opt_in).
    'public.res_resolve_broadcast_audience(uuid)',
    -- SECURITY DEFINER helpers, each answering a question about someone
    -- else's data. Individually small; together an oracle.
    'public.res_is_current_housemate(uuid)',
    'public.res_is_provider_admin(uuid)',
    'public.res_is_unit_ancestor_or_self(uuid, uuid)',
    'public.res_owns_room(uuid)',
    'public.res_shares_locality(text, text)',
    'public.res_user_is_sender_of_or_above(uuid, uuid)',
    -- A write path should never be reachable unauthenticated, even though
    -- auth.uid() being null would fail it anyway.
    'public.res_report_status(text, text, text, text, uuid, double precision, double precision, timestamptz)',
    -- Pure lookups: harmless, revoked so the anon surface is a deliberate
    -- list rather than an accident of the defaults.
    'public.res_area_daily_cap(text)',
    'public.res_coarsen_coord(double precision)',
    'public.res_default_target_hours(text, text)'
  ] loop
    begin
      execute format('revoke all on function %s from public, anon', v_sig);
    exception when undefined_function then
      null;
    end;
  end loop;

  -- Trigger bodies. Invoked by triggers, never by callers. PostgreSQL checks
  -- EXECUTE at CREATE TRIGGER rather than at fire time, so revoking cannot
  -- stop an existing trigger from running.
  foreach v_sig in array array[
    'public.res_check_broadcast_priority()',
    'public.res_check_broadcast_rate_limit()',
    'public.res_check_security_log_rate_limit()',
    'public.res_check_status_duration()',
    'public.res_fanout_broadcast()',
    'public.res_org_unit_auto_sender()',
    'public.res_room_touch()',
    'public.res_service_report_set_reference()',
    'public.res_service_report_touch()'
  ] loop
    begin
      execute format('revoke all on function %s from public, anon, authenticated', v_sig);
    exception when undefined_function then
      null;
    end;
  end loop;
end $$;


-- ==========================================================================
-- 32. theresident_grant_policy_lockdown.sql
-- ==========================================================================

-- The Resident — systemic grant/policy lockdown
--
-- Why this file exists
-- -------------------
-- Supabase's default privileges grant ALL on every newly created table to
-- `anon` and `authenticated`. A schema file that only ever GRANTs (and never
-- REVOKEs first) therefore leaves every command open at the privilege layer
-- and relies on RLS alone to refuse writes. That is one lock where there
-- should be two, and it is the exact shape of defect that made the
-- res_org_units privilege escalation exploitable: RLS has no column
-- granularity, so when a policy is broader than intended the GRANT is the
-- only thing left standing.
--
-- This has now been found five separate times by hand. Rather than fix a
-- sixth instance later, this file revokes INSERT/UPDATE/DELETE from `anon`
-- and `authenticated` on every RLS-enabled res_* table where NO policy
-- permits that command for that role. Those operations are already refused
-- by RLS today, so nothing that works stops working — the grant is simply
-- no longer the last line of defence.
--
-- It is computed, not hand-listed, so it stays correct as policies change,
-- and it is idempotent: re-running it after adding a policy will not revoke
-- a grant that policy now needs.
--
-- `service_role` is deliberately untouched (it bypasses RLS by design and is
-- never exposed to a browser). SELECT is deliberately untouched: read
-- exposure is a separate question, governed by the policies themselves.
--
-- The permanent invariant is asserted in sql-tests/99f-grant-policy.test.sql.

do $$
declare
  r record;
  n int := 0;
begin
  for r in
    with g as (
      select c.relname as tbl,
             g.grantee  as role,
             g.privilege_type as act
      from information_schema.role_table_grants g
      join pg_class c on c.relname = g.table_name
      join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
      where g.table_schema = 'public'
        and g.grantee in ('anon', 'authenticated')
        and g.privilege_type in ('INSERT', 'UPDATE', 'DELETE')
        and c.relname like 'res\_%'
        and c.relkind = 'r'
        and c.relrowsecurity
    )
    select g.role, g.act, g.tbl
    from g
    where not exists (
      select 1
      from pg_policies p
      where p.schemaname = 'public'
        and p.tablename = g.tbl
        -- a FOR ALL policy reports as cmd = 'ALL' and covers every command;
        -- comparing p.cmd = g.act alone produces false positives.
        and (p.cmd = g.act or p.cmd = 'ALL')
        and (p.roles @> array[g.role]::name[] or p.roles @> array['public']::name[])
    )
  loop
    execute format('revoke %s on public.%I from %I', r.act, r.tbl, r.role);
    n := n + 1;
  end loop;

  raise notice 'grant/policy lockdown: revoked % grant(s)', n;
end
$$;

-- Two grants survive the computed sweep because their policies are written
-- `to public` (which includes anon) rather than `to authenticated`. Both
-- require `user_id = auth.uid()`, which is NULL for an anonymous session, so
-- anon can never satisfy them — the grant is dead weight. Removed explicitly.
-- `authenticated` is unaffected: it holds these grants in its own right.
revoke insert, delete on public.res_gossip_post_reactions from anon;

-- res_security_logs keeps its anon INSERT deliberately: failed sign-in
-- attempts must be recordable before a session exists, and its policy pins
-- those rows to `user_id is null`.


-- ==========================================================================
-- 33. Columns that exist in production and were never written down
-- ==========================================================================
--
-- Building the schema from source and diffing it against the live catalogs
-- turned up twenty-six columns that production has and this repo did not.
-- They are added here as ALTER ... ADD COLUMN IF NOT EXISTS rather than
-- folded into the CREATE TABLE statements above, for two reasons: applying
-- this file to the live database stays a no-op, and the history of which
-- columns arrived out-of-band stays visible instead of being quietly
-- absorbed.
--
-- Types, defaults and nullability are transcribed from information_schema on
-- the live project. Nothing here changes an existing column.

-- Contact details for a provider, used by the Service Desk to say who to
-- chase. (The repo also claimed a `region` column here; production has never
-- had one, so it has been removed rather than added.)
alter table public.res_infra_providers
  add column if not exists contact_email text,
  add column if not exists contact_phone text;

-- Listing moderation, document review, boosting, and the link back to a
-- property that res_rooms' "advertise this room" flow depends on.
alter table public.res_listings
  add column if not exists doc_review_note text,
  add column if not exists doc_review_status text not null default 'none',
  add column if not exists featured_until timestamptz,
  add column if not exists flag_reason text,
  add column if not exists flagged boolean not null default false,
  add column if not exists hidden boolean not null default false,
  add column if not exists property_id uuid,
  add column if not exists quick_post boolean not null default false,
  add column if not exists verification_doc_url text;

-- res_listings.property_id carries no foreign-key constraint in production,
-- so the computed sweep in section 34 will not cover it — but it is the join
-- PropertiesPanel uses to list a landlord's rooms, and section 23's guarded
-- entry ran before the column existed. Indexed here, next to the column.
create index if not exists res_listings_property_id_idx
  on public.res_listings (property_id);

alter table public.res_market_items
  add column if not exists featured_until timestamptz,
  add column if not exists hidden boolean not null default false,
  add column if not exists kind text not null default 'sell';

-- An outage has a start, an end, a source (crowd-reported vs the provider
-- itself) and the provider it belongs to. Without these the Service Desk
-- cannot tell "someone said the power is out" from "the utility confirmed it".
alter table public.res_neighbourhood_status
  add column if not exists ends_at timestamptz,
  add column if not exists provider_id uuid,
  add column if not exists source text not null default 'crowd',
  add column if not exists starts_at timestamptz not null default now();

alter table public.res_notice_events
  add column if not exists hidden boolean not null default false;

alter table public.res_profiles
  add column if not exists verification_priority_requested_at timestamptz,
  add column if not exists verification_status text not null default 'none';

alter table public.res_reputation
  add column if not exists last_action_at timestamptz default now(),
  add column if not exists streak_weeks integer not null default 0;

alter table public.res_reviews
  add column if not exists updated_at timestamptz default now();

alter table public.res_subscriptions
  add column if not exists paystack_customer_code text,
  add column if not exists paystack_subscription_code text;

-- ---------------------------------------------------------------------------
-- Drift in the other direction
-- ---------------------------------------------------------------------------
-- Three columns exist in this repo and NOT in production, because the files
-- that added them were written and never pasted in:
--   res_care_circle.flag, res_care_circle.flagged_at  (the care-circle flag)
--   res_gossip_comments.hidden                        (comment moderation)
--
-- Their CREATE TABLE definitions above do NOT create them on the live
-- database — `create table if not exists` skips an existing table entirely,
-- so a definition changed after the fact never lands. That is precisely how
-- this drift opened in the first place. They are therefore added explicitly
-- here, which is what those two files were written to do. Nullable and
-- unread, so adding them changes no behaviour today.
alter table public.res_care_circle
  add column if not exists flag text,
  add column if not exists flagged_at timestamptz;

alter table public.res_gossip_comments
  add column if not exists hidden boolean not null default false;
--
-- res_infra_providers.region was the fourth. It is not here: production never
-- had it, and the repo's claim that it did is a documented case of this same
-- drift. It has been removed rather than created.


-- ==========================================================================
-- 34. Foreign keys still without an index — computed
-- ==========================================================================
--
-- Section 23 lists thirty-three indexes by hand. Building the schema from
-- source showed that list was already incomplete: twelve more foreign keys
-- have covering indexes in production that no file here creates, so a clean
-- rebuild came up short and sql-tests/99e-fk-indexes.test.sql failed.
-- It runs last, after section 33 adds the columns some of those keys are on.
--
-- Rather than transcribe another twelve names and wait for the list to drift
-- again, this closes the gap by computation: any res_* foreign key with no
-- index whose leading columns match it gets one, named by the same
-- table_column_idx convention. On the live database it finds nothing (there
-- are zero unindexed foreign keys there) — it exists so a rebuild from source
-- matches production, and so the next foreign key added without an index is
-- covered the moment this file is applied.
do $$
declare
  r record;
  cols text;
  idx  text;
  n int := 0;
begin
  for r in
    select c.conrelid, c.conrelid::regclass::text as tbl, c.conkey
    from pg_constraint c
    where c.contype = 'f'
      and c.connamespace = 'public'::regnamespace
      and c.conrelid::regclass::text like 'res\_%'
      and not exists (
        select 1 from pg_index i
        where i.indrelid = c.conrelid
          and (i.indkey::int2[])[0:array_length(c.conkey, 1) - 1] = c.conkey
      )
  loop
    select string_agg(quote_ident(a.attname), ', ' order by k.ord),
           string_agg(a.attname, '_' order by k.ord)
      into cols, idx
      from unnest(r.conkey) with ordinality as k(attnum, ord)
      join pg_attribute a on a.attrelid = r.conrelid and a.attnum = k.attnum;

    execute format('create index if not exists %I on %s (%s)',
                   r.tbl || '_' || idx || '_idx', r.tbl, cols);
    n := n + 1;
  end loop;

  raise notice 'foreign-key index sweep: created % index(es)', n;
end
$$;


-- ==========================================================================
-- 35. Baseline table grants — computed
-- ==========================================================================
--
-- The live project's grants were never written down anywhere, because nobody
-- issued them: Supabase's default privileges hand ALL on every new table to
-- anon and authenticated automatically. That is invisible until you rebuild
-- from source, and then nothing works — res_profiles_select reads
-- res_room_requests, authenticated has no grant on it, and reading your own
-- profile fails with "permission denied".
--
-- So the grants are made explicit here, and made explicit by the same rule
-- section 32 enforces in the other direction: a role gets a privilege on a
-- table exactly when a policy permits that role that command. Grants and
-- policies agree by construction, in both directions, and
-- sql-tests/99f-grant-policy.test.sql asserts they still do.
--
-- Two deliberate exclusions:
--   * Tables carrying column-level grants are skipped. res_org_units is the
--     case that matters: its insert/update are granted column by column so a
--     sender cannot set `verified` or `jurisdiction_id` on their own row.
--     A table-level grant here would silently undo that lockdown, which is
--     the exact privilege escalation it was written to close.
--   * service_role is untouched. It bypasses RLS by design.
do $$
declare
  r record;
  n int := 0;
begin
  for r in
    select distinct p.tablename as tbl, rr.role, a.act
    from pg_policies p
    cross join lateral (select unnest(array['anon', 'authenticated']) as role) rr
    cross join lateral (select unnest(array['SELECT', 'INSERT', 'UPDATE', 'DELETE']) as act) a
    join pg_class c on c.relname = p.tablename
    join pg_namespace ns on ns.oid = c.relnamespace and ns.nspname = 'public'
    where p.schemaname = 'public'
      and p.tablename like 'res\_%'
      and (p.cmd = a.act or p.cmd = 'ALL')
      and (p.roles @> array[rr.role]::name[] or p.roles @> array['public']::name[])
      -- skip tables that express their grants per column
      and not exists (
        select 1 from pg_attribute att
        where att.attrelid = c.oid and att.attnum > 0 and not att.attisdropped
          and att.attacl is not null
      )
  loop
    execute format('grant %s on public.%I to %I', r.act, r.tbl, r.role);
    n := n + 1;
  end loop;

  raise notice 'baseline grants: issued %', n;
end
$$;


-- ==========================================================================
-- 36. theresident_room_vacancy_schema.sql
-- ==========================================================================

-- theresident_room_vacancy_schema.sql
--
-- Two gaps in the room inventory feature (section 10), both requested
-- directly: a landlord could not mark a room vacant/occupied with one click
-- — status only ever changed as a side effect of adding or ending an
-- occupant record — and a tenant had no way to ask to be told when a room
-- opens back up.
--
-- MANUAL STATUS TOGGLE. res_set_room_status() lets the landlord flip a
-- room's status directly, independent of whether they track occupants in the
-- app at all. A landlord who just wants to mark "this room is free" without
-- recording who moved out can now do exactly that.
--
-- VACANCY WATCH, KEYED BY LISTING. A tenant only ever sees a room through its
-- public listing (res_rooms itself is landlord-private, section 10) — so the
-- watch is keyed on listing_id, which is what the browsing UI already has on
-- every card, rather than room_id, which a tenant has no way to look up.
-- res_room_vacancy_watches keeps room_id too (resolved once, at watch time)
-- because that is what the notify step actually needs to check, but every
-- public-facing RPC takes a listing id.
--
-- The watch is one-shot: the moment the room goes vacant, every watcher is
-- notified and the watch is cleared — "let me know when it opens up" is a
-- single ping, not a standing subscription to every future vacancy on that
-- room. Both status-changing paths — this file's manual toggle and
-- res_end_room_occupancy() (section 10) — call the same notify function, so
-- a watcher hears about it regardless of which route freed the room.
--
-- A room can only be watched once it is advertised (has a listing_id) and
-- while it is currently occupied — watching an already-vacant room would
-- never fire, since nothing here re-checks status on a timer.
--
-- Paste into the Supabase SQL editor. Additive only.

-- ── 1. TABLE ───────────────────────────────────────────────────────────────

create table if not exists public.res_room_vacancy_watches (
  id uuid primary key default uuid_generate_v4(),
  room_id uuid references public.res_rooms(id) on delete cascade not null,
  listing_id uuid references public.res_listings(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  created_at timestamptz default now() not null,
  unique (listing_id, user_id)
);

create index if not exists res_room_vacancy_watches_room_idx on public.res_room_vacancy_watches (room_id);
create index if not exists res_room_vacancy_watches_listing_idx on public.res_room_vacancy_watches (listing_id);
create index if not exists res_room_vacancy_watches_user_idx on public.res_room_vacancy_watches (user_id);

-- ── 2. RLS ─────────────────────────────────────────────────────────────────
-- Strictly self: a tenant sees and manages only their own watches — enough
-- for the UI to ask "am I already watching this listing?" without needing
-- any access to res_rooms, which stays landlord-private. Writes go through
-- the RPCs in §3, where "must be advertised and currently occupied" is
-- enforced against res_rooms directly (as the function owner, bypassing the
-- landlord-only RLS on that table the same way res_owns_room does).

alter table public.res_room_vacancy_watches enable row level security;

drop policy if exists res_room_vacancy_watches_select on public.res_room_vacancy_watches;
create policy res_room_vacancy_watches_select on public.res_room_vacancy_watches
  for select to authenticated using (user_id = auth.uid());

-- ── 3. RPCs ────────────────────────────────────────────────────────────────

-- res_end_room_occupancy (section 10) is the OTHER path that can flip a
-- room back to vacant — a tenant moving out through the normal occupant
-- record, rather than the manual toggle below. Redefined here (same
-- signature, same body, plus one call) so a watcher hears about a vacancy
-- created either way, not only through the toggle this file adds.
create or replace function public.res_end_room_occupancy(p_occupant uuid)
returns public.res_room_occupants
language plpgsql security definer
set search_path = public
as $$
declare
  v_row res_room_occupants;
  v_room uuid;
begin
  select room_id into v_room from res_room_occupants where id = p_occupant;
  if v_room is null then raise exception 'occupant_not_found'; end if;
  if not public.res_owns_room(v_room) then raise exception 'not_your_room'; end if;

  update res_room_occupants set moved_out_at = now()
  where id = p_occupant and moved_out_at is null
  returning * into v_row;

  -- Only flips back to vacant if nobody else current remains — a room can
  -- have more than one occupant on record.
  if not exists (select 1 from res_room_occupants where room_id = v_room and moved_out_at is null) then
    update res_rooms set status = 'vacant' where id = v_room;
    perform public.res_notify_room_vacancy_watchers(v_room);
  end if;

  return v_row;
end;
$$;

-- The landlord's one-click toggle. Independent of occupant records — a
-- landlord who never adds an occupant row can still mark a room vacant or
-- occupied directly.
create or replace function public.res_set_room_status(p_room uuid, p_status text)
returns public.res_rooms
language plpgsql security definer
set search_path = public
as $$
declare
  v_row res_rooms;
  v_was_vacant boolean;
begin
  if not public.res_owns_room(p_room) then raise exception 'not_your_room'; end if;
  if p_status not in ('vacant', 'occupied') then raise exception 'invalid_status'; end if;

  select (status = 'vacant') into v_was_vacant from res_rooms where id = p_room;

  update res_rooms set status = p_status where id = p_room
  returning * into v_row;

  if p_status = 'vacant' and not v_was_vacant then
    perform public.res_notify_room_vacancy_watchers(p_room);
  end if;

  return v_row;
end;
$$;

-- Shared by the manual toggle above and res_end_room_occupancy() (section
-- 10) so a watcher is told no matter which path freed the room up. Fans out
-- into the Gruvs-owned notifications rail, same shape as the broadcast sends
-- elsewhere in this file, then clears the watches it just fired — a one-time
-- "it's free" ping, not a standing subscription.
create or replace function public.res_notify_room_vacancy_watchers(p_room uuid)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_room res_rooms;
begin
  select * into v_room from res_rooms where id = p_room;
  if v_room.id is null or v_room.listing_id is null then return; end if;

  insert into notifications (recipient_id, type, title, body, message, data, action_url)
  select
    w.user_id,
    'res_room_vacancy',
    'A room you were watching is now available',
    coalesce(v_room.label, 'Room') || ' is now vacant.',
    coalesce(v_room.label, 'Room') || ' is now vacant.',
    jsonb_build_object('room_id', v_room.id, 'listing_id', v_room.listing_id),
    '/dashboard/housing?listing=' || v_room.listing_id::text
  from res_room_vacancy_watches w
  where w.room_id = p_room;

  delete from res_room_vacancy_watches where room_id = p_room;
end;
$$;

-- A tenant asks to be told when a room frees up, by the listing they're
-- looking at. Refused (rather than silently accepted and never firing) when
-- the listing isn't a room-inventory listing at all, or the room is already
-- vacant right now.
create or replace function public.res_watch_room_vacancy(p_listing uuid)
returns public.res_room_vacancy_watches
language plpgsql security definer
set search_path = public
as $$
declare
  v_row res_room_vacancy_watches;
  v_room_id uuid;
  v_status text;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;

  select id, status into v_room_id, v_status from res_rooms where listing_id = p_listing;
  if v_room_id is null then raise exception 'not_a_room_listing'; end if;
  if v_status = 'vacant' then raise exception 'room_already_vacant: it is available right now'; end if;

  insert into res_room_vacancy_watches (room_id, listing_id, user_id)
  values (v_room_id, p_listing, auth.uid())
  on conflict (listing_id, user_id) do nothing
  returning * into v_row;

  if v_row.id is null then
    select * into v_row from res_room_vacancy_watches where listing_id = p_listing and user_id = auth.uid();
  end if;

  return v_row;
end;
$$;

create or replace function public.res_unwatch_room_vacancy(p_listing uuid)
returns void
language plpgsql security definer
set search_path = public
as $$
begin
  delete from res_room_vacancy_watches where listing_id = p_listing and user_id = auth.uid();
end;
$$;

-- Tells the browsing UI whether a listing is even a room-inventory listing,
-- and whether it's currently occupied — without exposing anything about
-- res_rooms itself, which stays landlord-private. A tenant legitimately
-- needs "is this vacant right now" to decide whether "Notify me" makes sense
-- to show at all; everything else about the room stays out of this.
create or replace function public.res_room_listing_status(p_listing_ids uuid[])
returns table (listing_id uuid, is_vacant boolean)
language sql stable security definer
set search_path = public
as $$
  select r.listing_id, (r.status = 'vacant')
  from res_rooms r
  where r.listing_id = any(p_listing_ids);
$$;

-- ── 4. GRANTS ──────────────────────────────────────────────────────────────

revoke execute on function public.res_room_listing_status(uuid[]) from public, anon;
grant execute on function public.res_room_listing_status(uuid[]) to authenticated, service_role;

revoke execute on function public.res_set_room_status(uuid,text) from public, anon;
revoke execute on function public.res_notify_room_vacancy_watchers(uuid) from public, anon, authenticated;
revoke execute on function public.res_watch_room_vacancy(uuid) from public, anon;
revoke execute on function public.res_unwatch_room_vacancy(uuid) from public, anon;

grant execute on function public.res_set_room_status(uuid,text) to authenticated, service_role;
grant execute on function public.res_notify_room_vacancy_watchers(uuid) to service_role;
grant execute on function public.res_watch_room_vacancy(uuid) to authenticated, service_role;
grant execute on function public.res_unwatch_room_vacancy(uuid) to authenticated, service_role;
