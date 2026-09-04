-- theresident_foreign_key_indexes.sql
--
-- Backlog J1: thirty-three foreign keys on res_ tables had no index that could
-- serve them.
--
-- WHY IT MATTERS MORE THAN IT LOOKS. An unindexed FK costs twice. Every join
-- through it is a sequential scan, which is invisible at two rows and
-- punishing at two hundred thousand. And every DELETE or UPDATE on the
-- REFERENCED table has to scan the whole referencing table to enforce the
-- constraint — so deleting one account walks res_gossip_posts, res_reviews,
-- res_listings and the rest end to end, which is exactly the operation that
-- must not become slow.
--
-- Two of these are from this week's own work (res_area_broadcasts and
-- res_unit_verification_requests), which is a fair illustration of how easily
-- it happens: an index is not part of writing a foreign key, so it only
-- appears if someone goes looking.
--
-- Indexes are named <table>_<column>_idx and created IF NOT EXISTS, so this
-- file is safe to re-run and safe to apply out of order. Each creation is
-- guarded: this file is applied both to the live project and to the local
-- sql-tests harness, which builds only a subset of the schema, and a missing
-- table there means "not installed here" rather than an error worth aborting
-- the remaining thirty-two indexes over.
--
-- Paste into the Supabase SQL editor. Additive only, and non-blocking in
-- practice at current row counts.

do $$
declare
  v record;
begin
  for v in select * from (values
    ('res_alert_responders', 'responder_id', 'res_alert_responders_responder_id_idx'),
    ('res_area_broadcasts', 'jurisdiction_id', 'res_area_broadcasts_jurisdiction_id_idx'),
    ('res_blocks', 'blocked_id', 'res_blocks_blocked_id_idx'),
    ('res_chore_schedule', 'roommate_id', 'res_chore_schedule_roommate_id_idx'),
    ('res_community_disputes', 'against_user_id', 'res_community_disputes_against_user_id_idx'),
    ('res_community_disputes', 'mediator_id', 'res_community_disputes_mediator_id_idx'),
    ('res_community_invites', 'community_id', 'res_community_invites_community_id_idx'),
    ('res_community_invites', 'created_by', 'res_community_invites_created_by_idx'),
    ('res_gossip_comments', 'author_id', 'res_gossip_comments_author_id_idx'),
    ('res_gossip_post_reactions', 'user_id', 'res_gossip_post_reactions_user_id_idx'),
    ('res_gossip_posts', 'author_id', 'res_gossip_posts_author_id_idx'),
    ('res_group_buy_pledges', 'user_id', 'res_group_buy_pledges_user_id_idx'),
    ('res_infra_partner_admins', 'user_id', 'res_infra_partner_admins_user_id_idx'),
    ('res_listings', 'event_id', 'res_listings_event_id_idx'),
    ('res_listings', 'property_id', 'res_listings_property_id_idx'),
    ('res_moderation_actions', 'actor_id', 'res_moderation_actions_actor_id_idx'),
    ('res_neighbourhood_status', 'provider_id', 'res_neighbourhood_status_provider_id_idx'),
    ('res_neighbourhood_status', 'reporter_id', 'res_neighbourhood_status_reporter_id_idx'),
    ('res_org_broadcasts', 'sender_id', 'res_org_broadcasts_sender_id_idx'),
    ('res_org_memberships', 'user_id', 'res_org_memberships_user_id_idx'),
    ('res_org_units', 'owner_user_id', 'res_org_units_owner_user_id_idx'),
    ('res_purchases', 'user_id', 'res_purchases_user_id_idx'),
    ('res_reviews', 'author_id', 'res_reviews_author_id_idx'),
    ('res_room_requests', 'listing_id', 'res_room_requests_listing_id_idx'),
    ('res_rooms', 'listing_id', 'res_rooms_listing_id_idx'),
    ('res_service_dispatches', 'service_id', 'res_service_dispatches_service_id_idx'),
    ('res_service_report_confirmations', 'user_id', 'res_service_report_confirmations_user_id_idx'),
    ('res_service_report_updates', 'author_id', 'res_service_report_updates_author_id_idx'),
    ('res_skills', 'user_id', 'res_skills_user_id_idx'),
    ('res_tool_library', 'rented_by', 'res_tool_library_rented_by_idx'),
    ('res_traffic_reports', 'reporter_id', 'res_traffic_reports_reporter_id_idx'),
    ('res_unit_verification_requests', 'requested_jurisdiction_id', 'res_unit_verification_requests_requested_jurisdiction_id_idx'),
    ('res_utility_tokens', 'claimed_by', 'res_utility_tokens_claimed_by_idx')
  ) as t(tbl, col, idx) loop
    -- Both guards are needed: the harness builds simplified stand-ins for
    -- some tables, so a table can exist there without the column this index
    -- is for.
    if to_regclass('public.' || v.tbl) is not null
       and exists (select 1 from information_schema.columns
                    where table_schema = 'public'
                      and table_name = v.tbl and column_name = v.col) then
      execute format('create index if not exists %I on public.%I (%I)', v.idx, v.tbl, v.col);
    end if;
  end loop;
end $$;
