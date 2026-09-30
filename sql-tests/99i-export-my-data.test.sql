\set ON_ERROR_STOP on
-- "Download my data": a resident gets their own rows, and nothing that
-- reveals someone else.

insert into public.profiles (id) values
  ('00000000-0000-0000-0000-000000009951'),
  ('00000000-0000-0000-0000-000000009952')
on conflict do nothing;
insert into public.res_profiles (id, role) values
  ('00000000-0000-0000-0000-000000009951', 'tenant'),
  ('00000000-0000-0000-0000-000000009952', 'tenant')
on conflict do nothing;

-- 9952 blocks 9951. 9951 must never learn that from an export.
insert into public.res_blocks (blocker_id, blocked_id)
values ('00000000-0000-0000-0000-000000009952', '00000000-0000-0000-0000-000000009951');
insert into public.res_home_areas (user_id, lat, lon)
values ('00000000-0000-0000-0000-000000009951', -26.2, 28.0)
on conflict (user_id) do nothing;

update auth._current set uid = '00000000-0000-0000-0000-000000009951';
create temp table export as select public.res_export_my_data() as j;

select 'the_export_includes_my_profile' as check,
  (select j->'profile'->>'id' from export) = '00000000-0000-0000-0000-000000009951' as pass;

select 'the_export_includes_rows_i_own' as check,
  (select j ? 'res_home_areas.user_id' from export) as pass;

select 'the_export_never_reveals_who_blocked_me' as check,
  (select position('00000000-0000-0000-0000-000000009952' in j::text) = 0 from export) as pass;

select 'the_export_leaves_out_internal_logs' as check,
  (select not exists (select 1 from jsonb_object_keys(j) k
                       where k like 'res_security_logs%' or k like 'res_rate_limits%') from export) as pass;

update auth._current set uid = null;
do $$ begin
  begin
    perform public.res_export_my_data();
    raise exception 'TEST FAILED: a signed-out caller exported data';
  exception when others then
    if sqlerrm like 'TEST FAILED%' then raise; end if;
    if sqlerrm not like 'not signed in%' then raise; end if;
  end;
end $$;
select 'a_signed_out_caller_gets_nothing' as check, true as pass;

select 'guests_cannot_call_it' as check,
  not has_function_privilege('anon', 'public.res_export_my_data()', 'execute') as pass;
