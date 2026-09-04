\set ON_ERROR_STOP on
-- Every write grant must have a policy standing behind it.
--
-- 97-anon-grants.test.sql pins the *function* surface. This pins the *table*
-- surface, and it is the generalisation of a bug this project has now hit
-- five separate times: Supabase's default privileges grant ALL on a new table
-- to `anon` and `authenticated`, so a schema file that grants without
-- revoking first leaves every command open at the privilege layer.
--
-- A grant with no policy behind it is not a live exploit — RLS refuses the
-- operation anyway. It is a missing second lock, and the second lock is what
-- matters: RLS has no column granularity, so when a policy turns out to be
-- broader than intended (as res_org_units_update was, which let any sender
-- make themselves a verified national broadcaster) the GRANT is the only
-- thing left. Requiring the two to agree means a policy mistake costs one
-- lock instead of all of them.
--
-- Scoped to res_* tables: Gruvs-owned tables are not ours to revoke on.
-- SELECT is deliberately excluded — read exposure is governed by the policies
-- themselves and is a different question. service_role is excluded because it
-- bypasses RLS by design and never reaches a browser.

with gr as (
  select c.relname as tbl, tg.grantee as role, tg.privilege_type as act
  from information_schema.role_table_grants tg
  join pg_class c on c.relname = tg.table_name
  join pg_namespace ns on ns.oid = c.relnamespace and ns.nspname = 'public'
  where tg.table_schema = 'public'
    and tg.grantee in ('anon', 'authenticated')
    and tg.privilege_type in ('INSERT', 'UPDATE', 'DELETE')
    and c.relname like 'res\_%'
    and c.relkind = 'r'
    and c.relrowsecurity
)
select 'no_res_table_write_grant_lacks_a_policy_behind_it' as check,
  (select count(*) from gr
    where not exists (
      -- A FOR ALL policy reports as cmd = 'ALL' and covers every command.
      -- Comparing p.cmd = gr.act alone reports false positives; that mistake
      -- was made once while writing this check.
      select 1 from pg_policies p
      where p.schemaname = 'public'
        and p.tablename = gr.tbl
        and (p.cmd = gr.act or p.cmd = 'ALL')
        and (p.roles @> array[gr.role]::name[] or p.roles @> array['public']::name[])
    )) = 0 as pass;

-- The converse failure mode: revoking too much. A policy that permits a write
-- is useless if the grant behind it was taken away, and that failure is
-- silent in exactly the same way the res_area_broadcasts one was — the
-- "permanent public record" had a SELECT policy and no SELECT grant, so it
-- was readable by nobody.
--
-- Two subtleties, both learned by getting this wrong first:
--   * has_table_privilege() is FALSE when a table carries only column-level
--     grants, which is precisely the shape of the res_org_units lockdown
--     (insert/update granted column by column so a sender cannot set
--     `verified` or `jurisdiction_id` on themselves). has_any_column_privilege
--     is the question actually being asked.
--   * Only policies that name a role explicitly are held to this. A policy
--     written `to public` covers anon, but a policy body of
--     `user_id = auth.uid()` can never be satisfied by an anonymous session,
--     so it is not a claim that anon must hold the grant.
with pol as (
  select p.tablename as tbl,
         r.role,
         a.act
  from pg_policies p
  cross join lateral (select unnest(array['anon','authenticated']) as role) r
  cross join lateral (select unnest(array['INSERT','UPDATE','DELETE']) as act) a
  where p.schemaname = 'public'
    and p.tablename like 'res\\_%'
    and (p.cmd = a.act or p.cmd = 'ALL')
    and p.roles @> array[r.role]::name[]
)
select 'every_policy_permitted_write_still_has_its_grant' as check,
  (select count(*) from pol
    where not case
      -- DELETE is table-level only; has_any_column_privilege rejects it
      -- outright ("unrecognized privilege type"), which is an error, not a
      -- failed assertion. INSERT and UPDATE are the two that can be held
      -- column by column.
      when pol.act = 'DELETE'
        then has_table_privilege(pol.role, ('public.' || quote_ident(pol.tbl))::regclass, pol.act)
      else has_any_column_privilege(pol.role, ('public.' || quote_ident(pol.tbl))::regclass, pol.act)
    end) = 0 as pass;
