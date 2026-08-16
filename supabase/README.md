# supabase/

The database and edge-function side of The Resident. Created as Layer −1 of
[docs/SELF-MANAGING.md](../docs/SELF-MANAGING.md): automation is code that runs
while you are asleep, so it needs a home, a review gate and a rollback path
before it needs any intelligence.

Project: `feevvddvrjmfbhffccbf` (shared with The Gruvs — see [CONTRACT.md](../CONTRACT.md)).

## Layout

```
migrations/    forward-only, timestamped, one concern each
functions/     edge functions (res-scheduler is the automation dispatcher)
tests/         SQL assertions run against a throwaway database
```

## Rules

1. **Migrations are forward-only.** Never edit an applied migration; add a new
   one. `resident_schema.sql` at the repo root is frozen history — the state of
   the database before this directory existed.
2. **`20260815000500_seed_transitions.sql` is generated.** It comes from
   `src/utils/lifecycle.ts` via `npm run gen:transitions`. Editing it by hand
   makes TypeScript and Postgres disagree about what automation may do; CI
   fails the build if it is stale.
3. **Every new function** is `res_`-prefixed, pins `set search_path = public`,
   and explicitly `revoke`s from `public, anon` before granting (CONTRACT §5).
   The database is default-deny; a function that forgets this is open to anon.
4. **Jobs ship disabled.** `res_jobs.enabled` defaults to false, and the global
   `automation.enabled` policy also starts false. Turning automation on is a
   deliberate, separate, reviewable act.
5. **Staging first.** Every job runs one full cycle in staging before
   production. A broken hourly job in production does damage 24 times a day.

## Order of the automation migrations

| File | What it establishes |
|---|---|
| `20260815000100_universal_columns` | `updated_at` on all 44 `res_*` tables; `archived_at` / `expires_at` / `managed_by` on the 24 automatable ones |
| `20260815000200_audit_log` | `res_audit_log` (append-only, service-role only) + `res_audit()` |
| `20260815000300_automation_substrate` | `res_policies` (kill switch), `res_jobs`, `res_job_runs`, `res_effect_keys`, leasing, `res_revert()` |
| `20260815000400_transitions` | `res_transitions`, guards, and `res_transition()` — the one door for status changes |
| `20260815000500_seed_transitions` | **generated** — the 52 modelled transitions and widened status constraints |

## Applying

```bash
supabase db push --project-ref feevvddvrjmfbhffccbf
```

Verify afterwards with `supabase/tests/verify_automation.sql`, which asserts
grants, append-only enforcement, and that the kill switch is closed.
