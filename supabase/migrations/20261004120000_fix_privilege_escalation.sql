-- Privilege-escalation fixes found in the 2026-10-04 app audit.
--
-- Root cause shared by sections 1-3: these functions decide "is this a normal
-- API user?" with `current_user IN ('authenticated', 'anon')`, but they were
-- declared SECURITY DEFINER. Inside a SECURITY DEFINER function current_user
-- is the function OWNER (postgres), never 'authenticated', so every guard
-- silently let the change through. Proven on the live project with a
-- rolled-back update: a signed-in user set their own
-- res_profiles.verification_status to 'reviewed'.

-- 1. res_profiles: users must not mark themselves verified.
--    The body only touches NEW/OLD, so it needs no elevated rights.
alter function public.res_guard_verification_status() security invoker;

-- 2. profiles (shared with The Gruvs): users must not set their own role
--    (e.g. 'admin'), is_verified or social_integrity_score.
alter function public.protect_profile_trust_columns() security invoker;

-- 3. review_verification: the admin check never ran, so any signed-in user
--    could approve any verification request, including their own.
--    A request that arrives through the API carries JWT claims; only the
--    service role may skip the admin check. Internal SQL (no claims) is
--    unchanged.
create or replace function public.review_verification(p_request uuid, p_approve boolean, p_note text default null::text)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
DECLARE
  v_uid UUID := auth.uid();
  v_req RECORD;
BEGIN
  IF coalesce(current_setting('request.jwt.claims', true), '') <> ''
     AND coalesce(auth.role(), '') <> 'service_role' THEN
    IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = v_uid AND role = 'admin') THEN
      RAISE EXCEPTION 'not authorised to review';
    END IF;
  END IF;

  SELECT * INTO v_req FROM verification_requests WHERE id = p_request AND status = 'pending';
  IF NOT FOUND THEN RAISE EXCEPTION 'no pending request'; END IF;

  UPDATE verification_requests
     SET status = CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END,
         reviewed_by = v_uid, review_note = left(COALESCE(p_note, ''), 500), reviewed_at = now()
   WHERE id = p_request;

  IF p_approve THEN
    UPDATE profiles SET is_verified = true WHERE id = v_req.user_id;
    INSERT INTO notifications (recipient_id, actor_id, type, title, body, data)
    VALUES (v_req.user_id, v_req.user_id, 'verified',
            'You are Verified ✓', 'Your identity check passed — the green tick is yours.',
            jsonb_build_object('request_id', p_request));
  ELSE
    INSERT INTO notifications (recipient_id, actor_id, type, title, body, data)
    VALUES (v_req.user_id, v_req.user_id, 'verification_rejected',
            'Verification not approved', COALESCE(p_note, 'Keep building your presence and try again in 30 days.'),
            jsonb_build_object('request_id', p_request));
  END IF;
END;
$function$;

-- 4. res_community_members: the direct INSERT policy only checked
--    user_id = auth.uid(), so a user could join a PRIVATE community without
--    an invite, and join any community as 'founder' or 'admin' (then
--    moderate it via res_moderate). The app only joins through the
--    SECURITY DEFINER RPCs res_join_community, res_redeem_invite and
--    res_create_community, which do not need this policy.
drop policy if exists res_members_insert on public.res_community_members;

-- 5. Moderation flags: owners could undo a moderator's hide, and landlords
--    could clear the "priced far below the suburb median" scam warning, with
--    a plain UPDATE on their own row. Moderation RPCs run as the owner role
--    and are unaffected.
create or replace function public.res_guard_moderation_columns()
 returns trigger
 language plpgsql
 security invoker
 set search_path to ''
as $function$
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;
  new.hidden := old.hidden;
  if tg_table_name = 'res_listings' then
    new.flagged := old.flagged;
    new.flag_reason := old.flag_reason;
  end if;
  return new;
end;
$function$;

revoke execute on function public.res_guard_moderation_columns() from public, anon, authenticated;

drop trigger if exists res_guard_moderation_columns on public.res_market_items;
create trigger res_guard_moderation_columns before update on public.res_market_items
  for each row execute function public.res_guard_moderation_columns();

drop trigger if exists res_guard_moderation_columns on public.res_notice_events;
create trigger res_guard_moderation_columns before update on public.res_notice_events
  for each row execute function public.res_guard_moderation_columns();

drop trigger if exists res_guard_moderation_columns on public.res_listings;
create trigger res_guard_moderation_columns before update on public.res_listings
  for each row execute function public.res_guard_moderation_columns();
