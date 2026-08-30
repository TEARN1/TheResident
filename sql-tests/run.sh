#!/usr/bin/env bash
# Runs the SQL suite against a THROWAWAY local Postgres. Never touches Supabase.
#
# Why this exists: until now nothing in this repo could test a .sql file. Schema
# files were written, hand-pasted into the Supabase dashboard, and only found to
# be wrong afterwards — which is how res_alerts ended up with a visibility rule
# matching columns the client never wrote. RLS policies and PL/pgSQL are the
# security boundary for the Service Desk, so they get executed and asserted here
# before anyone pastes them anywhere.
#
#   ./sql-tests/run.sh
#
# Needs a local PostgreSQL 16 (`apt-get install postgresql`). Exits non-zero on
# the first failed assertion.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PGBIN="${PGBIN:-/usr/lib/postgresql/16/bin}"
export PATH="$PGBIN:$PATH"

WORK="$(mktemp -d)"
PGDATA="$WORK/data"
SOCK="$WORK/sock"
PORT="${PGPORT:-5433}"
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

echo "→ starting a throwaway Postgres in $WORK"
run "initdb -D $PGDATA -A trust -U postgres" >/dev/null
run "pg_ctl -D $PGDATA -o '-k $SOCK -p $PORT -c listen_addresses=' -l $WORK/pg.log start" >/dev/null
sleep 2

psql_f() { run "psql -h $SOCK -p $PORT -U postgres -v ON_ERROR_STOP=1 -q -f $1"; }

# Stand-ins for what already exists in the live project (auth.uid(), profiles,
# res_infra_providers, the shared res_check_rate_limit) — shapes copied from the
# live information_schema, not guessed.
echo "→ prelude"
psql_f "$ROOT/sql-tests/00-prelude.sql"

# Applied in dependency order, exactly as they must be pasted into Supabase.
for schema in \
  theresident_org_broadcast_schema.sql \
  theresident_service_desk_schema.sql \
  theresident_directory_urgency_schema.sql \
  theresident_room_inventory_schema.sql
do
  echo "→ applying $schema"
  psql_f "$ROOT/$schema"
done

failed=0
for t in "$ROOT"/sql-tests/*.test.sql; do
  echo "→ $(basename "$t")"
  out="$(psql_f "$t" 2>&1)" || { echo "$out"; failed=1; continue; }
  echo "$out" | grep -E '\| [tf]$' | sed 's/^ */   /'
  if echo "$out" | grep -qE '\| f$'; then
    echo "   ✗ an assertion returned false"
    failed=1
  fi
done

if [ "$failed" -ne 0 ]; then
  echo "SQL tests FAILED"
  exit 1
fi
echo "SQL tests passed"
