-- theresident_directory_urgency_schema.sql
--
-- Two things, both extending the org-broadcast feature that is already live
-- (res_org_units / res_org_memberships / res_org_follows / res_org_broadcasts
-- all exist in the database — SECURITY.md's claim that the file "has not been
-- applied" is stale and is corrected in this change).
--
-- 1. THE DIRECTORY. The tier list only allowed department/hod/school/teacher/
--    business/branch, so there was no way to model a municipality, a utility,
--    an ISP, or the grade/class level a parent actually wants to follow. Adds
--    those tiers plus the fields a browsable directory needs.
--
-- 2. URGENCY THAT ACTUALLY ARRIVES. Today postBroadcast() inserts a row and
--    that is all: no notification, no bell, no sound. A follower learns about
--    an announcement only by visiting Community and scrolling. This adds a
--    priority, a per-recipient receipt so a critical item can persist until it
--    is explicitly acknowledged, and the fan-out that puts it in the shared
--    notifications rail.
--
-- SECURITY NOTE — IMPERSONATION. Any signed-in user can create a unit named
-- "Eskom" or "Department of Education" and broadcast as it. That is a live
-- hole today. This adds a `verified` flag, and — importantly — refuses to let
-- an UNVERIFIED unit send at urgent/critical priority at all. Anyone can still
-- make a unit and talk to people who chose to follow them; nobody can
-- impersonate an institution and force an interrupt onto someone's phone.
--
-- Paste into the Supabase SQL editor. Additive; nothing is dropped.

-- ── 1. DIRECTORY FIELDS ────────────────────────────────────────────────────

alter table public.res_org_units
  add column if not exists sector text,
  add column if not exists verified boolean not null default false,
  add column if not exists contact_email text,
  add column if not exists contact_phone text,
  add column if not exists suburb text,
  add column if not exists city text,
  add column if not exists description text;

do $$ begin
  if not exists (
    select 1 from pg_constraint where conname = 'res_org_units_sector_check'
  ) then
    alter table public.res_org_units add constraint res_org_units_sector_check
      check (sector is null or sector in
        ('education', 'utility', 'government', 'business', 'health', 'transport', 'other'));
  end if;
end $$;

-- Widen the tier list. Replaces the constraint rather than adding a second one
-- (two CHECKs would AND together and reject everything new).
alter table public.res_org_units drop constraint if exists res_org_units_tier_check;
alter table public.res_org_units add constraint res_org_units_tier_check
  check (tier in (
    'department', 'hod', 'school', 'teacher', 'business', 'branch',
    'municipality', 'ward', 'utility', 'isp',
    'university', 'faculty', 'grade', 'class',
    'clinic', 'other'
  ));

create index if not exists res_org_units_sector_idx on public.res_org_units (sector, name);
create index if not exists res_org_units_locality_idx on public.res_org_units (city, suburb);

-- ── 2. PRIORITY + RECEIPTS ─────────────────────────────────────────────────

alter table public.res_org_broadcasts
  add column if not exists priority text not null default 'normal',
  add column if not exists category text,
  add column if not exists expires_at timestamptz;

do $$ begin
  if not exists (
    select 1 from pg_constraint where conname = 'res_org_broadcasts_priority_check'
  ) then
    alter table public.res_org_broadcasts add constraint res_org_broadcasts_priority_check
      check (priority in ('normal', 'important', 'urgent', 'critical'));
  end if;
end $$;

-- One row per (broadcast, recipient). `acknowledged_at` is what lets an urgent
-- item keep signalling until the person has actually dealt with it, rather
-- than until they happened to scroll past it. Deliberately a DB row and not
-- localStorage: "I saw the school's emergency notice" must survive a new
-- device, which is exactly what the existing sessionStorage-dismissed banners
-- do not do.
create table if not exists public.res_org_broadcast_receipts (
  id uuid primary key default uuid_generate_v4(),
  broadcast_id uuid references public.res_org_broadcasts(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  seen_at timestamptz,
  acknowledged_at timestamptz,
  created_at timestamptz default now() not null,
  unique (broadcast_id, user_id)
);

create index if not exists res_org_broadcast_receipts_user_idx
  on public.res_org_broadcast_receipts (user_id, acknowledged_at);

alter table public.res_org_broadcast_receipts enable row level security;

-- Strictly self-service, matching res_org_follows: your receipts are yours.
drop policy if exists res_broadcast_receipts_select on public.res_org_broadcast_receipts;
create policy res_broadcast_receipts_select on public.res_org_broadcast_receipts
  for select to authenticated using (user_id = auth.uid());

drop policy if exists res_broadcast_receipts_insert on public.res_org_broadcast_receipts;
create policy res_broadcast_receipts_insert on public.res_org_broadcast_receipts
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists res_broadcast_receipts_update on public.res_org_broadcast_receipts;
create policy res_broadcast_receipts_update on public.res_org_broadcast_receipts
  for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ── 3. ONLY VERIFIED UNITS MAY INTERRUPT ───────────────────────────────────

create or replace function public.res_check_broadcast_priority()
returns trigger
language plpgsql security definer
set search_path = public
as $$
declare
  v_verified boolean;
begin
  if new.priority in ('urgent', 'critical') then
    select verified into v_verified from res_org_units where id = new.unit_id;
    if not coalesce(v_verified, false) then
      raise exception 'unit_not_verified: only a verified organisation can send at % priority', new.priority;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists res_org_broadcasts_priority_gate on public.res_org_broadcasts;
create trigger res_org_broadcasts_priority_gate
  before insert on public.res_org_broadcasts
  for each row execute function public.res_check_broadcast_priority();

-- ── 4. FAN-OUT INTO THE SHARED NOTIFICATIONS RAIL ──────────────────────────
-- `notifications` is Gruvs-owned (CONTRACT.md §2/§4): we write rows, we never
-- alter its shape. Priority and the ack requirement ride in the existing `data`
-- jsonb and the deep link in the existing `action_url`, so this needs no
-- schema change on their side. Both `body`/`message` and `read`/`is_read` are
-- populated because the live table carries both spellings and different
-- clients read different ones.
create or replace function public.res_fanout_broadcast()
returns trigger
language plpgsql security definer
set search_path = public
as $$
declare
  v_unit_name text;
  v_audience integer;
begin
  -- 'normal' stays quiet by design: it appears in the Community feed and
  -- nowhere else. Only deliberate escalation reaches the bell.
  if new.priority = 'normal' then
    return new;
  end if;

  select name into v_unit_name from res_org_units where id = new.unit_id;

  select count(*) into v_audience
  from res_resolve_broadcast_audience(new.unit_id)
  where follower_user_id <> new.sender_id;

  -- A runaway fan-out would be indistinguishable from an attack on the shared
  -- rail. Refuse loudly rather than inserting a hundred thousand rows.
  if v_audience > 20000 then
    raise exception 'audience_too_large: % recipients — contact support to send at this scale', v_audience;
  end if;

  insert into notifications (recipient_id, actor_id, type, title, body, message, data, action_url, read, is_read)
  select
    a.follower_user_id,
    new.sender_id,
    'res_org_broadcast',
    coalesce(v_unit_name, 'Announcement') || ': ' || new.title,
    new.body,
    new.body,
    jsonb_build_object(
      'priority', new.priority,
      'requires_ack', new.priority = 'critical',
      'broadcast_id', new.id,
      'unit_id', new.unit_id,
      'category', new.category
    ),
    '/dashboard/community?tab=notices&broadcast=' || new.id::text,
    false,
    false
  from res_resolve_broadcast_audience(new.unit_id) a
  where a.follower_user_id <> new.sender_id;

  return new;
end;
$$;

drop trigger if exists res_org_broadcasts_fanout on public.res_org_broadcasts;
create trigger res_org_broadcasts_fanout
  after insert on public.res_org_broadcasts
  for each row execute function public.res_fanout_broadcast();

-- ── 5. ACKNOWLEDGING ───────────────────────────────────────────────────────

create or replace function public.res_ack_broadcast(p_broadcast uuid)
returns void
language plpgsql security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;

  insert into res_org_broadcast_receipts (broadcast_id, user_id, seen_at, acknowledged_at)
  values (p_broadcast, auth.uid(), now(), now())
  on conflict (broadcast_id, user_id)
  do update set acknowledged_at = coalesce(res_org_broadcast_receipts.acknowledged_at, now()),
                seen_at = coalesce(res_org_broadcast_receipts.seen_at, now());

  -- Acknowledging the announcement also clears its bell entry, so the two
  -- cannot disagree about whether it has been dealt with.
  update notifications
     set read = true, is_read = true, read_at = now()
   where recipient_id = auth.uid()
     and type = 'res_org_broadcast'
     and data->>'broadcast_id' = p_broadcast::text;
end;
$$;

/**
 * Unacknowledged urgent/critical announcements for the signed-in user. The
 * banner reads this; RLS on res_org_broadcasts already limits it to units the
 * caller actually follows.
 */
create or replace function public.res_pending_urgent_broadcasts()
returns table (
  id uuid,
  unit_id uuid,
  unit_name text,
  title text,
  body text,
  priority text,
  created_at timestamptz
)
language sql stable security definer
set search_path = public
as $$
  select b.id, b.unit_id, u.name, b.title, b.body, b.priority, b.created_at
  from res_org_broadcasts b
  join res_org_units u on u.id = b.unit_id
  left join res_org_broadcast_receipts r
         on r.broadcast_id = b.id and r.user_id = auth.uid()
  where b.priority in ('urgent', 'critical')
    and r.acknowledged_at is null
    and (b.expires_at is null or b.expires_at > now())
    and exists (
      select 1 from res_org_follows f
      where f.follower_user_id = auth.uid()
        and public.res_is_unit_ancestor_or_self(b.unit_id, f.unit_id)
    )
  order by
    case b.priority when 'critical' then 0 else 1 end,
    b.created_at desc
  limit 20;
$$;

revoke execute on function public.res_ack_broadcast(uuid) from public, anon;
revoke execute on function public.res_pending_urgent_broadcasts() from public, anon;
grant execute on function public.res_ack_broadcast(uuid) to authenticated, service_role;
grant execute on function public.res_pending_urgent_broadcasts() to authenticated, service_role;
