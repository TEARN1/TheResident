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

-- ===========================================================================
-- PART 1 OF 3: CORE, SAFETY, SERVICE DESK, HOUSING
-- ===========================================================================
--
-- This file was one 9,002-line schema. It is split into three parts at
-- section boundaries so it stays editable and reviewable; the parts
-- concatenate back to the original, byte for byte.
--
-- APPLY IN ORDER: part1 -> part2 -> part3. Later parts depend on earlier ones.
--   part1 (this file) - core tables, safety, org broadcasts, service desk,
--                       housing, gossip reactions            (sections 01-13)
--   part2 - home areas, jurisdictions, area broadcasts, billing, official
--           verification, grant lockdowns, RLS perf          (sections 14-35)
--   part3 - room vacancy, client-error admin view, platform health,
--           definer fixes, moderation, operations            (sections 36-45)
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
  perform public.res_check_rate_limit('toggle', 300, 3600);
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
  perform public.res_check_rate_limit('toggle', 300, 3600);
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
  perform public.res_check_rate_limit('toggle', 300, 3600);
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
  perform public.res_check_rate_limit('lift_book', 30, 3600);
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
  perform public.res_check_rate_limit('group_buy_pledge', 30, 86400);
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
  perform public.res_check_rate_limit('create_room', 40, 86400);
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
  perform public.res_check_rate_limit('advertise_room', 20, 86400);
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
  perform public.res_check_rate_limit('delete_property', 10, 3600);
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
  perform public.res_check_rate_limit('kin_link', 10, 86400);
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


