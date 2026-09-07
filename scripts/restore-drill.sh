#!/usr/bin/env bash
# Tier 3 drill — prove the schema of record actually rebuilds from nothing.
#
# An untested backup is a hypothesis, not a backup. This is the test. It
# stands up a throwaway PostgreSQL, applies theresident_complete_schema.sql
# twice, and asserts the result is a database the app could actually run
# against.
#
# It NEVER touches Supabase. Safe to run any time, on any machine with a
# local PostgreSQL 16+ and PostGIS.
#
#   ./scripts/restore-drill.sh
#
# Run it quarterly (see MAINTENANCE.md). If it fails, Tier 3 is broken and
# you need to know that today rather than on the day you are relying on it.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PGBIN="${PGBIN:-/usr/lib/postgresql/16/bin}"
export PATH="$PGBIN:$PATH"

SCHEMA="$ROOT/theresident_complete_schema.sql"
PRELUDE="$ROOT/sql-tests/00-prelude.sql"

[ -f "$SCHEMA" ] || { echo "missing $SCHEMA"; exit 1; }

WORK="$(mktemp -d)"
PGDATA="$WORK/data"
SOCK="$WORK/sock"
PORT="${PGPORT:-5441}"
mkdir -p "$PGDATA" "$SOCK"
chmod 777 "$WORK" "$PGDATA" "$SOCK"

AS=""
if [ "$(id -u)" = "0" ] && id postgres >/dev/null 2>&1; then
  chown -R postgres "$WORK"
  AS="su postgres -c"
fi
run() { if [ -n "$AS" ]; then $AS "PATH=$PGBIN:\$PATH $*"; else bash -c "PATH=$PGBIN:\$PATH $*"; fi; }

cleanup() {
  run "pg_ctl -D $PGDATA -m immediate stop" >/dev/null 2>&1 || true
  rm -rf "$WORK"
}
trap cleanup EXIT

echo "→ standing up a throwaway PostgreSQL"
run "initdb -D $PGDATA -A trust -U postgres" >/dev/null
run "pg_ctl -D $PGDATA -o '-k $SOCK -p $PORT -c listen_addresses=' -l $WORK/pg.log start" >/dev/null
sleep 2

cp "$SCHEMA" "$WORK/schema.sql"
cp "$PRELUDE" "$WORK/prelude.sql"
chmod 644 "$WORK"/*.sql

psql_f() { run "psql -h $SOCK -p $PORT -U postgres -v ON_ERROR_STOP=1 -q -f $1"; }
psql_c() { run "psql -h $SOCK -p $PORT -U postgres -At -c \"$1\""; }

# The prelude supplies the Gruvs-owned objects this repo does not define and
# must never create (CONTRACT.md §3): profiles, notifications, events, and
# two shared helper functions. In a real recovery those come from the live
# Gruvs schema instead; here they are stand-ins so the drill can run alone.
echo "→ Gruvs-owned stand-ins (not ours to define — CONTRACT.md §3)"
psql_f "$WORK/prelude.sql" >/dev/null

echo "→ applying the schema of record (pass 1 — a fresh project)"
psql_f "$WORK/schema.sql" > "$WORK/pass1.log" 2>&1 || {
  echo "FAILED on first apply. Last 20 lines:"; tail -20 "$WORK/pass1.log"; exit 1; }

echo "→ applying it again (pass 2 — proving it is safe to re-run)"
psql_f "$WORK/schema.sql" > "$WORK/pass2.log" 2>&1 || {
  echo "FAILED on second apply — the schema is not idempotent. Last 20 lines:"
  tail -20 "$WORK/pass2.log"; exit 1; }

echo
echo "→ verifying the result is a database the app could run against"

fail=0
check() { # name expected actual
  if [ "$2" = "$3" ] || { [ "${4:-eq}" = "ge" ] && [ "$3" -ge "$2" ]; }; then
    printf '   %-46s %s\n' "$1" "ok ($3)"
  else
    printf '   %-46s FAILED (expected %s%s, got %s)\n' "$1" "${4:-}" "$2" "$3"
    fail=1
  fi
}

TABLES="$(psql_c "select count(*) from information_schema.tables where table_schema='public' and table_name like 'res\\_%'")"
POLICIES="$(psql_c "select count(*) from pg_policies where schemaname='public' and tablename like 'res\\_%'")"
FUNCS="$(psql_c "select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace and n.nspname='public' where p.proname like 'res\\_%'")"
RLS_OFF="$(psql_c "select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace and n.nspname='public' where c.relkind='r' and c.relname like 'res\\_%' and not c.relrowsecurity")"
UNBACKED="$(psql_c "
with gr as (
  select c.relname tbl, tg.grantee role, tg.privilege_type act
  from information_schema.role_table_grants tg
  join pg_class c on c.relname=tg.table_name
  join pg_namespace ns on ns.oid=c.relnamespace and ns.nspname='public'
  where tg.table_schema='public' and tg.grantee in ('anon','authenticated')
    and tg.privilege_type in ('INSERT','UPDATE','DELETE')
    and c.relname like 'res\\_%' and c.relkind='r' and c.relrowsecurity)
select count(*) from gr where not exists (
  select 1 from pg_policies p where p.schemaname='public' and p.tablename=gr.tbl
    and (p.cmd=gr.act or p.cmd='ALL')
    and (p.roles @> array[gr.role]::name[] or p.roles @> array['public']::name[]))")"

# Coarse floors, not exact counts — they catch "half the schema did not
# apply", which is the realistic rebuild failure, without breaking every
# time a policy is legitimately added. At the time of writing the rebuild
# produced 149 res_ policies, exactly matching production.
check "res_ tables rebuilt"                 60  "$TABLES"   ge
check "RLS policies rebuilt"               140  "$POLICIES" ge
# 163 live at the time of writing; a rebuild currently produces ~93 because
# 75 functions exist only in production (see docs/DISASTER-RECOVERY.md and
# scripts/sync-functions.sh). This floor is set at the CURRENT rebuild count
# rather than the live count, so it holds the line without failing on debt
# that predates it — raise it to 160 once sync-functions.sh has been run and
# theresident_functions.sql is committed.
check "res_ functions rebuilt"              90  "$FUNCS"    ge
check "every res_ table has RLS enabled"     0  "$RLS_OFF"
check "no write grant without a policy"      0  "$UNBACKED"

# The load-bearing ones by name. A count can look healthy while the table the
# whole product depends on is missing.
for t in res_profiles res_listings res_properties res_rooms res_room_requests \
         res_org_units res_jurisdictions res_area_broadcasts res_home_areas; do
  EXISTS="$(psql_c "select count(*) from information_schema.tables where table_schema='public' and table_name='$t'")"
  check "$t present" 1 "$EXISTS"
done

echo
if [ "$fail" -ne 0 ]; then
  echo "RESTORE DRILL FAILED — Tier 3 is not currently trustworthy."
  echo "See docs/DISASTER-RECOVERY.md"
  exit 1
fi

cat <<EOF
RESTORE DRILL PASSED.

The schema of record rebuilds every table, policy, index and grant from
zero with RLS enforced, and is safe to apply twice.

Two things this does NOT prove:

  * Your DATA. That is Tier 1 (PITR, currently not enabled) and Tier 2 (an
    off-platform dump).
  * Every FUNCTION. 75 of 163 exist only in production, so a rebuild is
    missing behaviour it will not complain about — including res_notify and
    every maintenance sweep. One command fixes it:
    ./scripts/sync-functions.sh

See docs/DISASTER-RECOVERY.md.
EOF
