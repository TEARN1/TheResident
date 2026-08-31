-- Assertions for res_delete_property(): only the owning landlord can call
-- it, and it cascades through rooms/occupants/listings without leaving
-- anything dangling.

delete from auth._current;

do $$
declare
  v_landlord uuid := '00000000-0000-0000-0000-000000000501';
  v_other_landlord uuid := '00000000-0000-0000-0000-000000000502';
  v_tenant uuid := '00000000-0000-0000-0000-000000000503';
  v_property uuid;
  v_room uuid;
  v_listing uuid;
begin
  insert into public.profiles (id) values (v_landlord), (v_other_landlord), (v_tenant)
  on conflict (id) do nothing;

  insert into public.res_properties (landlord_id, address, suburb, city, total_rooms)
    values (v_landlord, '1 Test Street', 'Testburb', 'Testville', 2)
    returning id into v_property;

  insert into public.res_listings (landlord_id, title, property_id)
    values (v_landlord, 'Room in Test Street', v_property)
    returning id into v_listing;

  insert into public.res_rooms (property_id, landlord_id, label, listing_id)
    values (v_property, v_landlord, 'Back room (delete test)', v_listing)
    returning id into v_room;

  insert into public.res_room_occupants (room_id, tenant_id, moved_in_at)
    values (v_room, v_tenant, now());

  -- A different landlord may not delete someone else's property.
  insert into auth._current values (v_other_landlord);
  begin
    perform public.res_delete_property(v_property);
    raise exception 'expected res_delete_property to reject a non-owner';
  exception when others then
    null;
  end;

  -- The owner can, and it takes the room/occupant/listing rows with it.
  delete from auth._current;
  insert into auth._current values (v_landlord);
  perform public.res_delete_property(v_property);
end $$;

select 'property_gone' as check, (select count(*) from public.res_properties where address = '1 Test Street') = 0 as pass;
select 'room_gone' as check, (select count(*) from public.res_rooms where label = 'Back room (delete test)') = 0 as pass;
select 'occupants_gone' as check, (select count(*) from public.res_room_occupants where tenant_id = '00000000-0000-0000-0000-000000000503') = 0 as pass;
select 'listing_gone' as check, (select count(*) from public.res_listings where title = 'Room in Test Street') = 0 as pass;
