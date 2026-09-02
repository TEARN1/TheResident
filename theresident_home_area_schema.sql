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
