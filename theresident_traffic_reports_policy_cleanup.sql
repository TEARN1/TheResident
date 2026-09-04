-- theresident_traffic_reports_policy_cleanup.sql
--
-- Backlog J3. res_traffic_reports carried five policies where three would do,
-- and the usual over-wide grants underneath them.
--
-- THE DUPLICATES. Two pairs were exact:
--   INSERT: "Auth Users Insert Traffic Reports" and "traffic_insert_policy",
--           identical checks — auth.uid() = reporter_id.
--   SELECT: "Public Read Traffic Reports" and "traffic_read_policy",
--           both `using (true)`.
-- Both of each pair is evaluated on every row for every query, and overlapping
-- permissive rules are how a policy quietly ends up meaning something nobody
-- intended: change one, and the other still permits what you thought you had
-- just stopped. The older, prose-named ones are dropped and the `traffic_*`
-- ones kept, because those name their role explicitly rather than falling back
-- to `public` (which is every role, including anon).
--
-- THE GRANTS. anon held INSERT and DELETE. RLS refused both in practice —
-- `auth.uid() = reporter_id` is NULL for a signed-out caller, and NULL is not
-- true — but that is the policy doing the work alone, with no second lock.
-- This is the fifth instance of the same root cause in this project: Supabase
-- grants ALL on a new table to anon and authenticated by default, so a schema
-- that grants without revoking first leaves the rest open.
--
-- Public READ is deliberate and kept: traffic reports are what makes the map
-- useful to somebody who has not signed up yet.
--
-- Paste into the Supabase SQL editor.

do $$
begin
  -- Guarded: this file is applied to the live project and to the local
  -- sql-tests harness, which does not build this table. Missing there means
  -- "not installed", not an error worth aborting over.
  if to_regclass('public.res_traffic_reports') is null then return; end if;

  execute 'drop policy if exists "Auth Users Insert Traffic Reports" on public.res_traffic_reports';
  execute 'drop policy if exists "Public Read Traffic Reports" on public.res_traffic_reports';
  execute 'drop policy if exists "Users Delete Own Traffic Reports" on public.res_traffic_reports';
  execute 'drop policy if exists traffic_delete_policy on public.res_traffic_reports';
  execute 'create policy traffic_delete_policy on public.res_traffic_reports';
  execute 'for delete to authenticated';
  execute 'using ((select auth.uid()) = reporter_id)';
  execute 'revoke all on public.res_traffic_reports from anon, authenticated';
  execute 'grant select on public.res_traffic_reports to anon';
  execute 'grant select, insert, delete on public.res_traffic_reports to authenticated';
end $$;
