\set ON_ERROR_STOP on
-- Privilege escalation on res_org_units.
--
-- The RLS policies on this table allow a sender to update their own row and
-- to insert one they own. Neither says anything about WHICH columns, because
-- RLS has no column granularity. `verified` clears the urgent/critical gate
-- and `jurisdiction_id` decides which areas ST_Covers will accept — so if
-- either is writable, the whole verification workflow is decoration.
--
-- These run as the real `authenticated` role and attempt the actual attack,
-- rather than reading grants and calling that proof.

grant usage on schema public, auth to authenticated;
grant select, insert, update on auth._current to authenticated;

insert into public.profiles (id) values ('00000000-0000-0000-0000-0000000009aa')
on conflict (id) do nothing;

update auth._current set uid = '00000000-0000-0000-0000-0000000009aa';
set role authenticated;

-- ── The attack, attempted for real ─────────────────────────────────────────
-- Self-verify at creation time, bound to the widest area that exists.
do $$ begin
  begin
    insert into res_org_units (id, name, tier, owner_user_id, verified, jurisdiction_id)
    values ('00000000-0000-0000-0000-0000000009ab', 'Office of the President', 'municipality',
            '00000000-0000-0000-0000-0000000009aa', true,
            (select id from res_jurisdictions order by level desc limit 1));
    raise exception 'TEST FAILED: a user created a self-verified, area-bound office';
  exception when insufficient_privilege then
    null;
  when others then
    if sqlerrm like 'TEST FAILED%' then raise; end if;
  end;
end $$;
select 'a_user_cannot_create_a_self_verified_office' as check,
  not exists (select 1 from res_org_units where name = 'Office of the President') as pass;

-- Create one legitimately, then try to promote it.
insert into res_org_units (id, name, tier, owner_user_id)
values ('00000000-0000-0000-0000-0000000009ac', 'Honest Corner Shop', 'business',
        '00000000-0000-0000-0000-0000000009aa')
on conflict (id) do nothing;

select 'a_user_can_still_create_an_ordinary_unit' as check,
  exists (select 1 from res_org_units where id = '00000000-0000-0000-0000-0000000009ac') as pass;

do $$ begin
  begin
    update res_org_units set verified = true
     where id = '00000000-0000-0000-0000-0000000009ac';
    raise exception 'TEST FAILED: a user verified their own office';
  exception when insufficient_privilege then
    null;
  when others then
    if sqlerrm like 'TEST FAILED%' then raise; end if;
  end;
end $$;
select 'a_user_cannot_verify_their_own_office' as check,
  (select verified from res_org_units where id = '00000000-0000-0000-0000-0000000009ac') = false as pass;

do $$ begin
  begin
    update res_org_units
       set jurisdiction_id = (select id from res_jurisdictions limit 1)
     where id = '00000000-0000-0000-0000-0000000009ac';
    raise exception 'TEST FAILED: a user bound their own office to an area';
  exception when insufficient_privilege then
    null;
  when others then
    if sqlerrm like 'TEST FAILED%' then raise; end if;
  end;
end $$;
select 'a_user_cannot_bind_their_own_office_to_an_area' as check,
  (select jurisdiction_id from res_org_units where id = '00000000-0000-0000-0000-0000000009ac') is null as pass;

-- ── What an office may still legitimately edit about itself ────────────────
-- The lockdown must not turn into "an office can never update anything",
-- which would break ordinary directory upkeep.
update res_org_units
   set name = 'Honest Corner Shop & Deli',
       contact_email = 'hello@example.co.za',
       description = 'Open 7am to 7pm',
       suburb = 'Testville'
 where id = '00000000-0000-0000-0000-0000000009ac';

select 'an_office_can_still_edit_its_own_details' as check,
  (select name from res_org_units where id = '00000000-0000-0000-0000-0000000009ac') = 'Honest Corner Shop & Deli'
  and (select contact_email from res_org_units where id = '00000000-0000-0000-0000-0000000009ac') = 'hello@example.co.za' as pass;

-- Handing an office to someone else is a transfer, not an edit.
do $$ begin
  begin
    update res_org_units set owner_user_id = '00000000-0000-0000-0000-000000000953'
     where id = '00000000-0000-0000-0000-0000000009ac';
    raise exception 'TEST FAILED: an office was silently transferred by an update';
  exception when insufficient_privilege then
    null;
  when others then
    if sqlerrm like 'TEST FAILED%' then raise; end if;
  end;
end $$;
select 'an_office_cannot_be_transferred_by_a_plain_update' as check,
  (select owner_user_id from res_org_units where id = '00000000-0000-0000-0000-0000000009ac')
    = '00000000-0000-0000-0000-0000000009aa' as pass;

reset role;

-- ── The approved path still works ──────────────────────────────────────────
-- The lockdown must not break res_approve_unit_verification, which runs as the
-- function owner and so is unaffected by column grants.
insert into public.res_platform_admins (user_id, note)
values ('00000000-0000-0000-0000-0000000009aa', 'escalation test admin')
on conflict (user_id) do nothing;
update auth._current set uid = '00000000-0000-0000-0000-0000000009aa';

select public.res_approve_unit_verification(
  '00000000-0000-0000-0000-0000000009ac',
  (select id from res_jurisdictions where external_ref = 'WA-1'),
  'approved in escalation test');

select 'an_admin_going_through_the_function_can_still_verify' as check,
  (select verified from res_org_units where id = '00000000-0000-0000-0000-0000000009ac')
  and (select jurisdiction_id from res_org_units where id = '00000000-0000-0000-0000-0000000009ac') is not null as pass;

delete from public.res_platform_admins where user_id = '00000000-0000-0000-0000-0000000009aa';

-- ── Column grants, pinned ──────────────────────────────────────────────────
select 'the_two_authority_columns_are_not_writable_at_the_grant_level' as check,
  not has_column_privilege('authenticated','public.res_org_units','verified','INSERT')
  and not has_column_privilege('authenticated','public.res_org_units','verified','UPDATE')
  and not has_column_privilege('authenticated','public.res_org_units','jurisdiction_id','INSERT')
  and not has_column_privilege('authenticated','public.res_org_units','jurisdiction_id','UPDATE') as pass;

select 'ordinary_columns_are_still_writable' as check,
  has_column_privilege('authenticated','public.res_org_units','name','UPDATE')
  and has_column_privilege('authenticated','public.res_org_units','contact_email','UPDATE')
  and has_column_privilege('authenticated','public.res_org_units','name','INSERT') as pass;
