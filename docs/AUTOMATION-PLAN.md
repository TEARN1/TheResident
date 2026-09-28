# The Resident — Autonomous Operations Plan

> Goal: The Resident runs itself. Listings expire, matches find people,
> abuse gets contained, alerts escalate, deploys roll themselves back, bugs
> get fixed and dependencies stay current — **without a person having to
> remember anything.** Humans are kept for judgement, not labour.

Constraint held throughout: free tier and open-source only, no new
vendors. Everything runs on things this project already has — Supabase
(`pg_cron`, triggers, Edge Functions, the `notifications` + `push-notify`
rails), Vercel, GitHub Actions — plus Claude Code Routines for the agent
layer.

---

## 0. Before building anything: the Automation Hub has to go

`src/app/dashboard/components/shared/AutomationControlPanel.tsx` is mounted
for **every signed-in user** (`dashboard/layout.tsx:498`) and is driven by
`src/utils/automationEngine.ts`, which is entirely simulated:

| What the user is told | What actually happens |
|---|---|
| "R350 cleared via Ozow! TX: ZA-TX-…" | `setTimeout(800)` and a made-up ID. No money moves. |
| "WhatsApp Alert Sent … Routed to +27 …" | A log line. Nothing is sent. |
| "POPIA compliance verified: 42 documents hashed & encrypted" | A hard-coded string with a hard-coded `42`. |
| "active emergency alert(s) dispatched to local security watch" | Nothing is dispatched to anyone. |
| "dispute(s) assigned to 5-member peer jury pool" | No jury exists. |

This is not cosmetic, for three reasons:

- **It is a false safety claim.** A resident who sees "dispatched to local
  security watch" during a panic alert may stop trying other ways to get
  help. In a safety product, that is the worst possible bug.
- **It breaks the contract.** `CONTRACT.md` §6 says neither app moves
  money — broker, never wallet. A "payment cleared" receipt is exactly the
  wallet posture the contract forbids, and it exposes both apps.
- **It is a false compliance claim.** Claiming POPIA verification that
  never ran is a statement a regulator can hold you to.

**Step zero: delete the panel and the engine's simulated methods.** Replace
them with the real Ops Console (§6), admin-only, which shows only things
that actually happened. Every section below is built on that rule: **an
automation that cannot prove it ran does not get to claim it did.**

---

## 1. The spine: one registry for every autonomous job

Self-managing systems fail when they become a pile of cron jobs nobody can
see, stop or audit. So every automation in this plan — database job, CI
workflow or AI agent — registers in one place and reports to one place.

```sql
-- Every autonomous job, its authority, and its off-switch.
create table public.res_automation_jobs (
  key            text primary key,              -- 'listing_staleness'
  plane          text not null,                 -- 'product' | 'platform' | 'code'
  autonomy       smallint not null,             -- 0..4, see ladder below
  enabled        boolean not null default true, -- kill switch, checked on every run
  schedule       text,                          -- cron expression, or 'trigger'
  max_actions_per_run int not null default 100, -- blast-radius cap
  expected_every interval not null,             -- dead-man's switch
  last_run_at    timestamptz,
  last_status    text,
  owner_note     text
);

-- Every run, and every individual action a job took.
create table public.res_automation_runs (
  id          uuid primary key default gen_random_uuid(),
  job_key     text not null references public.res_automation_jobs(key),
  started_at  timestamptz not null default now(),
  finished_at timestamptz,
  status      text not null,          -- 'ok' | 'failed' | 'capped' | 'skipped_disabled'
  actions     int not null default 0,
  details     jsonb not null default '{}'
);

-- Things a human should look at. Acknowledged, never deleted.
create table public.res_ops_findings (
  id           uuid primary key default gen_random_uuid(),
  detected_at  timestamptz not null default now(),
  job_key      text references public.res_automation_jobs(key),
  severity     text not null,          -- 'info' | 'warn' | 'critical'
  summary      text not null,
  details      jsonb not null default '{}',
  acknowledged_at timestamptz,
  acknowledged_by uuid references public.profiles(id)
);
```

RLS on all three: no client access; service role only, plus a
`res_is_ops_admin()` check for the Ops Console's read path.

Four properties come free with this spine:

1. **Kill switch.** `update res_automation_jobs set enabled = false where key = …`
   stops any job on its next tick, from a phone, without a deploy.
2. **Blast-radius cap.** A job that would act on more than
   `max_actions_per_run` rows stops, records `capped`, and raises a
   `critical` finding. A bug that tries to pause 4 000 listings pauses 100
   and wakes you up.
3. **Dead-man's switch.** A watchdog job (the only one that watches the
   others) raises `critical` for any enabled job whose `last_run_at` is
   older than `expected_every`. Silence is never mistaken for health.
4. **Audit trail.** Every autonomous change to a user-visible row is
   traceable to a run ID. "Why did my listing pause?" has an answer.

### The autonomy ladder

Every job is assigned a level. The level is a decision, written down, not
an accident of how the code happens to be written.

| Level | The system may… | Example |
|---|---|---|
| **L0 Observe** | measure and record | DB size, log volume |
| **L1 Surface** | raise a finding for a human | RLS drift, scam heuristic hit |
| **L2 Act, reversibly** | change state in a way the user can undo with one tap, and tell them | pause a stale listing; soft-hide reported content |
| **L3 Act, then report** | change state, verify, report after | auto-rollback a bad deploy; merge a green patch-level bump |
| **L4 Act silently** | routine upkeep with no user-visible effect | prune 180-day-old logs, expire caches |

**The hard ceiling:** nothing that punishes a person — ban, restrict,
permanent delete, trust-score penalty — ever goes above **L1**. That line is
already drawn in `MAINTENANCE.md` for the flag queues and it holds here for
everything. Automation's job is to make sure a human sees the case fast,
not to decide it.

---

## 2. Plane A — the product runs itself

These are the jobs that make the app feel alive and keep it clean without
anyone tending it. Most are already specified in `docs/LOGIC-BACKLOG.md` and
simply never got a scheduler. All run inside Postgres (`pg_cron` +
`security definer` functions) so they cannot be bypassed from the client
and do not depend on anyone having the app open.

### A1. Listing lifecycle — L2 · daily
Backlog #33. The single biggest thing that makes a marketplace look dead is
stale inventory.
- Day 30 untouched → notify the landlord: "Still available?" with one-tap
  Yes / Taken.
- Day 37 with no answer → flip to `paused` (a status the schema already
  has). Out of search, history and reviews kept, one tap republishes.
- An approved room request → listing flips to `taken` automatically (#34).
- Same rule for market items, tool listings and lift clubs past their date.

### A2. Matchmaker — L2 · on insert + daily digest
Backlogs #28, #29 and #31. A two-sided marketplace that waits for both
sides to search is half a marketplace.
- A new listing is matched against open roommate seekers and saved
  searches in range. A new seeker is matched against open listings.
- A new lift is matched against riders on similar routes, using the
  existing haversine logic.
- Matches go out as **one daily digest notification**, never one per
  match. Matches expire when the listing is `taken`.
- Never auto-applies on anyone's behalf (#28.5): a match is an invitation.

### A3. Notification engine — L4 · trigger
Backlog #45. The `notifications` table and `push-notify` function exist, and
the Resident has never inserted a row. Every lifecycle event above — plus
room requests, lift joins, dispatches and care check-ins — inserts a real
`res_*`-typed row via trigger. Push delivery is automatic (CONTRACT §4).
Respect `res_notification_prefs`: quiet hours and digest mode apply to
everything **except panic alerts**.

### A4. Safety escalation ladder — L2 · every minute
This replaces the Hub's fake "dispatched to local security watch" with the
real thing, bounded by what the app can honestly do.
- A panic alert with no responder acknowledgement (#2) after 2 minutes →
  re-notify the care circle and widen the radius one step.
- Still unacknowledged at 5 minutes → notify community admins and raise a
  `critical` finding.
- A care circle check-in (#4) missed → notify the circle (`res_care_missed`).
- The UI tells the user **exactly** who has been notified so far, and
  always shows the real emergency numbers. The app never implies a service
  it doesn't provide.

### A5. Trust & abuse containment — L1/L2 · on insert + hourly
Backlogs #22, #23 and #24.
- **Rate limits** enforced inside the insert RPCs (N listings/day, N
  alerts/hour, N messages/minute), replacing the in-memory `Map` in
  `src/proxy.ts` that resets on every cold start (#24).
- **Scam heuristics** — price far below the suburb median (#32),
  burst-posting, duplicate images or descriptions across accounts,
  "EFT deposit before viewing" in message bodies. **L1:** a finding plus a
  review badge. Never auto-removed.
- **Reports** — N distinct reports soft-hide the content pending review
  (**L2**, reversible, #23.3). Never a ban.
- **Reputation decay** (#19) recomputed nightly, server-side, shown as
  tiers. Decay is L4; a dispute-driven penalty stays L1.

### A6. Community health — L1 · weekly
- Stale `res_org_units` (no owner login for 6 months, no broadcasts, no
  followers) → a candidate list for review. Never pruned automatically.
- Communities with no admin activity for 30 days → prompt the admin, then
  surface to the Ops Console.
- Next-of-Kin overdue flags past threshold → a `critical` finding.

### A7. Data hygiene & privacy — L4 · weekly
- `res_prune_security_logs()` on schedule, recording the row count.
- Delete expired saved searches (#31, 60 days unopened), expired invites
  and stale live-location rows.
- **Real** POPIA retention: purge verification documents past their
  retention window from storage, and record the count. This is the honest
  version of what the fake Hub claimed.

---

## 3. Plane B — the platform heals itself

### B1. One gated pipeline — every PR
Merge `ci.yml` and `nextjs.yml`: today they duplicate each other and watch
different, partly stale branch lists. One workflow, four parallel jobs
(`quality`, `security`, `perf`, `build` on Node 20/22), all required.

Add the two checks that close the gaps that have actually been hit:
- **Render smoke test (Playwright; Chromium is already available).** Load
  every dashboard route headlessly and fail on a React error, or on more
  than N identical requests in a window. Nothing in CI renders a component
  today, which is why the infinite-refetch loop fixed in `a5222e3` passed
  every check while hammering Supabase in production.
- **Contract tests**, beside `schemaCoverage.test.ts`: `res_` prefix on new
  tables; no writes to §3 trust columns; no reads of Gruvs-private columns;
  every `res_*` RPC has `revoke … from public, anon`, an explicit grant and
  a pinned `search_path`. Plus a test that nothing in `src/` claims a
  payment, send or dispatch that no code performs.

### B2. Self-verifying deploys with auto-rollback — L3
- A `/api/health` route returns build SHA, DB reachability and the
  dead-man's-switch status from `res_automation_jobs`.
- After every production deploy, a workflow probes `/api/health` plus the
  key public routes (`/`, `/shops`, `sitemap.xml`) and a headless login
  flow.
- On failure, **roll back to the previous production deployment
  automatically** through Vercel's rollback, then open an issue carrying
  the failing probe output. A broken deploy lives for minutes, not until
  someone notices.

### B3. Continuous production probes — L1 · every 30 min
The same probe on a schedule, plus a weekly Lighthouse run with a stored
trend. It catches breakage the deploy didn't cause: an expired key, a
Supabase outage, a paused free-tier project.

### B4. Database guardrails — L1 · daily
- **RLS drift:** dump live `pg_policies`, function grants and `search_path`
  settings, then diff against a checked-in `supabase/expected-rls.sql`.
  Any change raises a finding with the diff. `MAINTENANCE.md` calls this
  un-automatable; it is only un-automatable while the expected state isn't
  in the repo. Generating that snapshot is also the missing half of "the
  database can be rebuilt from source".
- **Capacity:** database size, fastest-growing tables, and the headroom
  left on the free tier. A free-tier database that hits its ceiling fails
  every write.
- **Security log scanner** (hourly), with thresholds: auth-failure bursts
  on one account, `brute_force_blocked` on several accounts, `xss_blocked`
  above 3× the weekly baseline, unexpected `role_switched`, broadcasts from
  unknown units, and **zero log rows in 24 hours** (the logger is dead).

### B5. Trend gates — weekly
Store fuzzer block-rate and scale-benchmark numbers per run. Fail below a
100% block rate, or on a benchmark regression beyond a set margin. A 5%-a-week
slowdown is invisible per-PR and obvious over a quarter.

---

## 4. Plane C — the codebase maintains itself

This is the layer that makes "manage itself" literal. Claude Code Routines
(scheduled agent sessions on this repo) do the engineering labour. Every
agent works on a branch and opens a PR; **the PR is the human gate.**

| Agent | Schedule | Does | Autonomy |
|---|---|---|---|
| **CI Medic** | on any red scheduled/`main` run | Reproduces the failure, root-causes it, opens a fix PR. Flakes are not a root cause. | L3 for tests/lint · L1 otherwise |
| **Dependency Steward** | weekly | Batches updates, reads changelogs (Next 16 has breaking changes — `AGENTS.md`), runs the full gate, opens one PR. Patch/minor dev-deps auto-merge when green; `next`, `react`, `@supabase/*` never do. | L3 / L1 |
| **Findings Triage** | daily | Reads unacknowledged `res_ops_findings`, groups duplicates, separates noise from signal, and turns each real one into an issue with a proposed fix. | L1 |
| **Backlog Builder** | weekly | Takes the top ⚠️ item from `LOGIC-BACKLOG.md`, implements it with tests, opens a PR, and marks the item in the backlog. | L1 (PR only) |
| **Drift Reconciler** | on RLS-drift finding | Works out whether the live DB or the repo is right, then opens the PR that brings them into line. Never edits the live DB. | L1 |
| **Ops Reporter** | Monday 07:00 | Writes the weekly digest (§5). | L4 |

Hard rules for every agent:
- It **never** pushes to `main`, runs migrations against production, or
  touches a user row. Its only output is branches, PRs and issues.
- It **never** skips, disables or quarantines a test to make CI pass.
- It uses a GitHub token scoped to this repo and no service-role key. The
  database jobs in Plane A hold database power; the agents hold code power;
  nothing holds both.
- Every agent is a row in `res_automation_jobs`, so the kill switch and
  dead-man's switch apply to it too.

---

## 4b. Plane D — the business runs itself

Planes A–C keep the app *working*. They do nothing to keep it *alive*: a
self-managing app with no users is a well-maintained ghost town. These
loops cover what a solo founder would otherwise do by hand.

### D1. Disaster recovery — L4 · nightly (**do this early**)
Everything in this plan assumes the data survives. Right now nothing in
the repo backs it up, and the Supabase free tier does not give you a backup
you can restore on your own schedule.
- A nightly workflow runs `pg_dump` of the `res_*` schema and data,
  **encrypts it** (it contains personal data under POPIA), and stores it
  outside Supabase with 30-day retention.
- **A monthly restore drill:** a job restores the latest dump into a
  scratch database, runs row-count checks and records the result. A backup
  that has never been restored is a hope, not a backup.
- Schema is already rebuildable from the repo's `.sql` files; this covers
  the data.

### D2. Free-tier survival — L1/L3 · daily
The most likely way this app dies is not an attack; it is a quota.
- Supabase pauses free projects after a period of inactivity. A daily
  heartbeat query keeps it awake, and the probe in B3 alarms if it pauses
  anyway.
- Track database size, storage bucket size, Edge Function invocations,
  Vercel bandwidth and GitHub Actions minutes against their free limits.
  Warn at 70%, go critical at 90%, and include the projected date each
  quota runs out.
- Automatic storage relief (L3): recompress oversized listing photos and
  purge orphaned uploads whose row no longer exists.

### D3. Growth loops — L2 · on event
- **Activation:** a new user with no community after 24 hours gets the
  geo-suggested community (#13). A user with no activity after 7 days gets
  one nudge, then none.
- **Invites:** every resolved request, completed lift or returned tool ends
  with "invite a neighbour", using the existing `res_create_invite` RPC.
- **SEO:** the sitemap regenerates from live listings, shops and area
  pages, so new inventory is indexed without a deploy. Dead pages drop out
  and return `410`, not an empty page.
- **Re-engagement is capped:** at most one non-safety push a day per
  person. An app that nags gets uninstalled.

### D4. Product analytics — L0 · daily
You cannot manage a product you cannot see. Record a privacy-safe daily
rollup in `res_metrics_daily` — no personal data, only counts:
- signups, activation rate, weekly actives, retention by cohort
- listings created / paused / taken, match → request conversion
- panic alert time-to-first-acknowledgement (**the most important number
  in the app**)

It feeds the digest's trends section and gives the Backlog Builder agent
evidence for which item to build next, instead of just list order.

### D5. Resident support — L1/L2
- **Self-serve privacy rights (POPIA):** "download my data" and "delete my
  Resident data" buttons that run as jobs, generate the export, and log
  completion. They delete only `res_*` rows — the shared `profiles` row
  belongs to The Gruvs (CONTRACT §2), so account deletion is handed off,
  not performed.
- **Help assistant:** a Claude-backed help panel that answers "how do I…"
  from the app's own info pages. It is read-only — it can explain, never
  act — and it hands off to a human for anything about safety, disputes or
  money.
- **Moderation pre-sort (L1):** Claude classifies each new report or scam
  flag (likely spam / likely genuine / needs urgent eyes) and writes its
  reasoning to the finding. The human still decides; they just start with
  the urgent one.

### D6. Cross-app contract watch — L1 · weekly
The Resident shares one database with The Gruvs, so a change in their repo
can break this app without a single commit here.
- Diff `CONTRACT.md` against the copy in the Gruvs repo, and alarm on any
  divergence ("change it in both or not at all").
- Probe the shared rails (`notifications`, `messages`, `profiles` trust
  columns, `push-notify`) with a canary row and alarm if the shape
  changes.

### D7. Secrets and access hygiene — L1 · monthly
- Flag any secret older than its rotation window: `SUPABASE_SERVICE_ROLE_KEY`,
  `VOUCHER_SIGNING_KEY`, `JWT_SECRET`, and agent tokens.
- Run GitHub secret scanning on every push.
- List who holds ops-admin and service-role access, and have a person
  confirm it each quarter.

---

## 4c. When the system itself goes wrong

Autonomy multiplies bugs as well as labour. These rules keep a bad
automation from becoming an incident.

- **Dry-run first:** every new Plane A job ships with `enabled = false` and
  a `dry_run` flag. It runs for a week recording what it *would* have done,
  a person reads that record, and only then is it switched on.
- **Global stop:** one row (`key = 'all'`) disables every job at once, for
  the day something is clearly wrong and you don't yet know what.
- **Loop breakers:** an agent that opens more than 3 PRs for the same
  finding, or a job that re-triggers itself, disables itself and raises a
  `critical` finding.
- **Runbooks:** each `critical` finding type links a short runbook in
  `docs/runbooks/` — what it means, how to confirm it, how to undo it — so
  the 2 a.m. response is written by a calm person in advance.

---

## 5. The human loop: one digest, one console

### Weekly digest — a GitHub issue every Monday
1. **Needs you** — unacknowledged critical findings, jobs that are
   `capped` or silent, PRs waiting on a human.
2. **What the system did** — counts per job: listings paused, matches
   sent, content soft-hidden, deploys rolled back, PRs merged.
3. **Green** — every job's last successful run, named explicitly. A digest
   that only lists problems can't tell you the monitors are alive.
4. **Trends** — active users, listings, match rate, fuzzer, benchmark, DB
   size.

`critical` findings don't wait for Monday: they insert a `notifications`
row addressed to the ops admins and reach the maintainer by push through
the existing rails.

### Ops Console — replaces the fake Automation Hub
An admin-only dashboard tab (gated by `res_is_ops_admin()`, invisible to
residents) that reads the three spine tables: every job with its autonomy
level, a live kill switch, last run and status; open findings with an
acknowledge button; the review queues (scam flags, reports, NoK overdue,
stale units) in one place. It shows only what happened.

---

## 6. What stays human, permanently

- **Punishment of any kind** — bans, restrictions, permanent deletes, trust
  penalties. Capped at L1, forever.
- **Merging anything but green patch-level dev-dependency bumps.**
- **Schema and RLS changes against production.** Agents propose; a person
  applies.
- **Dependency majors**, especially `next`, `react` and `@supabase/*`.
- **Deciding whether an anomaly is a real attack.**
- **The quarterly click-through.** Probes catch crashes; only a person
  notices the app feels wrong.

---

## 7. Build order

> **Order now set by usage triggers (§9.5).** The table below breaks ties only; `automation-status.md` holds the current queue.

Each phase is useful on its own, and the most urgent work comes first.

| Phase | Ship | Why now |
|---|---|---|
| **0 · Honesty** | Remove `AutomationControlPanel` and the simulated `automationEngine` methods. | False safety, payment and compliance claims are live for every user today. |
| **0b · Survive** | D1 nightly encrypted backups + first restore drill; D2 inactivity heartbeat. | Everything else is worthless if the data is lost or the project pauses. |
| **1 · Spine** | `res_automation_jobs`, `res_automation_runs`, `res_ops_findings`, the watchdog job, `res_is_ops_admin()`. | Nothing autonomous should run without a kill switch and an audit trail. |
| **2 · Gates** | Merged CI, render smoke test, contract tests, Dependabot. | Autonomous PRs need a trustworthy gate before they exist. |
| **3 · Product loop** | A3 notifications → A1 listing lifecycle → A4 safety escalation → A5 rate limits. | These make the app feel alive, and A4 replaces the fake claim with the real thing. |
| **4 · Self-healing** | `/api/health`, post-deploy verify + auto-rollback, 30-minute probes, security log scanner, RLS snapshot + drift diff. | The platform recovers without anyone watching. |
| **5 · Agents** | CI Medic and Dependency Steward first, then Findings Triage, Ops Reporter, Backlog Builder. | Agent labour is only safe on top of phases 1–2. |
| **6 · Close the loop** | Ops Console; A2 matchmaker; A6/A7; trend gates; rewrite `MAINTENANCE.md` to the permanently-human list. | Finish the surface area and retire the manual checklist. |
| **7 · Grow** | D4 analytics → D3 growth loops → D5 support and privacy self-serve → D6 contract watch → D7 secrets hygiene. | The app now keeps itself alive, not just working. |

---

## 8. Definition of done

- No user-facing text claims an action the system didn't perform.
- Every autonomous job has a kill switch, a blast-radius cap and a
  dead-man's switch, and appears in the Ops Console.
- A stale listing pauses itself; a match finds the person; an unanswered
  panic alert escalates; a flood of reports contains itself — with no human
  involved, and every one of those actions reversible.
- A bad deploy rolls itself back within minutes.
- A red CI run has a fix PR open before anyone looks at it.
- Dependencies stay current without a calendar reminder.
- The maintainer's recurring load is **one Monday digest plus the review
  queues** — judgement, not labour.

---

## 9. How this plan improves itself

Three drafts of this plan came from reasoning, not evidence. From here on,
the plan changes because of what the system measures, not because someone
thought of something new. Without that rule a plan only grows, and a plan
that only grows never finishes.

### 9.1 Every item carries its own test
Each job, loop or agent gets a row in `docs/automation-status.md`:

| Field | Example |
|---|---|
| Item | A1 listing lifecycle |
| Status | proposed · dry-run · live · retired |
| Success metric | % of search results older than 30 days: 40% → under 5% |
| Cost | Actions minutes, DB load, and false-positive findings per week |
| Evidence | link to the `res_metrics_daily` series or digest that proves it |
| Review by | date |

An item without a measurable success metric is not ready to build.

### 9.2 Items must earn their keep
At each item's review date, one of four outcomes, recorded in the status
file:
- **Keep** — the metric moved and the cost is acceptable.
- **Tune** — it works but is noisy: change thresholds, not scope.
- **Promote or demote** — change its autonomy level (L0–L4), with the
  evidence that justifies it. Promotion needs at least 4 clean dry-run or
  L1 weeks; any wrongful action demotes it immediately.
- **Retire** — the metric didn't move, or a human keeps overriding it.
  Delete the job and its row in `res_automation_jobs`. Retiring an
  automation is a success, not a failure.

### 9.3 What feeds new items
New items enter the plan only from:
1. **Incidents** — every `critical` finding or outage ends with one
   question: which automation would have caught this sooner? The answer
   becomes a proposed item, or the explicit note "not automatable".
2. **Overrides** — when a human reverses an automated action (republishes
   a paused listing, un-hides content), that is logged. A cluster of
   overrides means the rule is wrong.
3. **Toil** — anything a human did twice in a month by hand.
4. **Metrics** — a D4 number trending the wrong way.

"This would be cool" is not an input. It goes in `LOGIC-BACKLOG.md` as a
product idea instead.

### 9.4 The plan gets a monthly review — by an agent, decided by a human
On the first Monday of each month, the Ops Reporter agent opens one PR
against this file and `automation-status.md`. The PR:
- proposes keep, tune, promote, demote or retire for every item past its
  review date, citing the evidence;
- turns the month's incidents, overrides and toil into proposed items;
- flags anything that has stayed `proposed` for 60 days, to be either
  scheduled or deleted.

A person merges or edits the PR. The plan's history is its git log, so
every change to how the app governs itself is reviewable and reversible.

### 9.5 Items start on evidence, not the calendar
The first measurement (2026-09-28, in `automation-status.md`) showed
2 Resident users and 0 listings, alerts and reports. It also showed a
nightly maintenance engine that has run 26 times without failing and
without ever touching a row. Most of this plan automates activity that
does not exist yet.

So an item enters the build queue when its **trigger** is met, not when
its phase comes round. The triggers are in the status file. The monthly
review evaluates them. The planning order in §7 only breaks ties.

One standing exception: **safety escalation (A4) ships before the first
real community launches.** Waiting for evidence that a safety feature is
needed means waiting for someone to be harmed.

### 9.6 Measure before designing
Before any item is designed, run the read-only baseline query for it
against the live database and record the result in the status file. The
first run of this rule found that the "new" spine and listing-expiry job
already existed — built directly in Supabase, never committed — and would
otherwise have been built twice.

### 9.7 Limits on the plan itself
- **Work in progress cap:** no more than 3 items in `dry-run` at once. A
  new item enters dry-run only when one leaves.
- **Complexity budget:** if `res_automation_jobs` exceeds 25 enabled jobs,
  the next review must retire or merge some before adding any.
- **The plan is measured too:** the metric for the whole plan is **hours of
  human toil per month**. It is recorded in every monthly review, and if it
  isn't falling the plan is failing, however complete it looks.
