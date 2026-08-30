\set ON_ERROR_STOP on

-- Two landlords, a tenant who wants their identity private by default, and a
-- housemate on the SAME property who must see nothing until that tenant opts
-- in.
insert into profiles (id, city) values
  ('d1111111-1111-4111-8111-111111111111', 'Midrand'),  -- landlord A
  ('d2222222-2222-4222-8222-222222222222', 'Midrand'),  -- landlord B (unrelated)
  ('d3333333-3333-4333-8333-333333333333', 'Midrand'),  -- tenant (occupant)
  ('d4444444-4444-4444-8444-444444444444', 'Midrand');  -- housemate, same property
insert into res_profiles (id, role) values
  ('d1111111-1111-4111-8111-111111111111', 'landlord'),
  ('d2222222-2222-4222-8222-222222222222', 'landlord'),
  ('d3333333-3333-4333-8333-333333333333', 'tenant'),
  ('d4444444-4444-4444-8444-444444444444', 'tenant');

-- delete+insert, not a bare insert: earlier test files in this suite already
-- left a row in auth._current, and auth.uid()'s `limit 1` has no ORDER BY, so
-- a second inserted row makes which identity is "current" nondeterministic.
delete from auth._current;
insert into auth._current values ('d1111111-1111-4111-8111-111111111111');
insert into res_properties (id, landlord_id, address, suburb, city, total_rooms)
values ('e0000000-0000-4000-8000-000000000001', 'd1111111-1111-4111-8111-111111111111',
        '12 Vine Street', 'Ivory Park', 'Midrand', 4);

-- ── Creating a room ─────────────────────────────────────────────────────────
select 'create_room' as step, (r).label, (r).status
from (select res_create_room(
  'e0000000-0000-4000-8000-000000000001', 'Back room', 2500, 'ZAR',
  'North-facing, own entrance', 'Shares a wall with the kitchen',
  'Priced below the front rooms because of the shared wall.',
  array['https://example.com/1.jpg','https://example.com/2.jpg']
) as r) s;

select 'room_starts_vacant' as check, status = 'vacant' as pass from res_rooms;

-- A room without a label is refused.
do $$ begin
  begin
    perform res_create_room('e0000000-0000-4000-8000-000000000001', '', null, 'ZAR', null, null, null, '{}');
    raise exception 'TEST FAILED: blank label accepted';
  exception when others then
    if sqlerrm not like 'label_required%' then raise; end if;
  end;
end $$;
select 'blank_label_rejected' as check, true as pass;

-- More than 6 photos is refused.
do $$ begin
  begin
    perform res_create_room('e0000000-0000-4000-8000-000000000001', 'Too many photos', null, 'ZAR', null, null, null,
      array['1','2','3','4','5','6','7']);
    raise exception 'TEST FAILED: 7 photos accepted';
  exception when others then
    if sqlerrm not like 'too_many_photos%' then raise; end if;
  end;
end $$;
select 'photo_cap_enforced' as check, true as pass;

-- Landlord B cannot create a room on landlord A's property.
update auth._current set uid = 'd2222222-2222-4222-8222-222222222222';
do $$ begin
  begin
    perform res_create_room('e0000000-0000-4000-8000-000000000001', 'Squatting', null, 'ZAR', null, null, null, '{}');
    raise exception 'TEST FAILED: a different landlord created a room on this property';
  exception when others then
    if sqlerrm not like 'not_your_property%' then raise; end if;
  end;
end $$;
select 'foreign_landlord_cannot_create' as check, true as pass;

-- ── Moving someone in ───────────────────────────────────────────────────────
update auth._current set uid = 'd1111111-1111-4111-8111-111111111111';

select res_add_room_occupant(
  (select id from res_rooms), 'd3333333-3333-4333-8333-333333333333', null, 2500, 'Pays on the 1st.'
);
select 'room_flips_to_occupied' as check, status = 'occupied' as pass from res_rooms;
select 'occupancy_defaults_landlord_only' as check, visibility = 'landlord_only' as pass
from res_room_occupants;

-- A landlord can also record someone who isn't on the app at all.
select res_add_room_occupant((select id from res_rooms), null, 'Sipho (not on the app)', 1800, null);
select 'unlinked_occupant_recorded' as check, count(*) = 2 as pass from res_room_occupants;

-- Neither a name nor a linked tenant is refused.
do $$ begin
  begin
    perform res_add_room_occupant((select id from res_rooms), null, null, null, null);
    raise exception 'TEST FAILED: occupant with no identity accepted';
  exception when others then
    if sqlerrm not like 'occupant_identity_required%' then raise; end if;
  end;
end $$;
select 'occupant_identity_required_enforced' as check, true as pass;

-- ── RLS: the housemate sees nothing before the tenant opts in ──────────────
-- Same property as the back room — a housemate, not a stranger.
select res_create_room('e0000000-0000-4000-8000-000000000001', 'Front room', 3000, 'ZAR', null, null, null, '{}');
select res_add_room_occupant(
  (select id from res_rooms where label = 'Front room'), 'd4444444-4444-4444-8444-444444444444', null, 3000, null
);

grant usage on schema public, auth to authenticated;
grant select on public.res_rooms, public.res_room_occupants, public.res_properties, public.res_listings to authenticated;
grant select, insert, update on auth._current to authenticated;
alter table public.res_rooms force row level security;
alter table public.res_room_occupants force row level security;
set role authenticated;

-- The tenant sees their own occupant row.
update auth._current set uid = 'd3333333-3333-4333-8333-333333333333';
select 'occupant_sees_own_row' as check, count(*) = 1 as pass from res_room_occupants;

-- The housemate on the SAME property sees nothing about the other tenant yet
-- (default is landlord_only) — this is the whole point of the feature.
update auth._current set uid = 'd4444444-4444-4444-8444-444444444444';
select 'housemate_sees_nothing_before_optin' as check, count(*) = 1 as pass
from res_room_occupants; -- sees only their OWN row, not the back-room tenant's

-- A landlord from an unrelated property sees no rooms and no occupants at all.
update auth._current set uid = 'd2222222-2222-4222-8222-222222222222';
select 'foreign_landlord_sees_no_rooms' as check, count(*) = 0 as pass from res_rooms;
select 'foreign_landlord_sees_no_occupants' as check, count(*) = 0 as pass from res_room_occupants;

reset role;

-- ── The occupant opts in, and only then does the housemate see it ─────────
update auth._current set uid = 'd3333333-3333-4333-8333-333333333333';
select res_set_occupant_visibility(
  (select id from res_room_occupants where tenant_id = 'd3333333-3333-4333-8333-333333333333'),
  'shared_with_housemates'
);

-- The landlord cannot change someone else's visibility on their behalf.
update auth._current set uid = 'd1111111-1111-4111-8111-111111111111';
do $$ begin
  begin
    perform res_set_occupant_visibility(
      (select id from res_room_occupants where tenant_id = 'd3333333-3333-4333-8333-333333333333'),
      'landlord_only'
    );
    raise exception 'TEST FAILED: landlord changed a tenant''s own visibility setting';
  exception when others then
    if sqlerrm not like 'not_your_occupancy%' then raise; end if;
  end;
end $$;
select 'landlord_cannot_override_occupant_choice' as check, true as pass;

set role authenticated;
update auth._current set uid = 'd4444444-4444-4444-8444-444444444444';
select 'housemate_sees_it_after_optin' as check, count(*) = 2 as pass from res_room_occupants;
reset role;

-- ── Ending a tenancy ─────────────────────────────────────────────────────────
update auth._current set uid = 'd1111111-1111-4111-8111-111111111111';
select res_end_room_occupancy((select id from res_room_occupants where occupant_name_raw is not null));
select res_end_room_occupancy((select id from res_room_occupants where tenant_id = 'd3333333-3333-4333-8333-333333333333' and room_id = (select id from res_rooms where label='Back room')));

select 'room_flips_back_to_vacant_once_all_moved_out' as check, status = 'vacant' as pass
from res_rooms where label = 'Back room';
select 'moved_out_at_stamped_not_deleted' as check, count(*) = 2 as pass
from res_room_occupants where room_id = (select id from res_rooms where label = 'Back room') and moved_out_at is not null;

-- ── Advertising a room ──────────────────────────────────────────────────────
select 'advertise_room' as step, (l).title, (l).property_id
from (select res_advertise_room((select id from res_rooms where label = 'Back room')) as l) s;

select 'room_linked_to_new_listing' as check, listing_id is not null as pass
from res_rooms where label = 'Back room';
select 'listing_carries_room_photos' as check, array_length(images, 1) = 2 as pass
from res_listings where id = (select listing_id from res_rooms where label = 'Back room');

do $$ begin
  begin
    perform res_advertise_room((select id from res_rooms where label = 'Back room'));
    raise exception 'TEST FAILED: the same room was advertised twice';
  exception when others then
    if sqlerrm not like 'already_advertised%' then raise; end if;
  end;
end $$;
select 'cannot_advertise_twice' as check, true as pass;
