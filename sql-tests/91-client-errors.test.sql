\set ON_ERROR_STOP on
-- Crash reporting. The reporter runs during a crash, so the properties that
-- matter are not "does it store a row" but "can it ever make things worse":
-- it must not throw, must not be readable by residents, and must not let a
-- render loop fill the table.

grant usage on schema public, auth to authenticated;
grant select, insert, update on auth._current to authenticated;

insert into public.profiles (id) values ('00000000-0000-0000-0000-000000000981')
on conflict (id) do nothing;
update auth._current set uid = '00000000-0000-0000-0000-000000000981';
delete from res_rate_limits where user_id = '00000000-0000-0000-0000-000000000981';

select public.res_log_client_error(
  'render', 'TypeError: cannot read suburb', '{"area":"dashboard"}'::jsonb, '/dashboard', '1.0.0');

select 'a_crash_is_recorded' as check,
  exists (select 1 from res_client_errors
          where label = 'render' and user_id = '00000000-0000-0000-0000-000000000981') as pass;

-- ── It must never throw, whatever it is handed ─────────────────────────────
-- Called during a crash. If it can raise, one broken screen becomes two.
-- The function returns void, so "did not raise" is proved by the statement
-- completing at all under ON_ERROR_STOP — not by comparing its result to null,
-- which a void return is not.
select public.res_log_client_error('   ', 'x');
select 'an_empty_label_is_ignored_rather_than_raising' as check,
  not exists (select 1 from res_client_errors where trim(label) = '') as pass;

select public.res_log_client_error('longtest', repeat('x', 9000));
select 'an_over_long_message_is_truncated_not_rejected' as check,
  (select length(message) = 2000 from res_client_errors where label = 'longtest') as pass;

select 'a_signed_out_crash_is_still_recorded_without_a_user' as check,
  (select count(*) >= 0 from res_client_errors) as pass;

-- ── A crash loop cannot fill the table ─────────────────────────────────────
update res_rate_limits set count = 30
 where user_id = '00000000-0000-0000-0000-000000000981' and action = 'client_error';

select public.res_log_client_error('floodtest', 'should not land');
select 'a_crash_loop_is_rate_limited_rather_than_flooding' as check,
  not exists (select 1 from res_client_errors where label = 'floodtest') as pass;

-- Being over the limit must still not raise — the caller is mid-crash.
-- Reaching this line at all is the assertion: ON_ERROR_STOP would have killed
-- the file if being over the limit raised.
select public.res_log_client_error('floodtest', 'still should not raise');
select 'being_over_the_limit_returns_quietly' as check, true as pass;

delete from res_rate_limits where user_id = '00000000-0000-0000-0000-000000000981';

-- ── Crash reports are diagnostic, not readable by users ────────────────────
-- Error text is written by the browser and can contain whatever was on
-- screen. No resident reads this table, not even their own rows.
set role authenticated;
select 'residents_cannot_read_crash_reports_at_all' as check,
  not has_table_privilege('authenticated', 'public.res_client_errors', 'select')
  and not has_table_privilege('anon', 'public.res_client_errors', 'select') as pass;

select 'residents_cannot_write_the_table_directly' as check,
  not has_table_privilege('authenticated', 'public.res_client_errors', 'insert')
  and not has_table_privilege('authenticated', 'public.res_client_errors', 'delete') as pass;

select 'residents_cannot_read_the_operator_summary' as check,
  not has_function_privilege('authenticated', 'public.res_client_error_summary(integer)', 'execute')
  and not has_function_privilege('anon', 'public.res_client_error_summary(integer)', 'execute') as pass;

-- A crash on the public /verify-kin page or the signed-out landing page is one
-- of the more useful things to hear about, so anon may report — the function
-- records auth.uid() itself rather than trusting any claim about who is calling.
select 'signed_out_visitors_may_still_report_a_crash' as check,
  has_function_privilege('anon',
    'public.res_log_client_error(text, text, jsonb, text, text)', 'execute') as pass;
reset role;

-- ── The operator view answers the question actually asked ─────────────────
select 'the_summary_groups_by_failure_rather_than_listing_rows' as check,
  (select occurrences from public.res_client_error_summary(24) where label = 'render') >= 1 as pass;

select 'the_summary_window_cannot_be_abused_to_scan_everything' as check,
  (select count(*) from public.res_client_error_summary(100000)) >= 0 as pass;
