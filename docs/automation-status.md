# Automation Status

Tracks every item in [`AUTOMATION-PLAN.md`](./AUTOMATION-PLAN.md). The rules
for changing this file are in §9 of that plan. Reviewed monthly.

**Headline metric — human toil per month:** ~4–5 h/month implied by the
`MAINTENANCE.md` cadence, plus queue review. Not yet measured directly.

## Baseline — measured 2026-09-28 (live DB, read-only, aggregate counts only)

| Signal | Value | What it means for the plan |
|---|---|---|
| Resident users (`res_profiles`) | **2** (of 40 shared Gruvs profiles) | Usage is the bottleneck, not operations. |
| Listings, alerts, market items, lifts, reports, communities | **0** each | Matching, scam, escalation and moderation jobs would have nothing to act on. |
| `res_*` notifications ever sent | **0** | Confirms backlog #45. |
| Nightly maintenance engine | **already live**: `res_run_maintenance()` via `pg_cron` at 02:20, 8 tasks, 26 nights, **0 failures, 0 rows ever affected** | The spine partly exists. It has never done any work, because there has been nothing to do. |
| Engine source in repo | **absent**: `res_run_maintenance`, `res_maintenance_runs` and `res_client_errors` appear nowhere in the repo | Schema drift: the database cannot be rebuilt from source. |
| Live RLS policies | 725 (shared with The Gruvs) | The drift diff (B4) must scope itself to `res_*`. |
| Database size | 57 MB | Around 11% of the free tier's 500 MB. D2 is not urgent. |
| `pg_cron` failures in the last 7 days | 0 of 2 032 runs | Scheduling infrastructure is healthy. |

## Now (evidence-backed)

| Item | Status | Success metric | Review by |
|---|---|---|---|
| 0 · Remove simulated Automation Hub | proposed | No user-facing text claims an action the system didn't perform (enforced by a contract test) | on ship |
| 1a · Bring the live maintenance engine into the repo | **done** (`theresident_maintenance_schema.sql`, guarded by `maintenanceCoverage.test.ts`) | `schemaCoverage.test.ts` covers `res_maintenance_runs` and `res_client_errors`; the engine can be rebuilt from source | on ship |
| 1b · Extend the engine rather than replace it | proposed | Add a kill switch, a cap and a dead-man's switch to `res_run_maintenance`; `res_ops_findings` is the only new table | on ship |
| D1 · Backups + restore drill | proposed | Monthly restore drill passes; restore time recorded | +1 month |
| D3/D4 · Growth + analytics | proposed | Resident users: 2 → first 50; D4 daily rollup live | +1 month |

## Found while doing 1a — need a decision

| Finding | Risk | Proposed fix |
|---|---|---|
| `res_expire_stale_alerts` marks any panic alert with no responder after 6 h as **`false_alarm`** | Turns "nobody came" into "nothing happened", and erases the data needed to measure A4 escalation | New status `expired_unanswered`; raise a `critical` finding instead of closing silently |
| Live DB grants `res_prune_security_logs` to **`authenticated`**; the repo says `service_role` only | Any signed-in user can trigger the prune on demand (it only deletes rows older than 180 days, so the harm is small, but it is drift) | Apply the repo's revoke to the live database |

## Gated on usage (starts automatically when its trigger is met)

| Item | Trigger |
|---|---|
| A1 listing lifecycle (already partly live as `res_expire_stale_listings`) | Its task affects at least 1 row |
| A2 matchmaker | 20 open listings **and** 20 seekers |
| A4 safety escalation | The first real panic alert. **Exception: build before the first community launches — safety cannot wait for data.** |
| A5 abuse containment | 10 reports, or 100 weekly actives |
| C Backlog Builder / Findings Triage agents | Findings exceed about 5 a week |
| D2 quota management | Any quota at 50% of its limit |

## Waiting (not yet triggered)

| Item | Status | Success metric | Review by |
|---|---|---|---|
| B1 · Merged CI + render smoke test | proposed | No render-loop or route crash reaches `main` | +3 months |
| A3 · Notification engine | proposed | Share of meaningful events that produce a `notifications` row: 0% → 100% | +1 month |
| A1 · Listing lifecycle | proposed | Search results older than 30 days: baseline → under 5% | +2 months |
| A4 · Safety escalation | proposed | Median time from panic alert to first acknowledgement: baseline → falling | +1 month |
| B2 · Auto-rollback | proposed | Time a bad deploy stays live: under 10 min | +3 months |
| C · CI Medic agent | proposed | Share of red runs that have a fix PR within 24 h | +2 months |

Everything else in the plan stays `proposed` until it enters this table
under the WIP cap in §9.5.
