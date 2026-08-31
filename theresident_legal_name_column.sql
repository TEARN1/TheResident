-- theresident_legal_name_column.sql
--
-- The "Legal Name" save on the profile page has always shown "Saved" —
-- setLegalName's sync handler (src/store/index.ts) writes `legal_name` to
-- res_profiles unconditionally, and the UI's confirmation fires on dispatch,
-- not on write success — but the live res_profiles table has never had a
-- legal_name column at all (confirmed via information_schema.columns).
-- Every save has been silently failing.
--
-- Paste into the Supabase SQL editor. Additive only.

alter table public.res_profiles
  add column if not exists legal_name text;
