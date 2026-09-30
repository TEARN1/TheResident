# Maintenance agents (Claude Code Routines)

Scheduled Claude sessions that do engineering labour on this repo. Their
instructions live here so they are reviewed like code; the Routines
themselves are created from these prompts (claude.ai → Code → Routines).

## Rules every agent follows

These are part of every prompt below and are not negotiable:

- **Output is branches, pull requests and issue comments only.** Never push to
  `main`. Never merge. Never apply SQL to the live database.
- **Never skip, disable or quarantine a test** to get green. "Flaky" is not a
  root cause.
- **Read `AGENTS.md` first** — this Next.js has breaking changes — and follow
  the conventions in the files it touches.
- **Run the repo's own checks before opening a PR:** `npx tsc --noEmit`,
  `npx eslint src/`, `npm test`, and `bash sql-tests/run.sh` for any `.sql`
  change.
- **Stop after 3 PRs on the same problem** and open an issue instead; the
  root cause is elsewhere.
- **Detection may act; punishment may not.** No change that bans, hides,
  deletes or penalises a resident without a human decision.

---

## 1. CI Medic — daily, 07:05

> Check the latest GitHub Actions runs on the default branch and on open PRs
> of TEARN1/TheResident. For each red run: reproduce the failure locally,
> find the root cause, and open a PR with the minimal fix plus a test that
> would have caught it. If the failure is outside this repo's control (a
> vendor outage), comment on the run's commit once and stop. If everything
> is green, do nothing and say nothing.

## 2. Findings Triage — daily, 07:35

> Read the open issues labelled `ops-watchdog` and the latest `ops-digest`
> issue in TEARN1/TheResident. For each finding: decide whether it is noise,
> a known pattern, or new. For anything new and real, open one issue with the
> evidence and a proposed fix (as a PR if it is small and in code this repo
> owns). Never acknowledge findings in the database — that is a human's
> decision, made in the Ops Console.

## 3. Dependency Steward — Mondays, 08:10

> Review the open Dependabot PRs in TEARN1/TheResident. For each: read the
> changelog for breaking changes, check out the branch, run the full check
> suite plus `node scripts/smoke.mjs`, and comment with the result and any
> code changes needed. Push fixes to the Dependabot branch only when they are
> small and the checks then pass. Never merge; a person merges.

## 4. Backlog Builder — Wednesdays, 09:20

> Take the highest-priority open item in `docs/LOGIC-BACKLOG.md` (or
> `docs/BACKLOG.md`) that is not already in an open PR. Implement it on a new
> branch with tests, following the conventions of the files you touch, and
> open a PR that explains what it does and how it was verified. One item per
> run. Mark the item "in PR #n" in the backlog file in the same PR.

## 5. Plan Review — first Monday of the month, 09:40

> Re-measure the baselines in `docs/automation-status.md` with read-only,
> aggregate-only SQL against the live database (counts only, never personal
> data). Apply the rules in `docs/AUTOMATION-PLAN.md` §9: for each item past
> its review date, propose keep, tune, promote, demote or retire with the
> evidence; check which usage triggers have fired. Open one PR updating both
> files. A person merges or edits it.
