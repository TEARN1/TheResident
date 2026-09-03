-- theresident_area_broadcast_send_schema.sql
--
-- Phase D of docs/OFFICIAL-BROADCAST-STRATEGY.md: actually send to an area,
-- deliver it, and keep a permanent public record of what was sent.
--
-- THE RECORD IS HALF THE FEATURE. Every area broadcast is stored with who
-- sent it, what area it covered, how many people it reached and when — and
-- that row is readable by everyone, forever. This is the same instinct as the
-- Service Desk's "how long did they take to fix it": an official who can
-- reach thousands of residents unprompted should be answerable for how often
-- they do it and what they said. It is not an audit log hidden in a table
-- nobody reads; it is shown on the sender's profile.
--
-- THE CLIENT NEVER HANDS US A SHAPE. The send RPC takes a jurisdiction id, or
-- a point and a radius — never geography. Phase C's preview accepts a
-- geography argument because the containment gate makes that safe, but a send
-- is a write, and the smaller surface is the right one for a write.
--
-- Paste into the Supabase SQL editor. Additive only.

-- ── 1. THE SUBURB NAMES AN AREA ACTUALLY CONTAINS ──────────────────────────
--
-- The text fallback (reaching residents who never dropped a pin, by the
-- suburb they typed) needs to know what the suburbs inside a ward are called.
-- Nothing in the boundary data carries that, so the pinned residents tell us:
-- the suburb names on home areas inside the target ARE the names of the
-- suburbs inside the target. No new data, no gazetteer to maintain, and it
-- improves on its own as more residents pin.
--
-- Returns place names, never people. Still service_role-only, because "list
-- the suburbs inside this polygon" is one join away from being useful to
-- someone probing where the pins are.
create or replace function public.res_area_place_names(p_target geography)
returns table (suburbs text[], cities text[])
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce(array_agg(distinct h.suburb) filter (where h.suburb is not null and trim(h.suburb) <> ''), '{}'),
    coalesce(array_agg(distinct h.city) filter (where h.city is not null and trim(h.city) <> ''), '{}')
  from res_home_areas h
  where p_target is not null
    and ST_Covers(p_target, ST_MakePoint(h.lon, h.lat)::geography);
$$;

revoke all on function public.res_area_place_names(geography) from public, anon, authenticated;
grant execute on function public.res_area_place_names(geography) to service_role;

-- ── 2. THE PUBLIC RECORD ───────────────────────────────────────────────────

create table if not exists public.res_area_broadcasts (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.res_org_units(id) on delete cascade,
  sender_id uuid not null,
  -- What was targeted, kept in both forms: the geometry for the record, and
  -- a human label because "Ward 12" is what a resident needs to read.
  target geography(Geometry, 4326) not null,
  target_kind text not null check (target_kind in ('jurisdiction', 'radius')),
  jurisdiction_id uuid references public.res_jurisdictions(id) on delete set null,
  target_label text not null,
  radius_metres double precision,
  priority text not null default 'important'
    check (priority in ('normal', 'important', 'urgent', 'critical')),
  category text,
  title text not null,
  body text not null,
  -- Counted at send time and frozen. The audience moves as residents pin and
  -- unpin; what matters for the record is how many this actually went to.
  recipient_count integer not null default 0,
  pinned_count integer not null default 0,
  text_matched_count integer not null default 0,
  sent_at timestamptz not null default now(),
  expires_at timestamptz
);

create index if not exists res_area_broadcasts_unit_idx
  on public.res_area_broadcasts (unit_id, sent_at desc);
create index if not exists res_area_broadcasts_target_idx
  on public.res_area_broadcasts using gist (target);

alter table public.res_area_broadcasts enable row level security;

-- Deliberately world-readable to signed-in users. See the header: the record
-- of who broadcast to whom is the accountability half of this feature, so it
-- is not scoped to recipients.
drop policy if exists res_area_broadcasts_select on public.res_area_broadcasts;
create policy res_area_broadcasts_select on public.res_area_broadcasts
  for select to authenticated using (true);

-- No insert/update/delete policy at all: rows appear only through the send
-- RPC below, and nothing may edit or erase what was said afterwards.

-- Two separate facts, both learned the hard way on the live project:
--   1. A policy alone grants nothing. Without a GRANT the "permanent public
--      record" is readable by no one.
--   2. Supabase's default privileges hand anon and authenticated ALL on every
--      newly created table — including UPDATE and DELETE — so the grants this
--      file wants must be stated by REVOKING first and granting back. Adding
--      only the grant leaves the rest quietly open.
-- SELECT only, deliberately: the absent INSERT/UPDATE/DELETE grants are the
-- second lock behind the absent RLS policies, so an official cannot soften or
-- erase what they broadcast even if a policy is ever loosened by mistake.
revoke all on public.res_area_broadcasts from anon, authenticated;
grant select on public.res_area_broadcasts to authenticated;

create table if not exists public.res_area_broadcast_receipts (
  broadcast_id uuid not null references public.res_area_broadcasts(id) on delete cascade,
  user_id uuid not null,
  seen_at timestamptz,
  acknowledged_at timestamptz,
  primary key (broadcast_id, user_id)
);

alter table public.res_area_broadcast_receipts enable row level security;

drop policy if exists res_area_receipts_select on public.res_area_broadcast_receipts;
create policy res_area_receipts_select on public.res_area_broadcast_receipts
  for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists res_area_receipts_insert on public.res_area_broadcast_receipts;
create policy res_area_receipts_insert on public.res_area_broadcast_receipts
  for insert to authenticated with check (user_id = (select auth.uid()));

drop policy if exists res_area_receipts_update on public.res_area_broadcast_receipts;
create policy res_area_receipts_update on public.res_area_broadcast_receipts
  for update to authenticated using (user_id = (select auth.uid()));

revoke all on public.res_area_broadcast_receipts from anon, authenticated;
grant select, insert, update on public.res_area_broadcast_receipts to authenticated;

-- ── 3. DAILY CAPS BY LEVEL ─────────────────────────────────────────────────
--
-- The strategy's shape: a councillor may send more, smaller messages; a
-- premier fewer, larger ones. Reach and frequency trade off against each
-- other, so that "everyone in the province" is never routine.
create or replace function public.res_area_daily_cap(p_level text)
returns integer
language sql
immutable
set search_path = public
as $$
  select case p_level
    when 'ward' then 10
    when 'service_area' then 10
    when 'municipality' then 6
    when 'district' then 4
    when 'province' then 3
    when 'national' then 2
    else 4
  end;
$$;

revoke all on function public.res_area_daily_cap(text) from public, anon;
grant execute on function public.res_area_daily_cap(text) to authenticated, service_role;

-- ── 4. THE SEND ────────────────────────────────────────────────────────────

create or replace function public.res_send_area_broadcast(
  p_unit uuid,
  p_title text,
  p_body text,
  p_priority text default 'important',
  p_category text default null,
  p_jurisdiction uuid default null,
  p_lat double precision default null,
  p_lon double precision default null,
  p_metres double precision default null,
  p_expires_at timestamptz default null
)
returns public.res_area_broadcasts
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_target geography;
  v_kind text;
  v_label text;
  v_level text;
  v_reason text;
  v_unit_name text;
  v_verified boolean;
  v_places record;
  v_sent_today integer;
  v_cap integer;
  v_row public.res_area_broadcasts;
begin
  if v_uid is null then raise exception 'not signed in'; end if;
  if coalesce(trim(p_title), '') = '' or coalesce(trim(p_body), '') = '' then
    raise exception 'empty_broadcast';
  end if;
  if not public.res_user_is_sender_of_or_above(p_unit, v_uid) then
    raise exception 'not_a_sender_for_this_unit';
  end if;

  select name, verified into v_unit_name, v_verified from res_org_units where id = p_unit;
  -- Redundant with the containment gate below, which also checks verified —
  -- stated separately because impersonating an official is the single largest
  -- risk in this feature and it deserves to fail on its own line.
  if not coalesce(v_verified, false) then
    raise exception 'not_verified';
  end if;

  -- Build the target server-side from a specification, never from a shape
  -- handed over by the caller.
  if p_jurisdiction is not null then
    select boundary, name, level into v_target, v_label, v_level
    from res_jurisdictions where id = p_jurisdiction;
    if v_target is null then raise exception 'unknown_jurisdiction'; end if;
    v_kind := 'jurisdiction';
  elsif p_lat is not null and p_lon is not null then
    v_target := public.res_radius_target(p_lat, p_lon, coalesce(p_metres, 3000));
    v_kind := 'radius';
    v_label := 'Within ' || round(least(greatest(coalesce(p_metres, 3000), 50), 50000))::text || 'm of a point';
    -- A radius is rated at the level of the area it was drawn inside, so a
    -- 50km circle cannot be used to dodge a province's daily cap.
    select j.level into v_level
    from res_org_units u join res_jurisdictions j on j.id = u.jurisdiction_id
    where u.id = p_unit;
  else
    raise exception 'no_target';
  end if;

  -- The Phase B gate. Geometry decides, not rank.
  v_reason := public.res_area_broadcast_block_reason(p_unit, v_target);
  if v_reason is not null then
    raise exception 'area_blocked: %', v_reason;
  end if;

  -- Two limiters: the generic burst limit, then the per-level daily cap.
  -- Billing (Phase F). A 'critical' notice is NEVER gated: an evacuation
  -- must send whether or not anyone paid. Everything below it needs a live
  -- licence — probation, active or exempt. Defined in
  -- theresident_area_billing_schema.sql; if that file is not applied, the
  -- undefined_function branch leaves sending open, which is the correct
  -- failure direction for a feature that already worked before billing.
  if p_priority <> 'critical' then
    begin
      perform public.res_ensure_area_probation(p_unit);
      -- coalesce is load-bearing: res_area_billing_state is sender-scoped, so
      -- it returns NO ROWS rather than false if the scoping ever fails to
      -- match. `not (select ...)` on an empty result is NULL, and `if NULL`
      -- does not fire — which would fail OPEN. Default to refusing instead.
      if not coalesce((select allows_routine from public.res_area_billing_state(p_unit)), false) then
        raise exception 'area_licence_required: this office has no active area-messaging licence';
      end if;
    exception
      when undefined_function then null;
    end;
  end if;

  perform public.res_check_rate_limit('area_broadcast', 5, 3600);

  v_cap := public.res_area_daily_cap(v_level);
  select count(*) into v_sent_today
  from res_area_broadcasts
  where unit_id = p_unit and sent_at > now() - interval '24 hours';
  if v_sent_today >= v_cap then
    raise exception 'daily_cap_reached: % per day at this level', v_cap;
  end if;

  select * into v_places from public.res_area_place_names(v_target);

  insert into res_area_broadcasts (
    unit_id, sender_id, target, target_kind, jurisdiction_id, target_label,
    radius_metres, priority, category, title, body, expires_at
  ) values (
    p_unit, v_uid, v_target, v_kind, p_jurisdiction, v_label,
    case when v_kind = 'radius' then least(greatest(coalesce(p_metres, 3000), 50), 50000) end,
    p_priority, p_category, trim(p_title), trim(p_body), p_expires_at
  ) returning * into v_row;

  -- Resolve once, into a temp set: the counts written to the record and the
  -- notifications delivered must be the same people, not two queries that
  -- could disagree if someone pins a home area mid-send.
  create temp table if not exists _area_audience (user_id uuid, matched_by text) on commit drop;
  delete from _area_audience;
  insert into _area_audience
  select a.user_id, a.matched_by
  from public.res_resolve_area_audience(
    v_target, p_priority, p_category, v_places.suburbs, v_places.cities
  ) a
  where a.user_id <> v_uid;

  select count(*) filter (where matched_by = 'home_area'),
         count(*) filter (where matched_by = 'suburb_text'),
         count(*)
    into v_row.pinned_count, v_row.text_matched_count, v_row.recipient_count
  from _area_audience;

  -- A runaway fan-out is indistinguishable from an attack on the shared rail.
  -- Refuse loudly; the whole send rolls back, record included.
  if v_row.recipient_count > 20000 then
    raise exception 'audience_too_large: % recipients — contact support to send at this scale', v_row.recipient_count;
  end if;

  update res_area_broadcasts
     set pinned_count = v_row.pinned_count,
         text_matched_count = v_row.text_matched_count,
         recipient_count = v_row.recipient_count
   where id = v_row.id;

  -- 'normal' stays in the feed and off the bell, matching the follow-based
  -- broadcasts. Escalation has to be deliberate.
  if p_priority <> 'normal' then
    insert into notifications (recipient_id, actor_id, type, title, body, message, data, action_url, read, is_read, expires_at)
    select
      a.user_id,
      v_uid,
      'res_area_broadcast',
      coalesce(v_unit_name, 'Notice') || ': ' || trim(p_title),
      trim(p_body),
      trim(p_body),
      jsonb_build_object(
        'priority', p_priority,
        'requires_ack', p_priority = 'critical',
        'area_broadcast_id', v_row.id,
        'unit_id', p_unit,
        'category', p_category,
        'target_label', v_label,
        'matched_by', a.matched_by
      ),
      '/dashboard/community?tab=notices&area=' || v_row.id::text,
      false,
      false,
      p_expires_at
    from _area_audience a;

    -- Mirror it out to devices. Defined in
    -- theresident_web_push_dispatch_schema.sql and deliberately incapable of
    -- failing the send: if push is not configured it returns 0 and the notice
    -- is still in the rail. Apply that file after this one.
    begin
      perform public.res_push_area_broadcast(v_row.id);
    exception when undefined_function then
      -- Push dispatch not installed yet. In-app delivery already happened.
      null;
    end;
  end if;

  return v_row;
end;
$$;

revoke all on function public.res_send_area_broadcast(uuid, text, text, text, text, uuid, double precision, double precision, double precision, timestamptz) from public, anon;
grant execute on function public.res_send_area_broadcast(uuid, text, text, text, text, uuid, double precision, double precision, double precision, timestamptz) to authenticated, service_role;

-- ── 5. ACKNOWLEDGING ───────────────────────────────────────────────────────

create or replace function public.res_ack_area_broadcast(p_broadcast uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  insert into res_area_broadcast_receipts (broadcast_id, user_id, seen_at, acknowledged_at)
  values (p_broadcast, auth.uid(), now(), now())
  on conflict (broadcast_id, user_id)
  do update set acknowledged_at = coalesce(res_area_broadcast_receipts.acknowledged_at, now()),
                seen_at = coalesce(res_area_broadcast_receipts.seen_at, now());
end;
$$;

revoke all on function public.res_ack_area_broadcast(uuid) from public, anon;
grant execute on function public.res_ack_area_broadcast(uuid) to authenticated, service_role;

-- ── 6. THE TRACK RECORD ────────────────────────────────────────────────────
--
-- What an official's send history looks like to anyone who cares to look.
-- Geometry is deliberately not returned — the label is what a resident reads,
-- and shipping polygons to every profile view is pointless weight.
create or replace function public.res_area_broadcast_history(p_unit uuid default null)
returns table (
  id uuid,
  unit_id uuid,
  unit_name text,
  target_label text,
  priority text,
  category text,
  title text,
  body text,
  recipient_count integer,
  sent_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select b.id, b.unit_id, u.name, b.target_label, b.priority, b.category,
         b.title, b.body, b.recipient_count, b.sent_at
  from res_area_broadcasts b
  join res_org_units u on u.id = b.unit_id
  where p_unit is null or b.unit_id = p_unit
  order by b.sent_at desc
  limit 100;
$$;

revoke all on function public.res_area_broadcast_history(uuid) from public, anon;
grant execute on function public.res_area_broadcast_history(uuid) to authenticated, service_role;

-- What a resident received. Self-scoped: reads the caller's own notifications
-- rail and nobody else's.
create or replace function public.res_my_area_notices()
returns table (
  id uuid,
  unit_name text,
  target_label text,
  priority text,
  category text,
  title text,
  body text,
  sent_at timestamptz,
  acknowledged_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select b.id, u.name, b.target_label, b.priority, b.category, b.title, b.body,
         b.sent_at, r.acknowledged_at
  from notifications n
  join res_area_broadcasts b on b.id = (n.data ->> 'area_broadcast_id')::uuid
  join res_org_units u on u.id = b.unit_id
  left join res_area_broadcast_receipts r
    on r.broadcast_id = b.id and r.user_id = auth.uid()
  where n.recipient_id = auth.uid()
    and n.type = 'res_area_broadcast'
  order by b.sent_at desc
  limit 100;
$$;

revoke all on function public.res_my_area_notices() from public, anon;
grant execute on function public.res_my_area_notices() to authenticated, service_role;
