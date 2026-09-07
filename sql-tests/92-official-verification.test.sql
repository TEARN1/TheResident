\set ON_ERROR_STOP on
-- Verifying an office is the most consequential act in this app: it is what
-- lets someone message thousands of people who never opted in. So the tests
-- here are mostly about who CANNOT do it.

grant usage on schema public, auth to authenticated;
grant select, insert, update on auth._current to authenticated;

-- 901 owns the Ward A councillor unit (9d1) from an earlier file. 953 is an
-- unrelated resident. 9f1 is unverified, 9f2 verified but unbound.
insert into public.profiles (id) values
  ('00000000-0000-0000-0000-000000000991'),
  ('00000000-0000-0000-0000-000000000992')
on conflict (id) do nothing;

-- A fresh, unverified unit to apply with, so the fixtures above stay untouched.
insert into public.res_org_units (id, name, tier, owner_user_id, verified, jurisdiction_id)
values ('00000000-0000-0000-0000-0000000009e9', 'Applicant Library', 'other',
        '00000000-0000-0000-0000-000000000991', false, null)
on conflict (id) do nothing;

-- ── Applying ───────────────────────────────────────────────────────────────
update auth._current set uid = '00000000-0000-0000-0000-000000000991';
delete from res_rate_limits where user_id = '00000000-0000-0000-0000-000000000991';

select 'an_official_can_apply_for_verification' as check,
  public.res_request_unit_verification(
    '00000000-0000-0000-0000-0000000009e9', 'Branch Librarian',
    'https://example.gov.za/proof', 'lib@example.gov.za', 'Please verify us',
    (select id from res_jurisdictions where external_ref = 'WA-1')) is not null as pass;

select 'applying_is_recorded_in_the_audit_trail' as check,
  exists (select 1 from res_org_unit_audit
          where unit_id = '00000000-0000-0000-0000-0000000009e9'
            and action = 'verification_requested') as pass;

-- Re-applying updates the same application rather than queueing a second one
-- for a reviewer to work through twice.
select public.res_request_unit_verification(
  '00000000-0000-0000-0000-0000000009e9', 'Branch Librarian',
  'https://example.gov.za/better-proof', 'lib@example.gov.za', 'Updated evidence', null);
select 'reapplying_updates_the_same_application' as check,
  (select count(*) from res_unit_verification_requests
   where unit_id = '00000000-0000-0000-0000-0000000009e9' and status = 'pending') = 1 as pass;

-- A stranger cannot apply on someone else's behalf.
update auth._current set uid = '00000000-0000-0000-0000-000000000953';
do $$ begin
  begin
    perform public.res_request_unit_verification('00000000-0000-0000-0000-0000000009e9');
    raise exception 'TEST FAILED: a stranger applied for someone else''s unit';
  exception when others then
    if sqlerrm like 'TEST FAILED%' then raise; end if;
  end;
end $$;
select 'a_stranger_cannot_apply_for_another_office' as check,
  (select count(*) from res_unit_verification_requests
   where unit_id = '00000000-0000-0000-0000-0000000009e9') = 1 as pass;

-- ── THE ONE THAT MATTERS: nobody verifies themselves ───────────────────────
update auth._current set uid = '00000000-0000-0000-0000-000000000991';
do $$ begin
  begin
    perform public.res_approve_unit_verification(
      '00000000-0000-0000-0000-0000000009e9',
      (select id from res_jurisdictions where external_ref = 'WA-1'), 'self approved');
    raise exception 'TEST FAILED: an applicant approved their own office';
  exception when others then
    if sqlerrm like 'TEST FAILED%' then raise; end if;
  end;
end $$;
select 'an_applicant_cannot_approve_their_own_office' as check,
  (select verified from res_org_units where id = '00000000-0000-0000-0000-0000000009e9') = false as pass;

select 'an_ordinary_user_is_not_a_platform_admin' as check,
  public.res_is_platform_admin() = false as pass;

select 'a_non_admin_sees_no_pending_queue' as check,
  (select count(*) from public.res_pending_verification_requests()) = 0 as pass;

select 'a_non_admin_cannot_search_areas_to_bind' as check,
  (select count(*) from public.res_search_jurisdictions('Ward')) = 0 as pass;

-- ── With an admin ──────────────────────────────────────────────────────────
insert into public.res_platform_admins (user_id, note)
values ('00000000-0000-0000-0000-000000000992', 'test admin')
on conflict (user_id) do nothing;

update auth._current set uid = '00000000-0000-0000-0000-000000000992';

select 'an_admin_sees_the_pending_queue' as check,
  (select count(*) from public.res_pending_verification_requests()
   where unit_id = '00000000-0000-0000-0000-0000000009e9') = 1 as pass;

select 'an_admin_can_search_areas_by_name' as check,
  (select count(*) from public.res_search_jurisdictions('Ward A')) >= 1 as pass;

-- A rejection nobody can understand is a rejection they will simply resubmit.
do $$ begin
  begin
    perform public.res_reject_unit_verification('00000000-0000-0000-0000-0000000009e9', '  ');
    raise exception 'TEST FAILED: rejected with no reason';
  exception when others then
    if sqlerrm like 'TEST FAILED%' then raise; end if;
  end;
end $$;
select 'a_rejection_must_state_a_reason' as check,
  (select status from res_unit_verification_requests
   where unit_id = '00000000-0000-0000-0000-0000000009e9') = 'pending' as pass;

-- Approval must do BOTH things. Either alone leaves an office that looks
-- approved to its owner and silently reaches nobody.
select public.res_approve_unit_verification(
  '00000000-0000-0000-0000-0000000009e9',
  (select id from res_jurisdictions where external_ref = 'WA-1'), 'ID and letterhead checked');

select 'approval_verifies_and_binds_in_one_act' as check,
  (select verified from res_org_units where id = '00000000-0000-0000-0000-0000000009e9')
  and (select jurisdiction_id from res_org_units where id = '00000000-0000-0000-0000-0000000009e9')
      = (select id from res_jurisdictions where external_ref = 'WA-1') as pass;

-- Checked as the OFFICIAL, not the admin: res_targetable_jurisdictions is
-- sender-scoped, so an admin sees nothing for a unit they do not belong to.
-- That is correct, and worth asserting in both directions.
select 'an_admin_does_not_inherit_the_offices_targeting_rights' as check,
  (select count(*) from public.res_targetable_jurisdictions('00000000-0000-0000-0000-0000000009e9')) = 0 as pass;

update auth._current set uid = '00000000-0000-0000-0000-000000000991';
select 'the_approved_office_can_now_actually_target_its_area' as check,
  (select count(*) from public.res_targetable_jurisdictions('00000000-0000-0000-0000-0000000009e9')) >= 1 as pass;
update auth._current set uid = '00000000-0000-0000-0000-000000000992';

select 'approval_starts_the_free_period' as check,
  exists (select 1 from res_org_unit_billing
          where unit_id = '00000000-0000-0000-0000-0000000009e9' and status = 'probation') as pass;

select 'the_decision_is_on_the_record_with_who_made_it' as check,
  exists (select 1 from res_org_unit_audit
          where unit_id = '00000000-0000-0000-0000-0000000009e9' and action = 'verified'
            and actor_id = '00000000-0000-0000-0000-000000000992') as pass;

select 'an_unknown_area_cannot_be_bound' as check,
  (select count(*) from (
     select 1 from res_org_units where id = '00000000-0000-0000-0000-0000000009e9'
   ) x) = 1 as pass;
do $$ begin
  begin
    perform public.res_approve_unit_verification(
      '00000000-0000-0000-0000-0000000009e9', '00000000-0000-0000-0000-00000000dead', 'x');
    raise exception 'TEST FAILED: bound a jurisdiction that does not exist';
  exception when others then
    if sqlerrm like 'TEST FAILED%' then raise; end if;
  end;
end $$;

-- ── Revocation ─────────────────────────────────────────────────────────────
-- An official who leaves the post, or misuses the channel, must be stoppable
-- without deleting the unit and losing its public broadcast record.
select public.res_revoke_unit_verification(
  '00000000-0000-0000-0000-0000000009e9', 'Left the post');

select 'verification_can_be_revoked' as check,
  (select verified from res_org_units where id = '00000000-0000-0000-0000-0000000009e9') = false as pass;

select 'revocation_keeps_the_area_binding_and_the_record' as check,
  (select jurisdiction_id from res_org_units where id = '00000000-0000-0000-0000-0000000009e9') is not null
  and exists (select 1 from res_org_unit_audit
              where unit_id = '00000000-0000-0000-0000-0000000009e9' and action = 'unverified') as pass;

do $$ begin
  begin
    perform public.res_revoke_unit_verification('00000000-0000-0000-0000-0000000009e9', '');
    raise exception 'TEST FAILED: revoked with no reason';
  exception when others then
    if sqlerrm like 'TEST FAILED%' then raise; end if;
  end;
end $$;
select 'a_revocation_must_state_a_reason' as check, true as pass;

-- ── Grant boundary ─────────────────────────────────────────────────────────
select 'admins_are_appointed_only_through_the_database' as check,
  not has_table_privilege('authenticated', 'public.res_platform_admins', 'insert')
  and not has_table_privilege('authenticated', 'public.res_platform_admins', 'update')
  and not has_table_privilege('authenticated', 'public.res_platform_admins', 'delete') as pass;

select 'the_audit_trail_cannot_be_edited_or_erased' as check,
  not has_table_privilege('authenticated', 'public.res_org_unit_audit', 'insert')
  and not has_table_privilege('authenticated', 'public.res_org_unit_audit', 'update')
  and not has_table_privilege('authenticated', 'public.res_org_unit_audit', 'delete') as pass;

select 'signed_out_visitors_reach_none_of_this' as check,
  not has_function_privilege('anon', 'public.res_request_unit_verification(uuid, text, text, text, text, uuid)', 'execute')
  and not has_function_privilege('anon', 'public.res_approve_unit_verification(uuid, uuid, text)', 'execute')
  and not has_function_privilege('anon', 'public.res_is_platform_admin()', 'execute')
  and not has_table_privilege('anon', 'public.res_platform_admins', 'select') as pass;

-- Admins use the app, not the SQL editor — that was the whole problem.
select 'admins_can_call_the_decision_functions_from_the_app' as check,
  has_function_privilege('authenticated', 'public.res_approve_unit_verification(uuid, uuid, text)', 'execute')
  and has_function_privilege('authenticated', 'public.res_reject_unit_verification(uuid, text)', 'execute')
  and has_function_privilege('authenticated', 'public.res_revoke_unit_verification(uuid, text)', 'execute') as pass;

-- ── Client error admin view (theresident_client_error_admin_view.sql) ──────
-- res_client_errors itself stays exactly as locked down as before this file
-- — no policy, no grant, service_role only. This is a narrow, admin-gated
-- door back in for the one person who should be able to see crash reports
-- from inside the app instead of the Supabase dashboard.
-- A label unique to this file, since 91-client-errors.test.sql already left
-- a 'render' row behind in this shared table — an exact-count assertion
-- against a shared label would be testing cross-file leakage, not this RPC.
insert into res_client_errors (user_id, label, message, created_at) values
  (null, 'admin_view_test_bug', 'TypeError: cannot read suburb', now() - interval '1 hour'),
  (null, 'admin_view_test_bug', 'TypeError: cannot read suburb', now() - interval '2 hours'),
  ('00000000-0000-0000-0000-000000000991', 'admin_view_test_timeout', 'fetch failed', now() - interval '10 hours');

update auth._current set uid = '00000000-0000-0000-0000-000000000991';
do $$ begin
  begin
    perform public.res_client_error_summary_for_admin(24);
    raise exception 'TEST FAILED: a non-admin read the crash-report summary';
  exception when others then
    if sqlerrm like 'TEST FAILED%' then raise; end if;
    if sqlerrm not like 'not_a_platform_admin%' then raise; end if;
  end;
end $$;
select 'a_non_admin_cannot_read_client_error_summary' as check, true as pass;

update auth._current set uid = '00000000-0000-0000-0000-000000000992';
select 'an_admin_sees_the_bug_grouped_and_counted' as check,
  (select occurrences from public.res_client_error_summary_for_admin(24) where label = 'admin_view_test_bug') = 2 as pass;

select 'an_admin_sees_how_many_distinct_users_it_hit' as check,
  (select affected_users from public.res_client_error_summary_for_admin(24) where label = 'admin_view_test_timeout') = 1 as pass;

select 'the_underlying_table_stays_locked_regardless' as check,
  not has_table_privilege('authenticated', 'public.res_client_errors', 'select')
  and not has_function_privilege('anon', 'public.res_client_error_summary_for_admin(integer)', 'execute') as pass;

reset role;
