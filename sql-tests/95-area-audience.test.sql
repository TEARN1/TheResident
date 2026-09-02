\set ON_ERROR_STOP on
-- The audience resolver decides who a government message reaches. Three
-- things must hold and none of them are obvious enough to trust: the right
-- people are found, muting is honoured except for emergencies, and the count
-- cannot be used by a stranger as a population probe.

grant usage on schema public, auth to authenticated;
grant select, insert, update on auth._current to authenticated;

-- Reuse the Phase B geography: Ward A is x 0..1, Ward B is x 2..3.
-- Residents 1 and 2 live in Ward A, resident 3 lives in Ward B.
insert into public.profiles (id) values
  ('00000000-0000-0000-0000-000000000951'),
  ('00000000-0000-0000-0000-000000000952'),
  ('00000000-0000-0000-0000-000000000953'),
  ('00000000-0000-0000-0000-000000000954'),
  ('00000000-0000-0000-0000-000000000955')
on conflict (id) do nothing;

insert into public.res_profiles (id, role, suburb, city) values
  ('00000000-0000-0000-0000-000000000951', 'tenant', null, null),
  ('00000000-0000-0000-0000-000000000952', 'tenant', null, null),
  ('00000000-0000-0000-0000-000000000953', 'tenant', null, null),
  -- No pin, but says they live in the suburb the sender is targeting.
  ('00000000-0000-0000-0000-000000000954', 'tenant', 'Testville', 'Test City'),
  -- No pin and a suburb nobody is targeting.
  ('00000000-0000-0000-0000-000000000955', 'tenant', 'Elsewhere', 'Other City')
on conflict (id) do update set suburb = excluded.suburb, city = excluded.city;

insert into public.res_home_areas (user_id, lat, lon, granularity) values
  ('00000000-0000-0000-0000-000000000951', 0.5, 0.5, 'exact'),
  ('00000000-0000-0000-0000-000000000952', 0.7, 0.7, 'exact'),
  ('00000000-0000-0000-0000-000000000953', 0.5, 2.5, 'exact')
on conflict (user_id) do update set lat = excluded.lat, lon = excluded.lon;

-- ── Containment finds the right residents ──────────────────────────────────
-- Scoped to this file's own residents: the suite shares one database and an
-- earlier file also pins someone inside Ward A, so a global count would be
-- counting other tests' fixtures.
select 'finds_both_residents_pinned_in_ward_a' as check,
  (select count(*) from public.res_resolve_area_audience(
     (select boundary from public.res_jurisdictions where external_ref = 'WA-1'),
     'important', null, null, null)
   where matched_by = 'home_area'
     and user_id in ('00000000-0000-0000-0000-000000000951',
                     '00000000-0000-0000-0000-000000000952')) = 2 as pass;

select 'excludes_the_resident_in_the_other_ward' as check,
  (select count(*) from public.res_resolve_area_audience(
     (select boundary from public.res_jurisdictions where external_ref = 'WA-1'),
     'important', null, null, null)
   where user_id = '00000000-0000-0000-0000-000000000953') = 0 as pass;

-- ── The suburb fallback, counted separately ────────────────────────────────
select 'unpinned_resident_matched_by_suburb_text' as check,
  (select count(*) from public.res_resolve_area_audience(
     (select boundary from public.res_jurisdictions where external_ref = 'WA-1'),
     'important', null, array['Testville'], null) where matched_by = 'suburb_text') = 1 as pass;

select 'unrelated_suburb_is_not_swept_in' as check,
  (select count(*) from public.res_resolve_area_audience(
     (select boundary from public.res_jurisdictions where external_ref = 'WA-1'),
     'important', null, array['Testville'], null)
   where user_id = '00000000-0000-0000-0000-000000000955') = 0 as pass;

-- Suburb text is typed by people, so matching ignores case and stray spaces.
select 'suburb_match_is_case_and_space_insensitive' as check,
  (select count(*) from public.res_resolve_area_audience(
     (select boundary from public.res_jurisdictions where external_ref = 'WA-1'),
     'important', null, array['  tEsTvIlLe '], null) where matched_by = 'suburb_text') = 1 as pass;

-- A pinned resident is never double-counted by also matching on text.
insert into public.res_profiles (id, role, suburb) values
  ('00000000-0000-0000-0000-000000000951', 'tenant', 'Testville')
on conflict (id) do update set suburb = excluded.suburb;
select 'pinned_resident_is_not_double_counted' as check,
  (select count(*) from public.res_resolve_area_audience(
     (select boundary from public.res_jurisdictions where external_ref = 'WA-1'),
     'important', null, array['Testville'], null)
   where user_id = '00000000-0000-0000-0000-000000000951') = 1 as pass;

-- ── Muting: honoured, except for the one tier that cannot be silenced ──────
insert into public.res_notification_prefs (user_id, muted_types)
  values ('00000000-0000-0000-0000-000000000952', array['res_area_broadcast'])
on conflict (user_id) do update set muted_types = excluded.muted_types;

select 'muted_resident_is_dropped_from_a_normal_broadcast' as check,
  (select count(*) from public.res_resolve_area_audience(
     (select boundary from public.res_jurisdictions where external_ref = 'WA-1'),
     'important', null, null, null)
   where user_id = '00000000-0000-0000-0000-000000000952') = 0 as pass;

-- THE ONE THAT MATTERS: an evacuation still reaches someone who muted.
select 'critical_reaches_even_a_muted_resident' as check,
  (select count(*) from public.res_resolve_area_audience(
     (select boundary from public.res_jurisdictions where external_ref = 'WA-1'),
     'critical', null, null, null)
   where user_id = '00000000-0000-0000-0000-000000000952') = 1 as pass;

-- Category muting is surgical: silence library events, still hear the police.
insert into public.res_notification_prefs (user_id, muted_types)
  values ('00000000-0000-0000-0000-000000000951', array['res_area_broadcast:library'])
on conflict (user_id) do update set muted_types = excluded.muted_types;

select 'category_mute_drops_only_that_category' as check,
  (select count(*) from public.res_resolve_area_audience(
     (select boundary from public.res_jurisdictions where external_ref = 'WA-1'),
     'important', 'library', null, null)
   where user_id = '00000000-0000-0000-0000-000000000951') = 0 as pass;

select 'category_mute_does_not_silence_other_categories' as check,
  (select count(*) from public.res_resolve_area_audience(
     (select boundary from public.res_jurisdictions where external_ref = 'WA-1'),
     'important', 'safety', null, null)
   where user_id = '00000000-0000-0000-0000-000000000951') = 1 as pass;

-- ── Radius targeting ───────────────────────────────────────────────────────
-- A tight radius around resident 1 catches them and not the resident ~25km off.
select 'radius_target_catches_the_nearby_resident' as check,
  (select count(*) from public.res_resolve_area_audience(
     public.res_radius_target(0.5, 0.5, 2000), 'important', null, null, null)
   where user_id = '00000000-0000-0000-0000-000000000951') = 1 as pass;
select 'radius_target_excludes_the_distant_one' as check,
  (select count(*) from public.res_resolve_area_audience(
     public.res_radius_target(0.5, 0.5, 2000), 'important', null, null, null)
   where user_id = '00000000-0000-0000-0000-000000000953') = 0 as pass;

-- ── The preview is gated, not a population probe ───────────────────────────
set role authenticated;

-- A stranger who is not a sender for the unit gets an error, not a headcount.
update auth._current set uid = '00000000-0000-0000-0000-000000000955';
do $$ begin
  begin
    perform public.res_preview_area_audience(
      '00000000-0000-0000-0000-0000000009d1',
      (select boundary from public.res_jurisdictions where external_ref = 'WA-1'));
    raise exception 'TEST FAILED: a stranger previewed an audience';
  exception when others then
    if sqlerrm like 'TEST FAILED%' then raise; end if;
    if sqlerrm not like 'not_a_sender%' then raise; end if;
  end;
end $$;
select 'stranger_cannot_preview_an_audience' as check, true as pass;

-- The real sender gets numbers, split by how confident the match is.
update auth._current set uid = '00000000-0000-0000-0000-000000000901';
select 'sender_sees_the_pinned_count' as check,
  (select pinned_count from public.res_preview_area_audience(
     '00000000-0000-0000-0000-0000000009d1',
     (select boundary from public.res_jurisdictions where external_ref = 'WA-1'),
     'important', null, array['Testville'], null)) >= 1 as pass;

select 'sender_sees_text_matches_counted_separately' as check,
  (select text_matched_count from public.res_preview_area_audience(
     '00000000-0000-0000-0000-0000000009d1',
     (select boundary from public.res_jurisdictions where external_ref = 'WA-1'),
     'important', null, array['Testville'], null)) = 1 as pass;

-- Refused targets report the reason and reveal NO numbers.
select 'blocked_preview_reports_reason' as check,
  (select block_reason from public.res_preview_area_audience(
     '00000000-0000-0000-0000-0000000009d1',
     (select boundary from public.res_jurisdictions where external_ref = 'WB-1'))) = 'outside_jurisdiction' as pass;
select 'blocked_preview_reveals_no_headcount' as check,
  (select total_count from public.res_preview_area_audience(
     '00000000-0000-0000-0000-0000000009d1',
     (select boundary from public.res_jurisdictions where external_ref = 'WB-1'))) = 0 as pass;

-- ── The picker offers own area first, and nothing outside it ───────────────
update auth._current set uid = '00000000-0000-0000-0000-000000000902';
select 'mayor_can_target_own_area_and_wards_within' as check,
  (select count(*) from public.res_targetable_jurisdictions('00000000-0000-0000-0000-0000000009e1')) >= 3 as pass;
select 'own_area_is_offered_first' as check,
  (select is_own from public.res_targetable_jurisdictions('00000000-0000-0000-0000-0000000009e1') limit 1) as pass;

update auth._current set uid = '00000000-0000-0000-0000-000000000901';
select 'councillor_is_offered_only_their_own_ward' as check,
  (select count(*) from public.res_targetable_jurisdictions('00000000-0000-0000-0000-0000000009d1')) = 1 as pass;

-- ── Grant boundary ─────────────────────────────────────────────────────────
-- The resolver returns a list of real people, not a count. A signed-in
-- resident must not be able to call it and enumerate who lives in a polygon.
-- Pinned here because the live project genuinely had this grant open after
-- the first apply: revoking from `public` alone did not take it away.
reset role;
select 'authenticated_cannot_call_the_audience_resolver' as check,
  not has_function_privilege('authenticated',
    'public.res_resolve_area_audience(geography, text, text, text[], text[])', 'execute') as pass;
select 'authenticated_may_still_call_the_gated_preview' as check,
  has_function_privilege('authenticated',
    'public.res_preview_area_audience(uuid, geography, text, text, text[], text[])', 'execute') as pass;

