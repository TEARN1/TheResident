\set ON_ERROR_STOP on
-- The public profile is an RPC precisely so that the column list is decided
-- server-side. These assertions are the ones worth having: that the things
-- CONTRACT.md §3 forbids never leave the function, that res_profiles' own
-- landlord/tenant disclosure does not leak through it, and that a block hides
-- the person in both directions.

grant usage on schema public, auth to authenticated;
grant select, insert, update on auth._current to authenticated;

insert into public.profiles (id, username, display_name, bio, city, is_verified, vibe_score, xp)
values
  ('00000000-0000-0000-0000-000000000801', 'thandi',  'Thandi M',  'I bake.', 'Pretoria', true,  72, 410),
  ('00000000-0000-0000-0000-000000000802', 'sipho',   'Sipho K',   null,      'Pretoria', false, 40, 90),
  ('00000000-0000-0000-0000-000000000803', 'blocker', 'Blocked B', null,      'Pretoria', false, 10, 0)
-- DO UPDATE, not DO NOTHING: an earlier file in the suite may already have
-- created a bare row with this id, and DO NOTHING would leave every field
-- these assertions read as null. That is exactly what happened while writing
-- this, and it reads as a broken function rather than a stale fixture.
on conflict (id) do update set
  username = excluded.username, display_name = excluded.display_name,
  bio = excluded.bio, city = excluded.city, is_verified = excluded.is_verified,
  vibe_score = excluded.vibe_score, xp = excluded.xp;

insert into public.res_profiles (id, role, suburb, city, legal_name, gender, employment_status, children_count)
values ('00000000-0000-0000-0000-000000000801', 'tenant', 'Sunnyside', 'Pretoria',
        'Thandi Mahlangu', 'women', 'employed', 2)
on conflict (id) do update set
  role = excluded.role, suburb = excluded.suburb, city = excluded.city,
  legal_name = excluded.legal_name, gender = excluded.gender,
  employment_status = excluded.employment_status, children_count = excluded.children_count;

insert into public.res_gossip_posts (id, author_id, body, hidden)
values
  ('00000000-0000-0000-0000-0000000008a1', '00000000-0000-0000-0000-000000000801', 'Load shedding again', false),
  ('00000000-0000-0000-0000-0000000008a2', '00000000-0000-0000-0000-000000000801', 'Removed by a moderator', true)
on conflict (id) do nothing;

set role authenticated;
update auth._current set uid = '00000000-0000-0000-0000-000000000802';

-- A stranger can look Thandi up, and gets the public shape.
select 'a_stranger_can_look_up_a_resident' as check,
  (select count(*) from public.res_public_profile('00000000-0000-0000-0000-000000000801')) = 1 as pass;

select 'the_public_fields_come_through' as check,
  (select display_name = 'Thandi M' and username = 'thandi' and bio = 'I bake.'
          and is_verified and vibe_score = 72 and xp = 410
     from public.res_public_profile('00000000-0000-0000-0000-000000000801')) as pass;


-- res_profiles' own suburb wins, and its city overrides the Gruvs one.
select 'the_resident_side_place_is_used' as check,
  (select suburb = 'Sunnyside' and city = 'Pretoria' and role = 'tenant'
     from public.res_public_profile('00000000-0000-0000-0000-000000000801')) as pass;

-- THE CONTRACT BOUNDARY. Not "we did not select them" — the function's return
-- type must not be able to carry them at all. A future edit that adds
-- `legal_name` to the profile card fails here rather than in production.
select 'no_gruvs_private_or_res_private_column_is_returned' as check,
  not exists (
    select 1
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      cross join lateral unnest(p.proargnames) as a(col)
     where n.nspname = 'public'
       and p.proname in ('res_public_profile', 'res_public_profile_posts')
       and a.col in (
         -- CONTRACT.md §3, the never-read list
         'email', 'first_name', 'surname', 'emergency_contacts',
         'lat', 'lon', 'push_token', 'birth_date', 'birth_year',
         -- res_profiles' landlord/tenant disclosure, which is not public
         'legal_name', 'gender', 'children_count', 'employment_status',
         'verification_doc_url', 'landlord_gender_pref', 'landlord_pets_allowed'
       )
  ) as pass;

-- The check above is only worth anything if it can actually see the column
-- names. Proving it in the other direction: a name that IS returned is found.
select 'the_column_check_can_see_the_real_output_columns' as check,
  exists (
    select 1
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      cross join lateral unnest(p.proargnames) as a(col)
     where n.nspname = 'public' and p.proname = 'res_public_profile'
       and a.col = 'social_integrity_score'
  ) as pass;

-- Hidden posts are moderation decisions and stay hidden on the profile too.
select 'a_hidden_post_is_not_counted' as check,
  (select gossip_post_count = 1 from public.res_public_profile('00000000-0000-0000-0000-000000000801')) as pass;

select 'a_hidden_post_is_not_listed' as check,
  (select count(*) from public.res_public_profile_posts('00000000-0000-0000-0000-000000000801', 20)) = 1 as pass;

select 'is_self_is_false_for_someone_else' as check,
  (select not is_self from public.res_public_profile('00000000-0000-0000-0000-000000000801')) as pass;

update auth._current set uid = '00000000-0000-0000-0000-000000000801';
select 'is_self_is_true_for_your_own_profile' as check,
  (select is_self from public.res_public_profile('00000000-0000-0000-0000-000000000801')) as pass;

-- BLOCKS, BOTH DIRECTIONS. 803 blocks 801.
reset role;
insert into public.res_blocks (blocker_id, blocked_id)
values ('00000000-0000-0000-0000-000000000803', '00000000-0000-0000-0000-000000000801')
on conflict do nothing;
set role authenticated;

-- The blocked person cannot look up the blocker...
do $$
begin
  perform * from public.res_public_profile('00000000-0000-0000-0000-000000000803');
  raise exception 'CANARY: a blocked resident could still read the blocker''s profile';
exception when others then
  if sqlerrm like '%CANARY%' then raise; end if;
end $$;
select 'a_blocked_resident_cannot_view_the_blocker' as check, true as pass;

-- ...and the blocker does not have to keep seeing them either.
update auth._current set uid = '00000000-0000-0000-0000-000000000803';
do $$
begin
  perform * from public.res_public_profile('00000000-0000-0000-0000-000000000801');
  raise exception 'CANARY: a blocker was still shown the person they blocked';
exception when others then
  if sqlerrm like '%CANARY%' then raise; end if;
end $$;
select 'a_blocker_does_not_see_the_person_they_blocked' as check, true as pass;

do $$
begin
  perform * from public.res_public_profile_posts('00000000-0000-0000-0000-000000000801', 20);
  raise exception 'CANARY: a block hid the profile but not the posts behind it';
exception when others then
  if sqlerrm like '%CANARY%' then raise; end if;
end $$;
select 'the_block_hides_their_posts_too' as check, true as pass;

reset role;
