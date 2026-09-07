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
set -euo pipefail

OUT_DIR="${1:-./backups}"
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

echo "→ dumping to $OUT_FILE"

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
echo "→ wrote $OUT_FILE ($SIZE)"

# A dump that silently produced nothing is the worst kind of backup, because
# it looks like success in a cron log. Refuse to call it done.
if [ "$(gzip -dc "$OUT_FILE" | head -c 100 | wc -c)" -lt 100 ]; then
  echo "ERROR: the dump is suspiciously small — treat this as FAILED." >&2
  exit 1
fi

# Keep the last 14. Old dumps of a database that has since changed shape are
# still worth having, but not forever.
ls -1t "$OUT_DIR"/theresident-*.sql.gz 2>/dev/null | tail -n +15 | while read -r old; do
  echo "→ pruning $old"
  rm -f "$old"
done

cat <<EOF

Done. THIS IS NOT YET A BACKUP.

It becomes one when a copy is somewhere that survives losing your Supabase
account. Move it now:

  - object storage on a different vendor (not the same login), or
  - an encrypted copy in a password manager's file vault, or
  - at minimum, a machine that is not this one

Restore procedure: docs/DISASTER-RECOVERY.md
EOF
