-- ═══════════════════════════════════════════════════════════════════════════
-- The Resident — the RPC functions that were never versioned.
--
-- WHY THIS FILE EXISTS
-- The client calls 26 Postgres functions. Only 4 of them are defined in this
-- repo (res_book_seat, res_pledge_group_buy, res_toggle_echo/rsvp/vibe in
-- resident_schema.sql). The other 22 exist ONLY in the live Supabase project,
-- so the database cannot be rebuilt from source and — more importantly — the
-- privilege boundary cannot be reviewed from here.
--
-- That matters more for functions than it did for the 12 undocumented tables
-- fixed in theresident_undocumented_tables_schema.sql. A SECURITY DEFINER
-- function runs as its OWNER, not its caller, which means RLS on the tables it
-- touches does not protect you: the function itself has to re-check who is
-- asking. An unreviewed SECURITY DEFINER function is the single easiest way to
-- hand out data the RLS policies were carefully written to withhold.
--
-- WHY IT DRIFTED — the same cause, now confirmed three times
-- git archaeology puts every undocumented RPC in a large multi-feature commit:
--   42c1e8b  "join The Resident to the shared living map + one account"
--            -> ensure_res_profile, zones_near
--   0f9612c  "build out the 19-item backlog — trust circle, gossip, DMs..."
--            -> res_trust_gate, res_moderate, ...
--   83212ea  "complete 300 system logics integration..."
--            -> res_block_user, ...
-- while the four that ARE versioned came from small, focused fix commits:
--   39a715f  "atomic seat/pledge counters and a working offline queue"
--            -> res_book_seat, res_pledge_group_buy
--   1d424d4  "make writes actually persist and close the auth bypass"
--            -> res_toggle_vibe/echo/rsvp
-- Those same big commits are also what created the 12 undocumented tables and
-- left the gossip `hidden` moderation flag half-wired. The pattern is not
-- forgetfulness in general — it is specifically that broad feature pushes
-- created database objects in the Supabase dashboard and never came back to
-- the repo, whereas narrow fixes were already editing the schema file.
--
-- ⚠️  THIS FILE CANNOT RECONSTRUCT THE FUNCTION BODIES ⚠️
-- A table's shape can be inferred from how the client queries it. A function's
-- body cannot — the logic, the security context and the internal permission
-- checks are invisible from the call site. Guessing them and committing the
-- guess would be worse than the current gap, because it would look
-- authoritative. So STEP 1 below dumps the real definitions out of the live
-- project; paste that output into theresident_rpc_definitions.sql to close
-- this properly.
-- ═══════════════════════════════════════════════════════════════════════════


-- ═══ STEP 1 ═══ Read-only. Run this in the Supabase SQL editor and export
-- the result. Nothing here changes anything.

select
  p.proname                                as function_name,
  pg_get_function_identity_arguments(p.oid) as arguments,
  case when p.prosecdef then 'SECURITY DEFINER ⚠️' else 'security invoker' end as security,
  pg_get_userbyid(p.proowner)              as owner,
  pg_get_functiondef(p.oid)                as full_definition
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and (p.proname like 'res\_%' or p.proname in ('ensure_res_profile', 'zones_near', 'zone_verify'))
order by p.prosecdef desc, p.proname;


-- ═══ STEP 2 ═══ Review, in this order:
--
--   1. Every row marked SECURITY DEFINER. For each, confirm the body checks
--      that the CALLER is entitled to what it returns or changes — typically
--      a comparison against auth.uid(). A DEFINER function that trusts its
--      arguments is an IDOR: res_household_members(p_listing) that does not
--      verify the caller is in that household will happily list another
--      household's members to anyone who guesses a listing id.
--
--   2. Functions taking an id the caller could tamper with. From the call
--      sites, these take a caller-supplied id and are worth checking first:
--        res_block_user(p_blocked)                  res_care_check_in(p_care_id)
--        res_comment_gossip(p_post, p_body)         res_confirm_trust_connection(p_requester)
--        res_create_invite(p_community, ...)        res_end_tenancy(p_request)
--        res_has_household_plus(p_user)             res_household_members(p_listing)
--        res_property_occupancy(p_property)         res_public_provider_tier(p_user)
--        res_redeem_invite(p_code)                  res_request_trust_connection(p_connection)
--        zone_verify(p_zone, p_vote)
--
--   3. `search_path`. A SECURITY DEFINER function without
--      `set search_path = public` can be hijacked by a caller-controlled
--      search_path. The two functions this repo does define that way
--      (res_check_security_log_rate_limit, res_prune_security_logs) both set
--      it — the live ones should too.
--
-- ═══ STEP 3 ═══ Save the full_definition column into
-- theresident_rpc_definitions.sql and commit it, so the privilege boundary is
-- versioned and diffable like the table schema now is.


-- ═══ REFERENCE ═══ What the client actually calls, and from where.
-- Derived from the call sites, so this is accurate about the interface even
-- though it says nothing about the implementation.
--
--   ensure_res_profile()                        utils/authLogin.ts, auth/callback, dashboard/layout
--   res_block_user(p_blocked)                   components/trust-safety/BlockUserButton
--   res_book_seat(p_lift_id)                    store/index.ts            [versioned]
--   res_care_check_in(p_care_id)                components/trust-safety/SafetyTab
--   res_comment_gossip(p_post, p_body)          dashboard/gossip
--   res_confirm_trust_connection(p_requester)   dashboard/trust-circle
--   res_create_invite(p_community, p_max_uses, p_expires_at)
--                                               components/community/CommunityAdminTab
--   res_create_property()                       components/housing/PropertiesPanel
--   res_end_tenancy(p_request)                  components/household/HouseholdTab
--   res_has_household_plus(p_user)              utils/subscriptions.ts
--   res_household_members(p_listing)            components/household/HouseholdTab
--   res_moderate()                              components/community/CommunityAdminTab
--   res_pledge_group_buy()                      store/index.ts            [versioned]
--   res_property_occupancy(p_property)          components/housing/PropertiesPanel
--   res_public_provider_tier(p_user)            utils/subscriptions.ts
--   res_redeem_invite(p_code)                   components/community/CommunitiesTab
--   res_report_map_zone()                       utils/mapZones.ts
--   res_request_move_assist()                   dashboard/services
--   res_request_trust_connection(p_connection)  dashboard/trust-circle
--   res_submit_property_verification()          components/housing/PropertiesPanel
--   res_toggle_echo(p_notice_id)                store/index.ts            [versioned]
--   res_toggle_rsvp(p_notice_id)                store/index.ts            [versioned]
--   res_toggle_vibe(p_notice_id)                store/index.ts            [versioned]
--   res_trust_gate()                            dashboard/services
--   zone_verify(p_zone, p_vote)                 utils/mapZones.ts
--   zones_near()                                utils/mapZones.ts
