\set ON_ERROR_STOP on
-- RLS is the real boundary here too: the table itself must only ever be
-- readable by its own requester, and the public /verify-kin flow must work
-- through the RPCs alone, as the anon role, with no table privileges at all.

grant usage on schema public, auth to authenticated, anon;
grant select on public.res_kin_verification_links to authenticated;
grant select, insert, update on auth._current to authenticated;
alter table public.res_kin_verification_links force row level security;

insert into public.profiles (id) values
  ('00000000-0000-0000-0000-000000000601'),
  ('00000000-0000-0000-0000-000000000602')
on conflict (id) do nothing;

set role authenticated;
update auth._current set uid = '00000000-0000-0000-0000-000000000601';

select (public.res_create_kin_verification_link('Sipho Dlamini', 'Brother')).token as token \gset

select 'requester_sees_own_link' as check,
  (select count(*) from public.res_kin_verification_links where requester_id = '00000000-0000-0000-0000-000000000601') = 1 as pass;

update auth._current set uid = '00000000-0000-0000-0000-000000000602';
select 'stranger_sees_no_links_via_table' as check,
  (select count(*) from public.res_kin_verification_links) = 0 as pass;

reset role;

-- The public /verify-kin page runs as anon, with no table grant at all —
-- everything must go through the RPCs.
set role anon;

select 'anon_can_read_claim_by_token' as check,
  (select claimed_relationship from public.res_get_kin_verification_link(:'token'::uuid)) = 'Brother' as pass;

select 'status_starts_pending' as check,
  (select status from public.res_get_kin_verification_link(:'token'::uuid)) = 'pending' as pass;

select 'unknown_token_returns_nothing' as check,
  (select count(*) from public.res_get_kin_verification_link(uuid_generate_v4())) = 0 as pass;

select public.res_respond_kin_verification_link(:'token'::uuid, true, 'Yes, that is my brother.');

select 'response_recorded' as check,
  (select status from public.res_get_kin_verification_link(:'token'::uuid)) = 'confirmed' as pass;

reset role;

-- psql variable interpolation doesn't reach inside a dollar-quoted DO body,
-- so this last check runs as authenticated (already granted table select)
-- and looks the token up by its known claim instead of by :'token'.
set role authenticated;
update auth._current set uid = '00000000-0000-0000-0000-000000000601';
do $$
declare
  v_token uuid;
begin
  select token into v_token from public.res_kin_verification_links where claimed_name = 'Sipho Dlamini';
  begin
    perform public.res_respond_kin_verification_link(v_token, false, null);
    raise exception 'expected a second response on the same token to be rejected';
  exception when others then
    if sqlerrm not like '%already been answered%' then raise; end if;
  end;
end $$;
select 'cannot_answer_twice' as check, true as pass;

reset role;
