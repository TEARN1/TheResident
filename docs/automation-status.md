# Automation Status

Tracks every item in [`AUTOMATION-PLAN.md`](./AUTOMATION-PLAN.md). The rules
for changing this file are in §9 of that plan. Reviewed monthly (see
`docs/agents/ROUTINES.md`, Plan Review).

**Headline metric — hours of human toil per month:** ~4–5 h implied by the
old `MAINTENANCE.md` cadence. Target once the items below are live: one
Monday digest (~5 min/week) plus the review queues.

## Baseline — measured 2026-09-28 (live DB, read-only, aggregate counts only)

| Signal | Value |
|---|---|
| Resident users | 2 (of 40 shared Gruvs profiles) |
| Listings, alerts, reports, communities | 0 each |
| Nightly maintenance | Live, 8 tasks, 26 nights, 0 failures, 0 rows ever changed |
| Database size | 57 MB (~11% of free tier) |
| `pg_cron` failures, last 7 days | 0 of 2 032 runs |

Two corrections to earlier drafts of this file, which measured the stale
`main` branch rather than `claude/app-fresh-from-main`:
the maintenance engine **is** in the repo (`theresident_schema_part2.sql`
and `theresident_functions.sql`), and the simulated Automation Hub was shown
**only in development builds**, never to real users.

## Status

| # | Item | Status | Where | Success metric |
|---|---|---|---|---|
| 0 | Remove simulated Automation Hub | **done** | deleted | No user-facing claim of an action that did not happen (`honestClaims.test.ts`) |
| 1 | Job registry: on/off switch, global stop, blast-radius cap | **built** · not yet applied | schema part3 §49 | A runaway job stops itself after one run |
| 1 | Findings log (deduplicated) | **built** · not yet applied | §49 | Every critical finding acknowledged within 24 h |
| 1 | Watchdog outside the database | **built** · needs secrets | `ops-watchdog.yml` | A stopped pg_cron is noticed within 3 h |
| A1 | Listing lifecycle | live (pause at 37 days) | part2 | Search results older than 30 days under 5% |
| A3 | Notifications | live (`res_notify`) | functions.sql | Meaningful events produce a row |
| A4 | Panic-alert escalation (10 km at 2 min, admins at 5) | **built** · not yet applied | §49 | Median time to first response, falling |
| A4 | Unanswered ≠ false alarm | **built** · not yet applied | §49 | `expired_unanswered` recorded and surfaced |
| A5 | Rate limits, report auto-hide at 3 | live | part3, functions.sql | — |
| A7 | Retention pruning | live, now switchable | part2 + §49 | — |
| B1 | CI: types, lint, tests, build, smoke, fuzzer, SQL, restore drill | live | `checks.yml`, `ci.yml` | No render crash reaches the default branch |
| B2 | Post-deploy smoke test + automatic rollback | **built** · needs Vercel secrets | `verify-deploy.yml` | A bad deploy stays live under 10 min |
| B4 | Security-log scanner (hourly) | **built** · not yet applied | §49 | — |
| C | Maintenance agents (5 routines) | **written** · not yet created | `docs/agents/ROUTINES.md` | Red CI has a fix PR within 24 h |
| D1 | Nightly verified, encrypted backup | **built** · needs secrets | `backup.yml` | A verified backup every night |
| D1 | Restore drill | live (every push) | `ci.yml` | — |
| D4 | Daily metrics (counts only) | **built** · not yet applied | §49 | Rollup present every day |
| D5 | Download my data (POPIA s23) | **built** · not yet applied | §50 + Profile | — |
| D5 | Delete my account | live | Profile | — |
| — | Weekly digest | **built** · needs secrets | `ops-digest.yml` | Read every Monday |
| — | Dependabot, grouped weekly, framework majors held | **built** | `.github/dependabot.yml` | — |
| — | Findings runbook | **done** | `docs/runbooks/ops-findings.md` | — |

## Gated on usage (starts when its trigger is met)

| Item | Trigger |
|---|---|
| A2 matchmaker digests | 20 open listings **and** 20 seekers |
| Scam-flag review queue in the console | 10 flagged listings |
| D3 growth nudges | 50 residents |
| Quota forecasting (D2) | Any free-tier quota at 50% |
| Help assistant, Claude report pre-sort | Needs a paid Anthropic API key — outside the free-only rule; a decision for the owner |

## To go live (owner actions)

1. **Apply sections 49 and 50** of `theresident_schema_part3.sql` to the live
   project (SQL editor, or ask Claude to apply them).
2. **Add repository secrets:** `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
   `SITE_URL`, `DATABASE_URL`, `BACKUP_PASSPHRASE` (keep a copy offline), and
   optionally `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` for
   automatic rollback.
3. **Create the routines** in `docs/agents/ROUTINES.md`.
