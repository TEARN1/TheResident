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
