-- Public (logged-out) access to service listings whose owners opted in.
--
-- res_handyman_services is readable only by signed-in users. The public
-- /services pages and the sitemap read this view instead, which exposes
-- only opted-in rows and only fields safe to show to anyone: no owner id,
-- phone number, street location or coordinates.
--
-- The view runs with its owner's rights (security_invoker = false) on
-- purpose: that is what lets anon read it without an anon policy on the
-- base table, which would expose every column.

alter table public.res_handyman_services
  add column if not exists show_publicly boolean not null default false;

create or replace view public.res_public_services
with (security_invoker = false) as
select
  id,
  business_name,
  category,
  suburb,
  city,
  description,
  price_estimate,
  website_url,
  image,
  rating,
  reviews_count,
  updated_at
from public.res_handyman_services
where show_publicly;

revoke all on public.res_public_services from public, anon, authenticated;
grant select on public.res_public_services to anon, authenticated;
