-- theresident_room_inventory_schema.sql
--
-- A landlord's private room inventory: how many rooms they have, which are
-- vacant, photos, advantages/disadvantages, who currently lives there, and why
-- a room costs what it does.
--
-- WHY A NEW TABLE, NOT MORE COLUMNS ON res_listings. Every res_listings row is
-- world-readable today (`select using (true)` in resident_schema.sql) — the
-- moment a room exists as a listing, it's public. There is no way for a
-- landlord to jot down a room privately. res_rooms is that private tool;
-- res_advertise_room() below is the one deliberate door from private to
-- public, reusing the res_listings.property_id link that already exists and
-- is already populated, just never had anything to publish FROM.
--
-- OCCUPANT PRIVACY IS SELF-SERVICE, NOT LANDLORD-IMPOSED. The landlord always
-- sees who lives in their own rooms — it's their property. What the landlord
-- cannot do is decide whether a housemate sees another housemate's name: that
-- switch belongs to the occupant themselves (res_set_occupant_visibility,
-- callable only by auth.uid() = tenant_id), defaulting to the safer
-- 'landlord_only' until they choose to soften it.
--
-- Paste into the Supabase SQL editor. Additive only.

-- ── 1. TABLES ──────────────────────────────────────────────────────────────

create table if not exists public.res_rooms (
  id uuid primary key default uuid_generate_v4(),
  property_id uuid references public.res_properties(id) on delete cascade not null,
  landlord_id uuid references public.profiles(id) on delete cascade not null,
  label text not null,
  -- Capped at 6 in the submit RPC below — the first genuine multi-photo
  -- gallery in this app; every existing uploader (MarketTab, gossip, profile)
  -- is deliberately single-image, so this is a new precedent, not an
  -- established one, and stays bounded on purpose.
  photos text[] not null default '{}',
  price numeric,
  currency text not null default 'ZAR',
  advantages text,
  disadvantages text,
  -- "Why does this room cost what it does?" — the landlord's own words, shown
  -- next to the price rather than left for a prospective tenant to guess.
  price_note text,
  status text not null default 'vacant' check (status in ('vacant', 'occupied')),
  -- Set once by res_advertise_room(); the room stays private until this is
  -- non-null.
  listing_id uuid references public.res_listings(id) on delete set null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

create table if not exists public.res_room_occupants (
  id uuid primary key default uuid_generate_v4(),
  room_id uuid references public.res_rooms(id) on delete cascade not null,
  -- Nullable: a landlord can record "Sipho, R2500/mo" for someone who isn't
  -- on the app at all. When it IS set, that person gets to control
  -- `visibility` themselves — see §4.
  tenant_id uuid references public.profiles(id) on delete set null,
  occupant_name_raw text,
  moved_in_at timestamptz not null default now(),
  -- Null while they still live there. Ending a stay stamps this rather than
  -- deleting the row, so — unlike res_room_requests today — a tenancy
  -- actually has a history once this ships.
  moved_out_at timestamptz,
  rent_amount numeric,
  notes text,
  visibility text not null default 'landlord_only'
    check (visibility in ('landlord_only', 'shared_with_housemates')),
  created_at timestamptz default now() not null,
  constraint res_room_occupants_person check (tenant_id is not null or occupant_name_raw is not null)
);

create index if not exists res_rooms_property_idx on public.res_rooms (property_id);
create index if not exists res_rooms_landlord_idx on public.res_rooms (landlord_id);
create index if not exists res_room_occupants_room_idx on public.res_room_occupants (room_id);
create index if not exists res_room_occupants_tenant_idx on public.res_room_occupants (tenant_id) where tenant_id is not null;
-- At most one CURRENT occupant record per (room, tenant) — moved_out_at is
-- part of the key so a returning tenant can get a fresh row.
create unique index if not exists res_room_occupants_current_idx
  on public.res_room_occupants (room_id, tenant_id)
  where tenant_id is not null and moved_out_at is null;

create or replace function public.res_room_touch()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists res_rooms_touch on public.res_rooms;
create trigger res_rooms_touch
  before update on public.res_rooms
  for each row execute function public.res_room_touch();

-- ── 2. OWNERSHIP HELPER ────────────────────────────────────────────────────
-- True when the caller owns the property this room (or occupant) belongs to.
-- A single function so every policy and RPC below agrees on what "yours"
-- means, rather than each repeating the join.
create or replace function public.res_owns_room(p_room uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (select 1 from res_rooms r where r.id = p_room and r.landlord_id = auth.uid());
$$;

-- True when the caller is a CURRENT occupant (moved_out_at is null) of any
-- room on the same property as p_room. A plain policy cannot express this —
-- querying res_room_occupants from within its own select policy recurses
-- (Postgres re-evaluates the policy for the nested reference). A security
-- definer function sidesteps that the same way res_owns_room does: it runs as
-- the function owner, which bypasses RLS on the table it queries internally.
create or replace function public.res_is_current_housemate(p_room uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1
    from res_rooms theirs
    join res_rooms mine on mine.property_id = theirs.property_id
    join res_room_occupants my_occupancy
      on my_occupancy.room_id = mine.id
     and my_occupancy.tenant_id = auth.uid()
     and my_occupancy.moved_out_at is null
    where theirs.id = p_room
  );
$$;

grant execute on function public.res_owns_room(uuid) to authenticated, service_role;
grant execute on function public.res_is_current_housemate(uuid) to authenticated, service_role;

-- ── 3. RLS ─────────────────────────────────────────────────────────────────

alter table public.res_rooms          enable row level security;
alter table public.res_room_occupants enable row level security;

-- Matches res_properties_all exactly: fully private to the landlord who owns
-- it. No separate insert/update policy needed since `for all` covers both,
-- and every write also goes through the RPCs in §4 for the parts (photo
-- count, reference-style validation) a bare policy can't enforce.
drop policy if exists res_rooms_all on public.res_rooms;
create policy res_rooms_all on public.res_rooms
  for all to authenticated
  using (landlord_id = auth.uid())
  with check (landlord_id = auth.uid());

-- Occupant rows: the landlord sees everyone in their own rooms; a linked
-- occupant sees their own row regardless of visibility (it's about them);
-- anyone else sharing the SAME property sees it only once that occupant has
-- opted into 'shared_with_housemates'. Writes go through the RPCs only.
drop policy if exists res_room_occupants_select on public.res_room_occupants;
create policy res_room_occupants_select on public.res_room_occupants
  for select to authenticated using (
    public.res_owns_room(room_id)
    or tenant_id = auth.uid()
    or (visibility = 'shared_with_housemates' and public.res_is_current_housemate(room_id))
  );

-- ── 4. RPCs ────────────────────────────────────────────────────────────────

create or replace function public.res_create_room(
  p_property uuid,
  p_label text,
  p_price numeric,
  p_currency text,
  p_advantages text,
  p_disadvantages text,
  p_price_note text,
  p_photos text[]
)
returns public.res_rooms
language plpgsql security definer
set search_path = public
as $$
declare
  v_row res_rooms;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if coalesce(trim(p_label), '') = '' then raise exception 'label_required'; end if;
  if not exists (select 1 from res_properties where id = p_property and landlord_id = auth.uid()) then
    raise exception 'not_your_property';
  end if;
  if coalesce(array_length(p_photos, 1), 0) > 6 then
    raise exception 'too_many_photos: 6 maximum per room';
  end if;

  insert into res_rooms (
    property_id, landlord_id, label, price, currency, advantages, disadvantages, price_note, photos
  ) values (
    p_property, auth.uid(), trim(p_label), p_price, coalesce(p_currency, 'ZAR'),
    nullif(trim(coalesce(p_advantages, '')), ''), nullif(trim(coalesce(p_disadvantages, '')), ''),
    nullif(trim(coalesce(p_price_note, '')), ''), coalesce(p_photos, '{}')
  )
  returning * into v_row;

  return v_row;
end;
$$;

create or replace function public.res_update_room(
  p_room uuid,
  p_label text,
  p_price numeric,
  p_currency text,
  p_advantages text,
  p_disadvantages text,
  p_price_note text,
  p_photos text[]
)
returns public.res_rooms
language plpgsql security definer
set search_path = public
as $$
declare
  v_row res_rooms;
begin
  if not public.res_owns_room(p_room) then raise exception 'not_your_room'; end if;
  if coalesce(array_length(p_photos, 1), 0) > 6 then
    raise exception 'too_many_photos: 6 maximum per room';
  end if;

  update res_rooms set
    label = coalesce(nullif(trim(p_label), ''), label),
    price = coalesce(p_price, price),
    currency = coalesce(p_currency, currency),
    advantages = nullif(trim(coalesce(p_advantages, '')), ''),
    disadvantages = nullif(trim(coalesce(p_disadvantages, '')), ''),
    price_note = nullif(trim(coalesce(p_price_note, '')), ''),
    photos = coalesce(p_photos, photos)
  where id = p_room
  returning * into v_row;

  return v_row;
end;
$$;

create or replace function public.res_add_room_occupant(
  p_room uuid,
  p_tenant uuid,
  p_occupant_name_raw text,
  p_rent_amount numeric,
  p_notes text
)
returns public.res_room_occupants
language plpgsql security definer
set search_path = public
as $$
declare
  v_row res_room_occupants;
begin
  if not public.res_owns_room(p_room) then raise exception 'not_your_room'; end if;
  if p_tenant is null and coalesce(trim(p_occupant_name_raw), '') = '' then
    raise exception 'occupant_identity_required: give a name, or link a resident';
  end if;

  insert into res_room_occupants (room_id, tenant_id, occupant_name_raw, rent_amount, notes)
  values (p_room, p_tenant, nullif(trim(coalesce(p_occupant_name_raw, '')), ''), p_rent_amount,
          nullif(trim(coalesce(p_notes, '')), ''))
  returning * into v_row;

  update res_rooms set status = 'occupied' where id = p_room;

  return v_row;
end;
$$;

create or replace function public.res_end_room_occupancy(p_occupant uuid)
returns public.res_room_occupants
language plpgsql security definer
set search_path = public
as $$
declare
  v_row res_room_occupants;
  v_room uuid;
begin
  select room_id into v_room from res_room_occupants where id = p_occupant;
  if v_room is null then raise exception 'occupant_not_found'; end if;
  if not public.res_owns_room(v_room) then raise exception 'not_your_room'; end if;

  update res_room_occupants set moved_out_at = now()
  where id = p_occupant and moved_out_at is null
  returning * into v_row;

  -- Only flips back to vacant if nobody else current remains — a room can
  -- have more than one occupant on record.
  if not exists (select 1 from res_room_occupants where room_id = v_room and moved_out_at is null) then
    update res_rooms set status = 'vacant' where id = v_room;
  end if;

  return v_row;
end;
$$;

-- Callable ONLY by the occupant themselves. This is the whole point: the
-- landlord cannot soften or tighten this on someone else's behalf.
create or replace function public.res_set_occupant_visibility(p_occupant uuid, p_visibility text)
returns public.res_room_occupants
language plpgsql security definer
set search_path = public
as $$
declare
  v_row res_room_occupants;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if p_visibility not in ('landlord_only', 'shared_with_housemates') then
    raise exception 'invalid_visibility';
  end if;

  update res_room_occupants
     set visibility = p_visibility
   where id = p_occupant and tenant_id = auth.uid()
  returning * into v_row;

  if v_row.id is null then raise exception 'not_your_occupancy'; end if;
  return v_row;
end;
$$;

-- The one deliberate door from private inventory to a public listing. Reuses
-- res_listings.property_id, which already exists and was already populated
-- by the create-listing form — this just finally gives it something to
-- publish FROM instead of only TO.
create or replace function public.res_advertise_room(p_room uuid)
returns public.res_listings
language plpgsql security definer
set search_path = public
as $$
declare
  v_room res_rooms;
  v_property res_properties;
  v_listing res_listings;
begin
  if not public.res_owns_room(p_room) then raise exception 'not_your_room'; end if;

  select * into v_room from res_rooms where id = p_room;
  if v_room.listing_id is not null then
    raise exception 'already_advertised';
  end if;

  select * into v_property from res_properties where id = v_room.property_id;

  insert into res_listings (
    landlord_id, title, description, price, currency, location, suburb,
    images, property_id
  ) values (
    auth.uid(), v_room.label,
    coalesce(v_room.advantages, '') ||
      case when v_room.disadvantages is not null then E'\n\n' || v_room.disadvantages else '' end,
    coalesce(v_room.price, 0), v_room.currency, coalesce(v_property.address, ''),
    coalesce(v_property.suburb, ''), coalesce(v_room.photos, '{}'), v_room.property_id
  )
  returning * into v_listing;

  update res_rooms set listing_id = v_listing.id where id = p_room;

  return v_listing;
end;
$$;

-- ── 5. GRANTS ──────────────────────────────────────────────────────────────
revoke execute on function public.res_create_room(uuid,text,numeric,text,text,text,text,text[]) from public, anon;
revoke execute on function public.res_update_room(uuid,text,numeric,text,text,text,text,text[]) from public, anon;
revoke execute on function public.res_add_room_occupant(uuid,uuid,text,numeric,text) from public, anon;
revoke execute on function public.res_end_room_occupancy(uuid) from public, anon;
revoke execute on function public.res_set_occupant_visibility(uuid,text) from public, anon;
revoke execute on function public.res_advertise_room(uuid) from public, anon;

grant execute on function public.res_create_room(uuid,text,numeric,text,text,text,text,text[]) to authenticated, service_role;
grant execute on function public.res_update_room(uuid,text,numeric,text,text,text,text,text[]) to authenticated, service_role;
grant execute on function public.res_add_room_occupant(uuid,uuid,text,numeric,text) to authenticated, service_role;
grant execute on function public.res_end_room_occupancy(uuid) to authenticated, service_role;
grant execute on function public.res_set_occupant_visibility(uuid,text) to authenticated, service_role;
grant execute on function public.res_advertise_room(uuid) to authenticated, service_role;
