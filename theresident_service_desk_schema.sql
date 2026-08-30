-- theresident_service_desk_schema.sql
--
-- The Service Desk: residents report an infrastructure fault to the
-- organisation responsible for fixing it, and the app measures how long that
-- organisation actually takes.
--
-- WHY THIS EXISTS, AND WHY IT IS NOT A DUPLICATE OF WHAT WE ALREADY HAVE:
--   • res_neighbourhood_status answers "is the power out right now?" (a live
--     crowd signal, 8h minimum window, mirrored onto the map).
--   • map_zones answers "is this road blocked?" (transient hazards, votes).
--   • res_service_reports answers "WHO owes me a fix, and HOW LONG are they
--     taking?" — a durable, referenced, measured record. Different question,
--     different lifetime, different audience.
--
-- DESIGN NOTE — this is deliberately NOT an escalation/warning system. The
-- brief was explicit: "the company must know how long it takes for them to fix
-- a problem." So every status transition is timestamped and the aggregate is
-- published per provider (median time to acknowledge, median time to resolve,
-- oldest open). An overdue report is stated as a fact, not as a threat the app
-- has no power to carry out.
--
-- WORKS WITHOUT PROVIDER BUY-IN. No municipality or ISP will have an account on
-- day one. A report is useful immediately — it gets a reference, neighbours
-- corroborate it, the clock runs — and simply gets richer if a provider ever
-- claims their record through res_infra_partner_admins (which already exists
-- live).
--
-- Paste into the Supabase SQL editor. Additive only: no existing table, column,
-- policy or function is dropped or altered destructively.

-- ── 1. WHERE THE REPORTER LIVES ────────────────────────────────────────────
-- res_profiles has no location today, so "my neighbours' reports" has nothing
-- to match on. This is the same trap theresident_safety_scoping.sql fell into:
-- narrowing reads to a column nothing ever writes makes rows invisible. Here
-- the submit RPC below backfills these from the report itself, so the column
-- populates as a side effect of the first report rather than needing a
-- migration or a new onboarding step.
alter table public.res_profiles
  add column if not exists suburb text,
  add column if not exists city text;

-- ── 2. TABLES ──────────────────────────────────────────────────────────────

create sequence if not exists public.res_service_report_ref_seq;

create table if not exists public.res_service_reports (
  id uuid primary key default uuid_generate_v4(),
  -- Human-quotable on the phone to a call centre: "reference SR-2026-00042".
  reference text unique not null,
  reporter_id uuid references public.profiles(id) on delete cascade not null,

  -- Optional: the provider is a nice-to-have, not a requirement. A resident
  -- knows the sewer is overflowing; they may not know which department owns it.
  provider_id uuid references public.res_infra_providers(id) on delete set null,
  -- What the resident typed when no provider record matched. Keeping the raw
  -- string means we can seed the directory from real demand later.
  provider_name_raw text,

  category text not null check (category in (
    'power', 'water', 'sewerage', 'network', 'fiber',
    'road', 'waste', 'streetlight', 'other'
  )),
  title text not null,
  detail text,
  severity text not null default 'medium'
    check (severity in ('low', 'medium', 'high', 'critical')),

  -- Required by the submit RPC — the visibility rule in §5 depends on it.
  suburb text,
  city text,
  lat double precision,
  lon double precision,

  status text not null default 'submitted' check (status in (
    'submitted', 'acknowledged', 'in_progress', 'resolved', 'closed', 'rejected'
  )),

  -- Snapshotted at submit time, NOT read live from a settings table: if the
  -- target for "sewerage/high" is retuned next year, an old report must still
  -- be judged against the promise that applied when it was filed.
  target_hours integer not null,

  -- The measurement columns. Every one is a real transition timestamp; all
  -- durations are derived from these, never stored pre-computed.
  acknowledged_at timestamptz,
  first_response_at timestamptz,
  resolved_at timestamptz,
  closed_at timestamptz,

  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

create table if not exists public.res_service_report_updates (
  id uuid primary key default uuid_generate_v4(),
  report_id uuid references public.res_service_reports(id) on delete cascade not null,
  -- null for rows written by the system rather than a person.
  author_id uuid references public.profiles(id) on delete set null,
  kind text not null check (kind in ('comment', 'status_change', 'system', 'corroboration')),
  body text,
  from_status text,
  to_status text,
  created_at timestamptz default now() not null
);

-- The "me too". This is the leverage: it turns one complaint into
-- "47 households, 3 weeks" without anyone having to organise a petition.
create table if not exists public.res_service_report_confirmations (
  id uuid primary key default uuid_generate_v4(),
  report_id uuid references public.res_service_reports(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  created_at timestamptz default now() not null,
  unique (report_id, user_id)
);

create index if not exists res_service_reports_suburb_idx  on public.res_service_reports (suburb, created_at desc);
create index if not exists res_service_reports_city_idx    on public.res_service_reports (city, created_at desc);
create index if not exists res_service_reports_provider_idx on public.res_service_reports (provider_id, status);
create index if not exists res_service_reports_reporter_idx on public.res_service_reports (reporter_id, created_at desc);
create index if not exists res_service_report_updates_idx  on public.res_service_report_updates (report_id, created_at);
create index if not exists res_service_report_confirm_idx  on public.res_service_report_confirmations (report_id);

-- ── 3. REFERENCE NUMBERS ───────────────────────────────────────────────────

create or replace function public.res_service_report_set_reference()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.reference is null or new.reference = '' then
    new.reference := 'SR-' || to_char(now(), 'YYYY') || '-'
                  || lpad(nextval('res_service_report_ref_seq')::text, 5, '0');
  end if;
  return new;
end;
$$;

drop trigger if exists res_service_reports_reference on public.res_service_reports;
create trigger res_service_reports_reference
  before insert on public.res_service_reports
  for each row execute function public.res_service_report_set_reference();

create or replace function public.res_service_report_touch()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists res_service_reports_touch on public.res_service_reports;
create trigger res_service_reports_touch
  before update on public.res_service_reports
  for each row execute function public.res_service_report_touch();

-- ── 4. RESPONSE-TIME TARGETS ───────────────────────────────────────────────
-- What counts as "taking too long", per category and severity. These are the
-- app's own stated expectations, not a legally binding SLA — the point is to
-- have a consistent yardstick so "slow" means the same thing every time.
-- Mirrored in src/utils/serviceReports.ts (defaultTargetHours) for the UI and
-- unit-tested there; this function is the authority.
create or replace function public.res_default_target_hours(p_category text, p_severity text)
returns integer
language sql
immutable
set search_path = public
as $$
  select case p_category
    when 'sewerage'   then case p_severity when 'critical' then 12 when 'high' then 24 when 'medium' then 48  else 72  end
    when 'water'      then case p_severity when 'critical' then 12 when 'high' then 24 when 'medium' then 48  else 72  end
    when 'power'      then case p_severity when 'critical' then 8  when 'high' then 24 when 'medium' then 48  else 72  end
    when 'network'    then case p_severity when 'critical' then 24 when 'high' then 48 when 'medium' then 72  else 120 end
    when 'fiber'      then case p_severity when 'critical' then 24 when 'high' then 48 when 'medium' then 72  else 120 end
    when 'road'       then case p_severity when 'critical' then 24 when 'high' then 72 when 'medium' then 168 else 336 end
    when 'waste'      then case p_severity when 'critical' then 24 when 'high' then 48 when 'medium' then 96  else 168 end
    when 'streetlight' then case p_severity when 'critical' then 48 when 'high' then 96 when 'medium' then 168 else 336 end
    else                    case p_severity when 'critical' then 24 when 'high' then 48 when 'medium' then 72  else 168 end
  end;
$$;

-- ── 5. ROW LEVEL SECURITY ──────────────────────────────────────────────────

alter table public.res_service_reports             enable row level security;
alter table public.res_service_report_updates      enable row level security;
alter table public.res_service_report_confirmations enable row level security;

-- True when the signed-in user should see reports for this suburb/city.
-- Deliberately a function so all three tables share one definition and it can
-- be tightened in one place.
create or replace function public.res_shares_locality(p_suburb text, p_city text)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from res_profiles rp
    where rp.id = auth.uid()
      and (
        (p_suburb is not null and rp.suburb is not null and lower(rp.suburb) = lower(p_suburb))
        or (p_city is not null and rp.city is not null and lower(rp.city) = lower(p_city))
      )
  );
$$;

-- True when the signed-in user is staff for the provider a report is aimed at.
create or replace function public.res_is_provider_admin(p_provider uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select p_provider is not null and exists (
    select 1 from res_infra_partner_admins a
    where a.provider_id = p_provider and a.user_id = auth.uid()
  );
$$;

grant execute on function public.res_shares_locality(text, text) to authenticated, service_role;
grant execute on function public.res_is_provider_admin(uuid) to authenticated, service_role;
grant execute on function public.res_default_target_hours(text, text) to authenticated, service_role;

-- NOTE the deliberate absence of a blanket "or (suburb is null and city is
-- null)" fallback here. theresident_safety_scoping.sql needed one because its
-- client never wrote those columns; res_submit_service_report below REQUIRES
-- both, so a report with neither cannot exist and no fallback is warranted.
drop policy if exists res_service_reports_select on public.res_service_reports;
create policy res_service_reports_select on public.res_service_reports
  for select to authenticated using (
    reporter_id = auth.uid()
    or public.res_is_provider_admin(provider_id)
    or public.res_shares_locality(suburb, city)
  );

-- Writes go exclusively through the security-definer RPCs in §6 so that
-- reference numbers, target snapshots, timeline rows and transition timestamps
-- can never be forged or skipped by a client.
drop policy if exists res_service_reports_insert on public.res_service_reports;
drop policy if exists res_service_reports_update on public.res_service_reports;

drop policy if exists res_service_report_updates_select on public.res_service_report_updates;
create policy res_service_report_updates_select on public.res_service_report_updates
  for select to authenticated using (
    exists (
      select 1 from res_service_reports r
      where r.id = res_service_report_updates.report_id
        and (
          r.reporter_id = auth.uid()
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
          r.reporter_id = auth.uid()
          or public.res_is_provider_admin(r.provider_id)
          or public.res_shares_locality(r.suburb, r.city)
        )
    )
  );

-- ── 6. RPCs ────────────────────────────────────────────────────────────────

create or replace function public.res_submit_service_report(
  p_category text,
  p_title text,
  p_detail text,
  p_severity text,
  p_suburb text,
  p_city text,
  p_provider uuid,
  p_provider_name_raw text,
  p_lat double precision,
  p_lon double precision
)
returns public.res_service_reports
language plpgsql security definer
set search_path = public
as $$
declare
  v_row res_service_reports;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if coalesce(trim(p_title), '') = '' then
    raise exception 'title_required: describe the problem in a few words';
  end if;
  if coalesce(trim(p_suburb), '') = '' or coalesce(trim(p_city), '') = '' then
    raise exception 'locality_required: we need the suburb and city so your neighbours can confirm it';
  end if;

  -- Reuse the existing generic limiter rather than adding another bespoke
  -- trigger. Raises 'rate_limit_exceeded: ...' which humanizeDbError maps.
  perform public.res_check_rate_limit('service_report', 5, 3600);

  insert into res_service_reports (
    reporter_id, provider_id, provider_name_raw, category, title, detail,
    severity, suburb, city, lat, lon, target_hours
  ) values (
    auth.uid(), p_provider, nullif(trim(coalesce(p_provider_name_raw, '')), ''),
    p_category, trim(p_title), nullif(trim(coalesce(p_detail, '')), ''),
    coalesce(p_severity, 'medium'), trim(p_suburb), trim(p_city), p_lat, p_lon,
    public.res_default_target_hours(p_category, coalesce(p_severity, 'medium'))
  )
  returning * into v_row;

  insert into res_service_report_updates (report_id, author_id, kind, body, to_status)
  values (v_row.id, auth.uid(), 'system', 'Report filed.', 'submitted');

  -- Teach the app where this resident lives, so neighbourhood visibility works
  -- for them from now on without a separate profile-editing chore.
  update res_profiles
     set suburb = coalesce(nullif(trim(suburb), ''), trim(p_suburb)),
         city   = coalesce(nullif(trim(city), ''), trim(p_city))
   where id = auth.uid();

  return v_row;
end;
$$;

create or replace function public.res_confirm_service_report(p_report uuid)
returns integer
language plpgsql security definer
set search_path = public
as $$
declare
  v_report res_service_reports;
  v_count integer;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;

  select * into v_report from res_service_reports where id = p_report;
  if not found then raise exception 'report_not_found'; end if;
  if v_report.reporter_id = auth.uid() then
    raise exception 'own_report: you filed this one — it already counts';
  end if;
  -- Only people who can see it may corroborate it.
  if not (public.res_is_provider_admin(v_report.provider_id)
          or public.res_shares_locality(v_report.suburb, v_report.city)) then
    raise exception 'not_your_area';
  end if;

  perform public.res_check_rate_limit('service_confirm', 30, 3600);

  insert into res_service_report_confirmations (report_id, user_id)
  values (p_report, auth.uid())
  on conflict (report_id, user_id) do nothing;

  select count(*) into v_count from res_service_report_confirmations where report_id = p_report;
  return v_count;
end;
$$;

create or replace function public.res_set_service_report_status(
  p_report uuid,
  p_status text,
  p_note text
)
returns public.res_service_reports
language plpgsql security definer
set search_path = public
as $$
declare
  v_report res_service_reports;
  v_is_provider boolean;
  v_is_reporter boolean;
  v_old_status text;
  v_now timestamptz := now();
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;

  select * into v_report from res_service_reports where id = p_report;
  if not found then raise exception 'report_not_found'; end if;
  -- Captured BEFORE the update below, which overwrites v_report via
  -- RETURNING — without this the timeline would record from_status and
  -- to_status as the same value.
  v_old_status := v_report.status;

  v_is_provider := public.res_is_provider_admin(v_report.provider_id);
  v_is_reporter := v_report.reporter_id = auth.uid();

  -- The reporter owns closing/reopening their own report (it was their problem,
  -- they know when it is actually fixed). Everything else is the provider's.
  if not v_is_provider and not (v_is_reporter and p_status in ('closed', 'submitted')) then
    raise exception 'not_your_report: only % can set that status',
      coalesce((select name from res_infra_providers where id = v_report.provider_id), 'the provider');
  end if;

  update res_service_reports
     set status = p_status,
         -- first_response_at is whenever the provider FIRST did anything at
         -- all, which is the number residents actually feel. It is set once
         -- and never moved.
         first_response_at = case
           when v_is_provider and first_response_at is null then v_now
           else first_response_at end,
         acknowledged_at = case
           when p_status = 'acknowledged' and acknowledged_at is null then v_now
           else acknowledged_at end,
         resolved_at = case
           when p_status = 'resolved' then v_now
           when p_status = 'submitted' then null   -- reopened
           else resolved_at end,
         closed_at = case
           when p_status = 'closed' then v_now
           when p_status = 'submitted' then null
           else closed_at end
   where id = p_report
   returning * into v_report;

  insert into res_service_report_updates (report_id, author_id, kind, body, from_status, to_status)
  values (p_report, auth.uid(), 'status_change', nullif(trim(coalesce(p_note, '')), ''),
          v_old_status, p_status);

  return v_report;
end;
$$;

create or replace function public.res_comment_service_report(p_report uuid, p_body text)
returns public.res_service_report_updates
language plpgsql security definer
set search_path = public
as $$
declare
  v_report res_service_reports;
  v_row res_service_report_updates;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if coalesce(trim(p_body), '') = '' then raise exception 'empty_comment'; end if;

  select * into v_report from res_service_reports where id = p_report;
  if not found then raise exception 'report_not_found'; end if;
  if not (v_report.reporter_id = auth.uid()
          or public.res_is_provider_admin(v_report.provider_id)
          or public.res_shares_locality(v_report.suburb, v_report.city)) then
    raise exception 'not_your_area';
  end if;

  perform public.res_check_rate_limit('service_comment', 20, 3600);

  insert into res_service_report_updates (report_id, author_id, kind, body)
  values (p_report, auth.uid(), 'comment', trim(p_body))
  returning * into v_row;

  -- A provider replying counts as their first response.
  if public.res_is_provider_admin(v_report.provider_id) and v_report.first_response_at is null then
    update res_service_reports set first_response_at = now() where id = p_report;
  end if;

  return v_row;
end;
$$;

-- ── 7. THE TRACK RECORD ────────────────────────────────────────────────────
-- "The company must know how long it takes for them to fix a problem."
-- security definer so it can aggregate across reports the caller cannot read
-- individually — it returns only counts and medians, never report contents.
create or replace function public.res_provider_performance(p_provider uuid default null)
returns table (
  provider_id uuid,
  provider_name text,
  open_count integer,
  resolved_count integer,
  median_ack_hours numeric,
  median_resolve_hours numeric,
  oldest_open_days numeric,
  overdue_count integer
)
language sql stable security definer
set search_path = public
as $$
  select
    p.id,
    p.name,
    count(*) filter (where r.status in ('submitted','acknowledged','in_progress'))::integer,
    count(*) filter (where r.status in ('resolved','closed'))::integer,
    -- Parenthesised before the cast: `agg(...) filter (...)::numeric` binds the
    -- cast to the filter expression rather than the aggregate result.
    round((percentile_cont(0.5) within group (
      order by extract(epoch from (r.acknowledged_at - r.created_at)) / 3600.0
    ) filter (where r.acknowledged_at is not null))::numeric, 1),
    round((percentile_cont(0.5) within group (
      order by extract(epoch from (r.resolved_at - r.created_at)) / 3600.0
    ) filter (where r.resolved_at is not null))::numeric, 1),
    round((max(extract(epoch from (now() - r.created_at)) / 86400.0)
      filter (where r.status in ('submitted','acknowledged','in_progress')))::numeric, 1),
    count(*) filter (
      where r.status in ('submitted','acknowledged','in_progress')
        and now() > r.created_at + make_interval(hours => r.target_hours)
    )::integer
  from res_infra_providers p
  join res_service_reports r on r.provider_id = p.id
  where p_provider is null or p.id = p_provider
  group by p.id, p.name
  order by p.name;
$$;

-- ── 8. GRANTS ──────────────────────────────────────────────────────────────
revoke execute on function public.res_submit_service_report(text,text,text,text,text,text,uuid,text,double precision,double precision) from public, anon;
revoke execute on function public.res_confirm_service_report(uuid) from public, anon;
revoke execute on function public.res_set_service_report_status(uuid,text,text) from public, anon;
revoke execute on function public.res_comment_service_report(uuid,text) from public, anon;
revoke execute on function public.res_provider_performance(uuid) from public, anon;

grant execute on function public.res_submit_service_report(text,text,text,text,text,text,uuid,text,double precision,double precision) to authenticated, service_role;
grant execute on function public.res_confirm_service_report(uuid) to authenticated, service_role;
grant execute on function public.res_set_service_report_status(uuid,text,text) to authenticated, service_role;
grant execute on function public.res_comment_service_report(uuid,text) to authenticated, service_role;
grant execute on function public.res_provider_performance(uuid) to authenticated, service_role;
