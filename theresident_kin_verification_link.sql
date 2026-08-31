-- theresident_kin_verification_link.sql
--
-- The existing Next of Kin feature (res_trust_connections, res_request_trust_
-- connection/res_confirm_trust_connection) already requires BOTH people to
-- have Resident accounts and to explicitly act — that's real mutual
-- confirmation, not a one-sided claim.
--
-- What's missing is the case the user actually asked for: "give them a
-- unique link ... so they can be asked 'is this your brother/sister' ...
-- so we can be sure they're related" — someone who may not have the app at
-- all (a sibling, a parent) getting a link they can open with no login and
-- answer a single yes/no question about a relationship claim.
--
-- This is a SEPARATE, lighter-weight table from res_trust_connections on
-- purpose: it doesn't create or require a Resident account for the
-- responder, doesn't feed the trust-circle 2-hop gate, and is answerable by
-- someone who never signs up. It exists purely as a corroboration record a
-- resident can point to ("my sister confirmed this link").
--
-- Paste into the Supabase SQL editor. Additive only.

create table if not exists public.res_kin_verification_links (
  id uuid primary key default uuid_generate_v4(),
  requester_id uuid references public.profiles(id) on delete cascade not null,
  claimed_name text not null,
  claimed_relationship text not null,
  -- The public, unguessable part of the link. Not the primary key so a
  -- leaked id (e.g. in a log line) can't be used to look the row up —
  -- only the token can.
  token uuid not null unique default uuid_generate_v4(),
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'denied')),
  responder_note text,
  created_at timestamptz not null default now(),
  responded_at timestamptz
);

create index if not exists res_kin_verification_links_requester_idx
  on public.res_kin_verification_links (requester_id, created_at desc);

alter table public.res_kin_verification_links enable row level security;

-- The requester can see their own links (to check status) — nobody else can
-- list or browse this table directly. The public-facing page never selects
-- the table itself; it goes through res_get_kin_verification_link(token)
-- below, which is the only way to reach a single row by token.
drop policy if exists res_kin_verification_links_select on public.res_kin_verification_links;
create policy res_kin_verification_links_select on public.res_kin_verification_links
  for select using (requester_id = auth.uid());

-- Creates a new claim + shareable link. Must be signed in — this is the
-- resident vouching for who they claim their kin is, not an anonymous act.
create or replace function public.res_create_kin_verification_link(
  p_claimed_name text,
  p_relationship text
)
returns public.res_kin_verification_links
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.res_kin_verification_links;
begin
  if auth.uid() is null then
    raise exception 'Must be signed in';
  end if;
  if trim(coalesce(p_claimed_name, '')) = '' then
    raise exception 'Name is required';
  end if;
  if trim(coalesce(p_relationship, '')) = '' then
    raise exception 'Relationship is required';
  end if;

  insert into public.res_kin_verification_links (requester_id, claimed_name, claimed_relationship)
    values (auth.uid(), trim(p_claimed_name), trim(p_relationship))
    returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.res_create_kin_verification_link(text, text) from public;
grant execute on function public.res_create_kin_verification_link(text, text) to authenticated;

-- Public, no-login read of a single claim by its token — for the /verify-kin
-- page. Deliberately returns only what a stranger needs to answer the
-- question: the requester's display name, the claim, and whether it's
-- already been answered. Never the requester's id, email, or any other
-- profile field.
create or replace function public.res_get_kin_verification_link(p_token uuid)
returns table (
  requester_name text,
  claimed_name text,
  claimed_relationship text,
  status text
)
language sql
security definer
set search_path = public
stable
as $$
  select
    coalesce(pr.display_name, pr.username, 'A Resident user'),
    l.claimed_name,
    l.claimed_relationship,
    l.status
  from public.res_kin_verification_links l
  join public.profiles pr on pr.id = l.requester_id
  where l.token = p_token;
$$;

revoke all on function public.res_get_kin_verification_link(uuid) from public;
grant execute on function public.res_get_kin_verification_link(uuid) to anon, authenticated;

-- Public, no-login response. Answerable exactly once — a second call on an
-- already-answered token is rejected rather than allowed to overwrite the
-- first answer.
create or replace function public.res_respond_kin_verification_link(
  p_token uuid,
  p_confirmed boolean,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
begin
  select status into v_status from public.res_kin_verification_links where token = p_token;
  if v_status is null then
    raise exception 'Link not found';
  end if;
  if v_status <> 'pending' then
    raise exception 'This link has already been answered';
  end if;

  update public.res_kin_verification_links
    set status = case when p_confirmed then 'confirmed' else 'denied' end,
        responder_note = p_note,
        responded_at = now()
    where token = p_token;
end;
$$;

revoke all on function public.res_respond_kin_verification_link(uuid, boolean, text) from public;
grant execute on function public.res_respond_kin_verification_link(uuid, boolean, text) to anon, authenticated;
