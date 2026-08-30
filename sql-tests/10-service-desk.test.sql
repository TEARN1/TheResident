\set ON_ERROR_STOP on
\timing off

-- Cast of characters
insert into profiles (id, city) values
  ('11111111-1111-4111-8111-111111111111', 'Midrand'),   -- reporter
  ('22222222-2222-4222-8222-222222222222', 'Midrand'),   -- neighbour
  ('33333333-3333-4333-8333-333333333333', 'Midrand');   -- provider staff
insert into res_profiles (id, role) values
  ('11111111-1111-4111-8111-111111111111', 'tenant'),
  ('22222222-2222-4222-8222-222222222222', 'tenant'),
  ('33333333-3333-4333-8333-333333333333', 'tenant');

insert into res_infra_providers (id, name, kind)
values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'City of Joburg Water', 'water');
insert into res_infra_partner_admins (provider_id, user_id)
values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '33333333-3333-4333-8333-333333333333');

-- ── Reporter files the three-week sewer ────────────────────────────────────
insert into auth._current values ('11111111-1111-4111-8111-111111111111');

select 'submit' as step,
       (r).reference, (r).status, (r).target_hours, (r).suburb
from (select res_submit_service_report(
  'sewerage', 'Sewer overflowing into Mahlangu Street', 'Three weeks now.',
  'high', 'Ivory Park', 'Midrand', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', null, null, null
) as r) s;

-- Reference format, target snapshot, and the profile backfill.
select 'reference_ok' as check, reference ~ '^SR-[0-9]{4}-[0-9]{5}$' as pass from res_service_reports;
select 'target_is_24h_for_sewerage_high' as check, target_hours = 24 as pass from res_service_reports;
select 'locality_backfilled_onto_profile' as check,
       (suburb = 'Ivory Park' and city = 'Midrand') as pass
from res_profiles where id = '11111111-1111-4111-8111-111111111111';
select 'opening_timeline_row' as check, count(*) = 1 as pass
from res_service_report_updates where kind = 'system';

-- Missing locality must be refused (the RLS visibility rule depends on it).
do $$ begin
  begin
    perform res_submit_service_report('water','No suburb given',null,'low','','Midrand',null,null,null,null);
    raise exception 'TEST FAILED: blank suburb was accepted';
  exception when others then
    if sqlerrm not like 'locality_required%' then raise; end if;
  end;
end $$;
select 'blank_suburb_rejected' as check, true as pass;

-- ── Neighbour corroborates ─────────────────────────────────────────────────
update auth._current set uid = '22222222-2222-4222-8222-222222222222';
update res_profiles set suburb = 'Ivory Park', city = 'Midrand'
 where id = '22222222-2222-4222-8222-222222222222';

select 'confirm_returns_count' as check,
       res_confirm_service_report((select id from res_service_reports)) = 1 as pass;
-- Idempotent: saying "me too" twice must not inflate the count.
select 'confirm_is_idempotent' as check,
       res_confirm_service_report((select id from res_service_reports)) = 1 as pass;

-- You cannot corroborate your own report.
update auth._current set uid = '11111111-1111-4111-8111-111111111111';
do $$ begin
  begin
    perform res_confirm_service_report((select id from res_service_reports));
    raise exception 'TEST FAILED: own report was corroborated';
  exception when others then
    if sqlerrm not like 'own_report%' then raise; end if;
  end;
end $$;
select 'own_report_rejected' as check, true as pass;

-- ── A resident cannot move the provider's status ───────────────────────────
do $$ begin
  begin
    perform res_set_service_report_status((select id from res_service_reports), 'resolved', null);
    raise exception 'TEST FAILED: reporter marked their own report resolved';
  exception when others then
    if sqlerrm not like 'not_your_report%' then raise; end if;
  end;
end $$;
select 'reporter_cannot_resolve' as check, true as pass;

-- ── Provider works the ticket ──────────────────────────────────────────────
update auth._current set uid = '33333333-3333-4333-8333-333333333333';

-- Backdate the filing so the measured durations are non-trivial.
update res_service_reports set created_at = now() - interval '30 hours';

select 'acknowledge' as step, (res_set_service_report_status(
  (select id from res_service_reports), 'acknowledged', 'Crew dispatched.')).status;

select 'ack_stamped' as check, acknowledged_at is not null as pass from res_service_reports;
select 'first_response_stamped' as check, first_response_at is not null as pass from res_service_reports;

-- The bug this test exists for: from_status must be the OLD value.
select 'timeline_records_transition' as check,
       (from_status = 'submitted' and to_status = 'acknowledged') as pass
from res_service_report_updates where kind = 'status_change' order by created_at desc limit 1;

select 'resolve' as step, (res_set_service_report_status(
  (select id from res_service_reports), 'resolved', 'Blockage cleared.')).status;
select 'resolved_stamped' as check, resolved_at is not null as pass from res_service_reports;

-- ── The track record ───────────────────────────────────────────────────────
select 'performance' as step, provider_name, open_count, resolved_count,
       median_resolve_hours, overdue_count
from res_provider_performance();

select 'median_resolve_is_about_30h' as check,
       median_resolve_hours between 29 and 31 as pass
from res_provider_performance();
select 'nothing_open_after_resolve' as check, open_count = 0 as pass
from res_provider_performance();

-- ── Rate limiting actually bites ───────────────────────────────────────────
update auth._current set uid = '11111111-1111-4111-8111-111111111111';
do $$
declare i integer;
begin
  for i in 1..5 loop
    perform res_submit_service_report('water', 'Spam ' || i, null, 'low', 'Ivory Park', 'Midrand', null, null, null, null);
  end loop;
  raise exception 'TEST FAILED: rate limit never fired';
exception when others then
  if sqlerrm not like 'rate_limit_exceeded%' then raise; end if;
end $$;
select 'rate_limit_enforced' as check, true as pass;

-- Reopening clears the resolution stamps rather than leaving a stale one.
update auth._current set uid = '11111111-1111-4111-8111-111111111111';
select 'reopen' as step, (res_set_service_report_status(
  (select id from res_service_reports where reference like 'SR-%' order by created_at limit 1),
  'submitted', 'Still overflowing.')).status;
select 'reopen_clears_resolved_at' as check, resolved_at is null as pass
from res_service_reports order by created_at limit 1;
