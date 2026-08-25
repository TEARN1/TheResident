-- Batch 10: Org/Business Broadcast Messaging — schema, RLS, and RPCs.
-- Apply this in the Supabase SQL editor the same way resident_schema.sql
-- and theresident_db_hardening.sql were applied (this repo has no Supabase CLI/
-- credentials access, so it cannot be applied automatically).
--
-- Free, in-app + email only (no SMS/push gateway — those need a paid
-- provider). Audience is opt-in: a parent/customer must explicitly follow
-- the org unit that can message them, never scraped or auto-subscribed.
--
-- Model: a self-referencing tree of "org units" (Department of Education ->
-- HOD -> School -> Teacher, or a Business -> Branch). A broadcast posted at
-- unit U reaches everyone who follows U OR follows any DESCENDANT of U —
-- i.e. a Department-level post cascades down to Teacher-level followers,
-- but a Teacher-level post never reaches a different school's followers.

-- ── 1. TABLES ──────────────────────────────────────────────────────────────

create table if not exists public.res_org_units (
  id uuid primary key default uuid_generate_v4(),
  parent_id uuid references public.res_org_units(id) on delete cascade,
  name text not null,
  tier text not null check (tier in ('department', 'hod', 'school', 'teacher', 'business', 'branch')),
  owner_user_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz default now()
);

create table if not exists public.res_org_memberships (
  id uuid primary key default uuid_generate_v4(),
  unit_id uuid references public.res_org_units(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  role text not null check (role in ('sender', 'member')) default 'member',
  created_at timestamptz default now(),
  unique (unit_id, user_id)
);

create table if not exists public.res_org_follows (
  id uuid primary key default uuid_generate_v4(),
  unit_id uuid references public.res_org_units(id) on delete cascade not null,
  follower_user_id uuid references public.profiles(id) on delete cascade not null,
  email_opt_in boolean default false,
  created_at timestamptz default now(),
  unique (unit_id, follower_user_id)
);

create table if not exists public.res_org_broadcasts (
  id uuid primary key default uuid_generate_v4(),
  unit_id uuid references public.res_org_units(id) on delete cascade not null,
  sender_id uuid references public.profiles(id) on delete cascade not null,
  title text not null,
  body text not null,
  created_at timestamptz default now()
);

create index if not exists res_org_units_parent_idx on public.res_org_units(parent_id);
create index if not exists res_org_follows_unit_idx on public.res_org_follows(unit_id);
create index if not exists res_org_follows_follower_idx on public.res_org_follows(follower_user_id);
create index if not exists res_org_broadcasts_unit_idx on public.res_org_broadcasts(unit_id, created_at desc);

-- ── 2. HELPER FUNCTIONS ────────────────────────────────────────────────────

-- True if p_ancestor is p_unit itself, or any ancestor of it (walks the
-- parent_id chain upward). Used both directions: "can I see this broadcast"
-- (is the poster's unit an ancestor-or-self of a unit I follow) and "can I
-- post as this unit" (is my sender membership on an ancestor-or-self of it).
create or replace function public.res_is_unit_ancestor_or_self(p_ancestor uuid, p_unit uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  with recursive chain as (
    select id, parent_id from res_org_units where id = p_unit
    union all
    select u.id, u.parent_id from res_org_units u
    join chain c on u.id = c.parent_id
  )
  select exists (select 1 from chain where id = p_ancestor);
$$;

-- True if p_user has a 'sender' membership on p_target_unit itself, or on
-- any ancestor of it (a Department-level sender can post as a School beneath it).
create or replace function public.res_user_is_sender_of_or_above(p_target_unit uuid, p_user uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from res_org_memberships m
    where m.user_id = p_user
      and m.role = 'sender'
      and public.res_is_unit_ancestor_or_self(m.unit_id, p_target_unit)
  );
$$;

-- Everyone who should receive a broadcast posted at p_unit: followers of
-- p_unit itself, plus followers of any descendant unit. Informational (used
-- for an audience-size preview and the eventual email fan-out) — the real
-- access control is res_org_broadcasts_select below, not this function.
create or replace function public.res_resolve_broadcast_audience(p_unit uuid)
returns table (follower_user_id uuid, email_opt_in boolean)
language sql stable security definer
set search_path = public
as $$
  with recursive descendants as (
    select id from res_org_units where id = p_unit
    union all
    select u.id from res_org_units u join descendants d on u.parent_id = d.id
  )
  select f.follower_user_id, bool_or(f.email_opt_in) as email_opt_in
  from res_org_follows f
  where f.unit_id in (select id from descendants)
  group by f.follower_user_id;
$$;

-- New unit's creator automatically becomes its first sender — otherwise
-- nobody could ever post to a unit they just created.
create or replace function public.res_org_unit_auto_sender()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  insert into res_org_memberships (unit_id, user_id, role)
  values (new.id, new.owner_user_id, 'sender')
  on conflict (unit_id, user_id) do update set role = 'sender';
  return new;
end;
$$;

drop trigger if exists res_org_units_after_insert on public.res_org_units;
create trigger res_org_units_after_insert
  after insert on public.res_org_units
  for each row execute function public.res_org_unit_auto_sender();

-- Caps broadcasts per unit per hour — mirrors the existing map closure-
-- report rate limit pattern (utils/mapZones.ts), prevents one bad actor
-- account from spamming an entire school/customer base. Client code should
-- treat a 'rate_limited' error message the same way VibeMap.tsx already does.
create or replace function public.res_check_broadcast_rate_limit()
returns trigger
language plpgsql security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  select count(*) into v_count
  from res_org_broadcasts
  where unit_id = new.unit_id
    and created_at > now() - interval '1 hour';
  if v_count >= 5 then
    raise exception 'rate_limited: too many broadcasts from this unit in the last hour';
  end if;
  return new;
end;
$$;

drop trigger if exists res_org_broadcasts_rate_limit on public.res_org_broadcasts;
create trigger res_org_broadcasts_rate_limit
  before insert on public.res_org_broadcasts
  for each row execute function public.res_check_broadcast_rate_limit();

grant execute on function public.res_is_unit_ancestor_or_self(uuid, uuid) to authenticated, service_role;
grant execute on function public.res_user_is_sender_of_or_above(uuid, uuid) to authenticated, service_role;
grant execute on function public.res_resolve_broadcast_audience(uuid) to authenticated, service_role;

-- ── 3. ROW LEVEL SECURITY ──────────────────────────────────────────────────

alter table public.res_org_units       enable row level security;
alter table public.res_org_memberships enable row level security;
alter table public.res_org_follows     enable row level security;
alter table public.res_org_broadcasts  enable row level security;

-- res_org_units: world-readable (needed to browse/pick the tree). Creating
-- a unit requires owning it and, if it has a parent, being a sender of that
-- parent (or an ancestor of it) already.
drop policy if exists res_org_units_select on public.res_org_units;
create policy res_org_units_select on public.res_org_units
  for select to authenticated using (true);

drop policy if exists res_org_units_insert on public.res_org_units;
create policy res_org_units_insert on public.res_org_units
  for insert to authenticated
  with check (
    owner_user_id = auth.uid()
    and (parent_id is null or public.res_user_is_sender_of_or_above(parent_id, auth.uid()))
  );

drop policy if exists res_org_units_update on public.res_org_units;
create policy res_org_units_update on public.res_org_units
  for update to authenticated
  using (public.res_user_is_sender_of_or_above(id, auth.uid()))
  with check (public.res_user_is_sender_of_or_above(id, auth.uid()));

-- res_org_memberships: visible to the member themself, or to any sender of
-- that unit or an ancestor of it. Only an existing sender-of-or-above can
-- add new members (bootstrapped by the auto-sender trigger above).
drop policy if exists res_org_memberships_select on public.res_org_memberships;
create policy res_org_memberships_select on public.res_org_memberships
  for select to authenticated
  using (
    user_id = auth.uid()
    or public.res_user_is_sender_of_or_above(unit_id, auth.uid())
  );

drop policy if exists res_org_memberships_insert on public.res_org_memberships;
create policy res_org_memberships_insert on public.res_org_memberships
  for insert to authenticated
  with check (public.res_user_is_sender_of_or_above(unit_id, auth.uid()));

drop policy if exists res_org_memberships_delete on public.res_org_memberships;
create policy res_org_memberships_delete on public.res_org_memberships
  for delete to authenticated
  using (public.res_user_is_sender_of_or_above(unit_id, auth.uid()));

-- res_org_follows: strictly self-service — nobody else can see, create, or
-- remove another person's follow/link ("Link your child to a class",
-- "Follow this business" is explicit, visible, and revocable per-user only).
drop policy if exists res_org_follows_select on public.res_org_follows;
create policy res_org_follows_select on public.res_org_follows
  for select to authenticated using (follower_user_id = auth.uid());

drop policy if exists res_org_follows_insert on public.res_org_follows;
create policy res_org_follows_insert on public.res_org_follows
  for insert to authenticated with check (follower_user_id = auth.uid());

drop policy if exists res_org_follows_delete on public.res_org_follows;
create policy res_org_follows_delete on public.res_org_follows
  for delete to authenticated using (follower_user_id = auth.uid());

-- res_org_broadcasts: a viewer sees a broadcast if they follow its unit, or
-- follow any unit that broadcast's unit is an ancestor of (i.e. they follow
-- a descendant) — this is the "Department post reaches Teacher-level
-- follower" cascade. Posting requires a sender membership on the target
-- unit or an ancestor of it.
drop policy if exists res_org_broadcasts_select on public.res_org_broadcasts;
create policy res_org_broadcasts_select on public.res_org_broadcasts
  for select to authenticated
  using (
    sender_id = auth.uid()
    or exists (
      select 1 from res_org_follows f
      where f.follower_user_id = auth.uid()
        and public.res_is_unit_ancestor_or_self(res_org_broadcasts.unit_id, f.unit_id)
    )
  );

drop policy if exists res_org_broadcasts_insert on public.res_org_broadcasts;
create policy res_org_broadcasts_insert on public.res_org_broadcasts
  for insert to authenticated
  with check (
    sender_id = auth.uid()
    and public.res_user_is_sender_of_or_above(unit_id, auth.uid())
  );
