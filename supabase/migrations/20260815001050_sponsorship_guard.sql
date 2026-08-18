-- ═══════════════════════════════════════════════════════════════════════════
-- 20260815001050_sponsorship_guard
--
-- Adds isSponsorshipAdmin to res_transition_guard.
--
-- This is the SECOND full redeclaration of this function (after
-- 20260815000750_fault_guards), because migrations are forward-only and the
-- earlier versions are applied history. It works, but the duplication is now
-- real: if a third feature needs a guard, refactor res_transition_guard to
-- dispatch through a lookup table first, rather than growing a third copy of
-- ninety lines that can silently drift apart.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.res_transition_guard(
  p_guard text, p_entity text, p_id uuid, p_actor uuid, p_actor_kind text
) returns boolean
language plpgsql stable security definer
set search_path = public
as $$
declare v_ok boolean;
begin
  if p_guard is null then
    return true;
  end if;

  case p_guard
    when 'isLandlord' then
      execute format('select landlord_id = $1 from public.%I where id = $2', p_entity)
        into v_ok using p_actor, p_id;

    when 'isLandlordOfRequest' then
      select landlord_id = p_actor into v_ok from res_room_requests where id = p_id;

    when 'isTenantOfRequest' then
      select tenant_id = p_actor into v_ok from res_room_requests where id = p_id;

    when 'isServiceOwner' then
      select s.owner_id = p_actor into v_ok
        from res_service_dispatches d
        join res_handyman_services s on s.id = d.service_id
       where d.id = p_id;

    when 'isDispatchParty' then
      select (d.sender_id = p_actor or s.owner_id = p_actor) into v_ok
        from res_service_dispatches d
        join res_handyman_services s on s.id = d.service_id
       where d.id = p_id;

    when 'isAlertOwner' then
      select user_id = p_actor into v_ok from res_alerts where id = p_id;

    when 'isAlertParty' then
      select (a.user_id = p_actor
              or exists (select 1 from res_alert_responders r
                          where r.alert_id = a.id and r.responder_id = p_actor))
        into v_ok from res_alerts a where a.id = p_id;

    when 'notCritical' then
      select severity is distinct from 'critical' into v_ok from res_alerts where id = p_id;

    when 'isToolOwner' then
      select owner_id = p_actor into v_ok from res_tool_library where id = p_id;

    when 'isItemOwner' then
      select user_id = p_actor into v_ok from res_market_items where id = p_id;

    when 'isPostOwner' then
      select user_id = p_actor into v_ok from res_lost_found where id = p_id;

    when 'isOrganizer' then
      select organizer_id = p_actor into v_ok from res_group_buys where id = p_id;

    when 'isDisputeParty' then
      select (reported_by_id = p_actor or against_user_id = p_actor or mediator_id = p_actor)
        into v_ok from res_community_disputes where id = p_id;

    when 'isCareParty' then
      select (subject_id = p_actor or carer_id = p_actor) into v_ok
        from res_care_circle where id = p_id;

    when 'isReviewer' then
      v_ok := p_actor_kind in ('operator', 'system');

    -- ── New for res_faults ───────────────────────────────────────────────

    -- Only a listed admin of the provider the fault is routed to may move it
    -- through acknowledged / in_progress / resolved. This is what stops a
    -- resident marking their own outage "fixed by the utility", which would
    -- make the whole accountability record worthless.
    when 'isProviderAdmin' then
      select exists (
        select 1
          from res_faults f
          join res_infra_partner_admins a on a.provider_id = f.provider_id
         where f.id = p_id and a.user_id = p_actor
      ) into v_ok;

    -- Anyone who reported or vouched on the fault may mark it resolved. Power
    -- very often comes back without any utility ever touching the record, and
    -- a system that cannot represent that fills up with phantom outages.
    when 'isFaultParty' then
      select (f.reported_by = p_actor
              or exists (select 1 from res_fault_vouches v
                          where v.fault_id = f.id and v.user_id = p_actor))
        into v_ok from res_faults f where f.id = p_id;

    -- Sponsorship placements are sold in a human conversation and activated by
    -- hand once payment lands off-platform. Only an operator may start one; a
    -- scheduled job can END a placement but never begin one, so automation can
    -- never grant somebody free advertising.
    when 'isSponsorshipAdmin' then
      v_ok := p_actor_kind in ('operator', 'system');

    else
      raise exception 'res_transition_guard: unknown guard %', p_guard;
  end case;

  return coalesce(v_ok, false);
end;
$$;

revoke execute on function public.res_transition_guard(text,text,uuid,uuid,text) from public, anon;
grant execute on function public.res_transition_guard(text,text,uuid,uuid,text) to authenticated, service_role;
