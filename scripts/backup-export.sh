#!/usr/bin/env bash
# Tier 2 backup — an off-platform logical dump of the live database.
#
# Tier 1 (Supabase PITR) protects the data while Supabase is reachable. This
# protects against losing the Supabase ACCOUNT: suspension, billing lapse, a
# compromised login, a vendor outage that outlasts your patience. A copy that
# lives inside the thing you just lost is not a backup.
#
# See docs/DISASTER-RECOVERY.md for how this fits with the other two tiers.
#
#   DATABASE_URL="postgresql://..." ./scripts/backup-export.sh [output-dir]
#
# The connection string is the pooler/direct URL from
# Supabase → Project Settings → Database → Connection string (URI).
# It is a secret: never commit it, never paste it into a chat.
#
# WHERE THE OUTPUT MUST GO: somewhere that is not Supabase and not the same
# credentials. Different vendor, different login. This script writes a local
# file; moving it off this machine is the step that makes it a real backup,
# and this script deliberately does not do that for you — it cannot know
# which storage you trust.
#
# SCHEDULING THIS. Two flags exist for cron:
#
#   --verify   restore the dump into a throwaway PostgreSQL and count what
#              came back. Without it this proves a FILE exists, which is not
#              the same as proving a BACKUP exists. Slower; worth it.
#   --quiet    print nothing on success. cron mails you only on failure, so
#              a silent run means "worked" and any output means "read me".
#              Failures still print, and the exit code is still the truth.
#
# A weekly line that actually tells you when it breaks:
#
#   0 3 * * 0 DATABASE_URL=... /path/scripts/backup-export.sh --verify --quiet /var/backups/resident
set -euo pipefail

VERIFY=0
QUIET=0
ARGS=()
for a in "$@"; do
  case "$a" in
    --verify) VERIFY=1 ;;
    --quiet)  QUIET=1 ;;
    -*) echo "unknown flag: $a" >&2; exit 2 ;;
    *) ARGS+=("$a") ;;
  esac
done
say() { [ "$QUIET" = "1" ] || echo "$@"; }

OUT_DIR="${ARGS[0]:-./backups}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OUT_FILE="$OUT_DIR/theresident-$STAMP.sql.gz"

if [ -z "${DATABASE_URL:-}" ]; then
  echo "DATABASE_URL is not set." >&2
  echo "  Supabase → Project Settings → Database → Connection string (URI)" >&2
  exit 1
fi

if ! command -v pg_dump >/dev/null 2>&1; then
  echo "pg_dump not found. Install the postgresql client tools." >&2
  echo "  Debian/Ubuntu: apt-get install postgresql-client" >&2
  exit 1
fi

# The server is PostgreSQL 17; a pg_dump older than the server will refuse to
# run rather than produce a subtly wrong dump. Say so clearly instead of
# letting the error scroll past at 2am.
DUMP_MAJOR="$(pg_dump --version | grep -oE '[0-9]+' | head -1)"
if [ "$DUMP_MAJOR" -lt 17 ]; then
  echo "WARNING: pg_dump is version $DUMP_MAJOR but the server is PostgreSQL 17." >&2
  echo "         A dump may be refused or incomplete. Install postgresql-client-17." >&2
fi

mkdir -p "$OUT_DIR"

say "→ dumping to $OUT_FILE"

# --no-owner / --no-privileges: the restore target is a fresh Supabase project
# where the roles are Supabase's own, not this project's. Ownership from the
# source would not resolve there. The GRANTs that matter are recreated by
# theresident_complete_schema.sql (section 35), which is the schema of record.
#
# --schema=public only: auth/storage/realtime schemas belong to Supabase and
# are recreated by the platform, not restored from here.
pg_dump "$DATABASE_URL" \
  --no-owner \
  --no-privileges \
  --schema=public \
  --format=plain \
  | gzip > "$OUT_FILE"

SIZE="$(du -h "$OUT_FILE" | cut -f1)"
say "→ wrote $OUT_FILE ($SIZE)"

# A dump that silently produced nothing is the worst kind of backup, because
# it looks like success in a cron log. Refuse to call it done.
if [ "$(gzip -dc "$OUT_FILE" | head -c 100 | wc -c)" -lt 100 ]; then
  echo "ERROR: the dump is suspiciously small — treat this as FAILED." >&2
  exit 1
fi

# Keep the last 14. Old dumps of a database that has since changed shape are
# still worth having, but not forever.
ls -1t "$OUT_DIR"/theresident-*.sql.gz 2>/dev/null | tail -n +15 | while read -r old; do
  say "→ pruning $old"
  rm -f "$old"
done

# ── Does it actually restore? ─────────────────────────────────────────────
#
# Everything above proves a file was written and is not empty. Neither of
# those is the property you need. The failure that ruins you is a dump that
# looks fine for months and will not load on the day you need it — a
# half-written file from a connection dropped mid-stream, a version skew, an
# extension the target does not have.
#
# So load it, into a throwaway PostgreSQL that is thrown away either way, and
# count what comes back. This is the same argument as the Tier 3 restore
# drill, applied to the data rather than the schema.
if [ "$VERIFY" = "1" ]; then
  say "→ verifying: restoring the dump into a throwaway PostgreSQL"

  PGBIN="${PGBIN:-/usr/lib/postgresql/16/bin}"
  if [ ! -x "$PGBIN/initdb" ]; then
    echo "ERROR: --verify needs a local PostgreSQL ($PGBIN/initdb not found)." >&2
    echo "       Install postgresql-16, or set PGBIN, or drop --verify." >&2
    exit 1
  fi
  export PATH="$PGBIN:$PATH"

  VWORK="$(mktemp -d)"
  VPORT="${VERIFY_PORT:-5443}"
  trap 'pg_ctl -D "$VWORK/d" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$VWORK"' EXIT

  initdb -D "$VWORK/d" -A trust -U postgres >/dev/null
  pg_ctl -D "$VWORK/d" -o "-k $VWORK -p $VPORT -c listen_addresses=" \
         -l "$VWORK/pg.log" start >/dev/null
  sleep 2

  # PostGIS and the Supabase-managed roles the dump references but does not
  # create. Missing these are expected differences between a Supabase project
  # and a bare PostgreSQL, not defects in the dump — so they are supplied
  # rather than allowed to produce noise that trains you to ignore errors.
  psql -h "$VWORK" -p "$VPORT" -U postgres -q -c \
    "create extension if not exists postgis; create extension if not exists \"uuid-ossp\";" \
    >/dev/null 2>&1 || true
  for r in anon authenticated service_role authenticator supabase_admin; do
    psql -h "$VWORK" -p "$VPORT" -U postgres -q -c \
      "do \$\$ begin if not exists (select 1 from pg_roles where rolname='$r')
         then execute 'create role $r'; end if; end \$\$;" >/dev/null 2>&1 || true
  done

  gzip -dc "$OUT_FILE" | psql -h "$VWORK" -p "$VPORT" -U postgres -q \
    > "$VWORK/restore.log" 2>&1 || true

  RES_TABLES="$(psql -h "$VWORK" -p "$VPORT" -U postgres -At -c \
    "select count(*) from information_schema.tables
      where table_schema='public' and table_name like 'res\\_%'")"

  if [ "${RES_TABLES:-0}" -lt 60 ]; then
    echo "ERROR: the dump restored only ${RES_TABLES:-0} res_ tables (expected 60+)." >&2
    echo "       This backup is NOT trustworthy. Last 20 lines of the restore:" >&2
    tail -20 "$VWORK/restore.log" >&2
    exit 1
  fi

  ROWS="$(psql -h "$VWORK" -p "$VPORT" -U postgres -At -c \
    "select coalesce(sum(n_live_tup),0) from pg_stat_user_tables
      where schemaname='public'")"

  say "→ verified: $RES_TABLES res_ tables and $ROWS rows restored cleanly"
fi

if [ "$QUIET" = "1" ]; then exit 0; fi

cat <<EOF

Done. THIS IS NOT YET A BACKUP.

It becomes one when a copy is somewhere that survives losing your Supabase
account. Move it now:

  - object storage on a different vendor (not the same login), or
  - an encrypted copy in a password manager's file vault, or
  - at minimum, a machine that is not this one

Restore procedure: docs/DISASTER-RECOVERY.md
EOF
