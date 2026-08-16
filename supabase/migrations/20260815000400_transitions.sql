-- ═══════════════════════════════════════════════════════════════════════════
-- 20260815000400_transitions
--
-- Layer 1 of docs/SELF-MANAGING.md: one door for every status change.
--
-- Context worth recording: this repo carried two schema files that disagreed
-- about what a status even is — resident_schema.sql said listings are
-- open|taken|paused, deploy_production_schema.sql said available. A query
-- against the live database settled it: deploy_production_schema.sql was NEVER
-- APPLIED (no token_code column, disputes still use reported_by_id, resources
-- still use lat/lon). It has been deleted. The canonical spellings below are
-- the live ones.
--
-- After this migration, res_transition() is the only supported way to change a
-- status column — for users, jobs, policies and the operator alike. An illegal
-- move raises. It does not silently no-op, because a job that quietly does
-- nothing is indistinguishable from a job with nothing to do.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. The rule tables (populated by the generated seed migration) ─────────
create table if not exists public.res_transitions (
  entity     text not null,
  from_state text not null,
  to_state   text not null,
  actors     text[] not null,
  guard      text,
  reversible boolean not null default true,
  note       text not null,
  primary key (entity, from_state, to_state)
);

create table if not exists public.res_initial_states (
  entity text primary key,
  state  text not null
);

alter table public.res_transitions    enable row level security;
alter table public.res_initial_states enable row level security;

revoke all on public.res_transitions    from public, anon;
revoke all on public.res_initial_states from public, anon;

-- Clients may READ the rules — the UI uses them to decide which buttons to
-- show — but only service_role writes them, and only via the generator.
grant select on public.res_transitions    to authenticated, service_role;
grant select on public.res_initial_states to authenticated, service_role;
grant insert, update, delete on public.res_transitions    to service_role;
grant insert, update, delete on public.res_initial_states to service_role;

drop policy if exists res_transitions_read on public.res_transitions;
create policy res_transitions_read on public.res_transitions
  for select to authenticated using (true);
drop policy if exists res_initial_states_read on public.res_initial_states;
create policy res_initial_states_read on public.res_initial_states
  for select to authenticated using (true);

-- ── 2. Guards ──────────────────────────────────────────────────────────────
-- Named in lifecycle.ts, evaluated here. A guard answers one question: may
-- THIS actor make THIS move on THIS row? Unknown guard names raise rather
-- than defaulting to permitted — failing closed is the whole point.
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

    -- Safety-critical: a scheduled job may auto-close an alert ONLY when it is
    -- not critical. A critical alert that times out escalates to a human
    -- instead. The cost of silently closing a real emergency is not symmetric
    -- with the cost of leaving a false one open.
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

    -- Review authority. Until a reviewer role exists, only the operator path
    -- (service_role, tier-checked by the Guard) satisfies this.
    when 'isReviewer' then
      v_ok := p_actor_kind in ('operator', 'system');

    else
      raise exception 'res_transition_guard: unknown guard %', p_guard;
  end case;

  return coalesce(v_ok, false);
end;
$$;

-- ── 3. The one door ────────────────────────────────────────────────────────
create or replace function public.res_transition(
  p_entity     text,
  p_id         uuid,
  p_to         text,
  p_reason     text,
  p_actor_kind text default 'user',
  p_job        text default null,
  p_correlation uuid default null,
  p_tier       text default null
) returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_from   text;
  v_rule   res_transitions%rowtype;
  v_actor  uuid := auth.uid();
  v_before jsonb;
  v_after  jsonb;
  v_audit  bigint;
begin
  if p_reason is null or length(trim(p_reason)) = 0 then
    raise exception 'res_transition: a reason is required';
  end if;

  -- Only these tables are addressable, and the name is validated against the
  -- rule table before it ever reaches format() — this function takes a table
  -- name as text, so that check is what stands between it and SQL injection.
  if not exists (select 1 from res_transitions where entity = p_entity) then
    raise exception 'res_transition: % is not a modelled entity', p_entity;
  end if;

  -- Lock the row for the duration, so two concurrent transitions cannot both
  -- read the same from-state and both consider themselves legal.
  execute format('select status, to_jsonb(t) from public.%I t where id = $1 for update', p_entity)
    into v_from, v_before using p_id;

  if v_from is null then
    raise exception 'res_transition: % % not found', p_entity, p_id;
  end if;

  if v_from = p_to then
    -- Idempotent no-op: a retried job finding its work already done is a
    -- success, not an error.
    return jsonb_build_object('entity', p_entity, 'id', p_id, 'state', v_from, 'changed', false);
  end if;

  select * into v_rule from res_transitions
   where entity = p_entity and from_state = v_from and to_state = p_to;

  if not found then
    raise exception 'res_transition: % -> % is not a legal move for % (row %)',
      v_from, p_to, p_entity, p_id;
  end if;

  if not (p_actor_kind = any(v_rule.actors)) then
    raise exception 'res_transition: % may not move % from % to % (allowed: %)',
      p_actor_kind, p_entity, v_from, p_to, v_rule.actors;
  end if;

  if not res_transition_guard(v_rule.guard, p_entity, p_id, v_actor, p_actor_kind) then
    raise exception 'res_transition: guard % refused % on % %',
      v_rule.guard, p_actor_kind, p_entity, p_id;
  end if;

  -- managed_by records whether automation or a human last touched the row.
  execute format(
    'update public.%I set status = $1, managed_by = $2 where id = $3 returning to_jsonb(%I)',
    p_entity, p_entity)
    into v_after
    using p_to, case when p_actor_kind = 'user' then null else coalesce(p_job, p_actor_kind) end, p_id;

  v_audit := res_audit(
    p_actor_kind   => p_actor_kind,
    p_action       => p_entity || '.' || p_to,
    p_entity       => p_entity,
    p_entity_id    => p_id,
    p_reason       => p_reason,
    p_before       => jsonb_build_object('status', v_from),
    p_after        => jsonb_build_object('status', p_to),
    p_job_name     => p_job,
    p_actor_id     => v_actor,
    p_correlation  => p_correlation,
    p_tier         => p_tier,
    p_reversible   => v_rule.reversible,
    p_reverse_spec => case when v_rule.reversible
                           then jsonb_build_object('status', v_from) else null end);

  return jsonb_build_object(
    'entity', p_entity, 'id', p_id, 'state', p_to,
    'from', v_from, 'changed', true, 'audit_id', v_audit);
end;
$$;

revoke execute on function public.res_transition(text,uuid,text,text,text,text,uuid,text) from public, anon;
revoke execute on function public.res_transition_guard(text,text,uuid,uuid,text) from public, anon;

grant execute on function public.res_transition(text,uuid,text,text,text,text,uuid,text) to authenticated, service_role;
grant execute on function public.res_transition_guard(text,text,uuid,uuid,text) to authenticated, service_role;

-- A user calling this directly may only ever act as themselves. Passing
-- p_actor_kind = 'job' from a client would otherwise be a privilege escalation
-- straight past every guard in the table.
create or replace function public.res_transition_user(
  p_entity text, p_id uuid, p_to text, p_reason text
) returns jsonb
language sql security invoker
set search_path = public
as $$
  select public.res_transition(p_entity, p_id, p_to, p_reason, 'user', null, null, null);
$$;

revoke execute on function public.res_transition(text,uuid,text,text,text,text,uuid,text) from authenticated;
grant execute on function public.res_transition_user(text,uuid,text,text) to authenticated;
grant execute on function public.res_transition_user(text,uuid,text,text) to service_role;

comment on function public.res_transition is
  'The only supported path for changing a status column. Service-role/internal; clients use res_transition_user.';
