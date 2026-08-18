-- ═══════════════════════════════════════════════════════════════════════════
-- 20260815001600_revoke_anon_grants
--
-- Found via the Supabase security advisor, which flagged 21 SECURITY DEFINER
-- functions callable by `anon`. Exactly one of them is Resident-owned:
--
--   res_report_status(text, text, text, text, uuid, float8, float8, timestamptz)
--
-- It was granted to PUBLIC, and PUBLIC includes anon. Combined with SECURITY
-- DEFINER that means anybody holding the project URL and the anon key — both
-- of which ship in the browser bundle by design — could file neighbourhood
-- power/water/network outage reports without ever signing in.
--
-- That matters more here than a generic spam vector would. res_neighbourhood_status
-- feeds the outage consensus that residents use to decide whether the water is
-- actually off, and anonymous writes into it are precisely how you poison a
-- signal people rely on during an emergency.
--
-- CONTRACT.md §5 already required this ("revoke ... from public, anon"); this
-- is one function that slipped through, plus a sweep so the next one cannot.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. The specific offender ───────────────────────────────────────────────
revoke execute on function public.res_report_status(
  text, text, text, text, uuid, double precision, double precision, timestamptz
) from public, anon;

grant execute on function public.res_report_status(
  text, text, text, text, uuid, double precision, double precision, timestamptz
) to authenticated, service_role;

-- ── 2. Sweep every other res_ function ─────────────────────────────────────
-- Belt and braces: one function slipping through is a mistake, the same
-- mistake twice is a process failure. This revokes from public/anon across the
-- board and re-grants only to authenticated + service_role.
--
-- Deliberately does NOT touch non-res_ functions: those belong to The Gruvs
-- (CONTRACT.md §2) and changing another app's grants from this repo is exactly
-- the kind of cross-boundary edit the contract exists to prevent. The 20 Gruvs
-- functions the advisor flagged are reported, not fixed, here.
do $$
declare
  fn record;
  v_sig text;
begin
  for fn in
    select p.oid, p.proname, pg_get_function_identity_arguments(p.oid) as args
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname like 'res\_%'
  loop
    v_sig := format('public.%I(%s)', fn.proname, fn.args);
    execute format('revoke execute on function %s from public, anon', v_sig);
    execute format('grant execute on function %s to authenticated, service_role', v_sig);
  end loop;
end $$;

-- ── 3. Prove it ────────────────────────────────────────────────────────────
-- Fails the migration rather than leaving a silent hole. A grant that came
-- back would otherwise only be noticed by the next weekly advisor email.
do $$
declare v_leaked text;
begin
  select string_agg(distinct routine_name, ', ') into v_leaked
    from information_schema.role_routine_grants
   where routine_schema = 'public'
     and routine_name like 'res\_%'
     and grantee in ('anon', 'PUBLIC');

  if v_leaked is not null then
    raise exception 'res_ function(s) still executable by anon/PUBLIC: %', v_leaked;
  end if;
end $$;
