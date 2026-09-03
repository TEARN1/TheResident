\set ON_ERROR_STOP on
-- The containment rule is the whole security model for area broadcasts: a
-- councillor must not be able to reach past their ward. That is a geometry
-- claim, so it gets tested against real PostGIS geometry rather than trusted.
--
-- Geography used throughout: two square wards side by side, and a
-- municipality that covers both.

grant usage on schema public, auth to authenticated;
grant select on public.res_jurisdictions to authenticated;
grant select, insert, update on auth._current to authenticated;

insert into public.profiles (id) values
  ('00000000-0000-0000-0000-000000000901'),
  ('00000000-0000-0000-0000-000000000902')
on conflict (id) do nothing;

-- Ward A covers x 0..1, Ward B covers x 2..3, the municipality covers 0..3.
insert into public.res_jurisdictions (id, name, level, external_ref, boundary) values
  ('00000000-0000-0000-0000-0000000009a1', 'Ward A', 'ward', 'WA-1',
   ST_Multi(ST_GeomFromText('POLYGON((0 0, 1 0, 1 1, 0 1, 0 0))', 4326))::geography),
  ('00000000-0000-0000-0000-0000000009b1', 'Ward B', 'ward', 'WB-1',
   ST_Multi(ST_GeomFromText('POLYGON((2 0, 3 0, 3 1, 2 1, 2 0))', 4326))::geography),
  ('00000000-0000-0000-0000-0000000009c1', 'Test Municipality', 'municipality', 'TM-1',
   ST_Multi(ST_GeomFromText('POLYGON((0 0, 3 0, 3 1, 0 1, 0 0))', 4326))::geography)
on conflict (id) do nothing;

-- A councillor bound to Ward A, and a mayor bound to the whole municipality.
insert into public.res_org_units (id, name, tier, owner_user_id, verified, jurisdiction_id) values
  ('00000000-0000-0000-0000-0000000009d1', 'Ward A Councillor', 'ward',
   '00000000-0000-0000-0000-000000000901', true, '00000000-0000-0000-0000-0000000009a1'),
  ('00000000-0000-0000-0000-0000000009e1', 'Test Mayor', 'municipality',
   '00000000-0000-0000-0000-000000000902', true, '00000000-0000-0000-0000-0000000009c1'),
  -- Same claimed authority, but nobody has verified them.
  ('00000000-0000-0000-0000-0000000009f1', 'Unverified Impostor', 'ward',
   '00000000-0000-0000-0000-000000000901', false, '00000000-0000-0000-0000-0000000009a1'),
  -- Verified, but no boundary on file.
  ('00000000-0000-0000-0000-0000000009f2', 'Verified But Unbound', 'ward',
   '00000000-0000-0000-0000-000000000901', true, null)
on conflict (id) do nothing;

-- ── The rule ───────────────────────────────────────────────────────────────

-- A councillor may target inside their own ward.
select 'councillor_can_target_own_ward' as check,
  public.res_can_broadcast_to_area(
    '00000000-0000-0000-0000-0000000009d1',
    ST_GeomFromText('POLYGON((0.2 0.2, 0.4 0.2, 0.4 0.4, 0.2 0.4, 0.2 0.2))', 4326)::geography
  ) as pass;

-- THE ONE THAT MATTERS: a councillor may NOT reach the neighbouring ward.
select 'councillor_cannot_reach_neighbouring_ward' as check,
  public.res_can_broadcast_to_area(
    '00000000-0000-0000-0000-0000000009d1',
    ST_GeomFromText('POLYGON((2.2 0.2, 2.4 0.2, 2.4 0.4, 2.2 0.4, 2.2 0.2))', 4326)::geography
  ) = false as pass;

-- Nor may they target an area that merely OVERLAPS their ward — partial
-- containment is not containment.
select 'councillor_cannot_straddle_the_boundary' as check,
  public.res_can_broadcast_to_area(
    '00000000-0000-0000-0000-0000000009d1',
    ST_GeomFromText('POLYGON((0.5 0.2, 1.5 0.2, 1.5 0.4, 0.5 0.4, 0.5 0.2))', 4326)::geography
  ) = false as pass;

-- A mayor may target a single ward inside their municipality...
select 'mayor_can_target_one_ward' as check,
  public.res_can_broadcast_to_area(
    '00000000-0000-0000-0000-0000000009e1',
    ST_GeomFromText('POLYGON((2.2 0.2, 2.4 0.2, 2.4 0.4, 2.2 0.4, 2.2 0.2))', 4326)::geography
  ) as pass;

-- ...and the whole municipality at once.
select 'mayor_can_target_whole_municipality' as check,
  public.res_can_broadcast_to_area(
    '00000000-0000-0000-0000-0000000009e1',
    ST_GeomFromText('POLYGON((0 0, 3 0, 3 1, 0 1, 0 0))', 4326)::geography
  ) as pass;

-- Regression guard for a real PostGIS trap this harness caught: on the
-- geography type, a polygon does not cover ITSELF, so an official targeting
-- their exact own boundary would have been refused in production. The schema
-- therefore compares in the geometry domain. If someone "simplifies" those
-- casts away, the mayor_can_target_whole_municipality case above breaks and
-- this pair of assertions explains why.
select 'geography_polygon_does_not_cover_itself' as check,
  ST_Covers(
    ST_GeomFromText('POLYGON((0 0, 3 0, 3 1, 0 1, 0 0))', 4326)::geography,
    ST_GeomFromText('POLYGON((0 0, 3 0, 3 1, 0 1, 0 0))', 4326)::geography
  ) = false as pass;

select 'geometry_domain_polygon_does_cover_itself' as check,
  ST_Covers(
    ST_GeomFromText('POLYGON((0 0, 3 0, 3 1, 0 1, 0 0))', 4326)::geography::geometry,
    ST_GeomFromText('POLYGON((0 0, 3 0, 3 1, 0 1, 0 0))', 4326)::geography::geometry
  ) as pass;

-- ── The verification gate ──────────────────────────────────────────────────
-- An unverified body cannot broadcast to an area AT ALL, even one it claims.
select 'unverified_cannot_broadcast_to_any_area' as check,
  public.res_can_broadcast_to_area(
    '00000000-0000-0000-0000-0000000009f1',
    ST_GeomFromText('POLYGON((0.2 0.2, 0.4 0.2, 0.4 0.4, 0.2 0.4, 0.2 0.2))', 4326)::geography
  ) = false as pass;

-- Verified but with no boundary recorded is also refused: authority has to be
-- on file before it can be exercised.
select 'verified_without_jurisdiction_is_refused' as check,
  public.res_can_broadcast_to_area(
    '00000000-0000-0000-0000-0000000009f2',
    ST_GeomFromText('POLYGON((0.2 0.2, 0.4 0.2, 0.4 0.4, 0.2 0.4, 0.2 0.2))', 4326)::geography
  ) = false as pass;

-- ── Reasons, so the composer can explain a refusal ─────────────────────────
select 'reason_not_verified' as check,
  public.res_area_broadcast_block_reason('00000000-0000-0000-0000-0000000009f1',
    ST_GeomFromText('POLYGON((0.2 0.2, 0.4 0.2, 0.4 0.4, 0.2 0.4, 0.2 0.2))', 4326)::geography
  ) = 'not_verified' as pass;

select 'reason_no_jurisdiction' as check,
  public.res_area_broadcast_block_reason('00000000-0000-0000-0000-0000000009f2',
    ST_GeomFromText('POLYGON((0.2 0.2, 0.4 0.2, 0.4 0.4, 0.2 0.4, 0.2 0.2))', 4326)::geography
  ) = 'no_jurisdiction' as pass;

select 'reason_outside_jurisdiction' as check,
  public.res_area_broadcast_block_reason('00000000-0000-0000-0000-0000000009d1',
    ST_GeomFromText('POLYGON((2.2 0.2, 2.4 0.2, 2.4 0.4, 2.2 0.4, 2.2 0.2))', 4326)::geography
  ) = 'outside_jurisdiction' as pass;

select 'reason_null_when_allowed' as check,
  public.res_area_broadcast_block_reason('00000000-0000-0000-0000-0000000009d1',
    ST_GeomFromText('POLYGON((0.2 0.2, 0.4 0.2, 0.4 0.4, 0.2 0.4, 0.2 0.2))', 4326)::geography
  ) is null as pass;

-- ── "Which area am I in?" is strictly self-scoped ──────────────────────────
set role authenticated;
update auth._current set uid = '00000000-0000-0000-0000-000000000901';
select public.res_set_home_area(0.5, 0.5, 'exact', null, null, null);

select 'my_jurisdictions_finds_my_ward' as check,
  (select count(*) from public.res_my_jurisdictions() where name = 'Ward A') = 1 as pass;
select 'my_jurisdictions_includes_the_municipality_above_it' as check,
  (select count(*) from public.res_my_jurisdictions() where name = 'Test Municipality') = 1 as pass;
select 'my_jurisdictions_excludes_the_ward_i_am_not_in' as check,
  (select count(*) from public.res_my_jurisdictions() where name = 'Ward B') = 0 as pass;

-- A resident with no home area gets nothing back rather than an error.
update auth._current set uid = '00000000-0000-0000-0000-000000000902';
select 'no_home_area_means_no_jurisdictions' as check,
  (select count(*) from public.res_my_jurisdictions()) = 0 as pass;

-- A signed-in user must NOT be able to redraw the map of who governs what.
do $$ begin
  begin
    perform public.res_upsert_jurisdiction('Self-declared Ward', 'ward', 'HACK-1',
      '{"type":"Polygon","coordinates":[[[9,9],[9.1,9],[9.1,9.1],[9,9.1],[9,9]]]}');
    raise exception 'TEST FAILED: an ordinary user imported a jurisdiction';
  exception when insufficient_privilege then
    null;
  when others then
    if sqlerrm like 'TEST FAILED%' then raise; end if;
  end;
end $$;
select 'authenticated_cannot_import_jurisdictions' as check,
  (select count(*) from public.res_jurisdictions where external_ref = 'HACK-1') = 0 as pass;

reset role;

-- ── Import ─────────────────────────────────────────────────────────────────
-- Upsert keyed on (level, external_ref) so a re-import after a boundary
-- redetermination updates the ward rather than creating a second one that
-- would double-notify everyone inside it.
select public.res_upsert_jurisdiction('Ward C', 'ward', 'WC-1',
  '{"type":"Polygon","coordinates":[[[4,0],[5,0],[5,1],[4,1],[4,0]]]}') as first_import \gset

select 'import_creates_a_ward' as check,
  (select count(*) from public.res_jurisdictions where external_ref = 'WC-1') = 1 as pass;

-- Same ref, new shape and name: must update in place.
select public.res_upsert_jurisdiction('Ward C (redetermined)', 'ward', 'WC-1',
  '{"type":"Polygon","coordinates":[[[4,0],[6,0],[6,1],[4,1],[4,0]]]}') as second_import \gset

select 'reimport_updates_rather_than_duplicates' as check,
  (select count(*) from public.res_jurisdictions where external_ref = 'WC-1') = 1 as pass;
select 'reimport_kept_the_same_row' as check, :'first_import'::uuid = :'second_import'::uuid as pass;
select 'reimport_applied_the_new_name' as check,
  (select name from public.res_jurisdictions where external_ref = 'WC-1') = 'Ward C (redetermined)' as pass;

-- A Polygon is normalised to MultiPolygon so the column type and every
-- downstream comparison see one shape.
select 'import_normalises_to_multipolygon' as check,
  (select ST_GeometryType(boundary::geometry) from public.res_jurisdictions where external_ref = 'WC-1')
    = 'ST_MultiPolygon' as pass;

do $$ begin
  begin
    perform public.res_upsert_jurisdiction('Broken', 'ward', 'BAD-1', 'not json at all');
    raise exception 'TEST FAILED: invalid GeoJSON was accepted';
  exception when others then
    if sqlerrm like 'TEST FAILED%' then raise; end if;
  end;
end $$;
select 'import_rejects_invalid_geojson' as check, true as pass;

reset role;


-- ── Grant boundary ─────────────────────────────────────────────────────────
-- The boundary map decides who may broadcast to whom, so a resident who could
-- redraw it would be a resident granting themselves authority. The SELECT-only
-- policy refuses writes; these pin the grants behind it, which Supabase's
-- defaults had left open on the live project until a sweep found them.
select 'residents_cannot_redraw_the_boundary_map' as check,
  not has_table_privilege('authenticated', 'public.res_jurisdictions', 'insert')
  and not has_table_privilege('authenticated', 'public.res_jurisdictions', 'update')
  and not has_table_privilege('authenticated', 'public.res_jurisdictions', 'delete') as pass;

select 'residents_can_still_read_the_boundary_map' as check,
  has_table_privilege('authenticated', 'public.res_jurisdictions', 'select') as pass;

select 'signed_out_visitors_cannot_read_the_boundary_map' as check,
  not has_table_privilege('anon', 'public.res_jurisdictions', 'select') as pass;
