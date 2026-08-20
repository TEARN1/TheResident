-- The Resident — schema guard + security hardening
-- Project feevvddvrjmfbhffccbf (the ONE project, shared with The Gruvs).
-- Safe to re-run: every statement is idempotent. Paste into Supabase → SQL Editor → Run.

begin;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Listing types (rent / sale / guesthouse) + seasonal guest-house columns.
--    Already applied on the live project — these are no-ops there, and exist so
--    a fresh environment can be brought to the same state from one paste.
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.res_listings
  add column if not exists listing_type text not null default 'rent';

alter table public.res_listings
  add column if not exists event_id uuid references public.events(id) on delete set null;

alter table public.res_listings
  add column if not exists visible_until timestamptz;

-- Re-created rather than ALTERed: a CHECK can't be widened in place, and doing
-- it by name is what lets this whole script stay re-runnable.
alter table public.res_listings drop constraint if exists res_listings_listing_type_check;
alter table public.res_listings
  add constraint res_listings_listing_type_check
  check (listing_type in ('rent', 'sale', 'guesthouse'));

-- Housing filters on both of these on every browse; without indexes each one is
-- a sequential scan over the whole table.
create index if not exists res_listings_listing_type_idx on public.res_listings (listing_type);
create index if not exists res_listings_visible_until_idx on public.res_listings (visible_until);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. public.spatial_ref_sys — the one genuinely open table on the project.
--    It's PostGIS's coordinate-system reference data with RLS disabled, so the
--    anon key can currently write to it.
--
--    `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` is the textbook fix but it
--    normally fails here with "must be owner of table" (the table belongs to the
--    PostGIS extension, not to you), and enabling RLS with no policy would break
--    every coordinate transform anyway. Revoking the writes closes the actual
--    hole while leaving the SELECT that PostGIS genuinely needs.
-- ─────────────────────────────────────────────────────────────────────────────
revoke insert, update, delete, truncate on public.spatial_ref_sys from anon, authenticated;

commit;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Verification — run this after the commit above and read the output.
--    Expect: three res_listings columns present, listing_type check listing all
--    three values, and zero rows from the spatial_ref_sys write-grant check.
-- ─────────────────────────────────────────────────────────────────────────────
select 'columns' as check, string_agg(column_name, ', ' order by column_name) as result
from information_schema.columns
where table_schema = 'public' and table_name = 'res_listings'
  and column_name in ('listing_type', 'event_id', 'visible_until')

union all
select 'listing_type constraint', pg_get_constraintdef(oid)
from pg_constraint where conname = 'res_listings_listing_type_check'

union all
select 'spatial_ref_sys writes still granted',
       coalesce(string_agg(distinct grantee || ':' || privilege_type, ', '), 'none — good')
from information_schema.role_table_grants
where table_schema = 'public' and table_name = 'spatial_ref_sys'
  and grantee in ('anon', 'authenticated')
  and privilege_type in ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE');
