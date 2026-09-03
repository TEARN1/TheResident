\set ON_ERROR_STOP on
-- Phase D: the send itself. The dangerous parts are not "does a row appear" —
-- they are that an unverified account cannot send at all, that a councillor
-- cannot reach past their ward no matter what they pass, that the record's
-- headcount matches who was actually notified, and that the public record
-- cannot be edited or erased afterwards.

grant usage on schema public, auth to authenticated;
grant select, insert, update on auth._current to authenticated;

-- Reuses the Phase B/C geography: Ward A is x 0..1, Ward B is x 2..3, the
-- municipality covers both. Councillor 9d1 → Ward A. Mayor 9e1 → municipality.
-- Residents 951/952 are pinned in Ward A, 953 in Ward B, 954 is unpinned but
-- says "Testville".

-- The suite shares one database and an earlier file mutes one of these
-- residents to prove emergencies override muting. Muting is asserted here on
-- purpose, so this file starts from a state it set itself rather than
-- inheriting another test's.
delete from public.res_notification_prefs where user_id in (
  '00000000-0000-0000-0000-000000000951',
  '00000000-0000-0000-0000-000000000952',
  '00000000-0000-0000-0000-000000000953',
  '00000000-0000-0000-0000-000000000954');

-- The councillor sends to their own ward.
update auth._current set uid = '00000000-0000-0000-0000-000000000901';

select 'send_returns_a_record' as check,
  (select id is not null from public.res_send_area_broadcast(
     '00000000-0000-0000-0000-0000000009d1',
     'Water shutdown', 'Water is off in Ward A from 08:00 to 16:00 tomorrow.',
     'urgent', 'water',
     '00000000-0000-0000-0000-0000000009a1')) as pass;

-- The record must say who, where and how many — that is the accountability.
select 'record_names_the_area_it_covered' as check,
  (select target_label from res_area_broadcasts
   where title = 'Water shutdown' order by sent_at desc limit 1) = 'Ward A' as pass;

select 'record_counts_the_pinned_residents_it_reached' as check,
  (select pinned_count from res_area_broadcasts
   where title = 'Water shutdown' order by sent_at desc limit 1) >= 2 as pass;

-- The headcount on the record and the notifications actually delivered must
-- be the same number. If these ever disagree the public record is a lie.
select 'headcount_matches_notifications_delivered' as check,
  (select b.recipient_count = (
     select count(*) from notifications n
     where n.type = 'res_area_broadcast'
       and (n.data ->> 'area_broadcast_id')::uuid = b.id)
   from res_area_broadcasts b where b.title = 'Water shutdown'
   order by b.sent_at desc limit 1) as pass;

select 'resident_pinned_in_the_ward_was_notified' as check,
  exists (select 1 from notifications n
          join res_area_broadcasts b on b.id = (n.data ->> 'area_broadcast_id')::uuid
          where b.title = 'Water shutdown'
            and n.recipient_id = '00000000-0000-0000-0000-000000000951') as pass;

-- THE ONE THAT MATTERS FOR REACH: someone who never followed this councillor
-- still gets it. That is the whole point of the feature and the thing the
-- follow-based system could not do.
select 'reaches_a_resident_who_follows_nobody' as check,
  not exists (select 1 from res_org_follows f
              where f.follower_user_id = '00000000-0000-0000-0000-000000000952')
  and exists (select 1 from notifications n
              join res_area_broadcasts b on b.id = (n.data ->> 'area_broadcast_id')::uuid
              where b.title = 'Water shutdown'
                and n.recipient_id = '00000000-0000-0000-0000-000000000952') as pass;

select 'resident_in_the_other_ward_was_not_notified' as check,
  not exists (select 1 from notifications n
              join res_area_broadcasts b on b.id = (n.data ->> 'area_broadcast_id')::uuid
              where b.title = 'Water shutdown'
                and n.recipient_id = '00000000-0000-0000-0000-000000000953') as pass;

select 'sender_does_not_notify_themselves' as check,
  not exists (select 1 from notifications n
              join res_area_broadcasts b on b.id = (n.data ->> 'area_broadcast_id')::uuid
              where b.title = 'Water shutdown'
                and n.recipient_id = '00000000-0000-0000-0000-000000000901') as pass;

-- ── The gate holds on the write path, not just the preview ─────────────────
--
-- Refusals are asserted by attempting the send for real and proving nothing
-- landed, rather than by trusting that the preview said no. The preview and
-- the send are different code paths and only one of them writes.

do $$ begin
  begin
    perform public.res_send_area_broadcast(
      '00000000-0000-0000-0000-0000000009d1', 'Not yours', 'Should never send.',
      'urgent', null, '00000000-0000-0000-0000-0000000009b1');
    raise exception 'TEST FAILED: a councillor sent into the neighbouring ward';
  exception when others then
    if sqlerrm like 'TEST FAILED%' then raise; end if;
  end;
end $$;
select 'councillor_cannot_send_into_the_neighbouring_ward' as check,
  not exists (select 1 from res_area_broadcasts where title = 'Not yours') as pass;

select 'a_blocked_send_notifies_nobody' as check,
  not exists (select 1 from notifications
              where type = 'res_area_broadcast' and title like '%Not yours%') as pass;

-- Impersonating an official is the largest risk in this feature. An
-- unverified account claiming the same ward must fail on its own line.
do $$ begin
  begin
    perform public.res_send_area_broadcast(
      '00000000-0000-0000-0000-0000000009f1', 'Fake notice', 'Evacuate immediately.',
      'critical', null, '00000000-0000-0000-0000-0000000009a1');
    raise exception 'TEST FAILED: an unverified unit broadcast to an area';
  exception when others then
    if sqlerrm like 'TEST FAILED%' then raise; end if;
  end;
end $$;
select 'unverified_unit_cannot_send_to_an_area' as check,
  not exists (select 1 from res_area_broadcasts where title = 'Fake notice') as pass;

-- A stranger who is not a sender for the unit cannot send as it.
update auth._current set uid = '00000000-0000-0000-0000-000000000953';
do $$ begin
  begin
    perform public.res_send_area_broadcast(
      '00000000-0000-0000-0000-0000000009d1', 'Hijacked', 'Not from the councillor.',
      'urgent', null, '00000000-0000-0000-0000-0000000009a1');
    raise exception 'TEST FAILED: a stranger sent as someone else''s unit';
  exception when others then
    if sqlerrm like 'TEST FAILED%' then raise; end if;
  end;
end $$;
select 'stranger_cannot_send_as_a_unit_they_do_not_belong_to' as check,
  not exists (select 1 from res_area_broadcasts where title = 'Hijacked') as pass;

-- An empty message is not a message.
update auth._current set uid = '00000000-0000-0000-0000-000000000901';
do $$ begin
  begin
    perform public.res_send_area_broadcast(
      '00000000-0000-0000-0000-0000000009d1', '   ', '   ',
      'urgent', null, '00000000-0000-0000-0000-0000000009a1');
    raise exception 'TEST FAILED: an empty broadcast was sent';
  exception when others then
    if sqlerrm like 'TEST FAILED%' then raise; end if;
  end;
end $$;

-- ── Muting, and the one thing that overrides it ────────────────────────────

insert into public.res_notification_prefs (user_id, muted_types)
values ('00000000-0000-0000-0000-000000000952', array['res_area_broadcast'])
on conflict (user_id) do update set muted_types = excluded.muted_types;

-- The send is its own statement: inside a single SELECT there is no
-- ordering guarantee between the send and the check, so an assertion
-- sharing a statement with it can read the rail before delivery.
select public.res_send_area_broadcast(
       '00000000-0000-0000-0000-0000000009d1', 'Routine notice', 'Bin day moves to Thursday.',
       'urgent', null, '00000000-0000-0000-0000-0000000009a1');
select 'muted_resident_is_not_notified_at_urgent' as check,
  not exists (
    select 1 from notifications n
    join res_area_broadcasts b on b.id = (n.data ->> 'area_broadcast_id')::uuid
    where b.title = 'Routine notice'
      and n.recipient_id = '00000000-0000-0000-0000-000000000952') as pass;

-- THE ETHICAL LINE: an emergency reaches someone who muted this sender.
-- If this ever goes false the feature has become spam with an exception,
-- rather than a safety channel with manners.
-- The send is its own statement: inside a single SELECT there is no
-- ordering guarantee between the send and the check, so an assertion
-- sharing a statement with it can read the rail before delivery.
select public.res_send_area_broadcast(
       '00000000-0000-0000-0000-0000000009d1', 'Evacuate now', 'Gas leak on Main Road.',
       'critical', null, '00000000-0000-0000-0000-0000000009a1');
select 'critical_reaches_the_muted_resident_anyway' as check,
  exists (
    select 1 from notifications n
    join res_area_broadcasts b on b.id = (n.data ->> 'area_broadcast_id')::uuid
    where b.title = 'Evacuate now'
      and n.recipient_id = '00000000-0000-0000-0000-000000000952') as pass;

select 'critical_is_flagged_as_needing_acknowledgement' as check,
  (select (n.data ->> 'requires_ack')::boolean from notifications n
   join res_area_broadcasts b on b.id = (n.data ->> 'area_broadcast_id')::uuid
   where b.title = 'Evacuate now' limit 1) as pass;

delete from public.res_notification_prefs
where user_id = '00000000-0000-0000-0000-000000000952';

-- ── The suburb fallback works without the sender typing place names ────────
--
-- The pinned residents supply the suburb names inside the ward, which is how
-- an unpinned resident who typed "Testville" is reached at all.
update public.res_home_areas set suburb = 'Testville', city = 'Test City'
where user_id = '00000000-0000-0000-0000-000000000951';

-- The send is its own statement: inside a single SELECT there is no
-- ordering guarantee between the send and the check, so an assertion
-- sharing a statement with it can read the rail before delivery.
select public.res_send_area_broadcast(
       '00000000-0000-0000-0000-0000000009d1', 'Suburb reach', 'Testing the text fallback.',
       'urgent', null, '00000000-0000-0000-0000-0000000009a1');
select 'unpinned_resident_reached_via_a_suburb_name_derived_from_pins' as check,
  exists (
    select 1 from notifications n
    join res_area_broadcasts b on b.id = (n.data ->> 'area_broadcast_id')::uuid
    where b.title = 'Suburb reach'
      and n.recipient_id = '00000000-0000-0000-0000-000000000954') as pass;

select 'the_record_separates_certain_reach_from_fuzzy_reach' as check,
  (select text_matched_count >= 1 and pinned_count >= 2
   from res_area_broadcasts where title = 'Suburb reach') as pass;

-- ── 'normal' stays off the bell ────────────────────────────────────────────

-- The send is its own statement: inside a single SELECT there is no
-- ordering guarantee between the send and the check, so an assertion
-- sharing a statement with it can read the rail before delivery.
select public.res_send_area_broadcast(
       '00000000-0000-0000-0000-0000000009d1', 'Quiet note', 'Library opens at 9.',
       'normal', null, '00000000-0000-0000-0000-0000000009a1');
select 'normal_priority_is_recorded_but_not_pushed_to_the_bell' as check,
  exists (select 1 from res_area_broadcasts where title = 'Quiet note')
  and not exists (
    select 1 from notifications n
    join res_area_broadcasts b on b.id = (n.data ->> 'area_broadcast_id')::uuid
    where b.title = 'Quiet note') as pass;

-- ── The record cannot be rewritten ─────────────────────────────────────────
--
-- A permanent public record is only worth anything if the official who sent
-- it cannot go back and soften it, or make it disappear.

set role authenticated;
update auth._current set uid = '00000000-0000-0000-0000-000000000901';

select 'the_record_is_public_to_every_signed_in_resident' as check,
  (select count(*) from res_area_broadcasts where title = 'Water shutdown') = 1 as pass;

do $$ begin
  begin
    update res_area_broadcasts set body = 'Something softer' where title = 'Water shutdown';
    if found then raise exception 'TEST FAILED: a sender edited their own broadcast'; end if;
  exception when insufficient_privilege then
    null;
  when others then
    if sqlerrm like 'TEST FAILED%' then raise; end if;
  end;
end $$;
select 'sender_cannot_edit_what_they_broadcast' as check,
  (select body from res_area_broadcasts where title = 'Water shutdown')
    = 'Water is off in Ward A from 08:00 to 16:00 tomorrow.' as pass;

do $$ begin
  begin
    delete from res_area_broadcasts where title = 'Water shutdown';
    if found then raise exception 'TEST FAILED: a sender deleted their own broadcast'; end if;
  exception when insufficient_privilege then
    null;
  when others then
    if sqlerrm like 'TEST FAILED%' then raise; end if;
  end;
end $$;
select 'sender_cannot_erase_what_they_broadcast' as check,
  exists (select 1 from res_area_broadcasts where title = 'Water shutdown') as pass;

-- A resident must not be able to enumerate the suburbs inside a polygon.
do $$ begin
  begin
    perform public.res_area_place_names(
      (select boundary from public.res_jurisdictions where external_ref = 'WA-1'));
    raise exception 'TEST FAILED: a resident enumerated place names inside a polygon';
  exception when insufficient_privilege then
    null;
  when others then
    if sqlerrm like 'TEST FAILED%' then raise; end if;
  end;
end $$;
select 'residents_cannot_enumerate_place_names_in_an_area' as check,
  not has_function_privilege('authenticated',
    'public.res_area_place_names(geography)', 'execute') as pass;

-- ── The track record, and what a resident received ─────────────────────────

select 'the_history_shows_what_this_official_has_sent' as check,
  (select count(*) from public.res_area_broadcast_history(
     '00000000-0000-0000-0000-0000000009d1')) >= 4 as pass;

update auth._current set uid = '00000000-0000-0000-0000-000000000951';
select 'a_resident_can_see_the_notices_they_received' as check,
  (select count(*) from public.res_my_area_notices()) >= 1 as pass;

-- Dropping to superuser only to read the Gruvs-owned notifications rail,
-- which The Resident's roles have no grant on. The claim under test is about
-- res_my_area_notices' own scoping, not about who may read that table.
reset role;
select 'a_resident_sees_only_their_own_notices' as check,
  (select count(*) from public.res_my_area_notices()) <=
  (select count(*) from notifications
   where recipient_id = '00000000-0000-0000-0000-000000000951'
     and type = 'res_area_broadcast') as pass;

set role authenticated;
-- Acknowledging is the resident's own act and is recorded against them.
-- Again its own statement, for the same reason as the sends above.
select public.res_ack_area_broadcast(
  (select id from res_area_broadcasts where title = 'Evacuate now'));
select 'acknowledging_is_recorded' as check,
  exists (select 1 from res_area_broadcast_receipts
          where user_id = '00000000-0000-0000-0000-000000000951'
            and acknowledged_at is not null) as pass;

reset role;

-- ── Grant boundary ─────────────────────────────────────────────────────────
--
-- RLS is the first lock; the absent table grants are the second. Supabase's
-- default privileges grant ALL on a new table to anon and authenticated, so
-- the schema file has to revoke before it grants — and that is easy to lose
-- in a later edit. These assertions notice if it ever is.
select 'the_record_cannot_be_written_or_erased_at_the_grant_level' as check,
  not has_table_privilege('authenticated', 'public.res_area_broadcasts', 'insert')
  and not has_table_privilege('authenticated', 'public.res_area_broadcasts', 'update')
  and not has_table_privilege('authenticated', 'public.res_area_broadcasts', 'delete') as pass;

select 'the_record_is_not_exposed_to_signed_out_visitors' as check,
  not has_table_privilege('anon', 'public.res_area_broadcasts', 'select') as pass;

select 'a_resident_cannot_delete_their_acknowledgement_receipts' as check,
  not has_table_privilege('authenticated', 'public.res_area_broadcast_receipts', 'delete') as pass;

select 'residents_may_send_and_acknowledge' as check,
  has_function_privilege('authenticated',
    'public.res_send_area_broadcast(uuid, text, text, text, text, uuid, double precision, double precision, double precision, timestamptz)', 'execute')
  and has_function_privilege('authenticated',
    'public.res_ack_area_broadcast(uuid)', 'execute') as pass;
