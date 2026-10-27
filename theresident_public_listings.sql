-- Public (logged-out) access to OPEN room listings.
--
-- res_listings is readable only by signed-in users, so guests and anyone
-- opening a shared link saw nothing real (the app filled the gap with
-- invented sample rooms). This view exposes open, visible listings with only
-- fields safe to show anyone: no landlord id, street address, coordinates,
-- verification documents or review notes.
--
-- Same pattern as res_public_services: the view runs with its owner's rights
-- (security_invoker = false) so anon can read it without an anon policy on
-- the base table, which would expose every column.

create or replace view public.res_public_listings
with (security_invoker = false) as
select
  id,
  title,
  description,
  price,
  currency,
  suburb,
  city,
  images,
  wifi,
  parking,
  bathroom,
  landlord_lives_here,
  listing_type,
  quick_post,
  event_id,
  featured_until,
  last_verified_at,
  flagged,
  flag_reason,
  created_at
from public.res_listings
where status = 'open'
  and not hidden
  and (visible_until is null or visible_until > now());

revoke all on public.res_public_listings from public, anon, authenticated;
grant select on public.res_public_listings to anon, authenticated;
