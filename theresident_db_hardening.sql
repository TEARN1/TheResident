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

commit;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. public.spatial_ref_sys — NOT fixable from here. Documented, not scripted.
--
--    It's PostGIS's coordinate-system reference data, and it's the one table on
--    the project with RLS disabled (Supabase's weekly security-advisor email
--    flags it every time). It looks fixable — `ALTER TABLE ... ENABLE ROW LEVEL
--    SECURITY` and `REVOKE ... FROM anon, authenticated` are both the textbook
--    remediation — but both were tried directly against this project and both
--    fail: the table and its grants are owned by `supabase_admin`, a role project
--    owners (`postgres`, which is what the SQL Editor runs as) cannot assume.
--    REVOKE against a grant you don't own silently no-ops instead of erroring,
--    which is why this looked fixable before it was actually tested end-to-end.
--
--    The only way to close this is a Supabase support ticket asking them to
--    enable RLS on spatial_ref_sys for this project — that needs their elevated
--    access, not anything runnable from the SQL Editor. Real-world risk is low:
--    this table holds public EPSG coordinate-system definitions, not user data;
--    worst case is someone vandalizing it and breaking map coordinate transforms
--    until it's restored, not a data leak.
-- ─────────────────────────────────────────────────────────────────────────────

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Verification — run this after the commit above and read the output.
--    Expect: three res_listings columns present, listing_type check listing all
--    three values.
-- ─────────────────────────────────────────────────────────────────────────────
select 'columns' as check, string_agg(column_name, ', ' order by column_name) as result
from information_schema.columns
where table_schema = 'public' and table_name = 'res_listings'
  and column_name in ('listing_type', 'event_id', 'visible_until')

union all
select 'listing_type constraint', pg_get_constraintdef(oid)
from pg_constraint where conname = 'res_listings_listing_type_check';
