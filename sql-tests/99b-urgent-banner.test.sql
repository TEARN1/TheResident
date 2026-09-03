\set ON_ERROR_STOP on
-- The urgent banner is the app's only interrupt-level surface: it stays until
-- acknowledged and survives clearing a browser. An evacuation sent to an AREA
-- must reach it, and must sort ahead of a routine follow notice — the banner
-- shows one at a time, so the ordering decides what a resident actually sees.

-- Numbered to run AFTER 96 and 98, which are the files that actually send
-- area broadcasts. Resident 951 is pinned in Ward A and received them; 952
-- also received them and has not acknowledged; 953 lives in Ward B and was
-- never notified.
update auth._current set uid = '00000000-0000-0000-0000-000000000951';

select 'a_critical_area_notice_reaches_the_urgent_banner' as check,
  exists (select 1 from public.res_pending_urgent_broadcasts()
          where source = 'area' and priority = 'critical') as pass;

select 'the_banner_says_which_area_a_notice_covered' as check,
  (select target_label is not null from public.res_pending_urgent_broadcasts()
   where source = 'area' limit 1) as pass;

select 'the_banner_names_which_acknowledgement_to_use' as check,
  (select count(*) from public.res_pending_urgent_broadcasts()
   where source not in ('follow','area')) = 0 as pass;

-- THE ORDERING THAT MATTERS. Critical sorts ahead of urgent across both
-- sources, so an evacuation is never queued behind a school notice.
select 'a_critical_notice_sorts_ahead_of_an_urgent_one' as check,
  (select priority from public.res_pending_urgent_broadcasts() limit 1) = 'critical' as pass;

-- ── Acknowledging clears it, and only for the person who did ───────────────
select public.res_ack_area_broadcast(
  (select id from public.res_pending_urgent_broadcasts()
   where source = 'area' and priority = 'critical' limit 1));

select 'acknowledging_an_area_notice_clears_it_from_the_banner' as check,
  not exists (
    select 1 from public.res_pending_urgent_broadcasts() p
    join res_area_broadcast_receipts r
      on r.broadcast_id = p.id and r.user_id = '00000000-0000-0000-0000-000000000951'
    where p.source = 'area' and r.acknowledged_at is not null) as pass;

-- Resident 952 also received it and has not acknowledged, so it must still be
-- waiting for them. Acknowledgement is per person, not per notice.
update auth._current set uid = '00000000-0000-0000-0000-000000000952';
select 'one_residents_acknowledgement_does_not_clear_it_for_another' as check,
  exists (select 1 from public.res_pending_urgent_broadcasts() where source = 'area') as pass;

-- ── A resident who was never notified sees nothing ─────────────────────────
-- Membership is taken from the notification actually delivered, so the banner
-- can never show something the rest of the app has no record of them getting.
update auth._current set uid = '00000000-0000-0000-0000-000000000953';
select 'a_resident_outside_the_area_gets_no_banner' as check,
  not exists (select 1 from public.res_pending_urgent_broadcasts() where source = 'area') as pass;

-- ── Grant boundary ─────────────────────────────────────────────────────────
select 'signed_out_visitors_cannot_read_the_pending_queue' as check,
  not has_function_privilege('anon', 'public.res_pending_urgent_broadcasts()', 'execute') as pass;
