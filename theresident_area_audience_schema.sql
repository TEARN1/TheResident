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
