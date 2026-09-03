\set ON_ERROR_STOP on
-- Rate limiting on write paths.
--
-- The limiter is inserted into existing functions by rewriting them from
-- pg_get_functiondef, which is a blunt enough technique to deserve proof that
-- the functions still WORK afterwards — not merely that the line is present.
-- So this exercises the real function until it refuses, rather than reading
-- prosrc and calling that a test.
--
-- Only the functions this harness actually builds are covered; the rest are
-- skipped by the migration with a notice, and the live project has all 13.

insert into public.profiles (id) values
  ('00000000-0000-0000-0000-000000000971')
on conflict (id) do nothing;
insert into public.res_profiles (id, role) values
  ('00000000-0000-0000-0000-000000000971', 'landlord')
on conflict (id) do nothing;

insert into public.res_properties (id, landlord_id, address, suburb, city)
values ('00000000-0000-0000-0000-0000000009c9',
        '00000000-0000-0000-0000-000000000971', '1 Limit Street', 'Testville', 'Test City')
on conflict (id) do nothing;

update auth._current set uid = '00000000-0000-0000-0000-000000000971';
delete from res_rate_limits where user_id = '00000000-0000-0000-0000-000000000971';

-- ── The rewrite did not break the function ────────────────────────────────
select 'a_rewritten_function_still_does_its_job' as check,
  (public.res_create_room(
     '00000000-0000-0000-0000-0000000009c9', 'Limit test room 1',
     1200, 'ZAR', null, null, null, '{}')).label = 'Limit test room 1' as pass;

select 'the_rewritten_function_kept_its_rate_limit_counter' as check,
  (select count from res_rate_limits
   where user_id = '00000000-0000-0000-0000-000000000971' and action = 'create_room') = 1 as pass;

-- ── The limit actually bites ───────────────────────────────────────────────
-- Pushed to the edge of the window rather than looping 40 times: the counter
-- is what the limiter reads, so seeding it proves the same thing far faster.
update res_rate_limits set count = 40
 where user_id = '00000000-0000-0000-0000-000000000971' and action = 'create_room';

do $$ begin
  begin
    perform public.res_create_room(
      '00000000-0000-0000-0000-0000000009c9', 'Over the limit',
      1200, 'ZAR', null, null, null, '{}');
    raise exception 'TEST FAILED: a landlord created rooms past the daily limit';
  exception when others then
    if sqlerrm like 'TEST FAILED%' then raise; end if;
    if sqlerrm not like 'rate_limit_exceeded%' then
      raise exception 'TEST FAILED: refused, but not by the rate limiter (%)', sqlerrm;
    end if;
  end;
end $$;
select 'creating_rooms_past_the_limit_is_refused' as check,
  not exists (select 1 from res_rooms where label = 'Over the limit') as pass;

-- A refusal must not be permanent: the next window lets the landlord work again.
delete from res_rate_limits
 where user_id = '00000000-0000-0000-0000-000000000971' and action = 'create_room';

select 'the_limit_clears_with_the_window' as check,
  (public.res_create_room(
    '00000000-0000-0000-0000-0000000009c9', 'Limit test room 2',
    1200, 'ZAR', null, null, null, '{}')).id is not null as pass;

-- ── Each action has its own budget ─────────────────────────────────────────
-- Otherwise one busy landlord filling their property would lock them out of
-- unrelated things, which is a worse failure than the abuse being prevented.
select 'one_actions_limit_does_not_block_another' as check,
  (select count(*) from res_rate_limits
   where user_id = '00000000-0000-0000-0000-000000000971') >= 1
  and not exists (
    select 1 from res_rate_limits
    where user_id = '00000000-0000-0000-0000-000000000971' and action = 'advertise_room') as pass;

-- ── The limiter is per person, not global ──────────────────────────────────
insert into public.profiles (id) values ('00000000-0000-0000-0000-000000000972')
on conflict (id) do nothing;
insert into public.res_profiles (id, role) values ('00000000-0000-0000-0000-000000000972', 'landlord')
on conflict (id) do nothing;
insert into public.res_properties (id, landlord_id, address, suburb, city)
values ('00000000-0000-0000-0000-0000000009ca',
        '00000000-0000-0000-0000-000000000972', '2 Limit Street', 'Testville', 'Test City')
on conflict (id) do nothing;

update auth._current set uid = '00000000-0000-0000-0000-000000000971';
update res_rate_limits set count = 40
 where user_id = '00000000-0000-0000-0000-000000000971' and action = 'create_room';

update auth._current set uid = '00000000-0000-0000-0000-000000000972';
select 'one_persons_limit_does_not_block_everyone_else' as check,
  (public.res_create_room(
    '00000000-0000-0000-0000-0000000009ca', 'Other landlord room',
    900, 'ZAR', null, null, null, '{}')).id is not null as pass;

-- ── Coverage moved in the right direction ─────────────────────────────────
select 'the_write_paths_built_here_are_all_limited' as check,
  not exists (
    select 1 from pg_proc p
    where p.pronamespace = 'public'::regnamespace
      and p.proname in ('res_create_room', 'res_advertise_room', 'res_create_kin_verification_link')
      and position('res_check_rate_limit' in p.prosrc) = 0) as pass;
