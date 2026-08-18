-- ═══════════════════════════════════════════════════════════════════════════
-- 20260815999000_seed_transitions  ***GENERATED — DO NOT EDIT BY HAND***
--
-- Source: src/utils/lifecycle.ts
-- Regenerate: npm run gen:transitions
--
-- Editing this file by hand makes TypeScript and Postgres disagree about
-- what a job is allowed to do. CI runs `gen:transitions -- --check` to stop
-- that happening.
-- ═══════════════════════════════════════════════════════════════════════════

-- Replace wholesale: the table is a projection of lifecycle.ts, so a
-- transition deleted there must disappear here too.
delete from public.res_transitions;

insert into public.res_transitions
  (entity, from_state, to_state, actors, guard, reversible, note)
values
  ('res_listings', 'open', 'taken', array['user']::text[], 'isLandlord', true, 'Landlord marks the room as filled.'),
  ('res_listings', 'open', 'paused', array['user']::text[], 'isLandlord', true, 'Landlord temporarily hides the listing.'),
  ('res_listings', 'paused', 'open', array['user']::text[], 'isLandlord', true, 'Landlord republishes.'),
  ('res_listings', 'taken', 'open', array['user']::text[], 'isLandlord', true, 'Tenant fell through; room is available again.'),
  ('res_listings', 'open', 'expiring', array['job']::text[], null, true, 'Approaching expires_at — warned, still visible.'),
  ('res_listings', 'expiring', 'open', array['user']::text[], 'isLandlord', true, 'Landlord confirmed the room is still available; clock resets.'),
  ('res_listings', 'expiring', 'expired', array['job']::text[], null, true, 'Passed expires_at with no landlord confirmation.'),
  ('res_listings', 'expired', 'open', array['user']::text[], 'isLandlord', true, 'Landlord relists from the expiry notification.'),
  ('res_listings', 'expired', 'archived', array['job']::text[], null, true, 'Long-expired listing removed from all surfaces.'),
  ('res_listings', 'open', 'flagged', array['policy']::text[], null, true, 'A moderation rule matched. Still visible — flagged is a queue, not a punishment.'),
  ('res_listings', 'flagged', 'open', array['operator', 'user']::text[], 'isReviewer', true, 'Review cleared the flag.'),
  ('res_listings', 'flagged', 'suspended', array['operator']::text[], 'isReviewer', true, 'Review upheld the flag; listing hidden. Propose tier — never Auto.'),
  ('res_listings', 'suspended', 'open', array['operator']::text[], 'isReviewer', true, 'Suspension lifted on appeal.'),
  ('res_room_requests', 'pending', 'approved', array['user']::text[], 'isLandlordOfRequest', false, 'Landlord accepts the applicant. Not reversible: the tenant has been told.'),
  ('res_room_requests', 'pending', 'rejected', array['user']::text[], 'isLandlordOfRequest', false, 'Landlord declines.'),
  ('res_room_requests', 'pending', 'withdrawn', array['user']::text[], 'isTenantOfRequest', false, 'Applicant pulls out.'),
  ('res_room_requests', 'pending', 'auto_expired', array['job']::text[], null, true, 'No landlord response within the policy window. Both sides notified; no reputation penalty on a first offence.'),
  ('res_service_dispatches', 'pending', 'accepted', array['user']::text[], 'isServiceOwner', true, 'Provider takes the job.'),
  ('res_service_dispatches', 'accepted', 'completed', array['user']::text[], 'isDispatchParty', false, 'Work done. Settlement happens off-platform (CONTRACT.md §6).'),
  ('res_service_dispatches', 'pending', 'abandoned', array['job']::text[], null, true, 'No provider accepted within the window; sender notified and offered alternatives.'),
  ('res_service_dispatches', 'accepted', 'disputed', array['user']::text[], 'isDispatchParty', false, 'Either party escalates.'),
  ('res_alerts', 'active', 'responded', array['system']::text[], null, false, 'A responder committed. Set by trigger when res_alert_responders gains a row.'),
  ('res_alerts', 'active', 'resolved', array['user']::text[], 'isAlertOwner', true, 'Raiser stands the alert down.'),
  ('res_alerts', 'responded', 'resolved', array['user']::text[], 'isAlertParty', true, 'Responder or raiser closes it out.'),
  ('res_alerts', 'active', 'false_alarm', array['user']::text[], 'isAlertOwner', true, 'Raiser retracts.'),
  ('res_alerts', 'active', 'auto_closed', array['job']::text[], 'notCritical', true, 'Timed out with no responder. CRITICAL alerts are excluded by the guard and escalate to a human instead — the cost of silently closing a real emergency is not symmetric.'),
  ('res_utility_tokens', 'available', 'claimed', array['user']::text[], null, true, 'A neighbour claims it. Coordination signal only — no money moves (CONTRACT.md §6).'),
  ('res_utility_tokens', 'claimed', 'available', array['job', 'user']::text[], null, true, 'Uncollected past the hold window, or the claimer released it.'),
  ('res_tool_library', 'available', 'rented', array['user']::text[], null, true, 'Borrower takes the tool.'),
  ('res_tool_library', 'rented', 'overdue', array['job']::text[], null, true, 'Past rented_until. Both parties nudged. No late fee is ever computed (CONTRACT.md §6).'),
  ('res_tool_library', 'rented', 'available', array['user']::text[], 'isToolOwner', true, 'Owner confirms the tool came back.'),
  ('res_tool_library', 'overdue', 'available', array['user']::text[], 'isToolOwner', true, 'Returned late.'),
  ('res_community_disputes', 'pending', 'mediating', array['user']::text[], 'isDisputeParty', true, 'A mediator picks it up.'),
  ('res_community_disputes', 'mediating', 'resolved', array['user']::text[], 'isDisputeParty', false, 'Outcome recorded.'),
  ('res_community_disputes', 'pending', 'resolved', array['user']::text[], 'isDisputeParty', false, 'Settled between the parties without a mediator ever stepping in. Common, and the machine has to be able to represent it.'),
  ('res_community_disputes', 'pending', 'escalated', array['job']::text[], null, true, 'Day 7 with no mediator. Propose tier — a human sees it before it moves.'),
  ('res_community_disputes', 'escalated', 'stale_closed', array['job']::text[], null, true, 'Day 21, still nothing. Closed with both parties notified, reopenable.'),
  ('res_group_buys', 'open', 'threshold_met', array['job', 'system']::text[], null, true, 'Pledges reached target_quantity.'),
  ('res_group_buys', 'open', 'expired_short', array['job']::text[], null, true, 'Deadline passed under target. Pledgers notified it will not proceed.'),
  ('res_group_buys', 'threshold_met', 'completed', array['user']::text[], 'isOrganizer', false, 'Organiser confirms the buy happened.'),
  ('res_group_buys', 'open', 'cancelled', array['user']::text[], 'isOrganizer', false, 'Organiser calls it off.'),
  ('res_market_items', 'available', 'pending', array['user']::text[], 'isItemOwner', true, 'Buyer lined up.'),
  ('res_market_items', 'pending', 'gone', array['user']::text[], 'isItemOwner', true, 'Sold or given away.'),
  ('res_market_items', 'pending', 'available', array['user', 'job']::text[], null, true, 'Buyer fell through, or the pending hold timed out.'),
  ('res_market_items', 'available', 'gone', array['user']::text[], 'isItemOwner', true, 'Sold or given away straight from the list, without a pending hold — which is how most small items actually go.'),
  ('res_market_items', 'available', 'expired', array['job']::text[], null, true, 'Untouched past the staleness window.'),
  ('res_lost_found', 'open', 'reunited', array['user']::text[], 'isPostOwner', true, 'Found its way home.'),
  ('res_lost_found', 'open', 'stale_archived', array['job']::text[], null, true, 'Open past the window. Archived, not deleted — a pet post may matter months later.'),
  ('res_care_circle', 'active', 'overdue', array['job']::text[], null, true, 'last_ok_at older than the cadence. Carer notified.'),
  ('res_care_circle', 'overdue', 'escalated', array['job']::text[], null, true, 'Still nothing 24h later. The whole circle is notified. There is no auto_closed state here on purpose.'),
  ('res_care_circle', 'overdue', 'active', array['user']::text[], 'isCareParty', false, 'Check-in received.'),
  ('res_care_circle', 'escalated', 'active', array['user']::text[], 'isCareParty', false, 'Check-in received after escalation.'),
  ('res_care_circle', 'active', 'paused', array['user']::text[], 'isCareParty', true, 'Subject away or opted out.'),
  ('res_care_circle', 'paused', 'active', array['user']::text[], 'isCareParty', true, 'Check-ins resume after a pause.'),
  ('res_faults', 'reported', 'corroborated', array['job']::text[], null, true, 'Neighbours are confirming, but not yet enough to send to the provider.'),
  ('res_faults', 'reported', 'escalated', array['job']::text[], null, true, 'Immediate physical danger — sent without waiting for corroboration.'),
  ('res_faults', 'corroborated', 'escalated', array['job']::text[], null, true, 'Evidence threshold met; the provider has been notified.'),
  ('res_faults', 'escalated', 'acknowledged', array['user']::text[], 'isProviderAdmin', true, 'The provider confirms they have received it, usually with a reference.'),
  ('res_faults', 'acknowledged', 'in_progress', array['user']::text[], 'isProviderAdmin', true, 'A crew is assigned or on site.'),
  ('res_faults', 'in_progress', 'resolved', array['user']::text[], 'isProviderAdmin', true, 'The provider says it is fixed. A claim, not yet a fact — residents verify next.'),
  ('res_faults', 'escalated', 'resolved', array['user']::text[], 'isFaultParty', true, 'Fixed before anyone formally acknowledged it, which happens often.'),
  ('res_faults', 'corroborated', 'resolved', array['user']::text[], 'isFaultParty', true, 'Came back on its own before it ever reached the provider.'),
  ('res_faults', 'resolved', 'verified', array['job']::text[], null, true, 'Enough residents confirm it is genuinely fixed. This is what closes the loop — a provider marking a job done is a claim; the neighbours are the fact.'),
  ('res_faults', 'resolved', 'escalated', array['job']::text[], null, true, 'Residents report it is still broken after a resolution claim. Reopened, and the false closure is on the record.'),
  ('res_faults', 'reported', 'rejected', array['job']::text[], null, true, 'Neighbours actively dispute it. Held, not deleted — the reporter may still be right.'),
  ('res_faults', 'corroborated', 'lapsed', array['job']::text[], null, true, 'Confidence decayed with nobody re-confirming; almost certainly fixed quietly.'),
  ('res_faults', 'reported', 'lapsed', array['job']::text[], null, true, 'A lone report nobody ever confirmed.'),
  ('res_sponsorships', 'pending', 'active', array['operator']::text[], 'isSponsorshipAdmin', true, 'Payment confirmed off-platform; the placement goes live.'),
  ('res_sponsorships', 'pending', 'cancelled', array['operator']::text[], 'isSponsorshipAdmin', true, 'Sale fell through before it ever ran.'),
  ('res_sponsorships', 'active', 'expired', array['job']::text[], null, true, 'The agreed term ended. The only status change automation may make here.'),
  ('res_sponsorships', 'active', 'cancelled', array['operator']::text[], 'isSponsorshipAdmin', true, 'Cancelled mid-term by either side. No refund logic — money never moved through the app.'),
  ('res_sponsorships', 'expired', 'active', array['operator']::text[], 'isSponsorshipAdmin', true, 'Renewed for a new term.');

delete from public.res_initial_states;
insert into public.res_initial_states (entity, state) values
  ('res_alerts', 'active'),
  ('res_care_circle', 'active'),
  ('res_community_disputes', 'pending'),
  ('res_faults', 'reported'),
  ('res_group_buys', 'open'),
  ('res_listings', 'open'),
  ('res_lost_found', 'open'),
  ('res_market_items', 'available'),
  ('res_room_requests', 'pending'),
  ('res_service_dispatches', 'pending'),
  ('res_sponsorships', 'pending'),
  ('res_tool_library', 'available'),
  ('res_utility_tokens', 'available');

-- ── Widen status check constraints to the full modelled state set ─────────
--
-- Constraints are matched by the COLUMN they constrain, not by a text
-- match on their definition. res_listings carries both a `status` check
-- and a `doc_review_status` check, and matching on the substring would
-- silently drop the wrong one — removing document-review validation while
-- appearing to succeed.
do $$
declare v_con text;
begin
  -- res_alerts
  if to_regclass('public.res_alerts') is not null then
    for v_con in
      select con.conname from pg_constraint con
       where con.conrelid = 'public.res_alerts'::regclass
         and con.contype = 'c'
         -- exactly one column, and that column is named "status"
         and array_length(con.conkey, 1) = 1
         and (select a.attname from pg_attribute a
               where a.attrelid = con.conrelid
                 and a.attnum = con.conkey[1]) = 'status'
    loop
      execute format('alter table public.res_alerts drop constraint %I', v_con);
    end loop;
    alter table public.res_alerts add constraint res_alerts_status_check
      check (status in ('active', 'auto_closed', 'false_alarm', 'resolved', 'responded'));
  end if;
  -- res_care_circle
  if to_regclass('public.res_care_circle') is not null then
    for v_con in
      select con.conname from pg_constraint con
       where con.conrelid = 'public.res_care_circle'::regclass
         and con.contype = 'c'
         -- exactly one column, and that column is named "status"
         and array_length(con.conkey, 1) = 1
         and (select a.attname from pg_attribute a
               where a.attrelid = con.conrelid
                 and a.attnum = con.conkey[1]) = 'status'
    loop
      execute format('alter table public.res_care_circle drop constraint %I', v_con);
    end loop;
    alter table public.res_care_circle add constraint res_care_circle_status_check
      check (status in ('active', 'escalated', 'overdue', 'paused'));
  end if;
  -- res_community_disputes
  if to_regclass('public.res_community_disputes') is not null then
    for v_con in
      select con.conname from pg_constraint con
       where con.conrelid = 'public.res_community_disputes'::regclass
         and con.contype = 'c'
         -- exactly one column, and that column is named "status"
         and array_length(con.conkey, 1) = 1
         and (select a.attname from pg_attribute a
               where a.attrelid = con.conrelid
                 and a.attnum = con.conkey[1]) = 'status'
    loop
      execute format('alter table public.res_community_disputes drop constraint %I', v_con);
    end loop;
    alter table public.res_community_disputes add constraint res_community_disputes_status_check
      check (status in ('escalated', 'mediating', 'pending', 'resolved', 'stale_closed'));
  end if;
  -- res_faults
  if to_regclass('public.res_faults') is not null then
    for v_con in
      select con.conname from pg_constraint con
       where con.conrelid = 'public.res_faults'::regclass
         and con.contype = 'c'
         -- exactly one column, and that column is named "status"
         and array_length(con.conkey, 1) = 1
         and (select a.attname from pg_attribute a
               where a.attrelid = con.conrelid
                 and a.attnum = con.conkey[1]) = 'status'
    loop
      execute format('alter table public.res_faults drop constraint %I', v_con);
    end loop;
    alter table public.res_faults add constraint res_faults_status_check
      check (status in ('acknowledged', 'corroborated', 'escalated', 'in_progress', 'lapsed', 'rejected', 'reported', 'resolved', 'verified'));
  end if;
  -- res_group_buys
  if to_regclass('public.res_group_buys') is not null then
    for v_con in
      select con.conname from pg_constraint con
       where con.conrelid = 'public.res_group_buys'::regclass
         and con.contype = 'c'
         -- exactly one column, and that column is named "status"
         and array_length(con.conkey, 1) = 1
         and (select a.attname from pg_attribute a
               where a.attrelid = con.conrelid
                 and a.attnum = con.conkey[1]) = 'status'
    loop
      execute format('alter table public.res_group_buys drop constraint %I', v_con);
    end loop;
    alter table public.res_group_buys add constraint res_group_buys_status_check
      check (status in ('cancelled', 'completed', 'expired_short', 'open', 'threshold_met'));
  end if;
  -- res_listings
  if to_regclass('public.res_listings') is not null then
    for v_con in
      select con.conname from pg_constraint con
       where con.conrelid = 'public.res_listings'::regclass
         and con.contype = 'c'
         -- exactly one column, and that column is named "status"
         and array_length(con.conkey, 1) = 1
         and (select a.attname from pg_attribute a
               where a.attrelid = con.conrelid
                 and a.attnum = con.conkey[1]) = 'status'
    loop
      execute format('alter table public.res_listings drop constraint %I', v_con);
    end loop;
    alter table public.res_listings add constraint res_listings_status_check
      check (status in ('archived', 'expired', 'expiring', 'flagged', 'open', 'paused', 'suspended', 'taken'));
  end if;
  -- res_lost_found
  if to_regclass('public.res_lost_found') is not null then
    for v_con in
      select con.conname from pg_constraint con
       where con.conrelid = 'public.res_lost_found'::regclass
         and con.contype = 'c'
         -- exactly one column, and that column is named "status"
         and array_length(con.conkey, 1) = 1
         and (select a.attname from pg_attribute a
               where a.attrelid = con.conrelid
                 and a.attnum = con.conkey[1]) = 'status'
    loop
      execute format('alter table public.res_lost_found drop constraint %I', v_con);
    end loop;
    alter table public.res_lost_found add constraint res_lost_found_status_check
      check (status in ('open', 'reunited', 'stale_archived'));
  end if;
  -- res_market_items
  if to_regclass('public.res_market_items') is not null then
    for v_con in
      select con.conname from pg_constraint con
       where con.conrelid = 'public.res_market_items'::regclass
         and con.contype = 'c'
         -- exactly one column, and that column is named "status"
         and array_length(con.conkey, 1) = 1
         and (select a.attname from pg_attribute a
               where a.attrelid = con.conrelid
                 and a.attnum = con.conkey[1]) = 'status'
    loop
      execute format('alter table public.res_market_items drop constraint %I', v_con);
    end loop;
    alter table public.res_market_items add constraint res_market_items_status_check
      check (status in ('available', 'expired', 'gone', 'pending'));
  end if;
  -- res_room_requests
  if to_regclass('public.res_room_requests') is not null then
    for v_con in
      select con.conname from pg_constraint con
       where con.conrelid = 'public.res_room_requests'::regclass
         and con.contype = 'c'
         -- exactly one column, and that column is named "status"
         and array_length(con.conkey, 1) = 1
         and (select a.attname from pg_attribute a
               where a.attrelid = con.conrelid
                 and a.attnum = con.conkey[1]) = 'status'
    loop
      execute format('alter table public.res_room_requests drop constraint %I', v_con);
    end loop;
    alter table public.res_room_requests add constraint res_room_requests_status_check
      check (status in ('approved', 'auto_expired', 'pending', 'rejected', 'withdrawn'));
  end if;
  -- res_service_dispatches
  if to_regclass('public.res_service_dispatches') is not null then
    for v_con in
      select con.conname from pg_constraint con
       where con.conrelid = 'public.res_service_dispatches'::regclass
         and con.contype = 'c'
         -- exactly one column, and that column is named "status"
         and array_length(con.conkey, 1) = 1
         and (select a.attname from pg_attribute a
               where a.attrelid = con.conrelid
                 and a.attnum = con.conkey[1]) = 'status'
    loop
      execute format('alter table public.res_service_dispatches drop constraint %I', v_con);
    end loop;
    alter table public.res_service_dispatches add constraint res_service_dispatches_status_check
      check (status in ('abandoned', 'accepted', 'completed', 'disputed', 'pending'));
  end if;
  -- res_sponsorships
  if to_regclass('public.res_sponsorships') is not null then
    for v_con in
      select con.conname from pg_constraint con
       where con.conrelid = 'public.res_sponsorships'::regclass
         and con.contype = 'c'
         -- exactly one column, and that column is named "status"
         and array_length(con.conkey, 1) = 1
         and (select a.attname from pg_attribute a
               where a.attrelid = con.conrelid
                 and a.attnum = con.conkey[1]) = 'status'
    loop
      execute format('alter table public.res_sponsorships drop constraint %I', v_con);
    end loop;
    alter table public.res_sponsorships add constraint res_sponsorships_status_check
      check (status in ('active', 'cancelled', 'expired', 'pending'));
  end if;
  -- res_tool_library
  if to_regclass('public.res_tool_library') is not null then
    for v_con in
      select con.conname from pg_constraint con
       where con.conrelid = 'public.res_tool_library'::regclass
         and con.contype = 'c'
         -- exactly one column, and that column is named "status"
         and array_length(con.conkey, 1) = 1
         and (select a.attname from pg_attribute a
               where a.attrelid = con.conrelid
                 and a.attnum = con.conkey[1]) = 'status'
    loop
      execute format('alter table public.res_tool_library drop constraint %I', v_con);
    end loop;
    alter table public.res_tool_library add constraint res_tool_library_status_check
      check (status in ('available', 'overdue', 'rented'));
  end if;
  -- res_utility_tokens
  if to_regclass('public.res_utility_tokens') is not null then
    for v_con in
      select con.conname from pg_constraint con
       where con.conrelid = 'public.res_utility_tokens'::regclass
         and con.contype = 'c'
         -- exactly one column, and that column is named "status"
         and array_length(con.conkey, 1) = 1
         and (select a.attname from pg_attribute a
               where a.attrelid = con.conrelid
                 and a.attnum = con.conkey[1]) = 'status'
    loop
      execute format('alter table public.res_utility_tokens drop constraint %I', v_con);
    end loop;
    alter table public.res_utility_tokens add constraint res_utility_tokens_status_check
      check (status in ('available', 'claimed'));
  end if;
end $$;
