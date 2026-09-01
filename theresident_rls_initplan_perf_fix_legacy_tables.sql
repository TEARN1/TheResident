-- theresident_rls_initplan_perf_fix_legacy_tables.sql
--
-- theresident_rls_initplan_perf_fix.sql fixed the 12 tables built this
-- session; Supabase's linter also flags the same auth_rls_initplan issue on
-- 44 older res_* tables that predate it — every policy below calls
-- auth.uid() directly, so Postgres re-evaluates it once per ROW instead of
-- once per QUERY. Wrapping it as (select auth.uid()) fixes that: same
-- access rules, no behavior change, cheaper at scale.
--
-- Generated mechanically from a live pg_policies dump (tablename,
-- policyname, permissive, roles, cmd, qual, with_check for every affected
-- policy), substituting auth.uid() -> (select auth.uid()) and nothing else
-- — every USING/WITH CHECK clause, role list, and command type is preserved
-- exactly as it already existed live.
--
-- Already applied directly to the live database via the Supabase MCP tool.
-- This file exists so the fix is versioned like every other schema change
-- in this repo, not because it still needs to be pasted anywhere.

drop policy if exists "res_responders_insert" on public.res_alert_responders;
create policy "res_responders_insert" on public.res_alert_responders
  for INSERT to authenticated
  with check (((responder_id = (select auth.uid())) AND (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND (p.is_verified = true))))));

drop policy if exists "res_responders_update" on public.res_alert_responders;
create policy "res_responders_update" on public.res_alert_responders
  for UPDATE to authenticated
  using ((responder_id = (select auth.uid())))
  with check ((responder_id = (select auth.uid())));

drop policy if exists "res_alerts_insert" on public.res_alerts;
create policy "res_alerts_insert" on public.res_alerts
  for INSERT to authenticated
  with check ((user_id = (select auth.uid())));

drop policy if exists "res_alerts_update" on public.res_alerts;
create policy "res_alerts_update" on public.res_alerts
  for UPDATE to authenticated
  using ((user_id = (select auth.uid())))
  with check ((user_id = (select auth.uid())));

drop policy if exists "res_blocks_delete" on public.res_blocks;
create policy "res_blocks_delete" on public.res_blocks
  for DELETE to authenticated
  using ((blocker_id = (select auth.uid())));

drop policy if exists "res_blocks_insert" on public.res_blocks;
create policy "res_blocks_insert" on public.res_blocks
  for INSERT to authenticated
  with check ((blocker_id = (select auth.uid())));

drop policy if exists "res_blocks_select" on public.res_blocks;
create policy "res_blocks_select" on public.res_blocks
  for SELECT to authenticated
  using ((blocker_id = (select auth.uid())));

drop policy if exists "res_care_insert" on public.res_care_circle;
create policy "res_care_insert" on public.res_care_circle
  for INSERT to authenticated
  with check ((carer_id = (select auth.uid())));

drop policy if exists "res_care_select" on public.res_care_circle;
create policy "res_care_select" on public.res_care_circle
  for SELECT to authenticated
  using (((subject_id = (select auth.uid())) OR (carer_id = (select auth.uid()))));

drop policy if exists "res_care_update" on public.res_care_circle;
create policy "res_care_update" on public.res_care_circle
  for UPDATE to authenticated
  using (((subject_id = (select auth.uid())) OR (carer_id = (select auth.uid()))))
  with check (((subject_id = (select auth.uid())) OR (carer_id = (select auth.uid()))));

drop policy if exists "res_chores_delete" on public.res_chore_schedule;
create policy "res_chores_delete" on public.res_chore_schedule
  for DELETE to authenticated
  using (res_is_household_member(listing_id, (select auth.uid())));

drop policy if exists "res_chores_insert" on public.res_chore_schedule;
create policy "res_chores_insert" on public.res_chore_schedule
  for INSERT to authenticated
  with check (res_is_household_member(listing_id, (select auth.uid())));

drop policy if exists "res_chores_select" on public.res_chore_schedule;
create policy "res_chores_select" on public.res_chore_schedule
  for SELECT to authenticated
  using (res_is_household_member(listing_id, (select auth.uid())));

drop policy if exists "res_chores_update" on public.res_chore_schedule;
create policy "res_chores_update" on public.res_chore_schedule
  for UPDATE to authenticated
  using (res_is_household_member(listing_id, (select auth.uid())))
  with check (res_is_household_member(listing_id, (select auth.uid())));

drop policy if exists "res_communities_insert" on public.res_communities;
create policy "res_communities_insert" on public.res_communities
  for INSERT to authenticated
  with check ((created_by = (select auth.uid())));

drop policy if exists "res_communities_update" on public.res_communities;
create policy "res_communities_update" on public.res_communities
  for UPDATE to authenticated
  using ((created_by = (select auth.uid())))
  with check ((created_by = (select auth.uid())));

drop policy if exists "res_disputes_insert" on public.res_community_disputes;
create policy "res_disputes_insert" on public.res_community_disputes
  for INSERT to authenticated
  with check ((reported_by_id = (select auth.uid())));

drop policy if exists "res_disputes_select" on public.res_community_disputes;
create policy "res_disputes_select" on public.res_community_disputes
  for SELECT to authenticated
  using (((reported_by_id = (select auth.uid())) OR (against_user_id = (select auth.uid())) OR (mediator_id = (select auth.uid()))));

drop policy if exists "res_disputes_update" on public.res_community_disputes;
create policy "res_disputes_update" on public.res_community_disputes
  for UPDATE to authenticated
  using (((reported_by_id = (select auth.uid())) OR (mediator_id = (select auth.uid()))))
  with check (((reported_by_id = (select auth.uid())) OR (mediator_id = (select auth.uid()))));

drop policy if exists "res_invites_select" on public.res_community_invites;
create policy "res_invites_select" on public.res_community_invites
  for SELECT to authenticated
  using ((EXISTS ( SELECT 1
   FROM res_community_members m
  WHERE ((m.community_id = res_community_invites.community_id) AND (m.user_id = (select auth.uid())) AND (m.role = ANY (ARRAY['admin'::text, 'founder'::text]))))));

drop policy if exists "res_members_delete" on public.res_community_members;
create policy "res_members_delete" on public.res_community_members
  for DELETE to authenticated
  using (((user_id = (select auth.uid())) OR (EXISTS ( SELECT 1
   FROM res_communities c
  WHERE ((c.id = res_community_members.community_id) AND (c.created_by = (select auth.uid())))))));

drop policy if exists "res_members_insert" on public.res_community_members;
create policy "res_members_insert" on public.res_community_members
  for INSERT to authenticated
  with check ((user_id = (select auth.uid())));

drop policy if exists "res_dm_insert" on public.res_direct_messages;
create policy "res_dm_insert" on public.res_direct_messages
  for INSERT to authenticated
  with check ((sender_id = (select auth.uid())));

drop policy if exists "res_dm_select" on public.res_direct_messages;
create policy "res_dm_select" on public.res_direct_messages
  for SELECT to authenticated
  using (((sender_id = (select auth.uid())) OR (recipient_id = (select auth.uid()))));

drop policy if exists "res_gossip_comments_delete" on public.res_gossip_comments;
create policy "res_gossip_comments_delete" on public.res_gossip_comments
  for DELETE to authenticated
  using ((author_id = (select auth.uid())));

drop policy if exists "res_gossip_comments_insert" on public.res_gossip_comments;
create policy "res_gossip_comments_insert" on public.res_gossip_comments
  for INSERT to authenticated
  with check ((author_id = (select auth.uid())));

drop policy if exists "res_gossip_posts_delete" on public.res_gossip_posts;
create policy "res_gossip_posts_delete" on public.res_gossip_posts
  for DELETE to authenticated
  using ((author_id = (select auth.uid())));

drop policy if exists "res_gossip_posts_insert" on public.res_gossip_posts;
create policy "res_gossip_posts_insert" on public.res_gossip_posts
  for INSERT to authenticated
  with check (((author_id = (select auth.uid())) AND res_account_ready((select auth.uid()), 48, false)));

drop policy if exists "res_gossip_posts_select" on public.res_gossip_posts;
create policy "res_gossip_posts_select" on public.res_gossip_posts
  for SELECT to authenticated
  using (((NOT hidden) OR (author_id = (select auth.uid()))));

drop policy if exists "res_pledges_insert" on public.res_group_buy_pledges;
create policy "res_pledges_insert" on public.res_group_buy_pledges
  for INSERT to authenticated
  with check ((user_id = (select auth.uid())));

drop policy if exists "res_pledges_update" on public.res_group_buy_pledges;
create policy "res_pledges_update" on public.res_group_buy_pledges
  for UPDATE to authenticated
  using ((user_id = (select auth.uid())))
  with check ((user_id = (select auth.uid())));

drop policy if exists "res_groupbuys_insert" on public.res_group_buys;
create policy "res_groupbuys_insert" on public.res_group_buys
  for INSERT to authenticated
  with check ((organizer_id = (select auth.uid())));

drop policy if exists "res_groupbuys_update" on public.res_group_buys;
create policy "res_groupbuys_update" on public.res_group_buys
  for UPDATE to authenticated
  using ((organizer_id = (select auth.uid())))
  with check ((organizer_id = (select auth.uid())));

drop policy if exists "res_handyman_insert" on public.res_handyman_services;
create policy "res_handyman_insert" on public.res_handyman_services
  for INSERT to authenticated
  with check ((owner_id = (select auth.uid())));

drop policy if exists "res_handyman_update" on public.res_handyman_services;
create policy "res_handyman_update" on public.res_handyman_services
  for UPDATE to authenticated
  using ((owner_id = (select auth.uid())))
  with check ((owner_id = (select auth.uid())));

drop policy if exists "res_infra_partner_admins_select" on public.res_infra_partner_admins;
create policy "res_infra_partner_admins_select" on public.res_infra_partner_admins
  for SELECT to authenticated
  using ((user_id = (select auth.uid())));

drop policy if exists "res_bookings_select" on public.res_lift_bookings;
create policy "res_bookings_select" on public.res_lift_bookings
  for SELECT to authenticated
  using (((rider_id = (select auth.uid())) OR (EXISTS ( SELECT 1
   FROM res_lift_clubs l
  WHERE ((l.id = res_lift_bookings.lift_id) AND (l.driver_id = (select auth.uid())))))));

drop policy if exists "res_bookings_update" on public.res_lift_bookings;
create policy "res_bookings_update" on public.res_lift_bookings
  for UPDATE to authenticated
  using (((rider_id = (select auth.uid())) OR (EXISTS ( SELECT 1
   FROM res_lift_clubs l
  WHERE ((l.id = res_lift_bookings.lift_id) AND (l.driver_id = (select auth.uid())))))))
  with check (((rider_id = (select auth.uid())) OR (EXISTS ( SELECT 1
   FROM res_lift_clubs l
  WHERE ((l.id = res_lift_bookings.lift_id) AND (l.driver_id = (select auth.uid())))))));

drop policy if exists "res_lifts_insert" on public.res_lift_clubs;
create policy "res_lifts_insert" on public.res_lift_clubs
  for INSERT to authenticated
  with check ((driver_id = (select auth.uid())));

drop policy if exists "res_lifts_update" on public.res_lift_clubs;
create policy "res_lifts_update" on public.res_lift_clubs
  for UPDATE to authenticated
  using ((driver_id = (select auth.uid())))
  with check ((driver_id = (select auth.uid())));

drop policy if exists "res_listings_delete" on public.res_listings;
create policy "res_listings_delete" on public.res_listings
  for DELETE to authenticated
  using ((landlord_id = (select auth.uid())));

drop policy if exists "res_listings_update" on public.res_listings;
create policy "res_listings_update" on public.res_listings
  for UPDATE to authenticated
  using ((landlord_id = (select auth.uid())))
  with check ((landlord_id = (select auth.uid())));

drop policy if exists "res_listings_write" on public.res_listings;
create policy "res_listings_write" on public.res_listings
  for INSERT to authenticated
  with check ((landlord_id = (select auth.uid())));

drop policy if exists "res_lostfound_insert" on public.res_lost_found;
create policy "res_lostfound_insert" on public.res_lost_found
  for INSERT to authenticated
  with check ((user_id = (select auth.uid())));

drop policy if exists "res_lostfound_update" on public.res_lost_found;
create policy "res_lostfound_update" on public.res_lost_found
  for UPDATE to authenticated
  using ((user_id = (select auth.uid())))
  with check ((user_id = (select auth.uid())));

drop policy if exists "res_market_delete" on public.res_market_items;
create policy "res_market_delete" on public.res_market_items
  for DELETE to authenticated
  using ((user_id = (select auth.uid())));

drop policy if exists "res_market_insert" on public.res_market_items;
create policy "res_market_insert" on public.res_market_items
  for INSERT to authenticated
  with check ((user_id = (select auth.uid())));

drop policy if exists "res_market_update" on public.res_market_items;
create policy "res_market_update" on public.res_market_items
  for UPDATE to authenticated
  using ((user_id = (select auth.uid())))
  with check ((user_id = (select auth.uid())));

drop policy if exists "res_modlog_select" on public.res_moderation_actions;
create policy "res_modlog_select" on public.res_moderation_actions
  for SELECT to authenticated
  using ((EXISTS ( SELECT 1
   FROM res_community_members m
  WHERE ((m.community_id = res_moderation_actions.community_id) AND (m.user_id = (select auth.uid())) AND (m.role = ANY (ARRAY['admin'::text, 'founder'::text]))))));

drop policy if exists "res_status_insert" on public.res_neighbourhood_status;
create policy "res_status_insert" on public.res_neighbourhood_status
  for INSERT to authenticated
  with check ((reporter_id = (select auth.uid())));

drop policy if exists "res_notices_insert" on public.res_notice_events;
create policy "res_notices_insert" on public.res_notice_events
  for INSERT to authenticated
  with check ((posted_by_id = (select auth.uid())));

drop policy if exists "res_notices_update" on public.res_notice_events;
create policy "res_notices_update" on public.res_notice_events
  for UPDATE to authenticated
  using ((posted_by_id = (select auth.uid())))
  with check ((posted_by_id = (select auth.uid())));

drop policy if exists "res_prefs_all" on public.res_notification_prefs;
create policy "res_prefs_all" on public.res_notification_prefs
  for ALL to authenticated
  using ((user_id = (select auth.uid())))
  with check ((user_id = (select auth.uid())));

drop policy if exists "res_profiles_insert" on public.res_profiles;
create policy "res_profiles_insert" on public.res_profiles
  for INSERT to authenticated
  with check ((id = (select auth.uid())));

drop policy if exists "res_profiles_select" on public.res_profiles;
create policy "res_profiles_select" on public.res_profiles
  for SELECT to authenticated
  using (((id = (select auth.uid())) OR (EXISTS ( SELECT 1
   FROM res_room_requests r
  WHERE (((r.tenant_id = res_profiles.id) AND (r.landlord_id = (select auth.uid()))) OR ((r.landlord_id = res_profiles.id) AND (r.tenant_id = (select auth.uid()))))))));

drop policy if exists "res_profiles_update" on public.res_profiles;
create policy "res_profiles_update" on public.res_profiles
  for UPDATE to authenticated
  using ((id = (select auth.uid())))
  with check ((id = (select auth.uid())));

drop policy if exists "res_properties_insert" on public.res_properties;
create policy "res_properties_insert" on public.res_properties
  for INSERT to authenticated
  with check ((landlord_id = (select auth.uid())));

drop policy if exists "res_properties_update" on public.res_properties;
create policy "res_properties_update" on public.res_properties
  for UPDATE to authenticated
  using ((landlord_id = (select auth.uid())))
  with check ((landlord_id = (select auth.uid())));

drop policy if exists "res_purchases_select" on public.res_purchases;
create policy "res_purchases_select" on public.res_purchases
  for SELECT to authenticated
  using ((user_id = (select auth.uid())));

drop policy if exists "res_ratelimit_select" on public.res_rate_limits;
create policy "res_ratelimit_select" on public.res_rate_limits
  for SELECT to authenticated
  using ((user_id = (select auth.uid())));

drop policy if exists "res_reports_insert" on public.res_reports;
create policy "res_reports_insert" on public.res_reports
  for INSERT to authenticated
  with check ((reporter_id = (select auth.uid())));

drop policy if exists "res_reports_select" on public.res_reports;
create policy "res_reports_select" on public.res_reports
  for SELECT to authenticated
  using ((reporter_id = (select auth.uid())));

drop policy if exists "res_reviews_delete" on public.res_reviews;
create policy "res_reviews_delete" on public.res_reviews
  for DELETE to authenticated
  using ((author_id = (select auth.uid())));

drop policy if exists "res_reviews_update" on public.res_reviews;
create policy "res_reviews_update" on public.res_reviews
  for UPDATE to authenticated
  using (((author_id = (select auth.uid())) AND (created_at > (now() - '24:00:00'::interval))))
  with check ((author_id = (select auth.uid())));

drop policy if exists "res_requests_insert" on public.res_room_requests;
create policy "res_requests_insert" on public.res_room_requests
  for INSERT to authenticated
  with check ((tenant_id = (select auth.uid())));

drop policy if exists "res_requests_select" on public.res_room_requests;
create policy "res_requests_select" on public.res_room_requests
  for SELECT to authenticated
  using (((tenant_id = (select auth.uid())) OR (landlord_id = (select auth.uid()))));

drop policy if exists "res_requests_update" on public.res_room_requests;
create policy "res_requests_update" on public.res_room_requests
  for UPDATE to authenticated
  using (((tenant_id = (select auth.uid())) OR (landlord_id = (select auth.uid()))))
  with check (((tenant_id = (select auth.uid())) OR (landlord_id = (select auth.uid()))));

drop policy if exists "res_seekers_update" on public.res_roommate_seekers;
create policy "res_seekers_update" on public.res_roommate_seekers
  for UPDATE to authenticated
  using ((id = (select auth.uid())))
  with check ((id = (select auth.uid())));

drop policy if exists "res_seekers_write" on public.res_roommate_seekers;
create policy "res_seekers_write" on public.res_roommate_seekers
  for INSERT to authenticated
  with check ((id = (select auth.uid())));

drop policy if exists "res_saved_pins_all" on public.res_saved_pins;
create policy "res_saved_pins_all" on public.res_saved_pins
  for ALL to authenticated
  using ((user_id = (select auth.uid())))
  with check ((user_id = (select auth.uid())));

drop policy if exists "res_saved_all" on public.res_saved_searches;
create policy "res_saved_all" on public.res_saved_searches
  for ALL to authenticated
  using ((user_id = (select auth.uid())))
  with check ((user_id = (select auth.uid())));

drop policy if exists "res_security_logs_insert_auth" on public.res_security_logs;
create policy "res_security_logs_insert_auth" on public.res_security_logs
  for INSERT to authenticated
  with check (((user_id IS NULL) OR (user_id = (select auth.uid()))));

drop policy if exists "res_dispatch_insert" on public.res_service_dispatches;
create policy "res_dispatch_insert" on public.res_service_dispatches
  for INSERT to authenticated
  with check ((sender_id = (select auth.uid())));

drop policy if exists "res_dispatch_select" on public.res_service_dispatches;
create policy "res_dispatch_select" on public.res_service_dispatches
  for SELECT to authenticated
  using (((sender_id = (select auth.uid())) OR (EXISTS ( SELECT 1
   FROM res_handyman_services s
  WHERE ((s.id = res_service_dispatches.service_id) AND (s.owner_id = (select auth.uid())))))));

drop policy if exists "res_resources_insert" on public.res_shared_resources;
create policy "res_resources_insert" on public.res_shared_resources
  for INSERT to authenticated
  with check ((owner_id = (select auth.uid())));

drop policy if exists "res_resources_update" on public.res_shared_resources;
create policy "res_resources_update" on public.res_shared_resources
  for UPDATE to authenticated
  using ((owner_id = (select auth.uid())))
  with check ((owner_id = (select auth.uid())));

drop policy if exists "res_skills_insert" on public.res_skills;
create policy "res_skills_insert" on public.res_skills
  for INSERT to authenticated
  with check ((user_id = (select auth.uid())));

drop policy if exists "res_skills_update" on public.res_skills;
create policy "res_skills_update" on public.res_skills
  for UPDATE to authenticated
  using ((user_id = (select auth.uid())))
  with check ((user_id = (select auth.uid())));

drop policy if exists "res_subscriptions_select" on public.res_subscriptions;
create policy "res_subscriptions_select" on public.res_subscriptions
  for SELECT to authenticated
  using ((user_id = (select auth.uid())));

drop policy if exists "res_tools_insert" on public.res_tool_library;
create policy "res_tools_insert" on public.res_tool_library
  for INSERT to authenticated
  with check ((owner_id = (select auth.uid())));

drop policy if exists "res_tools_update" on public.res_tool_library;
create policy "res_tools_update" on public.res_tool_library
  for UPDATE to authenticated
  using (((owner_id = (select auth.uid())) OR (rented_by = (select auth.uid()))))
  with check (((owner_id = (select auth.uid())) OR (rented_by = (select auth.uid()))));

drop policy if exists "Auth Users Insert Traffic Reports" on public.res_traffic_reports;
create policy "Auth Users Insert Traffic Reports" on public.res_traffic_reports
  for INSERT
  with check (((select auth.uid()) = reporter_id));

drop policy if exists "Users Delete Own Traffic Reports" on public.res_traffic_reports;
create policy "Users Delete Own Traffic Reports" on public.res_traffic_reports
  for DELETE
  using (((select auth.uid()) = reporter_id));

drop policy if exists "traffic_insert_policy" on public.res_traffic_reports;
create policy "traffic_insert_policy" on public.res_traffic_reports
  for INSERT to authenticated
  with check (((select auth.uid()) = reporter_id));

drop policy if exists "res_trust_connections_insert" on public.res_trust_connections;
create policy "res_trust_connections_insert" on public.res_trust_connections
  for INSERT to authenticated
  with check ((requester_id = (select auth.uid())));

drop policy if exists "res_trust_connections_select" on public.res_trust_connections;
create policy "res_trust_connections_select" on public.res_trust_connections
  for SELECT to authenticated
  using (((requester_id = (select auth.uid())) OR (connection_id = (select auth.uid()))));

drop policy if exists "res_trust_connections_update" on public.res_trust_connections;
create policy "res_trust_connections_update" on public.res_trust_connections
  for UPDATE to authenticated
  using ((connection_id = (select auth.uid())))
  with check ((connection_id = (select auth.uid())));

drop policy if exists "res_tokens_insert" on public.res_utility_tokens;
create policy "res_tokens_insert" on public.res_utility_tokens
  for INSERT to authenticated
  with check ((landlord_id = (select auth.uid())));

drop policy if exists "res_tokens_update" on public.res_utility_tokens;
create policy "res_tokens_update" on public.res_utility_tokens
  for UPDATE to authenticated
  using (((landlord_id = (select auth.uid())) OR (claimed_by = (select auth.uid())) OR ((status = 'available'::text) AND ((select auth.uid()) IS NOT NULL))))
  with check (((landlord_id = (select auth.uid())) OR (claimed_by = (select auth.uid()))));

drop policy if exists "res_vendors_insert" on public.res_vendors;
create policy "res_vendors_insert" on public.res_vendors
  for INSERT to authenticated
  with check ((user_id = (select auth.uid())));

drop policy if exists "res_vendors_update" on public.res_vendors;
create policy "res_vendors_update" on public.res_vendors
  for UPDATE to authenticated
  using ((user_id = (select auth.uid())))
  with check ((user_id = (select auth.uid())));
