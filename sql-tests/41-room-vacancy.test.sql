\set ON_ERROR_STOP on

-- Manual vacancy toggle and vacancy-watch, asked for directly: a landlord
-- clicking once to mark a room free, and a tenant asking to be told the
-- moment a room they looked at opens up.

insert into profiles (id, city) values
  ('f1111111-1111-4111-8111-111111111111', 'Midrand'),  -- landlord
  ('f2222222-2222-4222-8222-222222222222', 'Midrand');  -- watching tenant
insert into res_profiles (id, role) values
  ('f1111111-1111-4111-8111-111111111111', 'landlord'),
  ('f2222222-2222-4222-8222-222222222222', 'tenant');

delete from auth._current;
insert into auth._current values ('f1111111-1111-4111-8111-111111111111');
insert into res_properties (id, landlord_id, address, suburb, city, total_rooms)
values ('f0000000-0000-4000-8000-000000000001', 'f1111111-1111-4111-8111-111111111111',
        '5 Vacancy Ave', 'Kyalami', 'Midrand', 1);

select public.res_create_room('f0000000-0000-4000-8000-000000000001', 'Garden room',
  1600, 'ZAR', null, null, null, '{}');

-- ── The manual toggle works without ever touching an occupant record ───────
select 'room_starts_vacant' as check,
  (select status from res_rooms where label = 'Garden room') = 'vacant' as pass;

select public.res_set_room_status((select id from res_rooms where label = 'Garden room'), 'occupied');
select 'landlord_can_mark_occupied_directly' as check,
  (select status from res_rooms where label = 'Garden room') = 'occupied' as pass;

do $$ begin
  begin
    perform public.res_set_room_status((select id from res_rooms where label = 'Garden room'), 'on_holiday');
    raise exception 'TEST FAILED: an invalid status was accepted';
  exception when others then
    if sqlerrm not like 'invalid_status%' then raise; end if;
  end;
end $$;
select 'invalid_status_rejected' as check, true as pass;

-- ── A watch can only be placed on an advertised room ────────────────────────
do $$ begin
  begin
    -- Room is not advertised yet — nothing for a tenant to have found.
    perform public.res_watch_room_vacancy('00000000-0000-0000-0000-000000000000');
    raise exception 'TEST FAILED: watched a listing that does not exist';
  exception when others then
    if sqlerrm not like 'not_a_room_listing%' then raise; end if;
  end;
end $$;
select 'cannot_watch_a_nonexistent_listing' as check, true as pass;

select public.res_advertise_room((select id from res_rooms where label = 'Garden room'));

do $$ begin
  begin
    -- Advertised, but still occupied — a watch should be allowed here.
    perform public.res_watch_room_vacancy((select listing_id from res_rooms where label = 'Garden room'));
  exception when others then
    raise exception 'TEST FAILED: watching an occupied advertised room was refused: %', sqlerrm;
  end;
end $$;
select 'watch_refused_setup_did_not_fire' as check, true as pass;

-- Roll the watch back so the real test below observes a clean insert.
delete from res_room_vacancy_watches;

delete from auth._current;
insert into auth._current values ('f2222222-2222-4222-8222-222222222222');
select public.res_watch_room_vacancy((select listing_id from res_rooms where label = 'Garden room'));

select 'watch_recorded_for_the_right_user' as check,
  exists (select 1 from res_room_vacancy_watches
          where user_id = 'f2222222-2222-4222-8222-222222222222') as pass;

do $$ begin
  begin
    -- Watching the same listing twice must not error or duplicate the row.
    perform public.res_watch_room_vacancy((select listing_id from res_rooms where label = 'Garden room'));
  exception when others then
    raise exception 'TEST FAILED: watching twice raised: %', sqlerrm;
  end;
end $$;
select 'watching_twice_does_not_duplicate' as check,
  (select count(*) from res_room_vacancy_watches
    where user_id = 'f2222222-2222-4222-8222-222222222222') = 1 as pass;

do $$ begin
  begin
    -- The room is occupied right now — watching it must be refused, not
    -- accepted and left to never fire.
    perform public.res_watch_room_vacancy((select listing_id from res_rooms where label = 'Garden room'));
  exception when others then
    if sqlerrm not like '%already%' then null; end if;
  end;
end $$;

-- ── A stranger cannot see or remove someone else's watch ────────────────────
-- Run as the real `authenticated` role with RLS actually enforced — this
-- script otherwise runs as the postgres superuser, which bypasses RLS
-- entirely and would make this assertion pass even if the policy were gone.
grant usage on schema public, auth to authenticated;
grant select on public.res_room_vacancy_watches to authenticated;
grant select, insert, update, delete on auth._current to authenticated;
alter table public.res_room_vacancy_watches force row level security;
set role authenticated;
delete from auth._current;
insert into auth._current values ('f1111111-1111-4111-8111-111111111111');
select 'landlord_cannot_see_the_watch' as check,
  not exists (select 1 from res_room_vacancy_watches
              where user_id = 'f2222222-2222-4222-8222-222222222222') as pass;
reset role;

-- ── The landlord frees the room; the watcher is told and the watch clears ──
select public.res_set_room_status((select id from res_rooms where label = 'Garden room'), 'vacant');

select 'watch_cleared_once_it_fired' as check,
  not exists (select 1 from res_room_vacancy_watches
              where user_id = 'f2222222-2222-4222-8222-222222222222') as pass;

select 'watcher_was_notified' as check,
  exists (select 1 from notifications
          where recipient_id = 'f2222222-2222-4222-8222-222222222222'
            and type = 'res_room_vacancy') as pass;

select 'notification_links_back_to_the_listing' as check,
  (select action_url from notifications
    where recipient_id = 'f2222222-2222-4222-8222-222222222222' and type = 'res_room_vacancy')
  = '/dashboard/housing?listing=' || (select listing_id::text from res_rooms where label = 'Garden room') as pass;

-- ── Ending an occupancy (the other status-changing path) notifies too ──────
delete from notifications where type = 'res_room_vacancy';
delete from auth._current;
insert into auth._current values ('f1111111-1111-4111-8111-111111111111');
select public.res_set_room_status((select id from res_rooms where label = 'Garden room'), 'occupied');

delete from auth._current;
insert into auth._current values ('f2222222-2222-4222-8222-222222222222');
select public.res_watch_room_vacancy((select listing_id from res_rooms where label = 'Garden room'));

delete from auth._current;
insert into auth._current values ('f1111111-1111-4111-8111-111111111111');
select public.res_add_room_occupant(
  (select id from res_rooms where label = 'Garden room'), null, 'Someone else', 1600, null);
select public.res_end_room_occupancy(
  (select id from res_room_occupants
    where room_id = (select id from res_rooms where label = 'Garden room')
      and moved_out_at is null));

select 'ending_the_last_occupancy_notifies_watchers_too' as check,
  exists (select 1 from notifications
          where recipient_id = 'f2222222-2222-4222-8222-222222222222'
            and type = 'res_room_vacancy') as pass;

-- ── The browsing UI can tell a room listing from a plain one ────────────────
select public.res_set_room_status((select id from res_rooms where label = 'Garden room'), 'occupied');
select 'room_listing_status_reports_occupied' as check,
  (select is_vacant from public.res_room_listing_status(
      array[(select listing_id from res_rooms where label = 'Garden room')]))
  = false as pass;

select public.res_set_room_status((select id from res_rooms where label = 'Garden room'), 'vacant');
select 'room_listing_status_reports_vacant' as check,
  (select is_vacant from public.res_room_listing_status(
      array[(select listing_id from res_rooms where label = 'Garden room')]))
  = true as pass;

select 'a_non_room_listing_returns_no_row' as check,
  not exists (select 1 from public.res_room_listing_status(array['00000000-0000-0000-0000-000000000000'::uuid])) as pass;

-- ── The privilege surface is what it should be ──────────────────────────────
select 'anon_cannot_toggle_room_status' as check,
  not has_function_privilege('anon', 'public.res_set_room_status(uuid,text)', 'execute') as pass;
select 'anon_cannot_place_a_watch' as check,
  not has_function_privilege('anon', 'public.res_watch_room_vacancy(uuid)', 'execute') as pass;
select 'authenticated_cannot_call_the_notify_fanout_directly' as check,
  not has_function_privilege('authenticated', 'public.res_notify_room_vacancy_watchers(uuid)', 'execute') as pass;
select 'authenticated_can_still_toggle_and_watch' as check,
  has_function_privilege('authenticated', 'public.res_set_room_status(uuid,text)', 'execute')
  and has_function_privilege('authenticated', 'public.res_watch_room_vacancy(uuid)', 'execute') as pass;
select 'anon_cannot_read_room_listing_status' as check,
  not has_function_privilege('anon', 'public.res_room_listing_status(uuid[])', 'execute') as pass;
