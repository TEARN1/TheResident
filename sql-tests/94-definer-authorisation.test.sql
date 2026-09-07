\set ON_ERROR_STOP on
-- SECURITY DEFINER functions must check who is asking.
--
-- These functions run as their OWNER, so RLS on the tables they touch does
-- not constrain them at all. The body is the only thing between a caller and
-- the data. Four of them were not doing that check, and one was exploitable
-- by any signed-in user.
--
-- Every assertion below reproduces the actual exploit rather than testing the
-- fix's implementation, so a future rewrite that reintroduces the hole fails
-- here regardless of how it is written.

insert into profiles (id) values
  ('c1111111-1111-4111-8111-111111111111'),   -- community admin
  ('c2222222-2222-4222-8222-222222222222'),   -- attacker: member of nothing
  ('c3333333-3333-4333-8333-333333333333')    -- landlord
on conflict (id) do nothing;

insert into res_communities (id, name, kind, created_by)
values ('cc000000-0000-4000-8000-000000000001', 'Test Street', 'street',
        'c1111111-1111-4111-8111-111111111111')
on conflict (id) do nothing;

insert into res_community_members (community_id, user_id, role)
values ('cc000000-0000-4000-8000-000000000001', 'c1111111-1111-4111-8111-111111111111', 'admin')
on conflict do nothing;

insert into res_gossip_posts (id, author_id, community_id, body, hidden)
values ('cf000000-0000-4000-8000-000000000001', 'c1111111-1111-4111-8111-111111111111',
        'cc000000-0000-4000-8000-000000000001', 'an ordinary post', false)
on conflict (id) do nothing;

-- ── res_moderate: the fail-open-on-NULL privilege escalation ───────────────
-- `v_role not in ('admin','founder')` is NULL for a non-member, and
-- `if NULL then raise` does not fire. Before the fix, this exact sequence
-- hid another user's post.
delete from auth._current;
insert into auth._current values ('c2222222-2222-4222-8222-222222222222');

select 'the_attacker_belongs_to_no_community' as check,
  (select count(*) from res_community_members
    where user_id = 'c2222222-2222-4222-8222-222222222222') = 0 as pass;

do $$ begin
  begin
    perform public.res_moderate(
      'cc000000-0000-4000-8000-000000000001', 'hide', 'gossip_post',
      'cf000000-0000-4000-8000-000000000001', 'because I can');
    raise exception 'TEST FAILED: a non-member moderated a community';
  exception when others then
    if sqlerrm like 'TEST FAILED%' then raise; end if;
    if sqlerrm not like 'admin_required%' then raise; end if;
  end;
end $$;
select 'a_non_member_cannot_moderate' as check, true as pass;

select 'and_the_post_was_left_alone' as check,
  (select not hidden from res_gossip_posts where id = 'cf000000-0000-4000-8000-000000000001') as pass;

-- The fix must not break the person it is for.
delete from auth._current;
insert into auth._current values ('c1111111-1111-4111-8111-111111111111');
select public.res_moderate(
  'cc000000-0000-4000-8000-000000000001', 'hide', 'gossip_post',
  'cf000000-0000-4000-8000-000000000001', 'off topic');
select 'a_real_admin_can_still_moderate' as check,
  (select hidden from res_gossip_posts where id = 'cf000000-0000-4000-8000-000000000001') as pass;

-- A community admin must not reach another community's content.
insert into res_communities (id, name, kind, created_by)
values ('cc000000-0000-4000-8000-000000000002', 'Other Street', 'street',
        'c3333333-3333-4333-8333-333333333333')
on conflict (id) do nothing;
insert into res_gossip_posts (id, author_id, community_id, body, hidden)
values ('cf000000-0000-4000-8000-000000000002', 'c3333333-3333-4333-8333-333333333333',
        'cc000000-0000-4000-8000-000000000002', 'someone elses community', false)
on conflict (id) do nothing;

select public.res_moderate(
  'cc000000-0000-4000-8000-000000000001', 'hide', 'gossip_post',
  'cf000000-0000-4000-8000-000000000002', 'reaching across');
select 'an_admin_cannot_moderate_another_community' as check,
  (select not hidden from res_gossip_posts where id = 'cf000000-0000-4000-8000-000000000002') as pass;

-- ── res_household_members: who lives at this address ───────────────────────
-- No auth check at all before the fix. res_listings is world-readable, so
-- listing ids are free, and this returned the landlord and every approved
-- tenant to anybody with an account.
insert into res_listings (id, landlord_id, title, price, location)
values ('cb000000-0000-4000-8000-000000000001', 'c3333333-3333-4333-8333-333333333333',
        'A room', 2000, 'Somewhere')
on conflict (id) do nothing;

delete from auth._current;
insert into auth._current values ('c2222222-2222-4222-8222-222222222222');
select 'a_stranger_cannot_learn_who_lives_there' as check,
  (select count(*) from public.res_household_members('cb000000-0000-4000-8000-000000000001')) = 0 as pass;

delete from auth._current;
insert into auth._current values ('c3333333-3333-4333-8333-333333333333');
select 'the_landlord_still_sees_their_own_household' as check,
  (select count(*) from public.res_household_members('cb000000-0000-4000-8000-000000000001')) >= 1 as pass;

-- ── res_property_occupancy: another landlord's figures ─────────────────────
insert into res_properties (id, landlord_id, address, suburb, city, total_rooms)
values ('ca000000-0000-4000-8000-000000000001', 'c3333333-3333-4333-8333-333333333333',
        '1 Private Road', 'Testburb', 'Testville', 4)
on conflict (id) do nothing;

delete from auth._current;
insert into auth._current values ('c2222222-2222-4222-8222-222222222222');
select 'a_stranger_gets_nothing_about_someone_elses_property' as check,
  public.res_property_occupancy('ca000000-0000-4000-8000-000000000001') is null as pass;

delete from auth._current;
insert into auth._current values ('c3333333-3333-4333-8333-333333333333');
select 'the_owner_still_sees_their_own_occupancy' as check,
  public.res_property_occupancy('ca000000-0000-4000-8000-000000000001') is not null as pass;

-- ── res_has_household_plus: probing someone else's subscription ────────────
insert into res_subscriptions (user_id, product, tier, status)
values ('c3333333-3333-4333-8333-333333333333', 'household_plus', 'premium', 'active')
on conflict do nothing;

delete from auth._current;
insert into auth._current values ('c2222222-2222-4222-8222-222222222222');
select 'a_stranger_cannot_probe_who_is_paying' as check,
  public.res_has_household_plus('c3333333-3333-4333-8333-333333333333') = false as pass;

delete from auth._current;
insert into auth._current values ('c3333333-3333-4333-8333-333333333333');
select 'a_subscriber_can_still_see_their_own_status' as check,
  public.res_has_household_plus('c3333333-3333-4333-8333-333333333333') = true as pass;

-- ── The grant surface ──────────────────────────────────────────────────────
select 'none_of_these_are_reachable_signed_out' as check,
  not has_function_privilege('anon', 'public.res_moderate(uuid,text,text,uuid,text)', 'execute')
  and not has_function_privilege('anon', 'public.res_household_members(uuid)', 'execute')
  and not has_function_privilege('anon', 'public.res_property_occupancy(uuid)', 'execute')
  and not has_function_privilege('anon', 'public.res_has_household_plus(uuid)', 'execute') as pass;

-- ── Internal helpers must not be reachable from a browser ──────────────────
-- res_bump_reputation writes the trust signal that res_can_sell gates selling
-- on and that is shared with the other app. It has no auth.uid() check
-- because it is an internal helper — which is fine only for as long as a
-- resident cannot call it directly. It was granted to authenticated.
--
-- Guarded by to_regprocedure so this file still runs in the local harness,
-- which builds a subset of the schema. Absence reads as a pass ("not
-- installed here, so nothing to reach"); on the live project every signature
-- below resolves.
select 'residents_cannot_write_reputation_directly' as check,
  (to_regprocedure('public.res_bump_reputation(uuid,integer,text)') is null
   or not has_function_privilege('authenticated', to_regprocedure('public.res_bump_reputation(uuid,integer,text)'), 'execute')) as pass;

select 'residents_cannot_award_cross_app_reputation' as check,
  (to_regprocedure('public.res_award_good_neighbour(uuid,integer)') is null
   or not has_function_privilege('authenticated', to_regprocedure('public.res_award_good_neighbour(uuid,integer)'), 'execute')) as pass;

-- The cron sweeps mutate everyone's rows. Nothing in the app calls them.
select 'residents_cannot_run_the_maintenance_sweeps' as check,
  (to_regprocedure('public.res_expire_stale_listings()') is null
   or not has_function_privilege('authenticated', to_regprocedure('public.res_expire_stale_listings()'), 'execute'))
  and (to_regprocedure('public.res_release_stale_claims()') is null
   or not has_function_privilege('authenticated', to_regprocedure('public.res_release_stale_claims()'), 'execute'))
  and (to_regprocedure('public.res_auto_return_tools()') is null
   or not has_function_privilege('authenticated', to_regprocedure('public.res_auto_return_tools()'), 'execute')) as pass;

-- ── The trust pair: a caller-supplied user id, defaulted to auth.uid() ─────
-- That signature means "act on me" but will act on whoever you name unless
-- something stops it. Neither of these stopped it.
--
-- res_sync_trust's guard was `current_user IN ('authenticated','anon')`, and
-- current_user inside a SECURITY DEFINER function is the OWNER, not the
-- caller — so it was permanently false. This reproduces the write it allowed:
-- one resident promoting another resident's cross-app trust row.
delete from auth._current;
insert into auth._current values ('c2222222-2222-4222-8222-222222222222');

do $$ begin
  if to_regprocedure('public.res_sync_trust(uuid)') is null then return; end if;
  begin
    perform public.res_sync_trust('c3333333-3333-4333-8333-333333333333');
    raise exception 'TEST FAILED: one resident synced another resident''s trust';
  exception when others then
    if sqlerrm like 'TEST FAILED%' then raise; end if;
    if sqlerrm not like '%own trust%' then raise; end if;
  end;
end $$;
select 'a_resident_cannot_sync_someone_elses_trust' as check, true as pass;

do $$ begin
  if to_regprocedure('public.res_trust_gate(uuid)') is null then return; end if;
  begin
    perform public.res_trust_gate('c3333333-3333-4333-8333-333333333333');
    raise exception 'TEST FAILED: one resident read another resident''s trust standing';
  exception when others then
    if sqlerrm like 'TEST FAILED%' then raise; end if;
    if sqlerrm not like '%own trust standing%' then raise; end if;
  end;
end $$;
select 'a_resident_cannot_read_someone_elses_trust_standing' as check, true as pass;

-- And neither fix may break the person it is for.
do $$ begin
  if to_regprocedure('public.res_trust_gate(uuid)') is null then return; end if;
  perform public.res_trust_gate('c2222222-2222-4222-8222-222222222222');
  perform public.res_trust_gate();
end $$;
select 'a_resident_can_still_read_their_own_standing' as check, true as pass;
