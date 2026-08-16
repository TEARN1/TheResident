-- ═══════════════════════════════════════════════════════════════════════════
-- 20260815000700_faults — collective infrastructure fault reporting
--
-- One person saying "the power is out" is a complaint. Twenty neighbours
-- saying it independently, from twenty different houses, within the same hour
-- and the same few hundred metres, is EVIDENCE — something a utility can act
-- on and be held to.
--
-- Deliberately built WITHOUT an authority/verification layer. Residents get
-- value on day one whether or not a single utility ever signs up: they can see
-- how far an outage extends and how many households it affects, which is
-- already more than anyone can tell them today. Provider accounts reuse the
-- res_infra_providers / res_infra_partner_admins tables that already exist, so
-- a utility joining is an upgrade rather than a precondition.
--
-- The scoring rules live in src/utils/faults.ts (pure and unit-tested); this
-- migration owns storage, access, and the two write paths.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Faults ──────────────────────────────────────────────────────────────
create table if not exists public.res_faults (
  id             uuid primary key default gen_random_uuid(),

  kind           text not null check (kind in (
                   'power_outage','power_line_down','substation_damage',
                   'meter_box_damage','streetlight_out',
                   'water_outage','water_leak','burst_pipe','sewage_spill',
                   'refuse_uncollected','network_outage','road_damage')),
  sector         text not null check (sector in (
                   'electricity','water','sanitation','refuse','telecoms','roads')),

  title          text,
  detail         text,

  -- Point geometry so PostGIS can answer "how far does this outage extend"
  -- and "which faults are near me" without a full scan. lat/lon kept alongside
  -- for the existing client mappers, which read plain columns.
  geom           geometry(Point, 4326) not null,
  lat            double precision not null,
  lon            double precision not null,
  suburb         text,
  city           text,
  community_id   uuid references public.res_communities(id) on delete set null,

  reported_by    uuid not null references public.profiles(id) on delete cascade,

  status         text not null default 'reported',
  severity       int not null default 2 check (severity between 1 and 4),

  -- Denormalised evidence, recomputed by the escalation job. Cached rather
  -- than authoritative: res_fault_vouches is the source of truth, and the
  -- reconciler pattern repairs any drift.
  distinct_reporters int not null default 0,
  affected_count     int not null default 0,
  dispute_count      int not null default 0,
  weighted_score     numeric not null default 0,
  confidence         numeric not null default 0,
  priority           numeric not null default 0,

  -- Provider routing and the accountability record
  provider_id        uuid references public.res_infra_providers(id) on delete set null,
  escalated_at       timestamptz,
  acknowledged_at    timestamptz,
  provider_reference text,
  resolved_claimed_at timestamptz,
  verified_at        timestamptz,
  -- Set when residents reopen a fault a provider had claimed fixed. This is
  -- the single most valuable number in the table: it is a measured, evidenced
  -- record of a closure that was not real.
  false_closure_count int not null default 0,

  last_vouch_at  timestamptz not null default now(),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  archived_at    timestamptz,
  expires_at     timestamptz,
  managed_by     text
);

create index if not exists idx_res_faults_geom     on public.res_faults using gist (geom);
create index if not exists idx_res_faults_open     on public.res_faults (status, kind, created_at desc)
  where archived_at is null;
create index if not exists idx_res_faults_provider on public.res_faults (provider_id, status)
  where archived_at is null;
create index if not exists idx_res_faults_suburb   on public.res_faults (suburb, created_at desc);

drop trigger if exists trg_touch_res_faults on public.res_faults;
create trigger trg_touch_res_faults before update on public.res_faults
  for each row execute function public.touch_updated_at();

-- ── 2. Vouches ─────────────────────────────────────────────────────────────
-- One row per person per fault. The unique constraint IS the anti-gaming
-- mechanism: a person may change their mind, but they cannot vote twice.
create table if not exists public.res_fault_vouches (
  id          uuid primary key default gen_random_uuid(),
  fault_id    uuid not null references public.res_faults(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  kind        text not null check (kind in ('affected','witnessed','disputed','resolved')),

  -- Where the voucher was when they vouched, and how far that was from the
  -- fault. Stored at vouch time so the weighting is reproducible later and
  -- cannot be retro-fitted by moving the fault.
  lat         double precision,
  lon         double precision,
  distance_m  numeric,

  note        text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  unique (fault_id, user_id)
);

create index if not exists idx_res_fault_vouches_fault on public.res_fault_vouches (fault_id, created_at desc);

drop trigger if exists trg_touch_res_fault_vouches on public.res_fault_vouches;
create trigger trg_touch_res_fault_vouches before update on public.res_fault_vouches
  for each row execute function public.touch_updated_at();

-- ── 3. Policy knobs ────────────────────────────────────────────────────────
-- Mirrors DEFAULT_POLICY in src/utils/faults.ts. A dense informal settlement
-- and a low-density suburb need different radii and only an operator knows
-- which is which, so this is tunable without a deploy.
insert into public.res_policies (key, description, params, enabled) values
(
  'faults.escalation',
  'Evidence required before a fault is sent to a provider. Mirrors DEFAULT_POLICY in src/utils/faults.ts.',
  '{"minDistinctReporters": 5, "minWeightedScore": 4.0, "windowHours": 6,
    "radiusM": 400, "maxVoucherWeight": 1.5, "disputeRatioAbort": 0.4}'::jsonb,
  true
),
(
  'faults.proximity',
  'A voucher must be within this many metres of the fault at the time of vouching. Converts a trivial remote attack into an effortful physical one.',
  '{"maxVouchDistanceM": 400, "requireLocation": true}'::jsonb,
  true
),
(
  'faults.lapse',
  'A fault nobody re-confirms is almost certainly fixed. Confidence half-life in hours, and the floor below which it lapses.',
  '{"halfLifeHours": 24, "lapseBelowConfidence": 0.05, "lapseAfterHours": 72}'::jsonb,
  true
)
on conflict (key) do nothing;

-- ── 4. Row level security ──────────────────────────────────────────────────
alter table public.res_faults        enable row level security;
alter table public.res_fault_vouches enable row level security;

-- Faults are readable by every signed-in user. An outage is public
-- information about shared infrastructure — the whole point is that the
-- neighbourhood can see it. Archived rows are hidden.
drop policy if exists res_faults_select on public.res_faults;
create policy res_faults_select on public.res_faults
  for select to authenticated using (archived_at is null);

drop policy if exists res_faults_insert on public.res_faults;
create policy res_faults_insert on public.res_faults
  for insert to authenticated with check (reported_by = auth.uid());

-- No direct client UPDATE. Status moves go through res_transition() and the
-- counters are the escalation job's to maintain — if clients could write them,
-- the evidence would be self-reported and worthless.
drop policy if exists res_faults_update on public.res_faults;

drop policy if exists res_fault_vouches_select on public.res_fault_vouches;
create policy res_fault_vouches_select on public.res_fault_vouches
  for select to authenticated using (true);

-- Vouches are written only through res_vouch_fault(), which enforces the
-- proximity gate. A direct insert policy would let a client bypass it.
drop policy if exists res_fault_vouches_insert on public.res_fault_vouches;

-- ── 5. Report a fault ──────────────────────────────────────────────────────
-- Clusters into an existing nearby fault of the same kind rather than creating
-- a duplicate, and records the reporter's own vouch in the same transaction.
-- Without clustering, twenty neighbours produce twenty single-voucher faults,
-- none of which ever reaches a threshold — the exact opposite of the intent.
create or replace function public.res_report_fault(
  p_kind text,
  p_lat double precision,
  p_lon double precision,
  p_detail text default null,
  p_suburb text default null,
  p_city text default null
) returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_user    uuid := auth.uid();
  v_sector  text;
  v_policy  jsonb;
  v_radius  numeric;
  v_window  int;
  v_point   geometry;
  v_fault   record;
  v_joined  boolean := false;
  v_recent  int;
begin
  if v_user is null then
    raise exception 'not signed in';
  end if;
  if p_lat is null or p_lon is null then
    raise exception 'a fault needs a location';
  end if;
  if p_lat not between -90 and 90 or p_lon not between -180 and 180 then
    raise exception 'invalid coordinates';
  end if;

  v_sector := case p_kind
    when 'power_outage' then 'electricity'
    when 'power_line_down' then 'electricity'
    when 'substation_damage' then 'electricity'
    when 'meter_box_damage' then 'electricity'
    when 'streetlight_out' then 'electricity'
    when 'water_outage' then 'water'
    when 'water_leak' then 'water'
    when 'burst_pipe' then 'water'
    when 'sewage_spill' then 'sanitation'
    when 'refuse_uncollected' then 'refuse'
    when 'network_outage' then 'telecoms'
    when 'road_damage' then 'roads'
    else null end;

  if v_sector is null then
    raise exception 'unknown fault kind %', p_kind;
  end if;

  -- Rate limit: reporting is meant to be effortless, but not unlimited.
  select count(*) into v_recent from res_faults
   where reported_by = v_user and created_at > now() - interval '1 hour';
  if v_recent >= 5 then
    raise exception 'too many fault reports in the last hour';
  end if;

  select params into v_policy from res_policies where key = 'faults.escalation';
  v_radius := coalesce((v_policy->>'radiusM')::numeric, 400);
  v_window := coalesce((v_policy->>'windowHours')::int, 6);

  v_point := st_setsrid(st_makepoint(p_lon, p_lat), 4326);

  -- Nearest open fault of the same kind, inside the radius and the window.
  select f.* into v_fault
    from res_faults f
   where f.kind = p_kind
     and f.archived_at is null
     and f.status not in ('resolved','verified','lapsed','rejected')
     and f.created_at > now() - make_interval(hours => v_window)
     and st_dwithin(f.geom::geography, v_point::geography, v_radius)
   order by st_distance(f.geom::geography, v_point::geography) asc,
            f.created_at asc
   limit 1;

  if found then
    v_joined := true;
  else
    insert into res_faults (kind, sector, detail, geom, lat, lon, suburb, city,
                            reported_by, severity)
    values (p_kind, v_sector, p_detail, v_point, p_lat, p_lon, p_suburb, p_city,
            v_user,
            case when p_kind in ('power_line_down','substation_damage','sewage_spill')
                 then 4 else 2 end)
    returning * into v_fault;

    perform res_audit('user', 'fault.report', 'res_faults', v_fault.id,
      format('new %s fault reported', p_kind), null,
      jsonb_build_object('kind', p_kind, 'lat', p_lat, 'lon', p_lon),
      null, v_user, null, null, false, null);
  end if;

  -- The reporter's own vouch. They are affected by definition.
  perform res_vouch_fault(v_fault.id, 'affected', p_lat, p_lon, p_detail);

  return jsonb_build_object(
    'fault_id', v_fault.id,
    'joined_existing', v_joined,
    'status', v_fault.status,
    'kind', v_fault.kind);
end;
$$;

-- ── 6. Vouch for a fault ───────────────────────────────────────────────────
-- The proximity gate lives here. It does not make remote gaming impossible —
-- coordinates can be falsified — but it converts a trivial armchair attack
-- into one requiring physical presence, which removes nearly all of it.
create or replace function public.res_vouch_fault(
  p_fault_id uuid,
  p_kind text,
  p_lat double precision default null,
  p_lon double precision default null,
  p_note text default null
) returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_user     uuid := auth.uid();
  v_fault    record;
  v_policy   jsonb;
  v_max_d    numeric;
  v_require  boolean;
  v_distance numeric;
  v_prev     text;
begin
  if v_user is null then
    raise exception 'not signed in';
  end if;
  if p_kind not in ('affected','witnessed','disputed','resolved') then
    raise exception 'unknown vouch kind %', p_kind;
  end if;

  select * into v_fault from res_faults where id = p_fault_id and archived_at is null;
  if not found then
    raise exception 'fault not found';
  end if;

  select params into v_policy from res_policies where key = 'faults.proximity';
  v_max_d   := coalesce((v_policy->>'maxVouchDistanceM')::numeric, 400);
  v_require := coalesce((v_policy->>'requireLocation')::boolean, true);

  if p_lat is not null and p_lon is not null then
    select st_distance(v_fault.geom::geography,
                       st_setsrid(st_makepoint(p_lon, p_lat), 4326)::geography)
      into v_distance;

    if v_distance > v_max_d then
      raise exception
        'you are %m from this fault; vouching is limited to %m so that reports come from people who can actually see it',
        round(v_distance), v_max_d;
    end if;
  elsif v_require then
    raise exception 'location is required to vouch for a fault';
  end if;

  select kind into v_prev from res_fault_vouches
   where fault_id = p_fault_id and user_id = v_user;

  -- One vouch per person. Changing your mind updates; it never adds a second
  -- voice.
  insert into res_fault_vouches (fault_id, user_id, kind, lat, lon, distance_m, note)
  values (p_fault_id, v_user, p_kind, p_lat, p_lon, v_distance, p_note)
  on conflict (fault_id, user_id) do update
    set kind = excluded.kind, lat = excluded.lat, lon = excluded.lon,
        distance_m = excluded.distance_m, note = excluded.note;

  update res_faults set last_vouch_at = now() where id = p_fault_id;

  perform res_audit('user',
    case when v_prev is null then 'fault.vouch' else 'fault.vouch_changed' end,
    'res_faults', p_fault_id,
    format('%s vouched %s%s', v_user, p_kind,
           case when v_prev is null then '' else format(' (was %s)', v_prev) end),
    case when v_prev is null then null else jsonb_build_object('kind', v_prev) end,
    jsonb_build_object('kind', p_kind, 'distance_m', round(coalesce(v_distance, 0))),
    null, v_user, null, null, false, null);

  return jsonb_build_object('fault_id', p_fault_id, 'kind', p_kind,
                            'distance_m', round(coalesce(v_distance, 0)));
end;
$$;

-- ── 7. Provider-side read ──────────────────────────────────────────────────
-- What a utility sees: their sector's live faults, ordered by priority, with
-- the evidence attached. No personal data about reporters — a provider needs
-- to know that 23 households are affected, never which 23.
create or replace function public.res_provider_queue(p_provider uuid)
returns table (
  id uuid, kind text, sector text, status text, lat double precision, lon double precision,
  suburb text, distinct_reporters int, affected_count int, weighted_score numeric,
  priority numeric, created_at timestamptz, escalated_at timestamptz,
  acknowledged_at timestamptz, provider_reference text, false_closure_count int
)
language sql stable security definer
set search_path = public
as $$
  select f.id, f.kind, f.sector, f.status, f.lat, f.lon, f.suburb,
         f.distinct_reporters, f.affected_count, f.weighted_score,
         f.priority, f.created_at, f.escalated_at, f.acknowledged_at,
         f.provider_reference, f.false_closure_count
    from res_faults f
   where f.archived_at is null
     and f.status in ('escalated','acknowledged','in_progress')
     and exists (
       select 1 from res_infra_partner_admins a
        where a.provider_id = p_provider and a.user_id = auth.uid())
     and (f.provider_id = p_provider or f.provider_id is null)
   order by f.priority desc, f.created_at asc;
$$;

-- ── 8. Grants (default-deny — CONTRACT.md §5) ──────────────────────────────
revoke execute on function public.res_report_fault(text,double precision,double precision,text,text,text) from public, anon;
revoke execute on function public.res_vouch_fault(uuid,text,double precision,double precision,text) from public, anon;
revoke execute on function public.res_provider_queue(uuid) from public, anon;

grant execute on function public.res_report_fault(text,double precision,double precision,text,text,text) to authenticated, service_role;
grant execute on function public.res_vouch_fault(uuid,text,double precision,double precision,text) to authenticated, service_role;
grant execute on function public.res_provider_queue(uuid) to authenticated, service_role;

comment on table public.res_faults is
  'Collective infrastructure faults. Evidence is res_fault_vouches; the counters here are a cache maintained by the escalate_faults job.';
comment on column public.res_faults.false_closure_count is
  'Times residents reopened this after a provider claimed it fixed. An evidenced record of closures that were not real.';
