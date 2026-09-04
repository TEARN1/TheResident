-- The Resident — systemic grant/policy lockdown
--
-- Why this file exists
-- -------------------
-- Supabase's default privileges grant ALL on every newly created table to
-- `anon` and `authenticated`. A schema file that only ever GRANTs (and never
-- REVOKEs first) therefore leaves every command open at the privilege layer
-- and relies on RLS alone to refuse writes. That is one lock where there
-- should be two, and it is the exact shape of defect that made the
-- res_org_units privilege escalation exploitable: RLS has no column
-- granularity, so when a policy is broader than intended the GRANT is the
-- only thing left standing.
--
-- This has now been found five separate times by hand. Rather than fix a
-- sixth instance later, this file revokes INSERT/UPDATE/DELETE from `anon`
-- and `authenticated` on every RLS-enabled res_* table where NO policy
-- permits that command for that role. Those operations are already refused
-- by RLS today, so nothing that works stops working — the grant is simply
-- no longer the last line of defence.
--
-- It is computed, not hand-listed, so it stays correct as policies change,
-- and it is idempotent: re-running it after adding a policy will not revoke
-- a grant that policy now needs.
--
-- `service_role` is deliberately untouched (it bypasses RLS by design and is
-- never exposed to a browser). SELECT is deliberately untouched: read
-- exposure is a separate question, governed by the policies themselves.
--
-- The permanent invariant is asserted in sql-tests/99f-grant-policy.test.sql.

do $$
declare
  r record;
  n int := 0;
begin
  for r in
    with g as (
      select c.relname as tbl,
             g.grantee  as role,
             g.privilege_type as act
      from information_schema.role_table_grants g
      join pg_class c on c.relname = g.table_name
      join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
      where g.table_schema = 'public'
        and g.grantee in ('anon', 'authenticated')
        and g.privilege_type in ('INSERT', 'UPDATE', 'DELETE')
        and c.relname like 'res\_%'
        and c.relkind = 'r'
        and c.relrowsecurity
    )
    select g.role, g.act, g.tbl
    from g
    where not exists (
      select 1
      from pg_policies p
      where p.schemaname = 'public'
        and p.tablename = g.tbl
        -- a FOR ALL policy reports as cmd = 'ALL' and covers every command;
        -- comparing p.cmd = g.act alone produces false positives.
        and (p.cmd = g.act or p.cmd = 'ALL')
        and (p.roles @> array[g.role]::name[] or p.roles @> array['public']::name[])
    )
  loop
    execute format('revoke %s on public.%I from %I', r.act, r.tbl, r.role);
    n := n + 1;
  end loop;

  raise notice 'grant/policy lockdown: revoked % grant(s)', n;
end
$$;

-- Two grants survive the computed sweep because their policies are written
-- `to public` (which includes anon) rather than `to authenticated`. Both
-- require `user_id = auth.uid()`, which is NULL for an anonymous session, so
-- anon can never satisfy them — the grant is dead weight. Removed explicitly.
-- `authenticated` is unaffected: it holds these grants in its own right.
revoke insert, delete on public.res_gossip_post_reactions from anon;

-- res_security_logs keeps its anon INSERT deliberately: failed sign-in
-- attempts must be recordable before a session exists, and its policy pins
-- those rows to `user_id is null`.
