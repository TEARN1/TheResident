\set ON_ERROR_STOP on
-- Phase F billing. Three things must hold, and the third is the one that
-- matters most: an emergency must send even when nobody has paid.

grant usage on schema public, auth to authenticated;
grant select, insert, update on auth._current to authenticated;

-- ── Probation starts by itself, when the office can actually use it ────────
-- Unit 9d1 (Ward A Councillor) was inserted verified and jurisdiction-bound by
-- an earlier file, so the trigger should already have started its clock.
select 'probation_starts_when_a_unit_is_verified_and_bound' as check,
  exists (select 1 from res_org_unit_billing
          where unit_id = '00000000-0000-0000-0000-0000000009d1'
            and status = 'probation') as pass;

select 'the_free_period_is_six_months' as check,
  (select probation_ends_at::date - probation_started_at::date
   from res_org_unit_billing where unit_id = '00000000-0000-0000-0000-0000000009d1')
   between 180 and 185 as pass;

select 'the_plan_matches_the_level_of_the_area' as check,
  (select plan from res_org_unit_billing where unit_id = '00000000-0000-0000-0000-0000000009d1') = 'area_ward'
  and (select plan from res_org_unit_billing where unit_id = '00000000-0000-0000-0000-0000000009e1') = 'area_municipal' as pass;

-- An unverified unit has nothing to trial: it cannot reach an area at all, so
-- starting its six months would burn the trial on a capability it lacks.
select 'an_unverified_unit_gets_no_probation_clock' as check,
  not exists (select 1 from res_org_unit_billing
              where unit_id = '00000000-0000-0000-0000-0000000009f1') as pass;

select 'a_verified_unit_with_no_boundary_gets_no_probation_clock' as check,
  not exists (select 1 from res_org_unit_billing
              where unit_id = '00000000-0000-0000-0000-0000000009f2') as pass;

select 'during_probation_routine_notices_are_allowed' as check,
  (select allows_routine from public.res_area_billing_state('00000000-0000-0000-0000-0000000009d1')) as pass;

select 'the_state_tells_an_official_how_long_is_left' as check,
  (select days_remaining from public.res_area_billing_state('00000000-0000-0000-0000-0000000009d1')) between 175 and 185 as pass;

-- ── When the free period ends ──────────────────────────────────────────────
update res_org_unit_billing
   set probation_started_at = now() - interval '7 months',
       probation_ends_at = now() - interval '1 month'
 where unit_id = '00000000-0000-0000-0000-0000000009d1';

select 'an_expired_probation_reads_as_lapsed' as check,
  (select state from public.res_area_billing_state('00000000-0000-0000-0000-0000000009d1')) = 'lapsed' as pass;

select 'a_lapsed_office_cannot_send_routine_notices' as check,
  not (select allows_routine from public.res_area_billing_state('00000000-0000-0000-0000-0000000009d1')) as pass;

update auth._current set uid = '00000000-0000-0000-0000-000000000901';

do $$ begin
  begin
    perform public.res_send_area_broadcast(
      '00000000-0000-0000-0000-0000000009d1', 'Unpaid routine', 'Bin day moved.',
      'urgent', null, '00000000-0000-0000-0000-0000000009a1');
    raise exception 'TEST FAILED: a lapsed office sent a routine notice';
  exception when others then
    if sqlerrm like 'TEST FAILED%' then raise; end if;
  end;
end $$;
select 'a_lapsed_office_is_refused_at_the_send' as check,
  not exists (select 1 from res_area_broadcasts where title = 'Unpaid routine') as pass;

-- An earlier file already spent this sender's hourly broadcast allowance, and
-- the burst limiter is not what is under test here. Clearing it so the next
-- assertion measures billing and nothing else.
delete from res_rate_limits where user_id = '00000000-0000-0000-0000-000000000901';

-- ── THE RULE THAT OVERRIDES BILLING ────────────────────────────────────────
--
-- If this ever goes false, the app is charging people for the ability to warn
-- their neighbours that the street is on fire. There is no revenue worth that,
-- and no configuration in which it should be allowed to regress.
select public.res_send_area_broadcast(
  '00000000-0000-0000-0000-0000000009d1', 'Unpaid emergency', 'Gas leak — leave now.',
  'critical', null, '00000000-0000-0000-0000-0000000009a1');

select 'an_emergency_sends_even_when_nobody_has_paid' as check,
  exists (select 1 from res_area_broadcasts where title = 'Unpaid emergency') as pass;

select 'the_unpaid_emergency_actually_reached_residents' as check,
  (select recipient_count from res_area_broadcasts where title = 'Unpaid emergency') >= 1
  and exists (
    select 1 from notifications n
    join res_area_broadcasts b on b.id = (n.data ->> 'area_broadcast_id')::uuid
    where b.title = 'Unpaid emergency') as pass;

-- ── Paying restores routine sending ────────────────────────────────────────
select public.res_set_area_billing(
  '00000000-0000-0000-0000-0000000009d1', 'active', 'area_ward',
  'CUS_test', 'SUB_test', now() + interval '30 days');

select 'paying_restores_routine_sending' as check,
  (select state from public.res_area_billing_state('00000000-0000-0000-0000-0000000009d1')) = 'active'
  and (select allows_routine from public.res_area_billing_state('00000000-0000-0000-0000-0000000009d1')) as pass;

-- Its own statement: inside a single SELECT there is no ordering guarantee
-- between the write and the read of what it wrote.
select public.res_set_area_billing(
  '00000000-0000-0000-0000-0000000009d1', 'active', 'area_ward',
  null, null, now() - interval '1 day');
select 'a_subscription_past_its_period_end_does_not_still_count' as check,
  (select state from public.res_area_billing_state('00000000-0000-0000-0000-0000000009d1')) = 'lapsed' as pass;

-- An exemption is for bodies that must always reach people, and has to say why.
select public.res_exempt_unit_from_area_billing(
  '00000000-0000-0000-0000-0000000009d1', 'Disaster management — never billed');

select 'an_exempt_office_always_sends' as check,
  (select state from public.res_area_billing_state('00000000-0000-0000-0000-0000000009d1')) = 'exempt'
  and (select allows_routine from public.res_area_billing_state('00000000-0000-0000-0000-0000000009d1')) as pass;

do $$ begin
  begin
    perform public.res_exempt_unit_from_area_billing('00000000-0000-0000-0000-0000000009e1', '   ');
    raise exception 'TEST FAILED: an exemption was granted with no reason';
  exception when others then
    if sqlerrm like 'TEST FAILED%' then raise; end if;
  end;
end $$;
select 'an_exemption_must_state_a_reason' as check,
  (select status from res_org_unit_billing where unit_id = '00000000-0000-0000-0000-0000000009e1')
    is distinct from 'exempt' as pass;

-- ── Nobody can mark their own office paid ──────────────────────────────────
set role authenticated;
update auth._current set uid = '00000000-0000-0000-0000-000000000901';

select 'a_sender_can_see_their_own_billing_state' as check,
  exists (select 1 from res_org_unit_billing
          where unit_id = '00000000-0000-0000-0000-0000000009d1') as pass;

do $$ begin
  begin
    update res_org_unit_billing set status = 'active'
     where unit_id = '00000000-0000-0000-0000-0000000009d1';
    if found then raise exception 'TEST FAILED: a unit marked itself paid'; end if;
  exception when insufficient_privilege then
    null;
  when others then
    if sqlerrm like 'TEST FAILED%' then raise; end if;
  end;
end $$;
select 'a_unit_cannot_mark_itself_paid' as check,
  (select status from res_org_unit_billing where unit_id = '00000000-0000-0000-0000-0000000009d1') = 'exempt' as pass;

select 'residents_cannot_write_billing_at_the_grant_level' as check,
  not has_table_privilege('authenticated', 'public.res_org_unit_billing', 'insert')
  and not has_table_privilege('authenticated', 'public.res_org_unit_billing', 'update')
  and not has_table_privilege('authenticated', 'public.res_org_unit_billing', 'delete')
  and not has_table_privilege('anon', 'public.res_org_unit_billing', 'select') as pass;

select 'residents_cannot_call_the_billing_writers' as check,
  not has_function_privilege('authenticated',
    'public.res_set_area_billing(uuid, text, text, text, text, timestamptz)', 'execute')
  and not has_function_privilege('authenticated',
    'public.res_exempt_unit_from_area_billing(uuid, text)', 'execute') as pass;

reset role;

-- Stranger's units stay invisible: a sender for one office must not read
-- another office's licence.
update auth._current set uid = '00000000-0000-0000-0000-000000000953';
set role authenticated;
select 'a_stranger_cannot_read_another_offices_licence' as check,
  (select count(*) from res_org_unit_billing) = 0 as pass;

-- The RPC is security definer, so the table's RLS does not protect it. It
-- needs its own sender check, or whether a public body is paying, lapsed or
-- on trial becomes readable by every signed-in user.
select 'the_billing_rpc_does_not_leak_past_its_own_table_policy' as check,
  (select count(*) from public.res_area_billing_state('00000000-0000-0000-0000-0000000009d1')) = 0 as pass;
reset role;
