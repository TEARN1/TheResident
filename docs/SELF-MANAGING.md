# The Resident — Self-Managing Architecture

**Goal:** the app runs for weeks without a human opening a dashboard; when it
genuinely needs a person, it says so in one place, precisely, with a reason.

**Definition.** "Self-managing" here is four distinct capabilities, and they are
not interchangeable:

1. **Self-operating** — routine lifecycle work happens on a clock (expiry,
   rotation, settlement, nudges) with no one pressing a button.
2. **Self-healing** — when a dependency, job, or client write fails, the system
   detects the divergence and repairs it without losing data.
3. **Self-observing** — it measures itself, notices when it is abnormal, and
   reports what it did and what it could not decide.
4. **Self-governing** — it knows the limits of its own authority, refuses to
   exceed them, logs everything it does, and can undo it.

Most "autonomous app" attempts build #1, skip #2–#4, and become unrecoverable.
This plan builds them in dependency order.

---

## Constraints (non-negotiable, inherited)

From [CONTRACT.md](../CONTRACT.md):

| # | Constraint | Consequence for automation |
|---|---|---|
| §2/§3 | The Gruvs owns `profiles`; Resident may read 11 trust columns, never write | The Guard hard-blocks any automated write to `profiles`. Reputation changes go via `res_award_good_neighbour` / `res_bump_reputation` only |
| §5 | Default-deny DB | Every new function: `res_`-prefixed, `set search_path = public`, `revoke from public, anon`, `grant to authenticated, service_role` |
| §6 | **Broker, never wallet** for peer-to-peer | Automation may change *coordination status* (`claimed`, `rented`, `taken`). It may never compute, hold, transfer, or refund peer money |
| §7 | RLS on every table, signed-in only, no `USING (true)` writes | Jobs run as `service_role` and **bypass RLS entirely** — so RLS stops protecting automated paths. The Guard (Layer 7) replaces it |
| §4 | Notifications go into `notifications`; `push-notify` delivers | Jobs never call push APIs. They insert rows with `res_`-prefixed types |

**One important nuance the contract doesn't spell out:** money *does* move at the
**platform** level — Paystack subscriptions and boosts, written to
`res_subscriptions` by a webhook edge function (`src/utils/subscriptions.ts`,
`src/utils/pricing.ts`). So there are two money classes with different rules:

- **Platform money** (subscriptions, boosts): automation may *read* state and
  *expire* entitlements. It may never charge, refund, or extend a paid term.
- **Peer money** (rent, deposits, tool hire, group buys): automation touches
  nothing but status. Ever.

---

## Verified against the live database (2026-08-16)

Project `feevvddvrjmfbhffccbf`, Postgres 17.6. What the database actually says,
as opposed to what the repo's SQL files claim:

| Question | Answer | Consequence |
|---|---|---|
| Which schema file is deployed? | **Neither, exactly.** `deploy_production_schema.sql` was **never applied** — no `token_code` column, disputes still use `reported_by_id`, resources still use `lat/lon`. But `resident_schema.sql` is also stale: it describes 26 tables, the database has **45** | F1–F4 collapse from a data migration into a **file deletion**. Done |
| How much data is at risk? | **Effectively none — every `res_*` table is at ~0 live rows.** The app is pre-launch | Schema work is nearly free right now. This window closes permanently at launch |
| Is `pg_cron` available? | **Yes, and `pg_net` too** — both already installed | Layer 2 needs no infrastructure request |
| Are there loose write policies? | **No.** Zero `res_*` policies with `WITH CHECK (true)` | The RLS baseline is genuinely sound for *user* paths |
| `updated_at` coverage | **23 of 45 tables have none**, and several with the column have no trigger | F6 confirmed and worse than the file suggested |
| `expires_at` / `archived_at` | **Zero tables have either** (only `res_community_invites` has an expiry) | F7/F10 confirmed |
| Edge functions live | `push-notify`, `paystack-checkout`, `paystack-webhook`, `og-meta`, `delete-account` | The money and notification rails exist and work; automation plugs into them |
| Automation tables | **None** — no audit log, no job registry, no policies | Layer 0–2 is greenfield |

Two corrections to my first pass, both from reading the database rather than
the files: the schema conflict was never a production problem, and 19 tables
exist that no SQL file in this repo describes (`res_purchases`,
`res_subscriptions`, `res_reputation`, `res_reports`, `res_moderation_actions`,
`res_rate_limits`, `res_blocks`, `res_gossip_*`, `res_properties`,
`res_lift_bookings`, and others). **The database is the source of truth; both
SQL files are documentation that drifted.** That is precisely the condition the
Layer 5 drift check exists to prevent from recurring.

## What I found in the codebase (the real starting position)

These are not hypothetical risks; they are in the tree today, and each one
determines a step below. F1–F4 are now **resolved** (see the table above); the
rest stand.

| # | Finding | Where | Blocks |
|---|---|---|---|
| F1 | **Two contradictory schema files.** `res_listings.status` is `open\|taken\|paused` vs `available`; disputes use `reported_by_id/against_user_id` vs `claimant_id/respondent_id`; shared resources use `title/lat/lon` vs `name/latitude/longitude` | `resident_schema.sql` vs `deploy_production_schema.sql` | **Everything.** A job cannot act on a status that has two definitions |
| F2 | `deploy_production_schema.sql` stores `token_code` on utility tokens | that file, §3 | Violates CONTRACT §6 |
| F3 | `USING (true)` public read on `profiles`, disputes, listings in the production file | that file | Violates CONTRACT §7 |
| F4 | `res_security_logs` insert policy is `WITH CHECK (true)` | that file | Unbounded anonymous write vector; also the wrong shape for an audit log |
| F5 | **No `supabase/` directory, no migrations dir, no CI** in this repo. `paystack-checkout` / `push-notify` are invoked but live elsewhere | repo root | Automation has no home and no deploy path |
| F6 | **No `updated_at`** on `res_room_requests`, `res_service_dispatches`, `res_alerts`, `res_notice_events`, `res_chore_schedule`, `res_traffic_reports` | `resident_schema.sql` §4 trigger list covers only 13 of 26 tables | Time-based rules have no clock |
| F7 | **No expiry anywhere.** `res_traffic_reports` (potholes, roadblocks) never expire — the map accumulates stale hazards forever. No `expires_at` on listings, alerts, or market items | schema | The single most visible "nobody is managing this" symptom |
| F8 | **Offline queue loses writes.** `replayOfflineQueue` clears the queue *before* replaying; a replay that fails takes the `options.replay` branch, which is barred from re-queueing | `src/store/index.ts:2215` | Silent data loss; no server-side durability |
| F9 | No status on `res_listings` gates visibility — `res_listings_select` is `using (true)` | `resident_schema.sql` | Moderation has no lever: nothing can be hidden |
| F10 | No `archived` state anywhere; deletes are hard `on delete cascade` | schema | An autonomous system that deletes is unrecoverable |
| F11 | `res_care_circle.last_ok_at` and `res_group_buys.deadline` exist but nothing reads them on a schedule | schema | Two high-value jobs are already one query away |
| F12 | `res_listings.last_verified_at` exists (VibeMap) but never decays | schema | Freshness claims silently become lies |

F11 and F12 are good news: the data model already anticipates automation. F1 and
F5 are the two hard blockers.

---

# LAYER −1 — Delivery foundation

*Nothing below can ship without this. Roughly the first week.*

Automation is code that runs when you are asleep. It needs a home, a review
gate, and a rollback path before it needs intelligence.

### Steps

1. **Create the `supabase/` tree in this repo.**
   ```
   supabase/
     config.toml
     migrations/            # timestamped, forward-only, one concern each
     functions/
       res-scheduler/       # single dispatcher — see Layer 2
         index.ts
         jobs/              # one file per job
         lib/               # guard, audit, claim, metrics
       _shared/
     seed.sql
     tests/                 # pgTAP or SQL assertion scripts
   ```
2. **Adopt forward-only migrations.** `resident_schema.sql` becomes
   `migrations/00000000000000_baseline.sql` and is thereafter **read-only
   history**. Every change after that is a new timestamped file. This is what
   makes drift detection (Layer 6) possible at all.
3. **Delete `deploy_production_schema.sql`** after reconciliation (Layer 0,
   Step 1). Two schema files is the root cause of F1–F4.
4. **CI gate** (`.github/workflows/ci.yml`): `npm run lint`, `npm test`
   (the five existing suites), `npm run fuzzer`, `supabase db lint`, and
   **migration replay onto a clean database**. No migration merges unless it
   applies cleanly from zero.
5. **Environments.** `local` (Supabase CLI) → `staging` (a real Supabase branch)
   → `production`. Every job runs in staging for one full cycle before
   production. Non-negotiable for cron work: a broken hourly job in production
   does damage 24 times a day.
6. **Secrets discipline.** `SERVICE_ROLE_KEY` lives only in edge-function env,
   never in Next.js (`NEXT_PUBLIC_*` is public). Add a CI check that greps for
   service-role keys in `src/`.

**Exit gate:** a trivial migration and a no-op edge function can go
local → staging → production, and CI blocks a deliberately broken migration.

---

# LAYER 0 — Truth and invariants

*Automation multiplies whatever it is built on, including mistakes.*

### Step 0.1 — Reconcile the schema (fixes F1–F4)

Decide, per conflicted table, which definition is real by querying the live
production database — not by reading either file:

```sql
select table_name, column_name, data_type
from information_schema.columns
where table_schema='public' and table_name like 'res\_%'
order by table_name, ordinal_position;
```

Then write **one** reconciliation migration that: renames columns to the
canonical (`resident_schema.sql`) names, migrates status values with an explicit
mapping (`available → open`, etc.), drops `res_utility_tokens.token_code` (F2),
replaces the `USING (true)` policies (F3), and rebuilds `res_security_logs`
properly (F4). Ship it behind a read-only verification query run before *and*
after.

**Acceptance:** `information_schema` matches the baseline migration exactly;
`deploy_production_schema.sql` is deleted; a drift query returns zero rows.

### Step 0.2 — Universal columns (fixes F6, F7, F10)

Every automatable `res_*` table gets:

```sql
alter table public.res_<t>
  add column if not exists updated_at  timestamptz not null default now(),
  add column if not exists archived_at timestamptz,
  add column if not exists expires_at  timestamptz,
  add column if not exists managed_by  text;   -- null = human, else job name
```

- `updated_at` + the existing `touch_updated_at()` trigger extended to **all 26
  tables** (currently 13).
- `expires_at` is the single field every expiry job reads. One index:
  `create index on res_<t> (expires_at) where archived_at is null;`
- `managed_by` makes "did a human or a job last touch this?" a query, not an
  investigation.

### Step 0.3 — Soft delete everywhere (fixes F10)

Replace hard deletes with `archived_at = now()`. Update every RLS `select`
policy to append `and archived_at is null`. Add a much later
`purge_archived` job (Layer 3) that hard-deletes after 90 days — the only job
in the system permitted to delete, and it is Human-only tier for its first
month.

### Step 0.4 — The audit log

The single most important table in this plan. Append-only; nothing may update
or delete it.

```sql
create table public.res_audit_log (
  id           bigserial primary key,
  at           timestamptz not null default now(),
  actor_kind   text not null check (actor_kind in ('user','job','policy','operator','system')),
  actor_id     uuid,              -- profiles.id when actor_kind='user'
  job_name     text,              -- when actor_kind='job'
  action       text not null,     -- 'listing.expire', 'request.auto_expire'
  entity       text not null,     -- 'res_listings'
  entity_id    uuid,
  before       jsonb,
  after        jsonb,
  reason       text not null,     -- human-readable WHY
  reversible   boolean not null default false,
  reverse_spec jsonb,             -- exact payload for res_revert()
  correlation  uuid,              -- groups one job run's writes
  tier         text check (tier in ('auto','propose','human'))
);
create index on res_audit_log (entity, entity_id, at desc);
create index on res_audit_log (job_name, at desc);
create index on res_audit_log (correlation);

revoke all on public.res_audit_log from public, anon, authenticated;
grant select, insert on public.res_audit_log to service_role;
```

`reason` is `not null` on purpose. If a job cannot articulate why it acted, it
should not act.

**Retention:** partition by month, keep 13 months hot, archive to storage after.

### Step 0.5 — Idempotency

Jobs will run twice — retries, overlapping cron, manual re-runs. Every automated
write must be safe to repeat. Three permitted patterns:

1. **Guarded update** — the condition is in the `WHERE`:
   `update res_listings set status='expired' where id=$1 and status='open'`
   (returns 0 rows on the second run; that is success, not failure).
2. **Natural-key upsert** — `on conflict do update`, as
   `res_pledge_group_buy` already does correctly.
3. **Effect key** — for side effects (notifications), a
   `res_effect_keys(key primary key, at)` table; insert first, and if it
   conflicts, skip. Prevents the classic "job retried, user got 40 push
   notifications at 3am."

### Step 0.6 — Status enum audit

Across the 26 tables statuses are currently ad-hoc: `open|taken|paused`,
`pending|approved|rejected`, `available|claimed`, `active|resolved|false_alarm`,
`pending|mediating|resolved`, `available|pending|gone`, `open|reunited`,
`up|down|stage`. Produce **one table** documenting every entity's states, then
extend each `check` constraint with the states automation needs
(`expiring`, `expired`, `auto_expired`, `flagged`, `suspended`, `archived`).

**Layer 0 exit gate:** every `res_*` table has `updated_at`, `archived_at`,
`expires_at`, `managed_by`; `res_audit_log` exists and is service-role-only;
the status catalogue is written; drift query is clean.

---

# LAYER 1 — State machines

*Nothing manages itself until "what state is this, and what may follow" is data.*

### Step 1.1 — The transition table

`src/utils/lifecycle.ts` — a single exported const, unit-tested like
`logic.test.ts` already tests rules:

```ts
export interface Transition {
  entity: string
  from: string
  to: string
  trigger: 'user' | 'job' | 'policy' | 'operator'
  guard?: string          // named guard fn, e.g. 'isLandlord'
  effects?: string[]      // 'notify:res_request_approved'
  reversible: boolean
}
```

Model, at minimum:

| Entity | Lifecycle |
|---|---|
| `res_listings` | `draft → open → boosted → expiring → expired → archived`; plus `flagged`, `suspended` from any live state |
| `res_room_requests` | `pending → approved \| rejected \| withdrawn \| auto_expired` |
| `res_service_dispatches` | `pending → accepted → en_route → completed \| abandoned \| disputed` |
| `res_community_disputes` | `pending → mediating → resolved \| escalated \| stale_closed` |
| `res_alerts` | `active → responded → resolved \| false_alarm \| auto_closed` |
| `res_utility_tokens` | `available → claimed → collected \| expired` |
| `res_tool_library` | `available → rented → overdue → returned \| lost` |
| `res_group_buys` | `open → threshold_met \| expired_short → completed \| cancelled` |
| `res_lost_found` | `open → reunited \| stale_archived` |
| `res_market_items` | `available → pending → gone \| expired` |
| `res_care_circle` | `active → overdue → escalated → active \| paused` |
| verification | `unverified → submitted → in_review → verified \| rejected` |
| `res_subscriptions` | `active → past_due → grace → lapsed` (read-only to jobs; written by webhook) |

### Step 1.2 — The `res_transition()` RPC

**Every** status change — human *and* machine — goes through one function:

```sql
create or replace function public.res_transition(
  p_entity text, p_id uuid, p_to text,
  p_reason text, p_actor_kind text default 'user', p_job text default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
-- 1. read current row, lock it (select ... for update)
-- 2. look up (entity, from, to) in res_transitions; reject if absent
-- 3. evaluate the guard for this actor_kind
-- 4. perform the update
-- 5. insert res_audit_log with before/after/reason/reverse_spec
-- 6. return the new state
$$;
```

An illegal transition **raises**, it does not silently no-op. The allowed
transitions live in a `res_transitions` table generated from `lifecycle.ts`, so
TypeScript and Postgres cannot disagree.

### Step 1.3 — Migrate existing call sites

`src/store/index.ts` and `src/store/actions.ts` currently write status directly.
Convert them to `res_transition` calls incrementally, one entity at a time, with
the old path removed as each lands. **Do not** start Layer 2 for an entity until
that entity's writes all go through the RPC — otherwise jobs and the UI will
fight over the same rows with different rules.

**Exit gate:** `res_transition` is the only path that writes a status column;
add a CI grep asserting no `.update({ status`  remains in `src/`.

---

# LAYER 2 — Execution substrate

*The clock, the claim, the batch, the record. No business logic here.*

### Step 2.1 — Tables

```sql
create table public.res_jobs (
  name                 text primary key,
  description          text not null,
  schedule             text not null,          -- cron expression
  enabled              boolean not null default false,   -- ships OFF
  tier                 text not null check (tier in ('auto','propose','human')),
  batch_size           int  not null default 200,
  max_rows_per_run     int  not null default 1000,       -- blast radius cap
  timeout_seconds      int  not null default 60,
  lease_until          timestamptz,            -- crash-safe lock
  lease_owner          uuid,
  last_run_at          timestamptz,
  last_status          text check (last_status in ('ok','partial','failed','skipped')),
  last_error           text,
  consecutive_failures int not null default 0,
  circuit_open_until   timestamptz
);

create table public.res_job_runs (
  id             bigserial primary key,
  job_name       text not null references res_jobs(name),
  correlation    uuid not null,
  started_at     timestamptz not null default now(),
  finished_at    timestamptz,
  status         text,
  rows_scanned   int default 0,
  rows_affected  int default 0,
  detail         jsonb,
  error          text
);
create index on res_job_runs (job_name, started_at desc);
```

### Step 2.2 — The dispatcher

**One** edge function, `supabase/functions/res-scheduler`. `pg_cron` calls it
with a job name; it does not contain job logic:

```
POST /res-scheduler { "job": "expire_listings" }
```

Execution contract, in strict order:

1. **Global kill switch** — `res_policies['automation.enabled']`. If false,
   record `skipped` and return. Checked first, always, before anything else.
2. **Job enabled?** and **circuit open?** (`circuit_open_until > now()`) → skip.
3. **Acquire lease** — `update res_jobs set lease_until = now() + interval,
   lease_owner = $uuid where name=$1 and (lease_until is null or lease_until < now())`.
   Zero rows updated → another instance holds it → exit. Crash-safe: the lease
   expires on its own, no stuck locks.
4. **Open a run row** with a fresh `correlation` uuid.
5. **Work in bounded batches** — `limit batch_size`, loop to `max_rows_per_run`,
   stop and report `partial` if the cap is hit. Never an unbounded `UPDATE`.
6. **Every write via the Guard** (Layer 7) with the correlation id.
7. **Close the run**; on failure increment `consecutive_failures`, and at 3 set
   `circuit_open_until = now() + 30 min` (a broken job stops hammering).
8. **Emit metrics** (Layer 6).

### Step 2.3 — Cron registration

```sql
select cron.schedule('res_expire_listings', '7 * * * *', $$
  select net.http_post(
    url := current_setting('app.scheduler_url'),
    headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.scheduler_secret')),
    body := '{"job":"expire_listings"}'::jsonb
  );
$$);
```

Two details that matter: **stagger the minutes** (`:07`, `:13`, `:21`…) so
eleven jobs don't stampede the connection pool on the hour; and the scheduler
endpoint authenticates with a shared secret — it must not be publicly callable.

### Step 2.4 — Manual controls

- `res_run_job(p_name text)` — Human-only tier RPC to force a run (staging
  debugging, incident recovery).
- `res_dry_run(p_name text)` — executes the job's *selection* query and returns
  the rows it **would** touch, without writing. **Every job must support this**,
  and every job's first production execution is a dry run whose output you read.

**Exit gate:** a no-op `heartbeat` job runs hourly in production for 48 hours
with a clean run log, correct leasing under a forced double-invoke, and a
working kill switch.

---

# LAYER 3 — The job catalogue

Each job is one file under `functions/res-scheduler/jobs/`, with a declared
selection query, action, effects, tier, and cap. Ordered by
value-per-unit-of-risk — build top-down.

### Tranche A — Expiry and freshness (highest value, lowest risk)

| Job | Cadence | Selection | Action | Notify |
|---|---|---|---|---|
| `expire_traffic_reports` | 15 min | `res_traffic_reports` older than type-specific TTL (congestion 2h, accident 6h, roadblock 24h, pothole 30d) | archive | — |
| `expire_listings` | hourly | `res_listings` where `expires_at < now()` and status in (`open`,`boosted`) | → `expired` | landlord: "relist?" |
| `expire_boosts` | hourly | boosted listings whose boost window closed | → `open`, clear boost ordering | owner |
| `expire_market_items` | daily | `res_market_items` `available` and untouched 45d | → `expired` | owner |
| `stale_lost_found` | daily | `res_lost_found` `open` > 60d | → `stale_archived` | owner |
| `decay_verification` | daily | `last_verified_at` > 90d on listings/vendors/resources (F12) | set `needs_reverify`, drop the "verified" badge | owner |
| `expire_notices` | daily | `res_notice_events` with `event_date` past | archive | — |

`expire_traffic_reports` alone removes the app's most visible neglect symptom.
Ship it first; it is pure archive-with-audit and touches no money or trust.

### Tranche B — Coordination and nudges

| Job | Cadence | Behaviour |
|---|---|---|
| `stale_room_requests` | daily | `pending` > 7d → `auto_expired`; notify both sides; do **not** penalise the landlord on the first offence |
| `nudge_room_requests` | daily | `pending` at 48h → one nudge to the landlord (effect-keyed so it fires once) |
| `chore_rotation` | daily 06:00 | advance `res_chore_schedule`, mark missed, notify today's assignee |
| `care_circle_check` | hourly | `res_care_circle` where `last_ok_at` older than cadence → `overdue`, notify carer; +24h → `escalated`, notify circle (F11) |
| `groupbuy_settle` | hourly | past `deadline`: threshold met → `threshold_met`; short → `expired_short`; notify all pledgers. **Status only — no money** (F11) |
| `tool_overdue` | daily | `rented_until` past → `overdue`, notify both; **never** compute a late fee (CONTRACT §6) |
| `token_expiry` | daily | `claimed` but uncollected > 72h → back to `available`, notify |
| `dispatch_abandoned` | 6-hourly | `pending` > 48h with no acceptance → `abandoned`, notify sender, suggest alternatives |
| `alert_auto_close` | 15 min | `res_alerts` `active` with no responder after N hours (severity-scaled: critical 2h, low 24h) → `auto_closed`. **Critical alerts also escalate to a human** — never silently close a panic |
| `dispute_ladder` | daily | day 3 nudge → day 7 `escalated` → day 21 `stale_closed`. Escalation is Propose tier, not Auto |

### Tranche C — Platform money (read-and-expire only)

| Job | Cadence | Behaviour |
|---|---|---|
| `subscription_lapse` | hourly | `res_subscriptions` `active` past period end with no renewal → `past_due` → 7d `grace` → `lapsed`; removes entitlement. **Never charges, never refunds, never extends** |
| `reconcile_boosts` | hourly | listings flagged `boosted` with no corresponding paid purchase → unboost + incident (this is a revenue-integrity check both ways: it also flags *paid but not boosted*, which is the customer-harming direction) |
| `verification_queue` | 15 min | orders the verification queue: paid speed-ups first, then FIFO. Ordering only — approval is Layer 4/7 |

### Tranche D — Hygiene

| Job | Cadence | Behaviour |
|---|---|---|
| `storage_gc` | weekly | objects under `${user.id}/res/*` with no referencing row, older than 7d → delete. Dry-run-only for its first month |
| `purge_archived` | weekly | hard-delete `archived_at < now() - 90d`. **Human tier indefinitely** |
| `notification_prune` | weekly | read notifications > 90d |
| `metrics_rollup` | hourly | Layer 6 aggregation |
| `drift_check` | daily | Layer 5 schema/RLS assertions |
| `canary` | 30 min | Layer 6 synthetic user journey |
| `daily_digest` | daily 07:00 | Layer 6 self-report |

**Per-job checklist** (definition of done — no job merges without all seven):
declared in `res_jobs`; dry-run supported; idempotent by one of the three
patterns; bounded by `batch_size`/`max_rows_per_run`; writes audit rows with a
reason; emits metrics; has a test with a fixture proving both the acting and the
non-acting case.

---

# LAYER 4 — Policy engine

*The judgment layer. Declarative, so tuning is a config change, not a deploy.*

```sql
create table public.res_policies (
  key         text primary key,     -- 'moderation.new_account_listing_cap'
  description text not null,
  params      jsonb not null,
  enabled     boolean not null default true,
  updated_by  uuid,
  updated_at  timestamptz not null default now()
);
```

### 4.1 Moderation — deterministic first

Do not start with an LLM. Start with rules that are cheap, explainable, and
already half-built in `src/utils/security.ts` (which has 20+ injection/XSS
detectors and a `scanInput` aggregator):

- **Rate limits** per user per entity per hour (`checkRateLimit` exists
  client-side at `security.ts:627` — it must be re-implemented server-side; a
  client-side limit is a suggestion, not a control).
- **Duplicate detection** — normalised title+price+suburb hash; N identical
  listings → flag.
- **Contact-detail leakage** — phone numbers and WhatsApp links in free-text
  bodies where the product intends DM-gated contact.
- **New-account throttle** — accounts < 24h old capped on listings/alerts.
- **Content scan** — run `scanInput` server-side on insert via a trigger;
  hits go to `res_flags`, not straight to a block.
- **Panic-alert abuse** — repeated `critical` alerts from one user with no
  responder confirmation → flag for human review. Never auto-suppress: the cost
  of a suppressed real emergency dwarfs the cost of a false one.

```sql
create table public.res_flags (
  id bigserial primary key, entity text, entity_id uuid, rule text,
  severity int, detail jsonb, status text default 'open', at timestamptz default now()
);
```

### 4.2 Reputation

A Resident-side score in `res_reputation` (already exists, bumped by
`res_bump_reputation`) computed weekly from: dispatch completion rate, dispute
rate as respondent, request response latency, no-show reports, listing accuracy
(reverify confirmations), tenure. Feeds **ranking**, not bans. Never writes
`profiles` (§3).

### 4.3 Ranking

One pure function, `src/utils/ranking.ts`, unit-tested:
`freshness × proximity × reputation × verification × boost`. Pure and tested
means ordering is explainable to a user who asks "why am I not showing up?" —
which is itself a support-load reducer.

### 4.4 Verification triage

Auto-approve **only** on strong cheap signals (document present + face match +
no flags + account age). Everything ambiguous → `res_action_queue`. Auto-reject
never happens; rejection is Propose tier at minimum.

**Rule: policies propose, they never write.** A policy emits a flag or a queue
item. Layer 7 disposes.

---

# LAYER 5 — Self-healing

### 5.1 Durable write queue (fixes F8)

The client queue drops writes on replay failure. Fix in two parts:

1. **Client** — do not `clearOfflineQueue()` before replay. Mark items
   `inflight`, remove only on confirmed success, and increment an `attempts`
   counter with backoff on failure. Keep the existing `MAX_OFFLINE_QUEUE` bound
   but evict oldest-successful, never oldest-pending.
2. **Server** — a `res_dead_letters` table (`payload`, `error`, `attempts`,
   `first_seen`, `last_attempt`). Writes that exhaust client retries POST here;
   `drain_dead_letters` retries with exponential backoff + jitter, capped at 6
   attempts, then raises an incident. Nothing is ever silently lost.

### 5.2 Circuit breakers

`res_circuit_state (dependency, state, opened_at, failure_count, probe_at)` for
geocode (`src/utils/geocode.ts`), map tiles, Paystack, push. Trip after N
failures → serve degraded (cached geocode, "location unavailable") → half-open
probe → close. Every trip and close writes an audit row.

### 5.3 Reconcilers — the actual self-management primitive

A reconciler is **not** an event handler. It periodically compares *desired vs
actual* and repairs, which means it converges even after a crashed job, a
dropped webhook, or a bug you fixed last week. Build these:

| Reconciler | Desired state |
|---|---|
| `boost_integrity` | `boosted` ⟺ an active paid boost purchase exists (both directions) |
| `seat_integrity` | `res_lift_clubs.available_seats` = `total_seats` − confirmed bookings (the counters at `resident_schema.sql:1005` are atomic but can still drift via cancellations) |
| `pledge_integrity` | `res_group_buys.current_quantity` = `sum(pledges)` — already self-healing by design in `res_pledge_group_buy`; the reconciler catches rows the RPC never touched |
| `occupancy_integrity` | `res_rooms` occupancy ⟺ approved `res_room_requests` |
| `membership_integrity` | no `res_community_members` orphaned from archived communities |
| `notification_delivery` | every `notifications` row older than 5 min has a delivery outcome; re-enqueue misses (the `push-notify` DB webhook is a single point of silent failure) |
| `subscription_entitlement` | entitlements granted ⟺ `res_subscriptions.status='active'` |
| `storage_integrity` | every `images[]` URL resolves; every stored object has a row |

Each reconciler reports **drift count** as a metric even when it repairs
silently. Rising drift is the earliest signal of a real bug upstream.

### 5.4 Drift check

Daily: assert expected tables, columns, RLS enabled on every `res_*` table, no
`USING (true)` write policy, every `res_*` function has pinned `search_path` and
correct grants, and every `res_*` table appears in the baseline. Any deviation →
severity-1 incident. This job is the permanent institutional guard against F1
recurring.

---

# LAYER 6 — Self-observation

*A system that can't see itself is unattended, not autonomous.*

```sql
create table public.res_metrics (
  name text, value numeric, dims jsonb, at timestamptz default now()
);
create table public.res_incidents (
  id bigserial primary key, kind text, severity int check (severity between 1 and 4),
  opened_at timestamptz default now(), closed_at timestamptz,
  detail jsonb, ack_by uuid, auto_closed boolean default false
);
```

### 6.1 Metric set

- **Product:** signups, listings created, requests sent/approved, dispatches
  completed, alerts raised/responded, messages, group-buy conversion.
- **Automation:** per-job success rate, duration p95, rows affected, dry-run
  vs actual delta, queue depth, dead-letter count, drift counts per reconciler.
- **Health:** DB p95 query time, edge function error rate, realtime channel
  count, storage growth, Paystack webhook lag.
- **Trust:** flag rate, dispute rate, verification queue depth and age.

### 6.2 Anomaly detection — cheap and sufficient

Rolling 7-day mean ± 3σ per metric, computed in `metrics_rollup`. Deviation →
`res_incidents`. No ML at this scale; a z-score on 7 days of hourly data catches
"nobody has signed up in 6 hours" and "the alert job affected 40× normal rows,"
which are the two failures that actually matter.

Hard-coded severity-1 conditions (not statistical):
auth failure rate > 20%; any `res_alerts` `critical` unprocessed > 15 min; any
job failing 3 consecutive runs; drift check failing; dead letters > 50.

### 6.3 The daily digest

The artefact that makes the system trustworthy day to day. One notification each
morning:

> **Yesterday:** 47 listings expired · 12 requests auto-expired · 3 boosts ended
> · 1 care-circle escalation · 0 failed jobs.
> **Needs you:** 2 verification submissions I wasn't confident about · 1 dispute
> at day 21 · 1 listing flagged for duplicate content.
> **Unusual:** signups down 60% vs 7-day mean.

Three sections, always: **what I did**, **what I couldn't decide**, **what looks
wrong**. This is the interface to a self-managing app.

### 6.4 Synthetic canary

Every 30 min, a dedicated test account: sign in → read the feed → create a
listing → send a request → send a DM → roll everything back. First thing to fail
when something real breaks, and it exercises RLS as a *real user*, which
service-role jobs never do.

---

# LAYER 7 — The autonomous operator and the Guard

*Only now does an agent make sense — it has clean state, real levers, and an
audit trail.*

### 7.1 The Guard

**The single most security-critical module in this plan.** Jobs run as
`service_role` and bypass RLS, so the Guard *is* the authorisation layer for
every automated path. It lives in `functions/res-scheduler/lib/guard.ts`, and
every automated write goes through it — there is no second path.

It enforces, in order:

1. **Kill switch** — global, then per-job.
2. **Table allowlist** — a job may only touch tables it declared. **`profiles`
   is on no allowlist, ever** (CONTRACT §3).
3. **Column denylist** — never the §3 trust columns, never any price/amount
   field on a peer-to-peer entity, never `token_code`-shaped data.
4. **Money invariant** — the write may not change any monetary column. Enforced
   by comparing before/after on a declared list of money columns; violation
   throws and opens a severity-1 incident.
5. **Tier check** — see below.
6. **Blast radius** — per-run row cap; exceeding it aborts the whole run and
   raises an incident rather than committing a partial mass mutation.
7. **Transition legality** — status changes must go through `res_transition`.
8. **Mandatory audit** — the write and its `res_audit_log` row are in one
   transaction. No audit row, no write.

Review it like `src/utils/security.ts`, and give it its own test suite with
adversarial cases (a job that *tries* to write `profiles` must fail loudly in
CI).

### 7.2 The action queue

```sql
create table public.res_action_queue (
  id bigserial primary key,
  source text not null,            -- 'policy:duplicate_listing', 'agent'
  proposed_action text not null,   -- 'listing.suspend'
  entity text, entity_id uuid,
  rationale text not null,
  evidence jsonb,
  confidence numeric,
  tier text not null check (tier in ('auto','propose','human')),
  status text not null default 'queued'
    check (status in ('queued','auto_executed','awaiting_review','approved','vetoed','expired')),
  review_deadline timestamptz,
  decided_by uuid, decided_at timestamptz,
  at timestamptz not null default now()
);
```

### 7.3 The three tiers

| Tier | Examples | Authority |
|---|---|---|
| **Auto** | expire, archive stale, nudge, re-rank, unboost, rotate chores, re-enqueue a dropped notification, close a low-severity alert | executes immediately; audited; reversible |
| **Propose** | suspend a listing, reject a verification, escalate a dispute, flag a user, restrict a new account | queued with a `review_deadline` (24–72h); auto-executes on expiry **unless vetoed** — so absence of a human still converges, but a present human always wins |
| **Human-only** | account bans, anything touching `profiles`, anything money-adjacent (refunds, extensions, comps), bulk ops above N rows, schema changes, `purge_archived`, suppressing a panic alert | never auto-executes; blocks in the digest until decided |

The auto-execute-on-deadline design in Propose is deliberate: a queue that
requires human approval to drain is a queue that silently becomes the bottleneck
you were trying to remove. The veto window is the safety, not the approval.

### 7.4 Where an LLM belongs — and only here

Triage of the queue: summarising a dispute thread, classifying an ambiguous
report, drafting a nudge message, explaining why a listing was flagged. It reads
`res_flags` and entity context and emits a **proposal with a rationale** into
`res_action_queue`. It has **no database write credentials at all** — its output
is a row in a queue that the Guard later executes under the tier rules.

Practical notes: use Claude with a strict JSON output schema; include the
`res_policies` text in the prompt so its reasoning matches configured policy;
log the full prompt/response against the queue item for auditability; cap spend
with a daily token budget in `res_policies` and degrade to "queue for human"
when exhausted. Never let it choose its own tier — tier is derived from the
action type, in code.

---

# LAYER 8 — Governance

- **Kill switch:** `res_policies['automation.enabled'] = false`. One row,
  checked first in every dispatch. Test it monthly.
- **Per-job disable:** `res_jobs.enabled = false`.
- **Reversibility:** every Auto action stores `reverse_spec`; `res_revert(audit_id)`
  (Human tier) undoes it and logs the reversal as a new audit row. Bulk revert by
  `correlation` undoes a whole bad job run in one call. **Build this before the
  first Auto job runs in production**, not after you need it.
- **Escalation ladder:** incident → digest (sev 3–4) → push to owner (sev 2) →
  direct alert, any hour (sev 1).
- **Rate-of-change limit:** if automation modifies more than X% of any table in
  24h, halt automation and raise sev 1. The circuit breaker for the whole system.
- **Weekly review ritual:** 15 minutes over the digest and the queue; tune
  `res_policies`. *Self-managing means rarely managed, not never managed.*
- **Quarterly:** re-read the audit log for actions never vetoed (candidates to
  promote Propose → Auto) and Auto actions frequently reverted (demote).

---

# LAYER 9 — Testing and verification

| Level | What | Tooling |
|---|---|---|
| **Unit** | transition table legality, ranking purity, policy evaluation, guard rules | extend the existing `tsx` suites in `package.json` |
| **Guard adversarial** | a job attempting `profiles` writes, money-column mutation, over-cap runs — each must fail | new `guard.test.ts`, wired into `npm test` |
| **Job fixtures** | per job: a seeded DB state, a dry run asserting the exact selected set, an execute asserting the exact writes, and a **second execute asserting zero further writes** (idempotency) | `supabase/tests/` |
| **RLS** | the canary path exercises policies as a real user; plus a per-table matrix test (owner/other/anon) | pgTAP |
| **Security regression** | `npm run fuzzer` (`scripts/attack-fuzzer.ts`) extended to cover server-side moderation rules | CI |
| **Scale** | `npm run scale-test` extended: 100k listings, does `expire_listings` finish inside its timeout? | CI nightly |
| **Chaos** | kill the scheduler mid-run (lease recovery); double-invoke (leasing); break geocode (circuit); drop the push webhook (reconciler catches it) | staging, monthly |

**Every job's first production run is a dry run you read personally.** Not
automated approval — you read it.

---

# LAYER 10 — Cost and performance envelope

- **Query cost:** every job's selection query must use an index. Add partial
  indexes on `(expires_at) where archived_at is null` per table. Verify with
  `explain analyze` at scale-test volume before enabling.
- **Connection pressure:** stagger cron minutes; edge functions use a pooled
  connection; cap concurrent jobs at 2 via the lease pattern.
- **Notification blast:** the biggest self-inflicted risk. Any job that can
  notify > 100 users in one run is Propose tier, and effect-keys every send.
  Add a per-user notification rate limit (max N automated notifications/day) —
  the fastest way to make a self-managing app feel like spam is to let five jobs
  each notify correctly.
- **LLM spend:** daily token budget in `res_policies`; degrade to human queue.
- **Storage:** `res_audit_log` and `res_metrics` are the growth tables —
  partition monthly from day one, since retrofitting partitioning is painful.

---

# Rollout

Each phase is independently useful and independently revertible. Build in order.

| Phase | Scope | Deliverables | Exit gate |
|---|---|---|---|
| **P0 — Foundation** ✅ | Layer −1 | `supabase/` tree, CI, verification script | **Built.** CI replays every migration onto a clean Postgres 17 |
| **P1 — Truth** 🔶 | Layer 0 | Universal columns, `res_audit_log`, soft delete | **Migrations written, not yet applied.** `deploy_production_schema.sql` deleted |
| **P2 — State** 🔶 | Layer 1 | `lifecycle.ts` (52 transitions), `res_transition()`, generated seed | **Built and tested (17 tests).** Call-site migration outstanding |
| **P3 — Substrate** | Layer 2 | `res_jobs`, `res_job_runs`, `res-scheduler`, leasing, dry-run, kill switch, `res_revert` | `heartbeat` clean for 48h; kill switch and double-invoke tested |
| **P4 — First jobs** | Layer 3 Tranche A | Expiry/freshness jobs, Auto tier | Stale traffic reports and expired listings gone; zero unexpected audit rows |
| **P5 — Eyes** | Layer 6 | Metrics, rollup, anomalies, incidents, digest, canary | You learn about a staging outage from the digest, not from clicking around |
| **P6 — Repair** | Layer 5 | Durable queue (F8), dead letters, breakers, all reconcilers, drift check | Kill geocode in staging → degrades and recovers with no data loss |
| **P7 — Coordination** | Layer 3 Tranches B & C | Nudges, ladders, care circle, group buys, subscription lapse, boost integrity | A full week with no manual lifecycle intervention |
| **P8 — Judgment** | Layers 4 & 7 | Policies, flags, action queue, **Guard**, tiers, ranking | Guard adversarial suite green; Propose items flowing and being vetoed sometimes |
| **P9 — Operator** | Layer 7.4 | LLM triage emitting proposals only | 100 consecutive proposals reviewed; agreement rate measured before widening authority |
| **P10 — Governance** | Layer 8 | Rate-of-change limit, escalation ladder, review ritual, promote/demote loop | Two weeks unattended, nothing broken, digest read daily |

**Do not reorder.** Phase 8–9 without 1–6 produces an agent making confident
writes into untraceable state — the one failure mode from which there is no
clean recovery, because you cannot tell what it changed or put it back.

---

## Immediate next three actions

1. **Run the drift query** against production and write down which of the two
   schemas is actually deployed. Everything else depends on this answer.
2. **Create `supabase/` with the baseline migration and CI.** One day of work
   that unblocks every subsequent phase.
3. **Ship `res_audit_log`.** It costs one migration and is the difference
   between a system you can debug and one you cannot.

The first *visible* win — the one that makes the app feel managed — is
`expire_traffic_reports` in P4: potholes and roadblocks stop accumulating on the
VibeMap forever. It is also the safest possible first job: archive-only, no
money, no trust, no notifications.
