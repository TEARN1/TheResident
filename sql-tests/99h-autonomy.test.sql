\set ON_ERROR_STOP on
-- Section 49: the control layer over every scheduled job.
--
-- What must hold, in order of how badly it fails if it does not:
--   1. A panic alert nobody answers gets LOUDER, and never quieter.
--   2. An unanswered alert is recorded as unanswered, not as a false alarm.
--   3. A job can be switched off without a deploy, and the switch is obeyed.
--   4. A job that changes far more rows than expected stops itself.
--   5. Only a platform admin can see or touch any of it.
-- Numbered after 99c so the runner it governs is already exercised.

insert into public.profiles (id) values
  ('00000000-0000-0000-0000-000000009901'),  -- raises the alert
  ('00000000-0000-0000-0000-000000009902'),  -- lives ~5.5 km away
  ('00000000-0000-0000-0000-000000009903'),  -- lives ~22 km away
  ('00000000-0000-0000-0000-000000009904'),  -- lives ~1 km away (already reached)
  ('00000000-0000-0000-0000-000000009905'),  -- platform admin
  ('00000000-0000-0000-0000-000000009906')   -- an ordinary resident
on conflict do nothing;

insert into public.res_home_areas (user_id, lat, lon) values
  ('00000000-0000-0000-0000-000000009902', -26.25, 28.00),
  ('00000000-0000-0000-0000-000000009903', -26.40, 28.00),
  ('00000000-0000-0000-0000-000000009904', -26.21, 28.00)
on conflict (user_id) do update set lat = excluded.lat, lon = excluded.lon;

insert into public.res_platform_admins (user_id) values
  ('00000000-0000-0000-0000-000000009905') on conflict do nothing;

-- ── 1. Escalation ───────────────────────────────────────────────────────────
insert into public.res_alerts (id, user_id, kind, title, lat, lon, severity, status, created_at)
values ('00000000-0000-0000-0000-00000000a001', '00000000-0000-0000-0000-000000009901',
        'panic', 'Help at the corner', -26.20, 28.00, 'critical', 'active', now() - interval '3 minutes');

select 'a_fresh_unanswered_panic_escalates_once' as check,
  public.res_escalate_alerts() = 1 as pass;

select 'level_one_reaches_the_neighbour_between_3_and_10_km' as check,
  exists (select 1 from notifications
          where recipient_id = '00000000-0000-0000-0000-000000009902'
            and data->>'alert_id' = '00000000-0000-0000-0000-00000000a001') as pass;

select 'level_one_does_not_reach_22_km_away' as check,
  not exists (select 1 from notifications
              where recipient_id = '00000000-0000-0000-0000-000000009903'
                and data->>'alert_id' = '00000000-0000-0000-0000-00000000a001') as pass;

select 'level_one_does_not_double_notify_those_already_reached' as check,
  not exists (select 1 from notifications
              where recipient_id = '00000000-0000-0000-0000-000000009904'
                and data->>'alert_id' = '00000000-0000-0000-0000-00000000a001') as pass;

select 'running_again_before_5_minutes_does_nothing' as check,
  public.res_escalate_alerts() = 0 as pass;

update public.res_alerts set created_at = now() - interval '6 minutes'
 where id = '00000000-0000-0000-0000-00000000a001';

select 'at_5_minutes_it_escalates_again' as check,
  public.res_escalate_alerts() = 1 as pass;

-- Read in its own statement: a subquery in the same statement as the call
-- sees the snapshot from before the call ran.
select 'and_is_now_at_level_two' as check,
  (select escalation_level from res_alerts where id = '00000000-0000-0000-0000-00000000a001') = 2 as pass;

select 'level_two_reaches_the_platform_admin' as check,
  exists (select 1 from notifications
          where recipient_id = '00000000-0000-0000-0000-000000009905'
            and (data->>'escalation')::int = 2) as pass;

select 'level_two_raises_a_critical_finding' as check,
  exists (select 1 from res_ops_findings
          where source = 'res_escalate_alerts' and severity = 'critical') as pass;

select 'escalation_never_changes_the_alert_status' as check,
  (select status from res_alerts where id = '00000000-0000-0000-0000-00000000a001') = 'active' as pass;

select 'escalation_stops_at_level_two' as check,
  public.res_escalate_alerts() = 0 as pass;

-- An answered alert is left alone.
insert into public.res_alerts (id, user_id, kind, title, lat, lon, severity, status, created_at)
values ('00000000-0000-0000-0000-00000000a002', '00000000-0000-0000-0000-000000009901',
        'panic', 'Answered one', -26.20, 28.00, 'critical', 'active', now() - interval '3 minutes');
insert into public.res_alert_responders (alert_id, responder_id)
values ('00000000-0000-0000-0000-00000000a002', '00000000-0000-0000-0000-000000009904');

select 'an_answered_alert_is_not_escalated' as check,
  public.res_escalate_alerts() = 0 as pass;

-- ── 2. Unanswered is not a false alarm ──────────────────────────────────────
update public.res_alerts set created_at = now() - interval '7 hours'
 where id = '00000000-0000-0000-0000-00000000a001';

select 'the_sweep_closes_the_stale_unanswered_alert' as check,
  public.res_expire_stale_alerts() = 1 as pass;

select 'it_is_recorded_as_unanswered_not_false_alarm' as check,
  (select status from res_alerts where id = '00000000-0000-0000-0000-00000000a001') = 'expired_unanswered' as pass;

select 'closing_it_raises_a_critical_finding' as check,
  exists (select 1 from res_ops_findings
          where source = 'res_expire_stale_alerts' and severity = 'critical') as pass;

-- ── 3. The kill switch ──────────────────────────────────────────────────────
update res_automation_jobs set enabled = false where key = 'res_prune_client_errors';
delete from res_maintenance_runs;

select 'a_disabled_job_is_reported_as_skipped' as check,
  (select error from public.res_run_maintenance() where task = 'res_prune_client_errors') = 'skipped: disabled' as pass;

select 'and_the_rest_still_run' as check,
  (select count(*) from res_maintenance_runs where error is distinct from 'skipped: disabled') > 0 as pass;

update res_automation_jobs set enabled = true where key = 'res_prune_client_errors';

-- The global stop halts everything, including the minutely escalation.
update res_automation_jobs set enabled = false where key = '*';
delete from res_maintenance_runs;

select 'the_global_stop_skips_every_nightly_job' as check,
  (select bool_and(error = 'skipped: disabled') from public.res_run_maintenance()) as pass;

insert into public.res_alerts (id, user_id, kind, title, lat, lon, severity, status, created_at)
values ('00000000-0000-0000-0000-00000000a003', '00000000-0000-0000-0000-000000009901',
        'panic', 'During a global stop', -26.20, 28.00, 'critical', 'active', now() - interval '3 minutes');

select 'the_global_stop_halts_escalation_too' as check,
  public.res_escalate_alerts() = 0 as pass;

update res_automation_jobs set enabled = true where key = '*';
delete from res_alerts where id = '00000000-0000-0000-0000-00000000a003';

-- ── 4. The blast-radius cap ─────────────────────────────────────────────────
-- A deliberately runaway task: reports changing far more than its cap.
create or replace function public.res_auto_return_tools()
returns integer language plpgsql as $$ begin return 100000; end; $$;

delete from res_maintenance_runs;
select 'a_run_completes_even_when_a_job_blows_its_cap' as check,
  (select count(*) from public.res_run_maintenance()) > 1 as pass;

select 'the_runaway_job_switched_itself_off' as check,
  (select not enabled and disabled_reason like '%over its cap%'
     from res_automation_jobs where key = 'res_auto_return_tools') as pass;

select 'and_raised_a_critical_finding' as check,
  exists (select 1 from res_ops_findings
          where source = 'runner' and severity = 'critical'
            and summary like 'res_auto_return_tools%') as pass;

-- ── 5. Repeats do not pile up ───────────────────────────────────────────────
select public.res_raise_finding('test', 'warn', 'same thing');
select public.res_raise_finding('test', 'warn', 'same thing');
select 'a_repeated_finding_bumps_a_counter' as check,
  (select count(*) = 1 and max(occurrences) = 2 from res_ops_findings
    where source = 'test' and summary = 'same thing') as pass;

-- ── 6. Security scanner ─────────────────────────────────────────────────────
insert into public.res_security_logs (user_id, event_type, action)
select '00000000-0000-0000-0000-000000009906', 'auth_failed', 'sign_in'
  from generate_series(1, 12);

select 'the_scanner_reports_a_pattern' as check,
  public.res_scan_security_logs() >= 1 as pass;

select 'it_is_the_repeated_failed_sign_ins' as check,
  exists (select 1 from res_ops_findings
          where summary = 'Repeated failed sign-ins on one account') as pass;

-- ── 7. Metrics hold counts, not people ──────────────────────────────────────
select public.res_rollup_metrics();
select 'metrics_roll_up_yesterday' as check,
  exists (select 1 from res_metrics_daily
          where day = (now() at time zone 'Africa/Johannesburg')::date - 1) as pass;

select 'metrics_have_no_column_that_can_identify_a_person' as check,
  not exists (select 1 from information_schema.columns
              where table_schema = 'public' and table_name = 'res_metrics_daily'
                and (column_name like '%user%' or column_name like '%_id')) as pass;

-- ── 8. Only a platform admin sees or touches any of it ──────────────────────
update auth._current set uid = '00000000-0000-0000-0000-000000009906';
do $$ begin
  begin
    perform public.res_ops_overview();
    raise exception 'TEST FAILED: a resident read the ops overview';
  exception when others then
    if sqlerrm like 'TEST FAILED%' then raise; end if;
    if sqlerrm not like 'not_a_platform_admin%' then raise; end if;
  end;
  begin
    perform public.res_ops_set_job_enabled('*', false);
    raise exception 'TEST FAILED: a resident flipped the global stop';
  exception when others then
    if sqlerrm like 'TEST FAILED%' then raise; end if;
    if sqlerrm not like 'not_a_platform_admin%' then raise; end if;
  end;
end $$;
select 'an_ordinary_resident_cannot_read_or_switch_anything' as check, true as pass;

select 'and_the_global_stop_is_still_on' as check,
  (select enabled from res_automation_jobs where key = '*') as pass;

select 'no_client_role_can_touch_the_tables_directly' as check,
  not has_table_privilege('authenticated', 'public.res_ops_findings', 'select')
  and not has_table_privilege('authenticated', 'public.res_automation_jobs', 'update')
  and not has_table_privilege('anon', 'public.res_metrics_daily', 'select')
  and not has_function_privilege('authenticated', 'public.res_escalate_alerts()', 'execute')
  and not has_function_privilege('authenticated', 'public.res_prune_security_logs()', 'execute') as pass;

-- The admin can.
update auth._current set uid = '00000000-0000-0000-0000-000000009905';
select 'an_admin_sees_jobs_findings_and_metrics' as check,
  (select jsonb_array_length(o->'jobs') > 10
      and jsonb_array_length(o->'findings') > 0
      and jsonb_array_length(o->'metrics') > 0
     from (select public.res_ops_overview() o) x) as pass;

select public.res_ops_set_job_enabled('res_auto_return_tools', true);
select 'an_admin_can_switch_a_job_back_on' as check,
  (select enabled and disabled_reason is null
     from res_automation_jobs where key = 'res_auto_return_tools') as pass;

select public.res_ops_ack_finding((select id from res_ops_findings where source = 'test' limit 1));
select 'an_admin_can_acknowledge_a_finding' as check,
  (select acknowledged_by = '00000000-0000-0000-0000-000000009905'
     from res_ops_findings where source = 'test') as pass;

update auth._current set uid = null;
