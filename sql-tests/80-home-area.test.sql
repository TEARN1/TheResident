\set ON_ERROR_STOP on
-- res_home_areas is the most privacy-sensitive table in the app: it is where
-- residents live. The claim made in the schema file and in the strategy doc is
-- that NOBODY but the owner can read a row. That claim is worth proving, not
-- asserting, so these run as the real `authenticated` role with FORCE RLS on.

grant usage on schema public, auth to authenticated;
grant select, insert, update, delete on public.res_home_areas to authenticated;
grant select, update on public.res_profiles to authenticated;
grant select, insert, update on auth._current to authenticated;
alter table public.res_home_areas force row level security;

insert into public.profiles (id) values
  ('00000000-0000-0000-0000-000000000801'),
  ('00000000-0000-0000-0000-000000000802')
on conflict (id) do nothing;

insert into public.res_profiles (id, role) values
  ('00000000-0000-0000-0000-000000000801', 'tenant'),
  ('00000000-0000-0000-0000-000000000802', 'tenant')
on conflict (id) do nothing;

-- ── Coarse is rounded BEFORE storage ───────────────────────────────────────
set role authenticated;
update auth._current set uid = '00000000-0000-0000-0000-000000000801';

select public.res_set_home_area(-25.99551234, 28.20241234, 'coarse', 'Kreuzberg', 'Berlin', '12 Vine Street, Kreuzberg');

select 'coarse_lat_rounded_to_grid' as check,
  (select lat from public.res_home_areas where user_id = '00000000-0000-0000-0000-000000000801') = -26.00 as pass;
select 'coarse_lon_rounded_to_grid' as check,
  (select lon from public.res_home_areas where user_id = '00000000-0000-0000-0000-000000000801') = 28.20 as pass;
select 'label_stored_for_display' as check,
  (select label from public.res_home_areas where user_id = '00000000-0000-0000-0000-000000000801') = '12 Vine Street, Kreuzberg' as pass;

-- Suburb normalisation: the pin is authoritative, so it writes through.
select 'suburb_normalised_onto_profile' as check,
  (select suburb from public.res_profiles where id = '00000000-0000-0000-0000-000000000801') = 'Kreuzberg' as pass;
select 'city_normalised_onto_profile' as check,
  (select city from public.res_profiles where id = '00000000-0000-0000-0000-000000000801') = 'Berlin' as pass;

-- ── Exact preserves what it was given ──────────────────────────────────────
select public.res_set_home_area(-25.99551234, 28.20241234, 'exact', null, null, null);
select 'exact_preserves_precision' as check,
  (select lat from public.res_home_areas where user_id = '00000000-0000-0000-0000-000000000801') = -25.99551234 as pass;

-- Setting again updates in place rather than accumulating a location history.
select 'one_row_per_resident' as check,
  (select count(*) from public.res_home_areas where user_id = '00000000-0000-0000-0000-000000000801') = 1 as pass;

-- ── THE PRIVACY BOUNDARY ───────────────────────────────────────────────────
-- A different signed-in resident must not see that row at all.
update auth._current set uid = '00000000-0000-0000-0000-000000000802';
select 'stranger_sees_no_home_areas' as check,
  (select count(*) from public.res_home_areas) = 0 as pass;

-- ...and cannot write one on someone else's behalf either.
do $$ begin
  begin
    insert into public.res_home_areas (user_id, lat, lon)
      values ('00000000-0000-0000-0000-000000000801', 1, 1);
    raise exception 'TEST FAILED: a stranger wrote another resident''s home area';
  exception when insufficient_privilege or others then
    if sqlerrm like 'TEST FAILED%' then raise; end if;
  end;
end $$;
select 'stranger_cannot_write_for_someone_else' as check, true as pass;

-- ── Validation ─────────────────────────────────────────────────────────────
update auth._current set uid = '00000000-0000-0000-0000-000000000801';

do $$ begin
  begin
    perform public.res_set_home_area(120, 28.2, 'coarse', null, null, null);
    raise exception 'TEST FAILED: an out-of-range latitude was accepted';
  exception when others then
    if sqlerrm like 'TEST FAILED%' then raise; end if;
    if sqlerrm not like 'coordinates_out_of_range%' then raise; end if;
  end;
end $$;
select 'rejects_impossible_latitude' as check, true as pass;

do $$ begin
  begin
    perform public.res_set_home_area(-25.9, 28.2, 'somewhere_ish', null, null, null);
    raise exception 'TEST FAILED: an unknown granularity was accepted';
  exception when others then
    if sqlerrm like 'TEST FAILED%' then raise; end if;
    if sqlerrm not like 'invalid_granularity%' then raise; end if;
  end;
end $$;
select 'rejects_unknown_granularity' as check, true as pass;

-- ── Opt-out is one call ────────────────────────────────────────────────────
select public.res_clear_home_area();
select 'clear_removes_the_row' as check,
  (select count(*) from public.res_home_areas where user_id = '00000000-0000-0000-0000-000000000801') = 0 as pass;

reset role;
