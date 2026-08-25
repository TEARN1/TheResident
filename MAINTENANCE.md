# Maintenance Cadence

TheResident is solo-maintained and free/open-source only (no paid tooling).
This is the written answer to "how long between maintenance passes" —
it should live here, not only in one person's head.

## Weekly (~15 min)
- Check GitHub Actions CI status on the default branch.
- Skim the `res_audit_log` / security log entries (`addLog` action in
  `src/store/index.ts`) for anything unexpected — `xss_blocked`,
  `auth_failed`, `brute_force_blocked`, `role_switched`,
  `org_broadcast_sent`, or a spike in `Sync failed` notifications, which now
  surface with a real error message instead of `[object Object]` (see
  `utils/errors.ts`).

## Monthly (~1 hour)
- `npm audit` and a dependency bump pass.
- Review the Next of Kin overdue-flag queue.
- Review any auto-flagged listings from the price-anomaly / duplicate-photo
  detection rules (never auto-actioned — human review only).
- Re-run `npm run fuzzer` and confirm it's still 100% blocked across all
  attack categories.

## Quarterly (~half a day)
- Full manual click-through of each dashboard tab (Housing, Community,
  Services, Business, Profile, VibeMap).
- Review pricing/backlog priorities.
- Export and diff the live Supabase RLS policy set against what's expected
  — the actual `CREATE POLICY` statements live in Supabase, not fully
  mirrored in this repo, so this is the one check that can't be automated
  from the codebase alone.
- Prune stale `res_org_units` rows (no owner logged in for 6+ months, or no
  broadcasts/followers) — the org broadcast tree (Batch 10) has no
  self-cleanup, only human review.

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
- **Needs a human, on the cadence above:** RLS policy review, dependency
  updates, CI health, and anything in the audit log that looks like a real
  attack rather than the (expected, blocked) noise the fuzzer already
  covers.
