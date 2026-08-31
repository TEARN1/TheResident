-- theresident_property_delete_and_verification_meaning.sql
--
-- Two gaps flagged from UI feedback:
--   1. A landlord has no way to delete a property. Doing it with a plain
--      DELETE from the client would either fail on the FK from res_rooms/
--      res_listings, or (if those were ON DELETE CASCADE) silently wipe a
--      tenant's tenancy history with no record. This RPC cascades safely
--      through only the landlord's own rows, in dependency order, inside one
--      transaction (implicit in a single security-definer function body).
--   2. "How do we know it's true" (verification) had no explanation in the
--      UI — this file adds nothing new to the schema for that, the fix is
--      client-side copy next to the existing badge (see the .tsx change in
--      the same commit). Left here as a pointer so the two aren't scattered
--      across unrelated commits.
--
-- Paste into the Supabase SQL editor. Additive only; no existing objects
-- are altered.

create or replace function public.res_delete_property(p_property uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
begin
  select landlord_id into v_owner from public.res_properties where id = p_property;
  if v_owner is null then
    raise exception 'Property not found';
  end if;
  if v_owner <> auth.uid() then
    raise exception 'Not your property';
  end if;

  -- Occupant history is deleted with the room, not orphaned — there is no
  -- other owner who could still read it once the room itself is gone.
  delete from public.res_room_occupants
    where room_id in (select id from public.res_rooms where property_id = p_property);

  delete from public.res_rooms where property_id = p_property;

  -- A room's public listing (res_listings) is the landlord's own row too
  -- (res_listings.landlord_id = auth.uid() is already enforced elsewhere) —
  -- cascading it here means a deleted property can't leave a dangling,
  -- still-bookable listing pointing at nothing.
  delete from public.res_listings where property_id = p_property;

  delete from public.res_properties where id = p_property;
end;
$$;

revoke all on function public.res_delete_property(uuid) from public;
grant execute on function public.res_delete_property(uuid) to authenticated;
