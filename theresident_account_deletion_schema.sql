-- ═══════════════════════════════════════════════════════════════════════════
-- The Resident — account deletion (POPIA right to erasure).
-- Safe to re-run: every statement is idempotent. Paste into Supabase →
-- SQL Editor → Run.
--
-- WHY THIS EXISTS
-- There was no way to delete an account. POPIA gives a data subject a right
-- to erasure, and an app collecting employment status, household
-- composition, a verification photo and location has no business being
-- one-way.
--
-- WHY IT IS AN RPC AND NOT CLIENT CODE
-- Deleting the auth.users row requires privileges the browser's anon key
-- does not have and must never have. So the work happens inside one
-- SECURITY DEFINER function that acts ONLY on auth.uid() — the caller can
-- delete themselves and nobody else. It takes no user-id argument by
-- design: a function like res_delete_account(p_user) would be an IDOR
-- waiting to happen the moment someone passes a different id.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.res_delete_my_account()
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  -- Resident-owned content authored by this user. Ordered so that child
  -- rows go before the parents they reference; anything with an ON DELETE
  -- CASCADE from res_profiles/profiles is left to the cascade rather than
  -- deleted twice.
  delete from res_gossip_comments  where author_id = v_uid;
  delete from res_gossip_posts     where author_id = v_uid;
  delete from res_market_items     where user_id   = v_uid;
  delete from res_saved_pins       where user_id   = v_uid;
  delete from res_saved_searches   where user_id   = v_uid;
  delete from res_notification_prefs where user_id = v_uid;
  delete from res_trust_connections where requester_id = v_uid or connection_id = v_uid;
  delete from res_room_requests    where tenant_id = v_uid;
  delete from res_listings         where landlord_id = v_uid;

  -- The Resident profile itself. public.profiles is Gruvs-owned
  -- (CONTRACT.md §2) and is deliberately NOT touched here — deleting the
  -- shared account row from this side would silently delete the person's
  -- Gruvs account too, which is not what "delete my Resident account" means.
  delete from res_profiles where id = v_uid;

  -- Security records are deliberately NOT deleted. Letting someone erase
  -- the record of a blocked attack by deleting the account that made it
  -- would defeat the audit log's purpose. They expire on their own after
  -- 180 days (res_prune_security_logs), and the privacy notice states this
  -- plainly rather than implying erasure is total.
  insert into res_security_logs (user_id, event_type, action, details)
  values (null, 'auth_account_deleted', 'Account deleted by its owner',
          'res_delete_my_account() ran for a user who has since been removed.');

  return json_build_object('deleted', true);
end;
$$;

-- Callable only by a signed-in user; there is nothing here for anon.
revoke execute on function public.res_delete_my_account() from public, anon;
grant execute on function public.res_delete_my_account() to authenticated;


-- ── Audit log: allow the new event type ─────────────────────────────────────
-- Recreated by name because `create table if not exists` can never widen a
-- CHECK on an existing table. Mirrors the same block in
-- theresident_security_log_schema.sql — keep the two lists in step.
alter table public.res_security_logs drop constraint if exists res_security_logs_event_type_check;
alter table public.res_security_logs
  add constraint res_security_logs_event_type_check
  check (event_type in (
    'xss_blocked', 'rate_limit_triggered', 'idor_prevented',
    'auth_success', 'auth_failed', 'brute_force_blocked',
    'upload_malware_blocked', 'sqli_blocked',
    'role_switched', 'org_broadcast_sent',
    'auth_password_reset_requested', 'auth_password_changed',
    'auth_account_deleted'
  ));


-- ── Verification ────────────────────────────────────────────────────────────
select 'function' as check,
       case when count(*) > 0 then 'res_delete_my_account present' else 'MISSING' end as result
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'res_delete_my_account'
union all
select 'security context',
       case when p.prosecdef then 'SECURITY DEFINER (correct)' else 'INVOKER — will fail' end
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'res_delete_my_account';


-- ⚠️  NOTE ON auth.users
-- This function removes the Resident-side data. It does NOT delete the
-- auth.users row, because that table belongs to Supabase's auth schema and
-- the shared account is also The Gruvs' login (CONTRACT.md §1) — removing it
-- from here would delete someone's Gruvs account as a side effect of leaving
-- The Resident.
--
-- If you want full auth-account deletion as well, that has to be a
-- deliberate cross-app decision, and needs either the service role from a
-- server route or Supabase's own account-deletion flow. Until then the
-- privacy notice's wording is accurate: the Resident profile and content go,
-- the shared login does not.
