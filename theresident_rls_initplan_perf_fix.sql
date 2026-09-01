-- theresident_rls_initplan_perf_fix.sql
--
-- Supabase's own linter (get_advisors, performance) flagged every policy
-- below with `auth_rls_initplan`: calling `auth.uid()` directly inside a
-- policy makes Postgres re-evaluate it once per ROW instead of once per
-- QUERY. Wrapping it as `(select auth.uid())` lets the planner treat it as
-- a stable subplan evaluated once — same access rules, no behavior change,
-- just cheaper at scale. Scoped to the 12 tables built this session
-- (Service Desk, directory/urgency, room inventory, kin verification,
-- gossip reactions) — the same class of gap exists on ~40 older res_*
-- tables too, left for a separate pass since those predate this session.
--
-- Already applied directly to the live database via the Supabase MCP tool.
-- This file exists so the fix is versioned like every other schema change
-- in this repo, not because it still needs to be pasted anywhere.

drop policy if exists res_org_units_insert on public.res_org_units;
create policy res_org_units_insert on public.res_org_units
  for insert to authenticated
  with check (
    owner_user_id = (select auth.uid())
    and (parent_id is null or public.res_user_is_sender_of_or_above(parent_id, (select auth.uid())))
  );

drop policy if exists res_org_units_update on public.res_org_units;
create policy res_org_units_update on public.res_org_units
  for update to authenticated
  using (public.res_user_is_sender_of_or_above(id, (select auth.uid())))
  with check (public.res_user_is_sender_of_or_above(id, (select auth.uid())));

drop policy if exists res_org_memberships_select on public.res_org_memberships;
create policy res_org_memberships_select on public.res_org_memberships
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or public.res_user_is_sender_of_or_above(unit_id, (select auth.uid()))
  );

drop policy if exists res_org_memberships_insert on public.res_org_memberships;
create policy res_org_memberships_insert on public.res_org_memberships
  for insert to authenticated
  with check (public.res_user_is_sender_of_or_above(unit_id, (select auth.uid())));

drop policy if exists res_org_memberships_delete on public.res_org_memberships;
create policy res_org_memberships_delete on public.res_org_memberships
  for delete to authenticated
  using (public.res_user_is_sender_of_or_above(unit_id, (select auth.uid())));

drop policy if exists res_org_follows_select on public.res_org_follows;
create policy res_org_follows_select on public.res_org_follows
  for select to authenticated using (follower_user_id = (select auth.uid()));

drop policy if exists res_org_follows_insert on public.res_org_follows;
create policy res_org_follows_insert on public.res_org_follows
  for insert to authenticated with check (follower_user_id = (select auth.uid()));

drop policy if exists res_org_follows_delete on public.res_org_follows;
create policy res_org_follows_delete on public.res_org_follows
  for delete to authenticated using (follower_user_id = (select auth.uid()));

drop policy if exists res_org_broadcasts_select on public.res_org_broadcasts;
create policy res_org_broadcasts_select on public.res_org_broadcasts
  for select to authenticated
  using (
    sender_id = (select auth.uid())
    or exists (
      select 1 from res_org_follows f
      where f.follower_user_id = (select auth.uid())
        and public.res_is_unit_ancestor_or_self(res_org_broadcasts.unit_id, f.unit_id)
    )
  );

drop policy if exists res_org_broadcasts_insert on public.res_org_broadcasts;
create policy res_org_broadcasts_insert on public.res_org_broadcasts
  for insert to authenticated
  with check (
    sender_id = (select auth.uid())
    and public.res_user_is_sender_of_or_above(unit_id, (select auth.uid()))
  );

drop policy if exists res_broadcast_receipts_select on public.res_org_broadcast_receipts;
create policy res_broadcast_receipts_select on public.res_org_broadcast_receipts
  for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists res_broadcast_receipts_insert on public.res_org_broadcast_receipts;
create policy res_broadcast_receipts_insert on public.res_org_broadcast_receipts
  for insert to authenticated with check (user_id = (select auth.uid()));

drop policy if exists res_broadcast_receipts_update on public.res_org_broadcast_receipts;
create policy res_broadcast_receipts_update on public.res_org_broadcast_receipts
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy if exists res_service_reports_select on public.res_service_reports;
create policy res_service_reports_select on public.res_service_reports
  for select to authenticated using (
    reporter_id = (select auth.uid())
    or public.res_is_provider_admin(provider_id)
    or public.res_shares_locality(suburb, city)
  );

drop policy if exists res_service_report_updates_select on public.res_service_report_updates;
create policy res_service_report_updates_select on public.res_service_report_updates
  for select to authenticated using (
    exists (
      select 1 from res_service_reports r
      where r.id = res_service_report_updates.report_id
        and (
          r.reporter_id = (select auth.uid())
          or public.res_is_provider_admin(r.provider_id)
          or public.res_shares_locality(r.suburb, r.city)
        )
    )
  );

drop policy if exists res_service_report_confirm_select on public.res_service_report_confirmations;
create policy res_service_report_confirm_select on public.res_service_report_confirmations
  for select to authenticated using (
    exists (
      select 1 from res_service_reports r
      where r.id = res_service_report_confirmations.report_id
        and (
          r.reporter_id = (select auth.uid())
          or public.res_is_provider_admin(r.provider_id)
          or public.res_shares_locality(r.suburb, r.city)
        )
    )
  );

drop policy if exists res_rooms_all on public.res_rooms;
create policy res_rooms_all on public.res_rooms
  for all to authenticated
  using (landlord_id = (select auth.uid()))
  with check (landlord_id = (select auth.uid()));

drop policy if exists res_room_occupants_select on public.res_room_occupants;
create policy res_room_occupants_select on public.res_room_occupants
  for select to authenticated using (
    public.res_owns_room(room_id)
    or tenant_id = (select auth.uid())
    or (visibility = 'shared_with_housemates' and public.res_is_current_housemate(room_id))
  );

drop policy if exists res_kin_verification_links_select on public.res_kin_verification_links;
create policy res_kin_verification_links_select on public.res_kin_verification_links
  for select using (requester_id = (select auth.uid()));

drop policy if exists res_gossip_post_reactions_insert on public.res_gossip_post_reactions;
create policy res_gossip_post_reactions_insert on public.res_gossip_post_reactions
  for insert with check (user_id = (select auth.uid()));

drop policy if exists res_gossip_post_reactions_delete on public.res_gossip_post_reactions;
create policy res_gossip_post_reactions_delete on public.res_gossip_post_reactions
  for delete using (user_id = (select auth.uid()));
