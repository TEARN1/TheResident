# Backup and disaster recovery

## Why this document exists

Until it was written, the word "backup" did not appear anywhere in this
repository. The entire business — every listing, every property, every
resident account — lived in one Supabase project with no documented restore
path and no copy held anywhere else.

That is the single largest unrecoverable risk this project carries. Not a
security hole (those are recoverable), not a bug (recoverable), not a bad
deploy (recoverable). Losing the database is the only failure mode with no
way back.

This document is the way back.

---

## The three tiers

Each tier protects against a different failure. You need all three, because
each one has a failure the others cover.

### Tier 1 — Point-in-time recovery (Supabase PITR)

**Protects against:** a bad migration, an accidental `delete` without a
`where`, a truncated table. The failures where the database is still there
but the *data* is wrong.

**Recovery target:** any moment in the retention window, usually to the
second.

**Status: NOT ENABLED.** PITR is a paid Supabase add-on and is not on for
this project. On the free tier the only automatic protection is a daily
backup taken by Supabase, which means the worst case is losing up to 24
hours of everything.

> **This is the highest-value item on the whole maintenance list.** It cannot
> be turned on from code — it needs a billing decision in the Supabase
> dashboard: Project Settings → Database → Point-in-Time Recovery.

### Tier 2 — Off-platform logical dump

**Protects against:** losing the Supabase *account*, not just the data.
Suspension, a billing lapse, a compromised login, a vendor outage that
outlasts your patience. Tier 1 lives inside Supabase; if Supabase is the
thing you lost, Tier 1 is gone with it.

**Recovery target:** whenever the last dump ran. Weekly is the floor;
daily once there is real user data.

**How:** `./scripts/backup-export.sh` (see below). The output must be stored
somewhere that is **not Supabase and not the same credentials** — different
vendor, different login. A copy on the same account you just lost is not a
backup.

**Verify it, don't just take it.** `--verify` restores the dump it just made
into a throwaway PostgreSQL and counts what comes back, failing if fewer than
60 `res_` tables load. Without it the script proves a *file* exists, which is
not the same as proving a *backup* exists: a dump cut short by a dropped
connection is still a plausible-looking gzip of the right rough size, and you
find out on the day you can least afford to.

**Scheduling it.** `--quiet` prints nothing on success, so cron mails you only
when something is wrong — failures still print and the exit code is still the
truth. A weekly line that actually tells you when it breaks:

```
0 3 * * 0 DATABASE_URL=... /path/scripts/backup-export.sh --verify --quiet /var/backups/resident
```

**Status:** script exists and both directions are proven — a good dump passes,
a short one is rejected with a non-zero exit. Choosing the machine that runs
that cron line, and the off-platform storage the file is moved to, are the
human steps. See "What only a human can do" at the bottom.

### Tier 3 — Schema of record

**Protects against:** needing to rebuild the *structure* from nothing —
a fresh project, a new region, a local development copy, or a forensic
"what did this look like before?" question.

**Recovery target:** the full schema, no data.

**Status: TABLES, POLICIES AND FUNCTIONS PROVEN.**

`theresident_schema_part1.sql`, `theresident_schema_part2.sql` and
`theresident_schema_part3.sql` — applied in that order — rebuild every table,
policy, trigger, index and grant, in dependency order, safe to re-run. Then
`theresident_functions.sql` rebuilds all 168 Resident-owned functions.
`./scripts/restore-drill.sh` proves the whole sequence from zero on an empty
PostgreSQL, twice, and checks `res_notify`, `res_check_rate_limit`,
`res_distance_m`, `res_broadcast_alert`, `res_public_profile` and
`res_is_platform_admin` by name afterwards.

**This was the long-standing gap and it is now closed.** For most of this
project 75 of the database's functions existed in production and in no file
here — created in the Supabase dashboard during feature work and never
brought back. A database rebuilt from source would have looked healthy and
then failed the moment anything tried to notify a user or expire a listing.

Two things that came out of actually doing it, both of which would have
broken a real restore:

* `profiles.resident_trust_tier` and the whole of `map_zones` are Gruvs-owned
  and were missing from the test harness's stand-ins. `zones_near` returns
  `setof map_zones`, so the function definitions could not even be created
  against a rebuilt database.
* The file sets `check_function_bodies = off`, as `pg_dump` does. These
  functions call each other and there is no reliable dependency order to emit
  them in; without it, the first function referencing a later one aborts the
  entire file.

`theresident_functions.sql` is GENERATED. Do not hand-edit it — re-run
`./scripts/sync-functions.sh`, which asks Postgres for the exact text of each
definition. Almost all of them are SECURITY DEFINER: they run as their owner,
so RLS does not constrain them and the body is the only thing deciding who
gets what. Retyping code like that risks a one-character difference that is a
security hole, not a typo.

**What is still not proven:** that the committed snapshot still MATCHES
production. A function edited in the dashboard drifts from this file silently.
Re-run the script after any dashboard change and commit the result.
`src/store/schemaDrift.test.ts` catches new undocumented functions the client
calls, but it cannot see an edit to one that is already captured.

---

## The drill

**An untested backup is a hypothesis, not a backup.**

This now runs on **every push** (`.github/workflows/ci.yml`, the `database`
job), alongside the full `sql-tests/` suite — which until then was enforced
only by someone remembering to run it, and so was not enforced at all. Run it
by hand as well when you are about to trust it:

```bash
./scripts/restore-drill.sh
```

It stands up a throwaway PostgreSQL, applies the schema of record twice
(proving it is also idempotent), and asserts the result actually contains
the tables, policies and functions the app needs. It never touches Supabase.

If that script fails, Tier 3 is broken and you need to know *before* the day
you are relying on it.

---

## If the worst happens: recovery order

Work top to bottom. Do not skip ahead — each step assumes the one above.

### 1. Establish what actually broke

- **App is down, database is fine** → not a DR event. Check Vercel
  deployment status and the health of the last deploy. Roll back the deploy.
- **Database reachable, data looks wrong** → Tier 1 event. Go to step 2.
- **Supabase project/account gone or inaccessible** → Tier 2 + 3 event. Go
  to step 3.

Do not restore anything until you know which of these it is. A restore
performed against a healthy database is itself a data-loss event.

### 2. Wrong data, database intact (Tier 1)

1. **Stop writes first.** Take the app offline (Vercel → pause the project)
   so new writes do not land on data you are about to roll back.
2. Identify the timestamp *immediately before* the damage.
3. Supabase dashboard → Database → Point-in-Time Recovery → restore to that
   moment. If PITR is not enabled, you are on the most recent daily backup
   instead, and you will lose everything after it.
4. Bring the app back up. Verify sign-in, then verify one write path.

### 3. Project or account lost (Tier 2 + 3)

1. Create a new Supabase project. **Choose the region deliberately** — see
   the note on region at the bottom of this file; the current `eu-west-1`
   placement is a decision worth revisiting, and a rebuild is the cheapest
   possible moment to change it.
2. Enable the extensions the schema needs: `uuid-ossp`, `postgis`.
3. Apply the schema of record: paste `theresident_schema_part1.sql`, then
   `theresident_schema_part2.sql`, then `theresident_schema_part3.sql` into
   the SQL editor. Three files, in that order — parts 2 and 3 depend on part
   1. Beyond that order there is nothing to remember: each part is the whole
   of its range, safe to re-run.
4. Apply `theresident_functions.sql` if it exists (see Tier 3 above — run
   `scripts/sync-functions.sh` and commit it BEFORE you ever need this).
   Without it the rebuilt database is missing `res_notify`,
   `res_check_rate_limit` and every maintenance sweep, and will fail quietly
   the first time anything tries to notify a resident.
5. Restore data from the most recent Tier 2 dump:
   `psql "$NEW_DATABASE_URL" -f <the dump file>`
6. Re-seed what lives outside the database:
   - The platform admin row (`res_platform_admins`) — without it nobody can
     approve an official or see crash reports.
   - Edge function secrets (VAPID keys, Paystack keys, service role key in
     the vault).
   - Storage buckets (`gossip-media`) and their policies.
   - The boundary import, if `res_jurisdictions` is empty:
     `theresident_import_boundaries.sql`.
7. Point the app at the new project (Vercel environment variables), redeploy.
8. Work the verification checklist below before telling anyone it is back.

### 4. Verify before declaring recovery

Do not skip this. A restore that half-worked is worse than a known outage,
because people will trust it.

- [ ] A resident can sign in.
- [ ] A resident can see listings (or the honest empty state).
- [ ] A landlord can create a property and a room.
- [ ] `select count(*)` on the tables that matter matches the dump's own
      counts — actually compare the numbers, do not eyeball the app.
- [ ] `./sql-tests/run.sh` passes against the schema.
- [ ] The founder's platform-admin row exists and the crash-report panel
      renders on the profile page.

---

## What only a human can do

These cannot be automated from this repository and are the gaps that remain:

| Item | Where | Why it needs you |
|---|---|---|
| **Enable PITR** | Supabase → Settings → Database | Costs money; a billing decision |
| **Schedule the Tier 2 dump** | Anywhere with cron + `DATABASE_URL` | Needs the connection string, which is a secret. The cron line is written for you above — use `--verify --quiet`. |
| **Choose off-platform storage** | Not Supabase, not the same login | A vendor/account decision |
| **Run the quarterly drill** | `./scripts/restore-drill.sh` | Fifteen minutes, four times a year |
| **Keep Tier 3 current** | `./scripts/sync-functions.sh` | Needs `DATABASE_URL`. Tier 3 is complete as of 13 Sep 2026 (168 functions); re-run after any change made in the Supabase dashboard |

---

## A note on region

The database is in `eu-west-1` (Ireland). The users are in South Africa.
That is roughly 150–180 ms of round trip before anyone's 3G is accounted
for, on every single request, plus a POPIA cross-border transfer question
that is easier to answer honestly now than after there are thousands of
records.

Moving regions means downtime and a full dump/restore. Today, with almost no
production data, that cost is close to zero. It will never be cheaper than
it is right now, and a Tier 3 rebuild (step 3 above) is exactly the
procedure that would do it.

**This now has its own decision doc with the actual row counts behind it:
`docs/REGION-DECISION.md`.** The recommendation is to move to `af-south-1`
before launch.
