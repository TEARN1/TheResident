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
create table if not exists public.res_infra_providers (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  kind text check (kind in ('electricity', 'water', 'municipal', 'other')) default 'other',
  region text,
  created_at timestamptz default now()
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
