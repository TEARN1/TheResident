-- theresident_anon_grant_lockdown.sql
--
-- Closes a live hole: Resident-owned functions that were reachable by the
-- `anon` role — signed-out callers — because Supabase's default privileges
-- grant EXECUTE on every newly created function to `anon` and `authenticated`,
-- and the original files granted without revoking first.
--
-- THE ONE THAT MATTERS: res_resolve_broadcast_audience(unit) returns
-- (follower_user_id, email_opt_in). Anyone on the internet with the project's
-- publishable key could POST /rest/v1/rpc/res_resolve_broadcast_audience and
-- enumerate the followers of any school, clinic or business in the directory,
-- along with who opted into email. It is the follow-based twin of
-- res_resolve_area_audience, which was locked down when it was written.
--
-- The rest fall into three groups:
--   * Trigger bodies. These are invoked by triggers, never by callers.
--     PostgreSQL checks EXECUTE at CREATE TRIGGER, not at fire time, so
--     revoking here cannot stop an existing trigger from running.
--   * SECURITY DEFINER boolean helpers. Each answers a question about someone
--     else's data ("is this person an admin of that provider", "does this
--     person share my suburb"). Individually small; together they are an
--     oracle a signed-out caller should not have.
--   * Pure lookups with no data access. Harmless, revoked for tidiness so the
--     anon surface is a short, deliberate list rather than an accident.
--
-- DELIBERATELY LEFT REACHABLE BY anon:
--   res_get_kin_verification_link / res_respond_kin_verification_link — these
--   power /verify-kin/[token], a public no-login page where someone without a
--   Resident account answers one question about a claimed relationship. Both
--   are scoped by an unguessable token. Taking anon away would break that
--   feature, which is the whole point of it.
--
-- Paste into the Supabase SQL editor. Additive only — no behaviour changes for
-- signed-in users.

-- Each revoke is guarded, because this file is applied both to the live
-- project and to the local sql-tests harness, which builds only a subset of
-- the schema. A missing function means "not installed here", not an error
-- worth aborting the whole lockdown over — and aborting would leave the
-- functions after it still open.
do $$
declare
  v_sig text;
  v_roles text;
begin
  foreach v_sig in array array[
    -- The leak: returns (follower_user_id, email_opt_in).
    'public.res_resolve_broadcast_audience(uuid)',
    -- SECURITY DEFINER helpers, each answering a question about someone
    -- else's data. Individually small; together an oracle.
    'public.res_is_current_housemate(uuid)',
    'public.res_is_provider_admin(uuid)',
    'public.res_is_unit_ancestor_or_self(uuid, uuid)',
    'public.res_owns_room(uuid)',
    'public.res_shares_locality(text, text)',
    'public.res_user_is_sender_of_or_above(uuid, uuid)',
    -- A write path should never be reachable unauthenticated, even though
    -- auth.uid() being null would fail it anyway.
    'public.res_report_status(text, text, text, text, uuid, double precision, double precision, timestamptz)',
    -- Pure lookups: harmless, revoked so the anon surface is a deliberate
    -- list rather than an accident of the defaults.
    'public.res_area_daily_cap(text)',
    'public.res_coarsen_coord(double precision)',
    'public.res_default_target_hours(text, text)'
  ] loop
    begin
      execute format('revoke all on function %s from public, anon', v_sig);
    exception when undefined_function then
      null;
    end;
  end loop;

  -- Trigger bodies. Invoked by triggers, never by callers. PostgreSQL checks
  -- EXECUTE at CREATE TRIGGER rather than at fire time, so revoking cannot
  -- stop an existing trigger from running.
  foreach v_sig in array array[
    'public.res_check_broadcast_priority()',
    'public.res_check_broadcast_rate_limit()',
    'public.res_check_security_log_rate_limit()',
    'public.res_check_status_duration()',
    'public.res_fanout_broadcast()',
    'public.res_org_unit_auto_sender()',
    'public.res_room_touch()',
    'public.res_service_report_set_reference()',
    'public.res_service_report_touch()'
  ] loop
    begin
      execute format('revoke all on function %s from public, anon, authenticated', v_sig);
    exception when undefined_function then
      null;
    end;
  end loop;
end $$;
