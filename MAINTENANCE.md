# Maintenance Cadence

TheResident is solo-maintained and free/open-source only (no paid tooling).
This is the written answer to "how long between maintenance passes" —
it should live here, not only in one person's head.

## Before shipping any UI change
- **`npm run smoke`** — boots the production build and opens every route in a
  real phone-sized browser, failing on a bad status, an uncaught exception, a
  console error, or a page that renders almost nothing. It is the only check
  in this repo that renders a component at all, which is why the throttle bug
  (a 429 to anyone who viewed four pages in a minute) shipped with tsc, the
  unit tests and the build all green. Runs in CI on every push.


`npx tsc --noEmit`, `npm run build` and `npm test` are necessary but **not
sufficient** — none of them render a component. Always also:

```bash
npm run dev
# then load the routes the change touches and watch the terminal + network tab
```

This is not boilerplate caution. A React `useCallback` that takes a piece of
state as a dependency, where its own call chain writes that state, produces
an infinite refetch loop — and `setState(prev => ({ ...prev }))` always
creates a fresh object identity, so the loop is silent to every static
check. Exactly that shipped once on the gossip feed (fixed in a5222e3):
build, lint and all 87 tests passed green while the live page hammered
Supabase in a loop and flashed its loading state forever. ESLint actively
pushed toward it, since `react-hooks/exhaustive-deps` *requires* the
dependency that closes the cycle.

The pattern the rest of this codebase uses correctly, and the one to copy:
a loader callback depends only on stable props/ids, and anything it needs
to read mid-fetch is a **local variable** (see `loadCareCircle` in
`SafetyTab.tsx`) or a ref — never a piece of state that the same chain sets.

## Weekly (~5 min)
- **Read the Monday `Ops digest` issue.** It replaces the three chores that
  used to live here:
  - the off-platform backup — `.github/workflows/backup.yml` now runs it
    nightly, verified and encrypted, once its secrets are set;
  - checking CI — failures open `ops-watchdog` issues;
  - skimming the security log — `res_scan_security_logs()` checks it every
    hour against the thresholds that used to be written here (repeated
    `auth_failed` on one account, any `brute_force_blocked`, injection
    bursts, `role_switched`) and raises a finding.
- Acknowledge or act on anything in **Needs you** (Profile → Ops Console,
  admins only). Every finding type has a runbook in
  `docs/runbooks/ops-findings.md`.

## Monthly (~1 hour)
- `npm audit` and a dependency bump pass.
- Review the Next of Kin overdue-flag queue.
- Review any auto-flagged listings from the price-anomaly / duplicate-photo
  detection rules (never auto-actioned — human review only).
- Re-run `npm run fuzzer` and confirm it's still 100% blocked across all
  attack categories.
- ~~Prune the security log~~ — automatic: it is one of the nightly jobs, with
  its own switch in the Ops Console.

## Quarterly (~half a day)
- **Run the restore drill: `./scripts/restore-drill.sh`.** Fifteen minutes.
  It proves the schema of record still rebuilds a complete, RLS-enforced
  database from zero. An untested backup is a hypothesis, not a backup —
  and the very first run of this drill found twelve tables that would have
  come back with row level security switched off. See
  `docs/DISASTER-RECOVERY.md`.
- Full manual click-through of each dashboard tab (Housing, Community,
  Services, Business, Profile, VibeMap).
- Review pricing/backlog priorities.
- Export and diff the live Supabase RLS policy set against what's expected
  — the actual `CREATE POLICY` statements live in Supabase, not fully
  mirrored in this repo, so this is the one check that can't be automated
  from the codebase alone.
- Prune stale `res_org_units` rows (no owner logged in for 6+ months, or no
  broadcasts/followers) — the org broadcast tree has no self-cleanup, only
  human review. **Nothing to do yet:** the table currently holds 0 rows.
  This becomes real work only once officials and institutions are onboarded,
  and it is listed now so it is not discovered later.

- Export and diff the live RLS policy set (above) is no longer the only check
  that cannot be automated: `sql-tests/` and the Tier 3 restore drill now run
  in CI on every push, and `sql-tests/99f-grant-policy.test.sql` asserts the
  grant/policy correspondence directly against a rebuilt database.

## What's automated vs. what needs a human
- **Automated / self-healing:** transient network failures on writes retry
  once automatically (`utils/resilientCall.ts`), then fall back to the
  offline queue (`src/store/index.ts`'s `offlineQueue` + `replayOfflineQueue`)
  if the retry also fails — the user sees "saved, will sync," not an error.
  Permission/RLS failures are never retried, since retrying can't fix "not
  allowed."
- **Detected but never auto-actioned:** price anomalies, duplicate listing
  photos, off-platform payment pressure, Next of Kin overdue flags — all
  surfaced for human review, never used to auto-ban or auto-restrict an
  account.
- **Backups need a human in three places:** enabling PITR (a billing
  decision, currently OFF — the single highest-value item on this page),
  scheduling the weekly off-platform dump, and running the quarterly restore
  drill. Only Tier 3, the schema of record, is automated and proven. Full
  detail and the recovery order: `docs/DISASTER-RECOVERY.md`.
- **Needs a human, on the cadence above:** RLS policy review, dependency
  updates, CI health, and anything in the audit log that looks like a real
  attack rather than the (expected, blocked) noise the fuzzer already
  covers.

## Platform accounts: the things no script can do

Everything here needs a person with the login. They are listed because each
one has already produced an email that looked like an emergency and was not
triaged for days. Re-check monthly, on the cadence above.

**Supabase — leaked-password protection is OFF.** Authentication → Policies,
one toggle, free. It checks new passwords against HaveIBeenPwned at signup.
It is the only item in the entire Supabase security advisory that is both
ours and actionable; the rest is triaged once and for all in `SECURITY.md`.

**Supabase — PITR is OFF.** A billing decision, and still the highest-value
item on this page. See `docs/DISASTER-RECOVERY.md`.

**Vercel — Deployment Storage sits at 100% of the free 10 GB.** Two halves,
and only one of them is fixed:

* *Stopping the bleeding* is done. `vercel.json`'s `ignoreCommand` runs
  `scripts/vercel-should-build.sh`, which builds `main` and real pull
  requests and skips working branches. Before it, every commit here was
  pushed to two long-lived `claude/**` branches and each push built a full
  preview nobody opened.
* *Reclaiming what was already spent* cannot be automated from here.
  Deployment storage is cumulative and permanent until the deployments
  themselves are deleted, so the meter does not fall on its own — skipping
  new builds only stops it climbing. Delete old preview deployments in the
  dashboard, oldest first; production deployments for `main` are the ones to
  keep. Until that is done the "upgrade to Pro" emails keep arriving, and
  they are accurate.

**Vercel — `thegruvs.com` and `www.thegruvs.com` are misconfigured** on
project `the-gruvs-pt23`. That is the Gruvs project, not this one, and the
fix is DNS records at the registrar. Listed here only so the recurring email
has a known home.

**GitHub — the `The_Gruvs_App` fine-grained token expires 13 September 2026.**
Checked, and worth knowing before the day: **this repository's CI does not use
it, or any secret at all.** `checks.yml` builds against
`https://example.supabase.co` and a placeholder anon key; `ci.yml` and
`nextjs.yml` reference no secrets. So nothing in The Resident breaks when it
lapses. Whatever the Gruvs side automates with it does.

## Backups: what is automatic now, and what still is not

`sql-tests/run.sh` and `scripts/restore-drill.sh` run in CI on every push, so
the schema of record is proven to rebuild from nothing, and every
authorisation assertion from the security review is enforced continuously
rather than whenever someone remembers.

**Tier 2 now runs itself** — `.github/workflows/backup.yml`, nightly, as soon
as the `DATABASE_URL` and `BACKUP_PASSPHRASE` repository secrets exist. Each
dump is restored into a throwaway database before it is kept, encrypted, and
held for 30 days as a GitHub artifact (a different vendor and login from
Supabase). **Store the passphrase somewhere offline as well**: without it the
backups cannot be opened by anyone, including you. A failed night opens an
issue. The manual equivalent, if you prefer your own storage:

```
0 3 * * 0 DATABASE_URL=... /path/scripts/backup-export.sh --verify --quiet /var/backups/resident
```

Then move the output somewhere that survives losing the Supabase account.
That last step is the one that makes it a backup, and no script can do it for
you — it cannot know which storage you trust.
