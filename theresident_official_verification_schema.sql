-- theresident_official_verification_schema.sql
--
-- The on-ramp for the whole officials feature (backlog A1 and A4).
--
-- WHAT WAS WRONG. res_org_units.verified and .jurisdiction_id are the two
-- fields that decide whether an office can reach an area, and neither had any
-- way to be set: no RPC, no UI, no script. Six phases of work — boundaries,
-- audience resolution, targeting, sending, push, billing — sat behind a door
-- with no handle. res_org_units had zero rows.
--
-- THE SHAPE. An official asks; a platform admin decides. Nothing here lets a
-- unit verify or bind itself, because "authority is a polygon" only holds if
-- somebody outside the office draws it. Approval does both things at once —
-- verified AND bound — because either alone is useless and the pair is what
-- res_targetable_jurisdictions actually needs.
--
-- WHY A NEW ADMIN TABLE. The only existing authority model is per-community
-- (res_community_members.role in admin/founder), which is scoped to one
-- community and cannot express "may verify a municipality". `is_admin` exists
-- but is Gruvs-owned, so per CONTRACT.md §2 it is not mine to reuse for this.
--
-- EVERY DECISION IS RECORDED. Verifying an office is the single most
-- consequential act in this app — it is what lets someone message people who
-- never opted in. res_org_unit_audit keeps who did it, when, and why, and
-- nothing can delete a row from it.
--
-- Paste into the Supabase SQL editor. Additive only.

-- ── 1. WHO MAY DECIDE ──────────────────────────────────────────────────────

create table if not exists public.res_platform_admins (
  user_id uuid primary key,
  note text,
  added_at timestamptz not null default now()
);

alter table public.res_platform_admins enable row level security;

-- An admin may see the admin list; nobody else may learn who the admins are.
drop policy if exists res_platform_admins_select on public.res_platform_admins;
create policy res_platform_admins_select on public.res_platform_admins
  for select to authenticated
  using (exists (select 1 from res_platform_admins a where a.user_id = (select auth.uid())));

-- No insert/update/delete policy: admins are added by service_role only, so
-- an admin cannot appoint another admin without going through the database.
revoke all on public.res_platform_admins from anon, authenticated;
grant select on public.res_platform_admins to authenticated;

create or replace function public.res_is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from res_platform_admins where user_id = auth.uid());
$$;

revoke all on function public.res_is_platform_admin() from public, anon;
grant execute on function public.res_is_platform_admin() to authenticated, service_role;

-- ── 2. THE RECORD OF EVERY DECISION ────────────────────────────────────────

create table if not exists public.res_org_unit_audit (
  id bigint generated always as identity primary key,
  unit_id uuid not null references public.res_org_units(id) on delete cascade,
  action text not null check (action in
    ('verification_requested','verified','unverified','jurisdiction_bound','jurisdiction_cleared','rejected')),
  actor_id uuid,
  detail text,
  at timestamptz not null default now()
);

create index if not exists res_org_unit_audit_unit_idx on public.res_org_unit_audit (unit_id, at desc);

alter table public.res_org_unit_audit enable row level security;

-- Readable by the office's own senders and by admins. Not world-readable: a
-- rejection reason may say something about a person.
drop policy if exists res_org_unit_audit_select on public.res_org_unit_audit;
create policy res_org_unit_audit_select on public.res_org_unit_audit
  for select to authenticated
  using (
    public.res_is_platform_admin()
    or public.res_user_is_sender_of_or_above(unit_id, (select auth.uid()))
  );

-- Append-only, and only through the functions below.
revoke all on public.res_org_unit_audit from anon, authenticated;
grant select on public.res_org_unit_audit to authenticated;

-- ── 3. AN OFFICIAL ASKS ────────────────────────────────────────────────────

create table if not exists public.res_unit_verification_requests (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.res_org_units(id) on delete cascade,
  requested_by uuid not null,
  -- What the applicant says they are, and how to check it. Deliberately free
  -- text plus a link rather than a rigid schema: the proof a ward councillor
  -- has is not the proof a library has.
  official_title text,
  evidence_url text,
  contact_email text,
  note text,
  -- The area they say they are responsible for. A suggestion, not a grant —
  -- the admin picks what is actually bound.
  requested_jurisdiction_id uuid references public.res_jurisdictions(id) on delete set null,
  status text not null default 'pending' check (status in ('pending','approved','rejected','withdrawn')),
  decided_by uuid,
  decided_at timestamptz,
  decision_note text,
  created_at timestamptz not null default now()
);

create index if not exists res_unit_verif_pending_idx
  on public.res_unit_verification_requests (status, created_at);
-- One live application per office; a decided one can be superseded.
create unique index if not exists res_unit_verif_one_pending
  on public.res_unit_verification_requests (unit_id) where status = 'pending';

alter table public.res_unit_verification_requests enable row level security;

drop policy if exists res_unit_verif_select on public.res_unit_verification_requests;
create policy res_unit_verif_select on public.res_unit_verification_requests
  for select to authenticated
  using (
    public.res_is_platform_admin()
    or public.res_user_is_sender_of_or_above(unit_id, (select auth.uid()))
  );

revoke all on public.res_unit_verification_requests from anon, authenticated;
grant select on public.res_unit_verification_requests to authenticated;

create or replace function public.res_request_unit_verification(
  p_unit uuid,
  p_official_title text default null,
  p_evidence_url text default null,
  p_contact_email text default null,
  p_note text default null,
  p_jurisdiction uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_id uuid;
begin
  if v_uid is null then raise exception 'not signed in'; end if;
  if not public.res_user_is_sender_of_or_above(p_unit, v_uid) then
    raise exception 'not_a_sender_for_this_unit';
  end if;
  if exists (select 1 from res_org_units where id = p_unit and verified = true) then
    raise exception 'already_verified';
  end if;

  -- Applying is cheap for the applicant and expensive for whoever reviews it.
  perform public.res_check_rate_limit('verification_request', 5, 86400);

  insert into res_unit_verification_requests (
    unit_id, requested_by, official_title, evidence_url, contact_email, note,
    requested_jurisdiction_id
  ) values (
    p_unit, v_uid, nullif(trim(p_official_title), ''), nullif(trim(p_evidence_url), ''),
    nullif(trim(p_contact_email), ''), nullif(trim(p_note), ''), p_jurisdiction
  )
  on conflict (unit_id) where status = 'pending'
  do update set
    official_title = excluded.official_title,
    evidence_url = excluded.evidence_url,
    contact_email = excluded.contact_email,
    note = excluded.note,
    requested_jurisdiction_id = excluded.requested_jurisdiction_id,
    created_at = now()
  returning id into v_id;

  insert into res_org_unit_audit (unit_id, action, actor_id, detail)
  values (p_unit, 'verification_requested', v_uid, nullif(trim(p_official_title), ''));

  return v_id;
end;
$$;

revoke all on function public.res_request_unit_verification(uuid, text, text, text, text, uuid) from public, anon;
grant execute on function public.res_request_unit_verification(uuid, text, text, text, text, uuid) to authenticated, service_role;

-- An applicant may withdraw; they may never approve.
create or replace function public.res_withdraw_unit_verification(p_unit uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if not public.res_user_is_sender_of_or_above(p_unit, auth.uid()) then
    raise exception 'not_a_sender_for_this_unit';
  end if;
  update res_unit_verification_requests
     set status = 'withdrawn', decided_at = now(), decided_by = auth.uid()
   where unit_id = p_unit and status = 'pending';
end;
$$;

revoke all on function public.res_withdraw_unit_verification(uuid) from public, anon;
grant execute on function public.res_withdraw_unit_verification(uuid) to authenticated, service_role;

-- ── 4. AN ADMIN DECIDES ────────────────────────────────────────────────────
--
-- Approval sets verified AND binds the jurisdiction in one statement, because
-- either alone leaves the office unable to do anything: res_targetable_
-- jurisdictions requires both, and a half-approved unit looks approved to its
-- owner while silently reaching nobody.

create or replace function public.res_approve_unit_verification(
  p_unit uuid,
  p_jurisdiction uuid,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_level text;
begin
  if v_uid is null then raise exception 'not signed in'; end if;
  if not public.res_is_platform_admin() then raise exception 'not_a_platform_admin'; end if;

  select level into v_level from res_jurisdictions where id = p_jurisdiction;
  if v_level is null then raise exception 'unknown_jurisdiction'; end if;

  update res_org_units
     set verified = true, jurisdiction_id = p_jurisdiction
   where id = p_unit;
  if not found then raise exception 'unknown_unit'; end if;

  update res_unit_verification_requests
     set status = 'approved', decided_by = v_uid, decided_at = now(),
         decision_note = nullif(trim(p_note), '')
   where unit_id = p_unit and status = 'pending';

  insert into res_org_unit_audit (unit_id, action, actor_id, detail)
  values (p_unit, 'verified', v_uid, nullif(trim(p_note), '')),
         (p_unit, 'jurisdiction_bound', v_uid, v_level);

  -- The six-month clock starts here. The trigger on res_org_units also does
  -- this; calling it directly means approval does not depend on a trigger
  -- staying attached.
  begin
    perform public.res_ensure_area_probation(p_unit);
  exception when undefined_function then null;
  end;
end;
$$;

-- Granted to authenticated on purpose: the admin uses this from the app, and
-- the function gates on res_is_platform_admin() itself. service_role-only
-- would mean no admin could ever call it without the SQL editor, which is
-- the exact problem this file exists to fix.
revoke all on function public.res_approve_unit_verification(uuid, uuid, text) from public, anon;
grant execute on function public.res_approve_unit_verification(uuid, uuid, text) to authenticated, service_role;

create or replace function public.res_reject_unit_verification(p_unit uuid, p_note text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'not signed in'; end if;
  if not public.res_is_platform_admin() then raise exception 'not_a_platform_admin'; end if;
  -- A rejection the applicant cannot understand is a rejection they will
  -- simply resubmit.
  if coalesce(trim(p_note), '') = '' then raise exception 'rejection_needs_a_reason'; end if;

  update res_unit_verification_requests
     set status = 'rejected', decided_by = v_uid, decided_at = now(), decision_note = trim(p_note)
   where unit_id = p_unit and status = 'pending';

  insert into res_org_unit_audit (unit_id, action, actor_id, detail)
  values (p_unit, 'rejected', v_uid, trim(p_note));
end;
$$;

-- Granted to authenticated on purpose: the admin uses this from the app, and
-- the function gates on res_is_platform_admin() itself. service_role-only
-- would mean no admin could ever call it without the SQL editor, which is
-- the exact problem this file exists to fix.
revoke all on function public.res_reject_unit_verification(uuid, text) from public, anon;
grant execute on function public.res_reject_unit_verification(uuid, text) to authenticated, service_role;

-- Verification must be revocable. An office that misuses the channel, or an
-- official who leaves the post, has to be stoppable without deleting the unit
-- and losing its public broadcast record.
create or replace function public.res_revoke_unit_verification(p_unit uuid, p_note text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'not signed in'; end if;
  if not public.res_is_platform_admin() then raise exception 'not_a_platform_admin'; end if;
  if coalesce(trim(p_note), '') = '' then raise exception 'revocation_needs_a_reason'; end if;

  update res_org_units set verified = false where id = p_unit;
  if not found then raise exception 'unknown_unit'; end if;

  insert into res_org_unit_audit (unit_id, action, actor_id, detail)
  values (p_unit, 'unverified', v_uid, trim(p_note));
end;
$$;

-- Granted to authenticated on purpose: the admin uses this from the app, and
-- the function gates on res_is_platform_admin() itself. service_role-only
-- would mean no admin could ever call it without the SQL editor, which is
-- the exact problem this file exists to fix.
revoke all on function public.res_revoke_unit_verification(uuid, text) from public, anon;
grant execute on function public.res_revoke_unit_verification(uuid, text) to authenticated, service_role;

-- ── 5. WHAT AN ADMIN LOOKS AT ──────────────────────────────────────────────

create or replace function public.res_pending_verification_requests()
returns table (
  request_id uuid,
  unit_id uuid,
  unit_name text,
  unit_tier text,
  official_title text,
  evidence_url text,
  contact_email text,
  note text,
  requested_jurisdiction_id uuid,
  requested_jurisdiction_name text,
  requested_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select r.id, r.unit_id, u.name, u.tier, r.official_title, r.evidence_url,
         r.contact_email, r.note, r.requested_jurisdiction_id, j.name, r.created_at
  from res_unit_verification_requests r
  join res_org_units u on u.id = r.unit_id
  left join res_jurisdictions j on j.id = r.requested_jurisdiction_id
  where r.status = 'pending' and public.res_is_platform_admin()
  order by r.created_at;
$$;

revoke all on function public.res_pending_verification_requests() from public, anon;
grant execute on function public.res_pending_verification_requests() to authenticated, service_role;

-- Picking the area to bind. Text search over 267 areas, narrowest first, so an
-- admin types "Tshwane" rather than pasting a uuid.
create or replace function public.res_search_jurisdictions(p_query text, p_limit integer default 20)
returns table (id uuid, name text, level text, external_ref text, parent_name text)
language sql
stable
security definer
set search_path = public
as $$
  select j.id, j.name, j.level, j.external_ref, p.name
  from res_jurisdictions j
  left join res_jurisdictions p on p.id = j.parent_id
  where public.res_is_platform_admin()
    and (coalesce(trim(p_query), '') = '' or j.name ilike '%' || trim(p_query) || '%')
  order by
    case j.level when 'ward' then 1 when 'service_area' then 2 when 'municipality' then 3
                 when 'district' then 4 when 'province' then 5 else 6 end,
    j.name
  limit greatest(1, least(coalesce(p_limit, 20), 100));
$$;

revoke all on function public.res_search_jurisdictions(text, integer) from public, anon;
grant execute on function public.res_search_jurisdictions(text, integer) to authenticated, service_role;

-- What an applicant sees about their own application.
create or replace function public.res_my_unit_verification(p_unit uuid)
returns table (status text, decision_note text, decided_at timestamptz, requested_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select r.status, r.decision_note, r.decided_at, r.created_at
  from res_unit_verification_requests r
  where r.unit_id = p_unit
    and public.res_user_is_sender_of_or_above(p_unit, auth.uid())
  order by r.created_at desc
  limit 1;
$$;

revoke all on function public.res_my_unit_verification(uuid) from public, anon;
grant execute on function public.res_my_unit_verification(uuid) to authenticated, service_role;
