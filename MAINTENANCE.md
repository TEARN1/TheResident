# Maintenance Cadence

TheResident is solo-maintained and free/open-source only (no paid tooling).
This is the written answer to "how long between maintenance passes" —
it should live here, not only in one person's head.

## Before shipping any UI change

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

## Weekly (~15 min)
- Check GitHub Actions CI status on the default branch.
- Skim the security log for anything unexpected. Supabase dashboard →
  SQL Editor (the service role bypasses RLS; there is intentionally no
  select policy for normal users):

  ```sql
  select created_at, event_type, action, details, user_id
  from public.res_security_logs
  where created_at > now() - interval '7 days'
  order by created_at desc
  limit 200;
  ```

  Watch for `brute_force_blocked` and `auth_failed` clustering on one
  account, unexpected `role_switched` entries, `xss_blocked` spikes, and
  `org_broadcast_sent` from units you don't recognise. Also check for a rise
  in `Sync failed` notifications, which now carry a real error message
  instead of `[object Object]` (see `utils/errors.ts`).

## Monthly (~1 hour)
- `npm audit` and a dependency bump pass.
- Review the Next of Kin overdue-flag queue.
- Review any auto-flagged listings from the price-anomaly / duplicate-photo
  detection rules (never auto-actioned — human review only).
- Re-run `npm run fuzzer` and confirm it's still 100% blocked across all
  attack categories.
- Prune the security log if it's grown large: `select public.res_prune_security_logs();`
  (drops entries older than 180 days — unbounded growth on a free tier is
  its own outage).

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
