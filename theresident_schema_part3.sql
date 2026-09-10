-- ===========================================================================
-- THE RESIDENT — COMPLETE DATABASE SCHEMA — PART 3 OF 3: OPERATIONS AND MODERATION
-- ===========================================================================
--
-- The schema of record was one 9,002-line file. Editors, review tools and the
-- Supabase SQL editor all struggle at that size, so it is split into three
-- parts at section boundaries. Nothing else changed: the parts concatenate
-- back to the original, byte for byte.
--
-- APPLY IN ORDER: part1 → part2 → part3. Later parts depend on earlier ones.
--   part1 — core tables, safety, org broadcasts, service desk, housing
--   part2 — home areas, jurisdictions, area broadcasts, billing, hardening
--   part3 — room vacancy, platform health, moderation, operations
--
-- SAFE TO RE-RUN, as before: every statement is `if not exists`,
-- `create or replace`, or a drop-then-create pair.
--
-- Part 1 carries the original file's full preamble; read it there first.
-- ===========================================================================


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


-- ==========================================================================
-- 37. theresident_client_error_admin_view.sql
-- ==========================================================================

-- theresident_client_error_admin_view.sql
--
-- res_client_errors (section 20) already captures real crashes from real
-- users — deliberately unreadable by anyone through the API, service_role
-- only, per its own comment: "a crash report is diagnostic data, not
-- something to show a user." That was the right call for residents. It also
-- meant the one person who should see this — the founder running the
-- platform — had no way to either, short of reading raw rows in the
-- Supabase dashboard.
--
-- This adds exactly one door back in: res_is_platform_admin() (section 32),
-- the same gate every other admin-only decision in this app already uses.
-- Nothing about res_client_errors' own lockdown changes — no policy, no
-- grant on the table itself. This is a narrow, read-only, admin-gated
-- reimplementation of res_client_error_summary's query, not a widening of
-- that function's grant (which stays service_role only).
--
-- Paste into the Supabase SQL editor. Additive only.

create or replace function public.res_client_error_summary_for_admin(p_hours integer default 24)
returns table (
  label text,
  occurrences bigint,
  affected_users bigint,
  last_seen timestamptz,
  sample_message text
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.res_is_platform_admin() then
    raise exception 'not_a_platform_admin';
  end if;

  return query
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
end;
$$;

revoke all on function public.res_client_error_summary_for_admin(integer) from public, anon;
grant execute on function public.res_client_error_summary_for_admin(integer) to authenticated, service_role;


-- ==========================================================================
-- 38. RLS that production has and the rebuild did not
-- ==========================================================================
--
-- Found by scripts/restore-drill.sh on its very first run: rebuilding this
-- schema from zero produced a database where TWELVE res_ tables had row
-- level security switched off entirely — among them res_saved_pins (where
-- residents keep locations), res_subscriptions (billing), and
-- res_properties (a landlord's private record of what they own).
--
-- Production is fine. Every one of those twelve has RLS enabled live. The
-- bug was that nothing in this repo ever said so: the tables and most of
-- their policies were versioned, but the `alter table ... enable row level
-- security` was only ever issued out-of-band, so the policies sat in the
-- rebuild inert — present, correct, and enforcing nothing.
--
-- That is the worst shape a DR bug can take. A restore during an outage
-- would have looked completely healthy: right tables, right policies, app
-- boots, sign-in works — while every resident's saved locations were
-- readable by anyone holding the publishable key. Nobody would have looked,
-- because nothing would have appeared wrong.
--
-- Enabling RLS is idempotent and is a no-op against production, where it is
-- already on. It only changes the outcome of a rebuild — which is exactly
-- the situation nobody would be in a position to debug carefully.

alter table public.res_gossip_comments   enable row level security;
alter table public.res_gossip_posts      enable row level security;
alter table public.res_infra_providers   enable row level security;
alter table public.res_moderation_actions enable row level security;
alter table public.res_notification_prefs enable row level security;
alter table public.res_properties        enable row level security;
alter table public.res_reputation        enable row level security;
alter table public.res_reviews           enable row level security;
alter table public.res_saved_pins        enable row level security;
alter table public.res_saved_searches    enable row level security;
alter table public.res_subscriptions     enable row level security;
alter table public.res_trust_connections enable row level security;

-- Two policies existed only in production and in no file here. Transcribed
-- from pg_policies rather than reinvented: both are deliberately open reads.
-- Provider reference data (who to report a fault to) and reputation scores
-- are public by design — the point of a public track record is that it is
-- public. Writes remain closed: neither table grants insert/update/delete to
-- anon or authenticated, and section 32's lockdown asserts that.
drop policy if exists res_infra_providers_select on public.res_infra_providers;
create policy res_infra_providers_select on public.res_infra_providers
  for select to anon, authenticated using (true);

drop policy if exists res_reputation_select on public.res_reputation;
create policy res_reputation_select on public.res_reputation
  for select to authenticated using (true);


-- ==========================================================================
-- 39. theresident_platform_health.sql
-- ==========================================================================

-- theresident_platform_health.sql
--
-- Subsystems that are broken but silent are the worst kind of broken,
-- because everything downstream looks fine. This is the check that makes
-- them loud, on the founder's own profile page, next to the crash reports.
--
-- THE ONE THAT PROMPTED IT. web_push_subscriptions holds twelve rows —
-- twelve real people who were asked for notification permission on a real
-- device and said yes. The vault secret the dispatcher needs to authenticate
-- has never been set, so not one of those notifications has ever been
-- delivered, and nothing anywhere said so. Twelve residents believe an
-- evacuation notice would reach their lock screen. It would not.
--
-- Nothing here fixes anything. It reports. Every check answers one question:
-- "is this subsystem actually able to do the thing users believe it does?"
--
-- Admin-gated by res_is_platform_admin(), same as the crash-report summary.
--
-- Paste into the Supabase SQL editor. Additive only.

create or replace function public.res_platform_health()
returns table (
  component text,
  status text,      -- 'ok' | 'degraded' | 'broken' | 'idle'
  detail text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_subs int;
  v_vault int;
  v_jurisdictions int;
  v_last_maint timestamptz;
  v_maint_failures int;
  v_errors int;
begin
  if not public.res_is_platform_admin() then
    raise exception 'not_a_platform_admin';
  end if;

  -- ── Push delivery ────────────────────────────────────────────────────────
  -- Counted separately so "nobody subscribed" and "everybody subscribed and
  -- it is broken" cannot be confused for each other.
  select count(*) into v_subs from web_push_subscriptions;
  begin
    select count(*) into v_vault from vault.decrypted_secrets where name = 'service_role_key';
  exception when others then
    v_vault := 0;  -- no vault access at all counts as not configured
  end;

  if v_vault = 0 and v_subs > 0 then
    return query select 'Push notifications'::text, 'broken'::text,
      v_subs || ' people have granted notification permission, but the dispatcher '
      || 'has no service_role_key in the vault — nothing has ever been delivered '
      || 'to any of them. Set it in Supabase → Vault. See docs/PUSH-SETUP.md.';
  elsif v_vault = 0 then
    return query select 'Push notifications'::text, 'idle'::text,
      'Not configured, and nobody has subscribed yet — so nothing is being missed.'::text;
  elsif v_subs = 0 then
    return query select 'Push notifications'::text, 'idle'::text,
      'Configured, but nobody has granted permission yet.'::text;
  else
    return query select 'Push notifications'::text, 'ok'::text,
      v_subs || ' subscribed devices, dispatcher configured.';
  end if;

  -- ── Area boundaries ──────────────────────────────────────────────────────
  -- Without these no official has a jurisdiction, and the whole
  -- officials/area-broadcast feature is inert regardless of how it looks.
  select count(*) into v_jurisdictions from res_jurisdictions;
  if v_jurisdictions = 0 then
    return query select 'Area boundaries'::text, 'broken'::text,
      'No jurisdictions loaded — no official can be bound to an area, so area '
      || 'broadcasts cannot reach anyone. Run theresident_import_boundaries.sql.';
  else
    return query select 'Area boundaries'::text, 'ok'::text,
      v_jurisdictions || ' areas loaded.';
  end if;

  -- ── Scheduled maintenance ────────────────────────────────────────────────
  -- These functions existed for a long time and had never executed once.
  -- Silence here means listings never expire and logs grow without bound.
  select max(ran_at) into v_last_maint from res_maintenance_runs;
  select count(*) into v_maint_failures from res_maintenance_runs
   where ran_at > now() - interval '7 days' and not ok;

  if v_last_maint is null then
    return query select 'Scheduled maintenance'::text, 'broken'::text,
      'Has never run. Listings will not expire, tools never return, logs grow '
      || 'without bound.'::text;
  elsif v_last_maint < now() - interval '48 hours' then
    return query select 'Scheduled maintenance'::text, 'broken'::text,
      'Last ran ' || to_char(v_last_maint, 'YYYY-MM-DD HH24:MI')
      || ' — the daily job has stopped.';
  elsif v_maint_failures > 0 then
    return query select 'Scheduled maintenance'::text, 'degraded'::text,
      v_maint_failures || ' task failure(s) in the last 7 days.';
  else
    return query select 'Scheduled maintenance'::text, 'ok'::text,
      'Last ran ' || to_char(v_last_maint, 'YYYY-MM-DD HH24:MI') || '.';
  end if;

  -- ── Crash reports ────────────────────────────────────────────────────────
  select count(*) into v_errors from res_client_errors
   where created_at > now() - interval '24 hours';
  if v_errors = 0 then
    return query select 'Crash reports'::text, 'ok'::text,
      'No crashes reported in the last 24 hours.'::text;
  else
    return query select 'Crash reports'::text, 'degraded'::text,
      v_errors || ' crash(es) in the last 24 hours — see the list below.';
  end if;
end;
$$;

revoke all on function public.res_platform_health() from public, anon;
grant execute on function public.res_platform_health() to authenticated, service_role;


-- ==========================================================================
-- 40. theresident_definer_authorisation_fixes.sql
-- ==========================================================================

-- theresident_definer_authorisation_fixes.sql
--
-- Four SECURITY DEFINER functions that did not check who was asking.
--
-- A SECURITY DEFINER function runs as its OWNER, not its caller. The RLS on
-- every table it touches is therefore irrelevant inside it — the body is the
-- only thing standing between a caller and the data. An earlier audit said
-- exactly this and named res_household_members as "the clearest IDOR
-- candidate", and then nobody read it. This is that review.
--
-- These four were among the 75 functions that lived only in production (see
-- scripts/sync-functions.sh), which is precisely why they had never been
-- reviewed: they were not in the repo to read.
--
-- ── 1. res_moderate — PRIVILEGE ESCALATION, proven by exploit ──────────────
--
-- The guard read:
--
--     select role into v_role from res_community_members
--      where community_id = p_community and user_id = auth.uid();
--     if v_role not in ('admin','founder') then raise exception ...
--
-- For someone who is a member of nothing, v_role is NULL. In SQL,
-- `NULL not in ('admin','founder')` is NULL — not true — and `if NULL then
-- raise` does not fire. The guard fell straight through.
--
-- Verified, not inferred: in a throwaway database a signed-in user belonging
-- to no community successfully hid another user's post. Any signed-in person
-- could hide any listing, market item, notice or gossip post on the
-- platform, remove members from any community, and promote users to admin.
--
-- This is the same fail-open-on-NULL shape as the area-billing gate fixed
-- earlier in this schema; `coalesce` is the fix in both places.
--
-- A second, quieter bug: the subject was never scoped to the community, so
-- even a legitimate admin of one community could hide content belonging to
-- another. Now scoped by community_id where the table has one. res_listings
-- and res_notice_events have no community_id at all, so community admins
-- cannot be scoped for those — they are restricted to the owner or a
-- platform admin rather than left open to every community admin on the
-- platform.
create or replace function public.res_moderate(
  p_community uuid,
  p_action text,
  p_subject_type text,
  p_subject_id uuid,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare v_role text;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;

  select role into v_role from res_community_members
   where community_id = p_community and user_id = auth.uid();

  -- coalesce is load-bearing — see the header. Without it a non-member
  -- passes this check.
  if coalesce(v_role, '') not in ('admin', 'founder') then
    raise exception 'admin_required';
  end if;

  if p_action in ('hide','unhide') then
    if p_subject_type = 'listing' then
      if not public.res_is_platform_admin()
         and not exists (select 1 from res_listings where id = p_subject_id and landlord_id = auth.uid()) then
        raise exception 'not_your_listing: listings are not community-scoped';
      end if;
      update res_listings set hidden = (p_action = 'hide') where id = p_subject_id;

    elsif p_subject_type = 'market_item' then
      update res_market_items set hidden = (p_action = 'hide')
       where id = p_subject_id and community_id = p_community;

    elsif p_subject_type = 'notice' then
      if not public.res_is_platform_admin()
         and not exists (select 1 from res_notice_events where id = p_subject_id and posted_by_id = auth.uid()) then
        raise exception 'not_your_notice: notices are not community-scoped';
      end if;
      update res_notice_events set hidden = (p_action = 'hide') where id = p_subject_id;

    elsif p_subject_type = 'gossip_post' then
      update res_gossip_posts set hidden = (p_action = 'hide')
       where id = p_subject_id and community_id = p_community;
    end if;

  elsif p_action = 'remove_member' then
    delete from res_community_members where community_id = p_community and user_id = p_subject_id;
  elsif p_action = 'promote' then
    update res_community_members set role = 'admin'
     where community_id = p_community and user_id = p_subject_id;
  elsif p_action = 'demote' then
    if v_role <> 'founder' then raise exception 'founder_required'; end if;
    update res_community_members set role = 'member'
     where community_id = p_community and user_id = p_subject_id and role <> 'founder';
  end if;

  insert into res_moderation_actions (community_id, actor_id, action, subject_type, subject_id, reason)
  values (p_community, auth.uid(), p_action, p_subject_type, p_subject_id, p_reason);
end;
$$;

-- ── 2. res_household_members — IDOR: who lives at any address ──────────────
--
-- The body contained no reference to auth.uid() at all. Any signed-in user
-- could pass any listing id and receive the user ids of the landlord and
-- every approved tenant. Listing ids are trivially obtainable because
-- res_listings is world-readable (`select using (true)`).
--
-- So this answered "who lives at this address?" for every address on the
-- platform, to anyone with an account — in an app that also holds home areas
-- and safety alerts. res_is_household_member already encodes the right rule
-- and is what the RLS policies use.
create or replace function public.res_household_members(p_listing uuid)
returns table(user_id uuid, role text)
language sql
stable
security definer
set search_path to 'public'
as $$
  select l.landlord_id, 'landlord'
    from res_listings l
   where l.id = p_listing
     and public.res_is_household_member(p_listing, auth.uid())
  union
  select r.tenant_id, 'tenant'
    from res_room_requests r
   where r.listing_id = p_listing
     and r.status = 'approved'
     and public.res_is_household_member(p_listing, auth.uid());
$$;

-- ── 3. res_property_occupancy — any landlord's figures ─────────────────────
--
-- Same shape: no auth check, and res_properties is otherwise landlord-private
-- by RLS. Property ids leak through res_listings.property_id, which is
-- world-readable, so any signed-in user could read any landlord's occupancy.
create or replace function public.res_property_occupancy(p_property uuid)
returns jsonb
language sql
stable
security definer
set search_path to 'public'
as $$
  select jsonb_build_object(
    'total_rooms', p.total_rooms,
    'occupied_rooms', (select count(*) from res_listings l where l.property_id = p.id and l.status = 'taken'),
    'listed_rooms', (select count(*) from res_listings l where l.property_id = p.id)
  )
  from res_properties p
  where p.id = p_property
    and p.landlord_id = auth.uid();
$$;

-- ── 4. res_has_household_plus — probing anyone's subscription ──────────────
--
-- The client only ever passes the caller's own id, but the function accepted
-- any id and answered from res_subscriptions regardless of its RLS, so a
-- crafted call could probe whether any resident pays. Answering only for the
-- caller costs the client nothing.
--
-- res_public_provider_tier is deliberately left alone: a provider's tier is a
-- badge other people are meant to see, which is what its name says.
create or replace function public.res_has_household_plus(p_user uuid)
returns boolean
language sql
security definer
set search_path to 'public'
as $$
  select exists (
    select 1 from res_subscriptions
     where user_id = p_user
       and p_user = auth.uid()
       and product = 'household_plus'
       and status = 'active'
  );
$$;

revoke all on function public.res_moderate(uuid,text,text,uuid,text) from public, anon;
revoke all on function public.res_household_members(uuid) from public, anon;
revoke all on function public.res_property_occupancy(uuid) from public, anon;
revoke all on function public.res_has_household_plus(uuid) from public, anon;

grant execute on function public.res_moderate(uuid,text,text,uuid,text) to authenticated, service_role;
grant execute on function public.res_household_members(uuid) to authenticated, service_role;
grant execute on function public.res_property_occupancy(uuid) to authenticated, service_role;
grant execute on function public.res_has_household_plus(uuid) to authenticated, service_role;


-- ==========================================================================
-- 41. Internal helpers and cron sweeps that residents could call
-- ==========================================================================
--
-- Section 40 fixed functions that failed to check WHO was asking. This is the
-- other half of the same review: functions whose bodies are fine, but which
-- were never meant to be reachable from a browser at all and were granted to
-- `authenticated` anyway by Supabase's defaults.
--
-- ── res_bump_reputation — an unbounded write into the trust signal ─────────
--
-- Signature: (p_user uuid, p_points integer, p_reason text). No auth.uid()
-- anywhere in the body, granted to authenticated. Any signed-in person could
-- call it with their own id and any number of points.
--
-- Reputation is not decorative here. res_can_sell gates selling on trust
-- tier, TrustBadge renders it, and this function forwards to
-- res_award_good_neighbour, which writes reputation shared with the other app
-- (CONTRACT.md §8). So it was a free, unbounded write into the trust signal
-- of BOTH products. (It refuses p_points <= 0, so it could inflate but not
-- deflate — you could promote yourself, not punish a rival.)
--
-- It is an internal helper, not an API. The four paths that legitimately
-- award points — res_complete_chore, res_confirm_tool_return,
-- res_respond_to_alert, res_reunite_lost_found — are themselves SECURITY
-- DEFINER owned by postgres, so they still reach it while running as their
-- owner. The client never called it: zero call sites, checked.
--
-- Verified in a throwaway database: after this revoke a resident calling it
-- directly gets insufficient_privilege, and res_complete_chore still awards
-- exactly its 5 points. Blocked and still working, not blocked and broken.
--
-- ── The maintenance sweeps — platform-wide mutations on demand ─────────────
--
-- Cron jobs. res_run_maintenance() calls them on a schedule as a privileged
-- role, nothing in the app calls them, and no resident has any business
-- running a platform-wide UPDATE whenever they like — res_release_stale_claims
-- releases other people's utility-token claims, res_expire_stale_listings
-- pauses other people's listings. Their bodies are correct; only the grant
-- was wrong.
--
-- Guarded by to_regprocedure because these are among the functions that live
-- only in production (see scripts/sync-functions.sh). A bare REVOKE on a
-- function that does not exist is an error, which would abort a rebuild in
-- any environment that has not run sync-functions.sh yet. Absent here means
-- there is nothing to lock down.
do $$
declare
  sig text;
begin
  foreach sig in array array[
    'public.res_bump_reputation(uuid,integer,text)',
    'public.res_award_good_neighbour(uuid,integer)',
    'public.res_auto_return_tools()',
    'public.res_expire_market_items()',
    'public.res_expire_stale_alerts()',
    'public.res_expire_stale_listings()',
    'public.res_release_stale_claims()'
  ]
  loop
    if to_regprocedure(sig) is not null then
      execute format('revoke all on function %s from public, anon, authenticated', sig);
      execute format('grant execute on function %s to service_role', sig);
    end if;
  end loop;
end
$$;


-- ==========================================================================
-- SECTION 42 — THE TRUST PAIR: TWO MORE AUTHORISATION HOLES
-- ==========================================================================
--
-- Both found by continuing the SECURITY DEFINER review down the list of
-- functions that take a caller-supplied user id and default it to
-- `auth.uid()`. That signature is the tell: it means the function is meant to
-- act on you, but will act on anyone you name unless something stops it.
--
-- ── 1. res_sync_trust — a dead guard over a cross-app write ────────────────
--
-- The original tried to enforce "own trust only":
--
--     IF v_user <> auth.uid() AND current_user IN ('authenticated','anon')
--
-- current_user inside a SECURITY DEFINER function is the function's OWNER,
-- not the caller — postgres, here. session_user is the caller. So the second
-- half of that AND was permanently false and the branch could never fire.
-- Verified empirically rather than from memory: a definer function returning
-- (current_user, session_user), called as authenticated, returns
-- ('postgres', 'authenticated').
--
-- Consequence: any signed-in resident could call
-- res_sync_trust('<someone else>') and write resident_trust_tier, is_verified
-- and social_integrity_score onto that person's row in `profiles` — a table
-- this repo does not own (CONTRACT.md §2) carrying a trust signal shared with
-- the other app (CONTRACT.md §8).
--
-- The values are recomputed from the victim's own res_profiles rather than
-- supplied by the attacker, so this is forced promotion, not forgery. It is
-- still a stranger writing to another app's table on a user's behalf.
--
-- The fix states the intent directly. auth.uid() is NULL for internal callers
-- (cron, service_role), which legitimately sync anyone; a browser session
-- always has one and may only ever sync itself.
create or replace function public.res_sync_trust(p_user uuid default null)
returns text language plpgsql security definer set search_path to 'public'
as $$
DECLARE
  v_user UUID := COALESCE(p_user, auth.uid());
  v_rp RECORD;
  v_trusted BOOLEAN := false;
  v_verified BOOLEAN := false;
  v_tier TEXT;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'not signed in'; END IF;
  IF auth.uid() IS NOT NULL AND v_user <> auth.uid() THEN
    RAISE EXCEPTION 'may only sync own trust';
  END IF;
  IF to_regclass('public.res_profiles') IS NULL THEN RETURN NULL; END IF;

  SELECT * INTO v_rp FROM public.res_profiles WHERE id = v_user;
  IF FOUND THEN
    v_trusted := v_rp.role IS NOT NULL
             AND COALESCE(length(trim(v_rp.bio)), 0) >= 20
             AND v_rp.gender IS NOT NULL;
    v_verified := v_trusted
              AND COALESCE(v_rp.verification_doc_url, '') <> ''
              AND v_rp.verification_status = 'reviewed';
  END IF;

  v_tier := CASE WHEN v_verified THEN 'verified' WHEN v_trusted THEN 'trusted' ELSE NULL END;

  UPDATE public.profiles SET
    resident_trust_tier = v_tier,
    is_verified = CASE WHEN v_verified THEN true ELSE is_verified END,
    social_integrity_score = GREATEST(
      COALESCE(social_integrity_score, 50),
      CASE WHEN v_verified THEN 75 WHEN v_trusted THEN 62 ELSE 0 END
    )
  WHERE id = v_user;

  RETURN v_tier;
END;
$$;

-- ── 2. res_trust_gate — no ownership check at all ──────────────────────────
--
-- Same signature, and nothing checking it. Any signed-in user could read any
-- other user's trust standing: whether their next-of-kin circle is
-- established, and therefore whether gated actions are open to them.
--
-- That is derived from someone's private social graph — how many confirmed
-- trust connections they have, and how well-connected those people are in
-- turn. res_trust_connections is not readable directly; this handed out a
-- summary of it about anyone.
create or replace function public.res_trust_gate(p_user uuid default null)
returns jsonb language plpgsql security definer set search_path to 'public'
as $$
declare
  v_user uuid := coalesce(p_user, auth.uid());
  v_direct int;
  v_qualified int;
  v_unlocked boolean;
  v_status text;
begin
  if v_user is null then raise exception 'not signed in'; end if;
  if auth.uid() is not null and v_user <> auth.uid() then
    raise exception 'may only read own trust standing';
  end if;

  select count(distinct other) into v_direct from (
    select case when requester_id = v_user then connection_id else requester_id end as other
    from res_trust_connections
    where status = 'confirmed' and (requester_id = v_user or connection_id = v_user)
  ) t;

  select count(*) into v_qualified from (
    select case when requester_id = v_user then connection_id else requester_id end as other
    from res_trust_connections
    where status = 'confirmed' and (requester_id = v_user or connection_id = v_user)
  ) direct
  where (
    select count(distinct other2) from (
      select case when requester_id = direct.other then connection_id else requester_id end as other2
      from res_trust_connections
      where status = 'confirmed' and (requester_id = direct.other or connection_id = direct.other)
    ) t2
  ) >= 5;

  v_unlocked := v_direct >= 5 and v_qualified >= 3;
  v_status := case
    when v_unlocked then 'established'
    when v_direct >= 3 then 'building'
    else 'new'
  end;

  return jsonb_build_object('status', v_status, 'unlocked', v_unlocked);
end;
$$;


-- ==========================================================================
-- SECTION 44 — THE PANIC ALERT REACHED NOBODY
-- ==========================================================================
--
-- Measured on live data before this section existed:
--
--   40 profiles, of which exactly 1 had is_verified = true — and the
--   recipient query REQUIRED it. A neighbourhood panic alert notified one
--   account.
--
--   The fallback branch matched on profiles.city. Zero profiles have a city
--   set, so an alert not tied to a community reached nobody at all.
--
--   No push was sent on this path, so even that one person saw it only if
--   they already had the app open — which is not the state a phone is in
--   when something is happening on your street.
--
-- Meanwhile the landing page promised "real-time community panic alerts".
-- Of everything in this codebase, that gap is the one that could actually
-- hurt somebody: a person in danger relying on a feature that does not
-- deliver.
--
-- Two changes, and one honest admission.
--
-- 1. is_verified is no longer a gate. Verification is a trust signal for
--    TRANSACTIONS — deciding who can sell, who can be trusted with a deposit.
--    It has no business deciding who gets warned about danger, and requiring
--    it made the alert reach exactly one person.
--
-- 2. The audience resolves from Resident-owned location data: community
--    membership, res_profiles.suburb, and res_home_areas within 3km.
--    res_home_areas exists precisely for this. profiles.city, which the old
--    query used, is empty for every account in the database.
--
-- 3. THE ADMISSION: this does not make the feature work. There are currently
--    0 community memberships, 0 residents with a suburb, and 0 with a home
--    pin. There is no signal by which any resident can be reached, so an
--    alert raised today still notifies nobody. The fix is necessary and not
--    sufficient, and the product must say so — which is what
--    res_alert_reach_preview below is for.
create or replace function public.res_broadcast_alert(p_alert_id uuid)
returns void
language plpgsql security definer set search_path to 'public', 'extensions'
as $$
declare
  v_alert record;
  v_recipients uuid[];
  v_key text;
  v_url text;
begin
  select * into v_alert from res_alerts where id = p_alert_id;
  if not found then
    raise exception 'alert not found';
  end if;

  -- A UNION of weak signals, deliberately. For a safety alert, reaching
  -- someone slightly too far away is a far smaller harm than reaching nobody.
  select array_agg(distinct uid) into v_recipients from (
    select cm.user_id as uid
      from res_community_members cm
     where v_alert.community_id is not null
       and cm.community_id = v_alert.community_id
    union
    select rp.id
      from res_profiles rp
     where v_alert.suburb is not null and rp.suburb is not null
       and lower(rp.suburb) = lower(v_alert.suburb)
    union
    select ha.user_id
      from res_home_areas ha
     where v_alert.lat is not null and v_alert.lon is not null
       and public.res_distance_m(ha.lat, ha.lon, v_alert.lat, v_alert.lon) <= 3000
  ) t
  where uid is not null and uid <> v_alert.user_id;

  if v_recipients is null or array_length(v_recipients, 1) is null then
    return;
  end if;

  insert into notifications (recipient_id, actor_id, type, title, body, data)
  select r, v_alert.user_id, 'res_alert_panic',
         '🚨 NEIGHBOURHOOD ALERT: ' || v_alert.title,
         v_alert.description,
         jsonb_build_object('alert_id', v_alert.id, 'kind', v_alert.kind)
  from unnest(v_recipients) as r;

  -- Push, so it reaches a phone with the app closed. Wrapped so a push
  -- failure can never undo an alert already delivered in-app. Still needs
  -- VAPID_PRIVATE_KEY on the edge function; until that is set this degrades
  -- to in-app only rather than erroring.
  begin
    select decrypted_secret into v_key
      from vault.decrypted_secrets where name = 'service_role_key';
    if v_key is not null then
      v_url := 'https://feevvddvrjmfbhffccbf.supabase.co';
      perform net.http_post(
        url := v_url || '/functions/v1/web-push-send',
        headers := jsonb_build_object('Content-Type', 'application/json',
                                      'Authorization', 'Bearer ' || v_key),
        body := jsonb_build_object(
          'userIds', to_jsonb(v_recipients),
          'title', '🚨 ' || v_alert.title,
          'body', coalesce(v_alert.description, 'A neighbour has raised an alert nearby.'),
          'url', '/dashboard/community?tab=safety&alert=' || v_alert.id::text,
          'tag', 'alert-' || v_alert.id::text,
          'requireInteraction', true)
      );
    end if;
  exception when others then
    null;
  end;
end;
$$;

-- How many neighbours would an alert actually reach, right now?
--
-- So the app can tell someone the truth at the moment they are relying on it,
-- rather than implying help is coming. Same audience logic as
-- res_broadcast_alert, deliberately: a preview that can disagree with the
-- thing it previews is worse than no preview at all.
create or replace function public.res_alert_reach_preview(
  p_lat double precision default null,
  p_lon double precision default null,
  p_suburb text default null,
  p_community uuid default null
)
returns integer
language plpgsql stable security definer set search_path to 'public'
as $$
declare
  v_me uuid := auth.uid();
  v_count integer;
begin
  if v_me is null then raise exception 'not signed in'; end if;

  select count(distinct uid) into v_count from (
    select cm.user_id as uid
      from res_community_members cm
     where p_community is not null and cm.community_id = p_community
    union
    select rp.id
      from res_profiles rp
     where p_suburb is not null and rp.suburb is not null
       and lower(rp.suburb) = lower(p_suburb)
    union
    select ha.user_id
      from res_home_areas ha
     where p_lat is not null and p_lon is not null
       and public.res_distance_m(ha.lat, ha.lon, p_lat, p_lon) <= 3000
  ) t
  where uid is not null and uid <> v_me;

  return coalesce(v_count, 0);
end;
$$;

do $$
begin
  if to_regprocedure('public.res_alert_reach_preview(double precision,double precision,text,uuid)') is not null then
    execute 'revoke all on function public.res_alert_reach_preview(double precision,double precision,text,uuid) from public, anon';
    execute 'grant execute on function public.res_alert_reach_preview(double precision,double precision,text,uuid) to authenticated, service_role';
  end if;
end $$;


-- ==========================================================================
-- SECTION 45 — SOMEBODY HAS TO BE ABLE TO READ THE COMPLAINTS
-- ==========================================================================
--
-- res_reports has existed from early on, with a full status workflow
-- (open → reviewed → actioned → dismissed), and residents could file into it
-- from the feed and the marketplace.
--
-- NOTHING IN THE CODEBASE EVER READ IT. There was no queue, no reviewer, and
-- no way to act on a complaint. Meanwhile every reporter was told:
--
--     "It is hidden from you now and will be reviewed."
--
-- Both halves were untrue. Nothing hid the content from the reporter, and no
-- one reviewed anything. res_report_content auto-hid a subject once three
-- DISTINCT residents reported it — with no review, no appeal, and no notice
-- to the author — and gossip posts had no auto-hide branch at all, so
-- reporting one did nothing whatsoever.
--
-- For a platform carrying residents' statements about named landlords and
-- service providers, being able to act on a complaint is the difference
-- between a defensible position and an indefensible one. A process nobody can
-- execute is not a process.

-- Grouped by the thing complained about, not by individual complaint: a
-- reviewer decides about a post, not about each person who objected to it.
create or replace function public.res_pending_reports(p_limit integer default 100)
returns table (
  subject_type text,
  subject_id uuid,
  report_count integer,
  reasons text[],
  first_reported_at timestamptz,
  last_reported_at timestamptz,
  details text[],
  currently_hidden boolean
)
language plpgsql stable security definer set search_path to 'public'
as $$
begin
  if not public.res_is_platform_admin() then
    raise exception 'admin_required';
  end if;

  return query
  select r.subject_type,
         r.subject_id,
         count(distinct r.reporter_id)::integer,
         array_agg(distinct r.reason),
         min(r.created_at),
         max(r.created_at),
         -- Reporter identities are deliberately NOT returned. A reviewer
         -- needs to know what was said and how many people said it, not who;
         -- exposing complainants to whoever holds the admin role invites
         -- retaliation.
         array_remove(array_agg(distinct r.detail), null),
         coalesce(
           case r.subject_type
             when 'listing'     then (select l.hidden from res_listings l where l.id = r.subject_id)
             when 'market_item' then (select m.hidden from res_market_items m where m.id = r.subject_id)
             when 'notice'      then (select ne.hidden from res_notice_events ne where ne.id = r.subject_id)
             when 'gossip_post' then (select g.hidden from res_gossip_posts g where g.id = r.subject_id)
           end, false)
  from res_reports r
  where r.status = 'open'
  group by r.subject_type, r.subject_id
  order by count(distinct r.reporter_id) desc, min(r.created_at) asc
  limit greatest(1, least(coalesce(p_limit, 100), 500));
end;
$$;

create or replace function public.res_resolve_report(
  p_subject_type text,
  p_subject_id uuid,
  p_action text,          -- 'hide' | 'restore' | 'dismiss'
  p_note text default null
)
returns void
language plpgsql security definer set search_path to 'public'
as $$
declare v_hide boolean;
begin
  if not public.res_is_platform_admin() then
    raise exception 'admin_required';
  end if;
  -- coalesce, not a bare comparison: `NULL not in (...)` is NULL, and
  -- `if NULL then raise` does not fire. That exact shape was a live
  -- privilege escalation in res_moderate earlier in this project.
  if coalesce(p_action, '') not in ('hide', 'restore', 'dismiss') then
    raise exception 'invalid_action';
  end if;

  if p_action in ('hide', 'restore') then
    v_hide := (p_action = 'hide');
    if p_subject_type = 'listing' then
      update res_listings set hidden = v_hide where id = p_subject_id;
    elsif p_subject_type = 'market_item' then
      update res_market_items set hidden = v_hide where id = p_subject_id;
    elsif p_subject_type = 'notice' then
      update res_notice_events set hidden = v_hide where id = p_subject_id;
    elsif p_subject_type = 'gossip_post' then
      -- Reportable all along, but with no auto-hide branch, so reporting a
      -- feed post did nothing at all.
      update res_gossip_posts set hidden = v_hide where id = p_subject_id;
    else
      raise exception 'unknown_subject_type: %', p_subject_type;
    end if;
  end if;

  update res_reports
     set status = case when p_action = 'dismiss' then 'dismissed' else 'actioned' end
   where subject_type = p_subject_type
     and subject_id = p_subject_id
     and status = 'open';

  -- Permanent record of who decided what. community_id is null because this
  -- is a platform-level decision, not a community one.
  insert into res_moderation_actions (community_id, actor_id, action, subject_type, subject_id, reason)
  values (null, auth.uid(), 'report_' || p_action, p_subject_type, p_subject_id, p_note);
end;
$$;

do $$
begin
  if to_regprocedure('public.res_pending_reports(integer)') is not null then
    execute 'revoke all on function public.res_pending_reports(integer) from public, anon';
    execute 'grant execute on function public.res_pending_reports(integer) to authenticated, service_role';
  end if;
  if to_regprocedure('public.res_resolve_report(text,uuid,text,text)') is not null then
    execute 'revoke all on function public.res_resolve_report(text,uuid,text,text) from public, anon';
    execute 'grant execute on function public.res_resolve_report(text,uuid,text,text) to authenticated, service_role';
  end if;
end $$;
