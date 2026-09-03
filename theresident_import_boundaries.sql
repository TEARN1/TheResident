-- theresident_import_boundaries.sql
--
-- Loads res_jurisdictions from data/boundaries/za-municipalities.json. This is
-- the file that turns "a councillor cannot reach past their ward" from a
-- promise into a fact about geometry — until it has run, res_jurisdictions is
-- empty, no official has an area, and the whole officials feature is inert.
--
-- HOW IT GETS THE DATA. Via pg_net, straight from the raw file on GitHub,
-- because the data is far too large to paste into a SQL editor. That also
-- makes the import reproducible: the URL pins a commit, so re-running it
-- produces exactly the same boundaries rather than whatever the branch says
-- today.
--
-- ONLY MUNICIPALITIES ARE FETCHED. Districts, provinces and the national
-- outline are unions of those same municipalities and are built here. That is
-- not just to save bandwidth: res_targetable_jurisdictions decides what an
-- official may target with ST_Covers(parent, child), and building parents from
-- their children in the same engine that later runs that test is the only way
-- to be sure it holds. Computing them elsewhere and hoping they survive the
-- trip does not survive the trip — the first attempt at this failed on 204 of
-- 274 pairs, purely on floating-point grounds.
--
-- THE NUDGES. Each level is buffered outward slightly more than the level
-- below it. A parent and a child built from separate unions of the same
-- polygons differ by float noise where their edges coincide, and ST_Covers is
-- exact, so an equal nudge does not resolve it. 1e-5 degrees is about a metre;
-- nothing here is visible to anyone.
--
-- WARDS ARE NOT LOADED. See data/boundaries/README.md — the available ward set
-- is the 2011 one and would bind councillors to boundaries that no longer
-- exist. Use scripts/import-boundaries.mjs with a current Municipal
-- Demarcation Board file when one is to hand.
--
-- Safe to re-run: res_upsert_jurisdiction upserts on (level, external_ref), so
-- a redetermination updates an area in place rather than creating a second one
-- that would then double-notify everyone inside it.
--
-- Requires the pg_net extension. Run the steps in order.

-- ── 1. Fetch ───────────────────────────────────────────────────────────────
select net.http_get(
  url := 'https://raw.githubusercontent.com/TEARN1/TheResident/ecd414c40e3cd7a9c1aa1fd1d21e6e0191b0350a/data/boundaries/za-municipalities.json',
  timeout_milliseconds := 60000
) as request_id;

-- Wait a few seconds, then confirm it arrived before going on. Expect
-- status_code 200 and roughly 1.3 MB.
--   select id, status_code, error_msg, length(content)
--     from net._http_response order by id desc limit 1;
-- Substitute that id for the `= 1` below if it is not 1.

-- ── 2. Municipalities ──────────────────────────────────────────────────────
with payload as (select content::jsonb as doc from net._http_response where id = 1)
select count(public.res_upsert_jurisdiction(
         e ->> 'name', 'municipality', e ->> 'ref', (e -> 'geometry')::text, null, null))
       as municipalities_loaded
from payload, jsonb_array_elements(doc -> 'municipalities') e;

-- ── 3. National and provinces ──────────────────────────────────────────────
with payload as (select content::jsonb as doc from net._http_response where id = 1),
map as (
  select e ->> 'ref' as muni_ref, e ->> 'province_ref' as province_ref
  from payload, jsonb_array_elements(doc -> 'municipalities') e
),
national as (
  select public.res_upsert_jurisdiction(
    'South Africa', 'national', 'ZA',
    ST_AsGeoJSON(ST_Buffer(ST_Union(j.boundary::geometry), 1e-5)), null, null) as id
  from res_jurisdictions j where j.level = 'municipality'
),
provinces as (
  select public.res_upsert_jurisdiction(
    p.name, 'province', p.ref,
    ST_AsGeoJSON(ST_Buffer(ST_Union(j.boundary::geometry), 1e-6)),
    'ZA', 'national') as id
  from payload,
       jsonb_array_elements(doc -> 'meta' -> 'provinces') pe,
       lateral (select pe ->> 'ref' as ref, pe ->> 'name' as name) p
  join map m on m.province_ref = p.ref
  join res_jurisdictions j on j.level = 'municipality' and j.external_ref = m.muni_ref
  group by p.name, p.ref
)
select (select count(*) from national) as national_loaded,
       (select count(*) from provinces) as provinces_loaded;

-- ── 4. Districts ───────────────────────────────────────────────────────────
-- Metros are absent from meta.districts on purpose: a metro is a district
-- containing exactly itself, and creating both rows would offer a metro mayor
-- "City of Tshwane" twice in the targeting picker.
with payload as (select content::jsonb as doc from net._http_response where id = 1),
map as (
  select e ->> 'ref' as muni_ref, e ->> 'district_ref' as district_ref
  from payload, jsonb_array_elements(doc -> 'municipalities') e
)
select count(public.res_upsert_jurisdiction(
         d.name, 'district', d.ref,
         ST_AsGeoJSON(ST_Buffer(ST_Union(j.boundary::geometry), 1e-7)),
         d.province_ref, 'province')) as districts_loaded
from payload,
     jsonb_array_elements(doc -> 'meta' -> 'districts') de,
     lateral (select de ->> 'ref' as ref, de ->> 'name' as name,
                     de ->> 'province_ref' as province_ref) d
join map m on m.district_ref = d.ref
join res_jurisdictions j on j.level = 'municipality' and j.external_ref = m.muni_ref
group by d.name, d.ref, d.province_ref;

-- ── 5. Parent links for municipalities ─────────────────────────────────────
with payload as (select content::jsonb as doc from net._http_response where id = 1),
metros as (select jsonb_array_elements_text(doc -> 'meta' -> 'metro_district_refs') as ref from payload),
map as (
  select e ->> 'ref' as muni_ref, e ->> 'district_ref' as district_ref,
         e ->> 'province_ref' as province_ref
  from payload, jsonb_array_elements(doc -> 'municipalities') e
),
resolved as (
  select m.muni_ref,
         case when m.district_ref in (select ref from metros)
              then (select id from res_jurisdictions where level='province'  and external_ref = m.province_ref)
              else (select id from res_jurisdictions where level='district' and external_ref = m.district_ref)
         end as parent_id
  from map m
)
update res_jurisdictions j set parent_id = r.parent_id
  from resolved r
 where j.level = 'municipality' and j.external_ref = r.muni_ref and r.parent_id is not null;

-- ── 6. Verify ──────────────────────────────────────────────────────────────
-- Every one of these must come back clean. The containment check is the one
-- that matters: if it is non-zero, an official has silently lost the ability
-- to target an area inside their own jurisdiction.
select 'counts' as check,
  (select count(*) from res_jurisdictions where level='national')::text || '/' ||
  (select count(*) from res_jurisdictions where level='province')::text || '/' ||
  (select count(*) from res_jurisdictions where level='district')::text || '/' ||
  (select count(*) from res_jurisdictions where level='municipality')::text
  || '  (expect 1/9/44/213)' as detail
union all
select 'municipalities with no parent',
  (select count(*)::text from res_jurisdictions where level='municipality' and parent_id is null)
union all
select 'parent/child containment failures',
  (select count(*)::text from res_jurisdictions c join res_jurisdictions p on p.id = c.parent_id
    where not ST_Covers(p.boundary::geometry, c.boundary::geometry))
union all
select 'invalid geometries',
  (select count(*)::text from res_jurisdictions where not ST_IsValid(boundary::geometry))
union all
-- "Send to my whole area" passes the gate as ST_Covers(jurisdiction, itself),
-- which is FALSE on geography — the reason the gate casts to geometry.
select 'areas that cannot target themselves',
  (select count(*)::text from res_jurisdictions
    where not ST_Covers(boundary::geometry, boundary::geometry))
union all
select 'Church Square, Pretoria resolves to',
  (select string_agg(name, ', ' order by level)
     from res_jurisdictions
    where ST_Covers(boundary, ST_MakePoint(28.1879, -25.7461)::geography));
