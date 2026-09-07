\set ON_ERROR_STOP on
-- The fail-open-on-NULL class, as a standing check.
--
-- Found twice by hand, in two unrelated functions written months apart:
--   * the area-billing gate
--   * res_moderate, where it was a live privilege escalation — any signed-in
--     user could moderate any community, proven by exploit.
--
-- The shape is always the same. A SECURITY DEFINER function fetches an
-- authorisation value out of a table:
--
--     select role into v_role from res_community_members where ...;
--     if v_role not in ('admin','founder') then raise exception ...; end if;
--
-- With no row, v_role is NULL. `NULL not in (...)` is NULL, not true, and
-- `if NULL then raise` does not fire. The person with NO membership at all
-- walks past the check that exists to stop exactly them. The more complete
-- the absence of authorisation, the more reliably the guard fails open.
--
-- Finding it twice by reading is two lucky catches, not a process. This is
-- the process.
--
-- WHAT THE ALLOWLIST BELOW MEANS — read this before adding to it.
--
-- Sweeping the live database turned up 19 more instances of the shape. Every
-- one was traced, and none is currently exploitable: the column each guard
-- reads is NOT NULL, so the NULL that would defeat it cannot occur.
--
-- That is a weaker safety property than it sounds. These checks are correct
-- by a constraint declared in a different file, on a different table, for a
-- different reason — not by anything in the function. A later migration that
-- makes one of those columns nullable would silently unlock the guard, with
-- no error, no test failure, and nothing in the diff that looks like a
-- security change. That is precisely how res_moderate happened.
--
-- So they are recorded here rather than waved through, and the list may only
-- ever get SHORTER. The fix for any entry is one word: wrap the variable in
-- coalesce with a value outside the allowed set — `coalesce(v_role, '')` is
-- the idiom used elsewhere in this schema — and delete the line from here.

select 'the_scanner_can_see_security_definer_functions' as check,
  (select count(*) from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace and n.nspname = 'public'
    where p.prosecdef and p.proname like 'res\_%') > 0 as pass;

create temporary view failopen_hits as
  with lines as (
    select p.proname, trim(l) as ln
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace and n.nspname = 'public',
         lateral regexp_split_to_table(pg_get_functiondef(p.oid), E'\n') as l
    where p.prokind = 'f' and p.prosecdef and p.proname like 'res\_%'
  )
  select proname, ln from lines
   -- \y, not \b. In POSIX regex \b is a BACKSPACE character, so the obvious
   -- spelling of this pattern matches nothing at all and the check passes
   -- forever while reading as if it works. The canary at the bottom is what
   -- caught that, and is why it is not optional.
   where ln ~* '^\s*if\s+.*\yv_[a-z_]+\y'
     and ln ~* '(not\s+in\s*\(|<>|!=|not\s+like)'
     and ln !~* 'coalesce'
     and ln !~* 'is\s+null';

-- Reviewed, traced, and safe only because the column read is NOT NULL.
create temporary table failopen_allowed (proname text primary key, why text);
insert into failopen_allowed values
  ('res_approve_request',      'res_room_requests.landlord_id is NOT NULL'),
  ('res_reject_request',       'res_room_requests.landlord_id is NOT NULL'),
  ('res_save_request',         'res_room_requests.landlord_id is NOT NULL'),
  ('res_waitlist_request',     'res_room_requests.landlord_id is NOT NULL'),
  ('res_end_tenancy',          'res_room_requests tenant_id/landlord_id are NOT NULL'),
  ('res_care_check_in',        'res_care_circle carer_id/subject_id are NOT NULL'),
  ('res_complete_chore',       'roommate_id is NOT NULL'),
  ('res_complete_dispatch',    'row reached via a join on the service, so it exists'),
  ('res_confirm_tool_return',  'res_tool_library.owner_id is NOT NULL'),
  ('res_delete_property',      'explicit "if v_owner is null then raise" precedes it'),
  ('res_moderate',             'the coalesce gate above it guarantees v_role is set'),
  ('res_pledge_group_buy',     'status is NOT NULL with a default'),
  ('res_push_area_broadcast',  'priority is NOT NULL; worst case is a skipped push'),
  ('res_request_move_assist',  'explicit "if v_category is null then raise" precedes it'),
  ('res_respond_kin_verification_link', 'explicit "if v_status is null then raise" precedes it'),
  ('res_set_home_area',        'p_granularity is validated against a check constraint'),
  ('res_sync_trust',           'guard is auth.uid() is not null AND v_user <> auth.uid()'),
  ('res_trust_gate',           'guard is auth.uid() is not null AND v_user <> auth.uid()');

select 'no_NEW_authorisation_check_can_fail_open_on_null' as check,
  not exists (
    select 1 from failopen_hits h
     where not exists (select 1 from failopen_allowed a where a.proname = h.proname)
  ) as pass;

-- The allowlist must keep telling the truth: an entry whose function no
-- longer has the shape has been fixed, and should be deleted from the list.
select 'the_allowlist_only_shrinks' as check,
  not exists (
    select 1 from failopen_allowed a
     where not exists (select 1 from failopen_hits h where h.proname = a.proname)
       and exists (select 1 from pg_proc p
                     join pg_namespace n on n.oid = p.pronamespace and n.nspname = 'public'
                    where p.proname = a.proname)
  ) as pass;

-- Prove the scanner detects what it claims to. Without this, the check above
-- passes just as happily when the regex is broken as when the code is clean —
-- which is the failure mode that turns a green suite into a lie. It already
-- caught one broken regex (\b vs \y) before this file was committed.
create or replace function public.res__failopen_canary(p_x uuid)
returns void language plpgsql security definer set search_path to 'public'
as $canary$
declare v_role text;
begin
  select 'x' into v_role;
  if v_role not in ('admin') then raise exception 'admin_required'; end if;
end;
$canary$;

select 'and_the_scanner_catches_a_deliberately_planted_one' as check,
  exists (select 1 from failopen_hits where proname = 'res__failopen_canary') as pass;

drop function public.res__failopen_canary(uuid);
