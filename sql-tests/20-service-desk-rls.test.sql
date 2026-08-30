\set ON_ERROR_STOP on
-- RLS is the real security boundary for the Service Desk. Superuser bypasses
-- it, so these checks run as a non-superuser role with FORCE enabled, the way
-- Supabase's `authenticated` role actually sees the tables.

grant usage on schema public, auth to authenticated;
grant select on public.res_service_reports, public.res_service_report_updates,
                 public.res_service_report_confirmations to authenticated;
grant select on public.res_profiles, public.profiles, public.res_infra_providers,
                 public.res_infra_partner_admins to authenticated;
grant select, insert, update on auth._current to authenticated;
alter table public.res_service_reports force row level security;
alter table public.res_service_report_updates force row level security;
alter table public.res_service_report_confirmations force row level security;

-- A resident in a completely different city.
insert into profiles (id, city) values ('44444444-4444-4444-8444-444444444444', 'Cape Town');
insert into res_profiles (id, role, suburb, city)
  values ('44444444-4444-4444-8444-444444444444', 'tenant', 'Khayelitsha', 'Cape Town');

set role authenticated;

-- The reporter sees their own report.
update auth._current set uid = '11111111-1111-4111-8111-111111111111';
select 'reporter_sees_own' as check, count(*) >= 1 as pass from res_service_reports;

-- A neighbour in the same suburb sees it — this is what makes corroboration work.
update auth._current set uid = '22222222-2222-4222-8222-222222222222';
select 'neighbour_sees_it' as check, count(*) >= 1 as pass from res_service_reports;

-- The provider's staff see it even though they live nowhere near.
update auth._current set uid = '33333333-3333-4333-8333-333333333333';
select 'provider_admin_sees_it' as check, count(*) >= 1 as pass from res_service_reports;

-- Someone in another city sees NOTHING. This is the whole point.
update auth._current set uid = '44444444-4444-4444-8444-444444444444';
select 'outsider_sees_nothing' as check, count(*) = 0 as pass from res_service_reports;
select 'outsider_sees_no_timeline' as check, count(*) = 0 as pass from res_service_report_updates;
select 'outsider_sees_no_confirmations' as check, count(*) = 0 as pass from res_service_report_confirmations;

-- And cannot write directly around the RPCs (no insert/update policy exists).
do $$ begin
  begin
    insert into res_service_reports (reporter_id, category, title, target_hours)
    values (auth.uid(), 'water', 'forged', 24);
    raise exception 'TEST FAILED: direct insert bypassed the RPCs';
  exception when insufficient_privilege or others then
    if sqlerrm like 'TEST FAILED%' then raise; end if;
  end;
end $$;
select 'direct_insert_blocked' as check, true as pass;

reset role;
