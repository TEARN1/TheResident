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

**Status:** script exists; scheduling and off-platform storage are a human
step. See "What only a human can do" at the bottom.

### Tier 3 — Schema of record

**Protects against:** needing to rebuild the *structure* from nothing —
a fresh project, a new region, a local development copy, or a forensic
"what did this look like before?" question.

**Recovery target:** the full schema, no data.

**Status: WORKING AND TESTED.** `theresident_complete_schema.sql` is the
whole database — every table, policy, function, trigger, index and grant, in
dependency order, safe to re-run. `./scripts/restore-drill.sh` proves it
rebuilds from zero on an empty PostgreSQL, and runs in CI-able form on
demand.

This tier is the one most startups do not have, and this project does. It is
why a total loss of the Supabase project would cost you *data*, but not the
product.

---

## The drill

**An untested backup is a hypothesis, not a backup.**

Run this quarterly. It takes minutes and it is the only thing that converts
"we have backups" from a belief into a fact:

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
3. Apply the schema of record: paste `theresident_complete_schema.sql` into
   the SQL editor. This is one file on purpose — there is no order to get
   right and nothing to forget.
4. Restore data from the most recent Tier 2 dump:
   `psql "$NEW_DATABASE_URL" -f <the dump file>`
5. Re-seed what lives outside the database:
   - The platform admin row (`res_platform_admins`) — without it nobody can
     approve an official or see crash reports.
   - Edge function secrets (VAPID keys, Paystack keys, service role key in
     the vault).
   - Storage buckets (`gossip-media`) and their policies.
   - The boundary import, if `res_jurisdictions` is empty:
     `theresident_import_boundaries.sql`.
6. Point the app at the new project (Vercel environment variables), redeploy.
7. Work the verification checklist below before telling anyone it is back.

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
| **Schedule the Tier 2 dump** | Anywhere with cron + `DATABASE_URL` | Needs the connection string, which is a secret |
| **Choose off-platform storage** | Not Supabase, not the same login | A vendor/account decision |
| **Run the quarterly drill** | `./scripts/restore-drill.sh` | Fifteen minutes, four times a year |

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
