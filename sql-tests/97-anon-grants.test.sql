\set ON_ERROR_STOP on
-- The anon surface, pinned.
--
-- Supabase grants EXECUTE on every newly created function to `anon` and
-- `authenticated` by default, so a schema file that grants without revoking
-- first leaves signed-out access open. That is how
-- res_resolve_broadcast_audience — which returns (follower_user_id,
-- email_opt_in) — ended up callable by anyone on the internet holding the
-- publishable key. These assertions make the anon surface a deliberate,
-- short list rather than whatever the defaults last produced.

-- Checks go through to_regprocedure so a function this harness does not build
-- (the suite applies a subset of the schema) does not abort the file. Absence
-- reads as an explicit pass — "not installed here, so nothing to leak" —
-- rather than a NULL, which would print as neither a pass nor a fail and
-- quietly disappear from the results. On the live project every signature
-- below resolves.
--
-- ── The leak that was found ────────────────────────────────────────────────
-- Returns a list of real people and who opted into email. Signed-out callers
-- must never reach it.
select 'anon_cannot_enumerate_a_units_followers' as check,
  (to_regprocedure('public.res_resolve_broadcast_audience(uuid)') is null or not has_function_privilege('anon', to_regprocedure('public.res_resolve_broadcast_audience(uuid)'), 'execute')) as pass;

select 'signed_in_users_can_still_resolve_an_audience' as check,
  coalesce(has_function_privilege('authenticated', to_regprocedure('public.res_resolve_broadcast_audience(uuid)'), 'execute'), false) as pass;

-- ── Helpers that answer questions about other people's data ────────────────
select 'anon_cannot_probe_provider_admin_status' as check,
  (to_regprocedure('public.res_is_provider_admin(uuid)') is null or not has_function_privilege('anon', to_regprocedure('public.res_is_provider_admin(uuid)'), 'execute')) as pass;

select 'anon_cannot_probe_who_shares_a_locality' as check,
  (to_regprocedure('public.res_shares_locality(text, text)') is null or not has_function_privilege('anon', to_regprocedure('public.res_shares_locality(text, text)'), 'execute')) as pass;

select 'anon_cannot_probe_room_ownership_or_occupancy' as check,
  (to_regprocedure('public.res_owns_room(uuid)') is null or not has_function_privilege('anon', to_regprocedure('public.res_owns_room(uuid)'), 'execute'))
  and (to_regprocedure('public.res_is_current_housemate(uuid)') is null or not has_function_privilege('anon', to_regprocedure('public.res_is_current_housemate(uuid)'), 'execute')) as pass;

select 'anon_cannot_probe_org_unit_authority' as check,
  (to_regprocedure('public.res_user_is_sender_of_or_above(uuid, uuid)') is null or not has_function_privilege('anon', to_regprocedure('public.res_user_is_sender_of_or_above(uuid, uuid)'), 'execute'))
  and (to_regprocedure('public.res_is_unit_ancestor_or_self(uuid, uuid)') is null or not has_function_privilege('anon', to_regprocedure('public.res_is_unit_ancestor_or_self(uuid, uuid)'), 'execute')) as pass;

-- ── Write paths ────────────────────────────────────────────────────────────
select 'anon_cannot_file_an_outage_report' as check,
  (to_regprocedure('public.res_report_status(text, text, text, text, uuid, double precision, double precision, timestamptz)') is null or not has_function_privilege('anon', to_regprocedure('public.res_report_status(text, text, text, text, uuid, double precision, double precision, timestamptz)'), 'execute')) as pass;

-- ── Trigger bodies are not an API ──────────────────────────────────────────
-- PostgreSQL checks EXECUTE at CREATE TRIGGER, not when a trigger fires, so
-- revoking these cannot stop the triggers that use them.
select 'trigger_bodies_are_not_callable_as_rpcs' as check,
  (to_regprocedure('public.res_fanout_broadcast()') is null or not has_function_privilege('anon', to_regprocedure('public.res_fanout_broadcast()'), 'execute'))
  and (to_regprocedure('public.res_fanout_broadcast()') is null or not has_function_privilege('authenticated', to_regprocedure('public.res_fanout_broadcast()'), 'execute'))
  and (to_regprocedure('public.res_check_broadcast_priority()') is null or not has_function_privilege('authenticated', to_regprocedure('public.res_check_broadcast_priority()'), 'execute'))
  and (to_regprocedure('public.res_org_unit_auto_sender()') is null or not has_function_privilege('authenticated', to_regprocedure('public.res_org_unit_auto_sender()'), 'execute')) as pass;

select 'the_fanout_trigger_still_exists_and_fires' as check,
  exists (select 1 from pg_trigger where tgname = 'res_org_broadcasts_fanout' and not tgisinternal) as pass;

-- ── Deliberately still open to anon ────────────────────────────────────────
-- /verify-kin/[token] is a public, no-login page: someone without a Resident
-- account answers one question about a claimed relationship, scoped by an
-- unguessable token. Revoking anon here would break that feature, so it is
-- asserted as intentional rather than left to be "cleaned up" later.
select 'the_public_kin_verification_link_still_works_signed_out' as check,
  coalesce(has_function_privilege('anon', to_regprocedure('public.res_get_kin_verification_link(uuid)'), 'execute'), false)
  and coalesce(has_function_privilege('anon', to_regprocedure('public.res_respond_kin_verification_link(uuid, boolean, text)'), 'execute'), false) as pass;
