-- Database audit fixes (Supabase advisors, 2026-09-30).
-- Safe for the live project: no data is changed, and no function the app or
-- other apps call directly loses access.

-- 1. Trigger/cron functions must not be callable over the REST API.
--    Triggers and pg_cron (runs as postgres) keep working without EXECUTE.
revoke execute on function public.enforce_report_rate_limit() from public, anon, authenticated;
revoke execute on function public.handle_new_user_app_profiles() from public, anon, authenticated;
revoke execute on function public.notify_business_invoice_paid() from public, anon, authenticated;
revoke execute on function public.notify_checkin_welcome() from public, anon, authenticated;
revoke execute on function public.notify_founder_new_invoice_request() from public, anon, authenticated;
revoke execute on function public.sync_profile_display_name_to_app() from public, anon, authenticated;
revoke execute on function public.dispatch_reminders() from public, anon, authenticated;

-- 2. Internal health dashboards: signed-out visitors must not read them.
revoke execute on function public.maintenance_status() from public, anon;
revoke execute on function public.client_error_status(integer) from public, anon;

-- 3. Pin search_path on current_app_id (body uses only built-ins).
alter function public.current_app_id() set search_path = '';

-- 4. Drop duplicate indexes. The first name in each group is kept; an index
--    that backs a constraint (primary/unique key) is never dropped.
do $$
declare
  grp text[];
  keep text;
  n text;
  g_str text;
  groups text[] := array[
    'idx_activity_feed_recipient,idx_activity_recipient',
    'ad_campaigns_business_id,idx_ad_campaigns_business',
    'ad_campaigns_status,idx_ad_campaigns_status',
    'business_page_blocks_business_id,idx_page_blocks_business',
    'client_errors_created_at_idx,idx_client_errors_recent',
    'contextual_ads_active,idx_contextual_ads_active',
    'idx_dm_messages_room,idx_dm_messages_room_sent',
    'echoes_event_id,idx_echoes_event',
    'echoes_parent_id,idx_echoes_parent',
    'echoes_user_id,idx_echoes_user',
    'event_gallery_event_id,idx_gallery_event',
    'event_polls_event_id,idx_event_polls_event',
    'event_reactions_event_id,idx_event_reactions_event',
    'event_reminders_pending,reminders_send_at',
    'event_reminders_user,reminders_user',
    'idx_event_rsvps_event_status,idx_rsvps_event',
    'event_rsvps_user_id,idx_event_rsvps_user,idx_rsvps_user',
    'event_series_followers_series_id_user_id_key,uq_series_followers',
    'event_vibes_event_id,idx_event_vibes_event,vibes_event_id',
    'event_vibes_user_id,idx_event_vibes_user,vibes_user_id',
    'events_event_date_idx,idx_events_date',
    'idx_events_series,idx_events_series_id',
    'events_search_gin,idx_events_search',
    'events_tags_gin,idx_events_tags',
    'events_coords_gist,idx_events_coords',
    'follows_follower_id,idx_follows_follower',
    'follows_following_id,idx_follows_following',
    'idx_live_checkins_event,live_checkins_event_id,live_checkins_event_idx',
    'idx_live_checkins_user,live_checkins_user_id',
    'idx_messages_inbox,idx_messages_recipient,messages_recipient',
    'idx_messages_room,idx_messages_room_ts',
    'idx_notifications_unread,notifications_unread',
    'idx_notifications_recipient,idx_notifs_recipient,notifications_recipient_id',
    'idx_notifications_user_read,idx_notifications_user_unread',
    'idx_paths_user,paths_user',
    'idx_profiles_push,idx_profiles_push_token',
    'idx_profiles_vibe,idx_profiles_vibe_score',
    'idx_profiles_username_trgm,profiles_username_trgm',
    'idx_profiles_coords,profiles_coords_gist',
    'idx_pulse_event_votes,idx_pulse_requests_event_votes,pulse_requests_event_id',
    'idx_reel_comments_reel,idx_reel_comments_reel_idx,reel_comments_reel_id_idx,reel_comments_reel_idx',
    'idx_reel_likes_user,reel_likes_user_id_idx',
    'idx_reel_views_viewer,reel_views_viewer_id_idx',
    'idx_reels_created_at,idx_reels_created_at_idx,reels_created_at_idx',
    'idx_reels_created,idx_reels_feed,idx_reels_is_deleted,idx_reels_published',
    'idx_reels_user_id,idx_reels_user_id_idx,reels_user_id_idx',
    'idx_saved_events_user,saved_events_user_id',
    'idx_saved_reels_user,saved_reels_user_id_idx',
    'bookings_client_idx,idx_bookings_client,service_bookings_client',
    'bookings_provider_idx,idx_bookings_provider,service_bookings_provider',
    'bookings_status_idx,idx_bookings_status,service_bookings_status',
    'idx_stories_expires,stories_expires_idx',
    'idx_stories_user_id,stories_user_id_idx',
    'idx_user_blocks_blocked,user_blocks_blocked',
    'idx_user_blocks_blocker,user_blocks_blocker'
  ];
begin
  foreach g_str in array groups loop
    grp := string_to_array(g_str, ',');
    keep := null;
    -- prefer keeping a constraint-backed index when the group has one
    select g into keep from unnest(grp) g
      where exists (select 1 from pg_constraint c
                    where c.conindid = to_regclass('public.' || g))
      limit 1;
    keep := coalesce(keep, grp[1]);
    foreach n in array grp loop
      if n <> keep
         and to_regclass('public.' || n) is not null
         and not exists (select 1 from pg_constraint c
                         where c.conindid = to_regclass('public.' || n)) then
        execute format('drop index if exists public.%I', n);
      end if;
    end loop;
  end loop;
end $$;
