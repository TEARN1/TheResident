\set ON_ERROR_STOP on

-- The org tree: a district with a school beneath it, and a class beneath that.
-- A parent follows the CLASS; a district-level announcement must still reach
-- them, because a post cascades down to followers of any descendant.
insert into profiles (id, city) values
  ('a1111111-1111-4111-8111-111111111111', 'Midrand'),  -- principal (sender)
  ('a2222222-2222-4222-8222-222222222222', 'Midrand'),  -- parent, follows the class
  ('a3333333-3333-4333-8333-333333333333', 'Midrand');  -- unrelated resident
insert into res_profiles (id, role) values
  ('a1111111-1111-4111-8111-111111111111', 'tenant'),
  ('a2222222-2222-4222-8222-222222222222', 'tenant'),
  ('a3333333-3333-4333-8333-333333333333', 'tenant');

insert into auth._current values ('a1111111-1111-4111-8111-111111111111');

insert into res_org_units (id, parent_id, name, tier, owner_user_id, verified) values
  ('b0000000-0000-4000-8000-000000000001', null,
   'Gauteng Department of Education', 'department', 'a1111111-1111-4111-8111-111111111111', true),
  ('b0000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000001',
   'Ivory Park Secondary', 'school', 'a1111111-1111-4111-8111-111111111111', true),
  ('b0000000-0000-4000-8000-000000000003', 'b0000000-0000-4000-8000-000000000002',
   'Grade 10A', 'class', 'a1111111-1111-4111-8111-111111111111', true),
  -- Anyone can create this. It must never be able to interrupt a phone.
  ('b0000000-0000-4000-8000-000000000099', null,
   'Eskom', 'utility', 'a3333333-3333-4333-8333-333333333333', false);

select 'new_tiers_accepted' as check, count(*) = 4 as pass from res_org_units;

-- The parent follows only the class.
insert into res_org_follows (unit_id, follower_user_id)
values ('b0000000-0000-4000-8000-000000000003', 'a2222222-2222-4222-8222-222222222222');

-- ── An unverified unit cannot interrupt anyone ─────────────────────────────
do $$ begin
  begin
    insert into res_org_broadcasts (unit_id, sender_id, title, body, priority)
    values ('b0000000-0000-4000-8000-000000000099', 'a1111111-1111-4111-8111-111111111111',
            'Load shedding stage 8', 'Fake.', 'critical');
    raise exception 'TEST FAILED: an unverified unit sent at critical priority';
  exception when others then
    if sqlerrm not like 'unit_not_verified%' then raise; end if;
  end;
end $$;
select 'unverified_cannot_send_urgent' as check, true as pass;

-- ...but may still post normally to people who chose to follow it.
insert into res_org_broadcasts (unit_id, sender_id, title, body, priority)
values ('b0000000-0000-4000-8000-000000000099', 'a1111111-1111-4111-8111-111111111111',
        'Planned maintenance', 'Routine.', 'normal');
select 'unverified_can_still_post_normal' as check, count(*) = 1 as pass
from res_org_broadcasts where priority = 'normal';

-- A normal-priority post reaches the feed and nothing else.
select 'normal_priority_creates_no_notifications' as check, count(*) = 0 as pass
from notifications;

-- ── A verified district post cascades down to a class follower ─────────────
insert into res_org_broadcasts (id, unit_id, sender_id, title, body, priority, category)
values ('c0000000-0000-4000-8000-00000000000a', 'b0000000-0000-4000-8000-000000000001',
        'a1111111-1111-4111-8111-111111111111',
        'Schools closed tomorrow', 'Severe weather warning.', 'critical', 'closure');

select 'cascade_reached_class_follower' as check, count(*) = 1 as pass
from notifications where recipient_id = 'a2222222-2222-4222-8222-222222222222';

select 'sender_did_not_notify_themselves' as check, count(*) = 0 as pass
from notifications where recipient_id = 'a1111111-1111-4111-8111-111111111111';

select 'non_follower_got_nothing' as check, count(*) = 0 as pass
from notifications where recipient_id = 'a3333333-3333-4333-8333-333333333333';

select 'notification_carries_priority_and_ack' as check,
       (data->>'priority' = 'critical' and data->>'requires_ack' = 'true') as pass
from notifications limit 1;

select 'notification_deep_links_to_the_broadcast' as check,
       action_url like '%broadcast=c0000000-0000-4000-8000-00000000000a' as pass
from notifications limit 1;

-- Both spellings written, because the live table carries both and different
-- clients read different ones.
select 'both_body_and_message_written' as check,
       (body is not null and message is not null) as pass from notifications limit 1;
select 'both_read_flags_written' as check,
       (read = false and is_read = false) as pass from notifications limit 1;

-- ── The parent sees it pending, acknowledges, and it clears ────────────────
update auth._current set uid = 'a2222222-2222-4222-8222-222222222222';

select 'parent_sees_it_pending' as check, count(*) = 1 as pass
from res_pending_urgent_broadcasts();

select res_ack_broadcast('c0000000-0000-4000-8000-00000000000a');

select 'ack_clears_pending' as check, count(*) = 0 as pass
from res_pending_urgent_broadcasts();

select 'ack_recorded_on_receipt' as check, acknowledged_at is not null as pass
from res_org_broadcast_receipts
where user_id = 'a2222222-2222-4222-8222-222222222222';

-- The bell entry and the receipt must not be able to disagree.
select 'ack_also_marked_the_bell_read' as check, (read and is_read) as pass
from notifications where recipient_id = 'a2222222-2222-4222-8222-222222222222';

-- Acknowledging twice is harmless and does not move the original timestamp.
select res_ack_broadcast('c0000000-0000-4000-8000-00000000000a');
select 'ack_is_idempotent' as check, count(*) = 1 as pass
from res_org_broadcast_receipts where user_id = 'a2222222-2222-4222-8222-222222222222';

-- An unrelated resident never had it pending in the first place.
update auth._current set uid = 'a3333333-3333-4333-8333-333333333333';
select 'stranger_has_nothing_pending' as check, count(*) = 0 as pass
from res_pending_urgent_broadcasts();
