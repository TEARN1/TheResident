-- theresident_org_unit_column_lockdown.sql
--
-- CLOSES A PRIVILEGE-ESCALATION HOLE.
--
-- res_org_units_update lets any sender of a unit update their own row, and
-- res_org_units_insert checks only that owner_user_id is the caller. Neither
-- says anything about WHICH columns — RLS has no column granularity. So until
-- this file, any signed-in user could run:
--
--   insert into res_org_units (name, tier, owner_user_id, verified, jurisdiction_id)
--   values ('Office of the President', 'municipality', auth.uid(), true, '<national id>');
--
-- and immediately be a verified national broadcaster: verified = true clears
-- the urgent/critical gate, and jurisdiction_id set to the national boundary
-- makes ST_Covers succeed for every area in the country. They could then send
-- a 'critical' notice — which bypasses muting AND billing by design — to every
-- resident who has set a home area.
--
-- This predates the officials work: before boundaries existed, verified and
-- jurisdiction_id did almost nothing. Phases B through F are what turned a
-- latent flaw into a live one, and the verification workflow added alongside
-- this file is worthless while the table itself remains writable.
--
-- THE FIX. Postgres cannot express "this policy covers these columns", but it
-- can express column-level GRANTs. Table-wide insert/update is revoked and
-- granted back column by column, leaving `verified` and `jurisdiction_id`
-- writable only by the security-definer functions in
-- theresident_official_verification_schema.sql, which run as the owner and
-- check res_is_platform_admin() first.
--
-- Everything an office legitimately edits about itself — its name, contact
-- details, description, sector — is untouched.
--
-- Paste into the Supabase SQL editor. Additive only.

revoke insert, update on public.res_org_units from authenticated;

-- Stated explicitly rather than relied on: the directory is meant to be
-- readable by every signed-in user (the SELECT policy is `using (true)`), and
-- a file that revokes should say what it leaves behind.
grant select on public.res_org_units to authenticated;

-- Everything except verified and jurisdiction_id. Listed explicitly rather
-- than computed, so adding a column later is a deliberate decision about
-- whether an office may set it itself.
grant insert (id, parent_id, name, tier, owner_user_id, created_at, sector,
              contact_email, contact_phone, suburb, city, description)
  on public.res_org_units to authenticated;

grant update (parent_id, name, tier, sector,
              contact_email, contact_phone, suburb, city, description)
  on public.res_org_units to authenticated;

-- owner_user_id is deliberately absent from the UPDATE list: handing an office
-- to someone else is a transfer, not an edit, and should go through a function
-- that records it. Insert still sets it, and the policy pins it to the caller.
