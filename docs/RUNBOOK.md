# Runbook

How to turn this on, sell a sponsorship, and check nothing is on fire. Written
for the person doing it at 7am, not for an architect.

Project: `feevvddvrjmfbhffccbf` (shared with The Gruvs — see [CONTRACT.md](../CONTRACT.md)).

---

## 1. First-time setup, in order

### 1.1 Apply the migrations

```bash
supabase db push --project-ref feevvddvrjmfbhffccbf
```

Then verify:

```bash
psql "$DATABASE_URL" -f supabase/tests/verify_automation.sql
```

It should print `verify_automation: all checks passed`. It asserts, among other
things, that **the kill switch is closed and no job is enabled** — if it fails
on either, stop and read why before going further.

> **These migrations have never run against a real Postgres.** Push them to a
> branch first if you can, or expect to fix one or two things. `ci.yml` replays
> the whole history onto a clean database and is the cheapest way to find out.

### 1.2 Deploy the scheduler

```bash
supabase functions deploy res-scheduler --project-ref feevvddvrjmfbhffccbf
```

### 1.3 Set the two secrets

Generate one secret and use the same value in both places.

```bash
supabase secrets set SCHEDULER_SECRET="<generated>" --project-ref feevvddvrjmfbhffccbf
```

```sql
alter database postgres set app.scheduler_url    = 'https://feevvddvrjmfbhffccbf.supabase.co/functions/v1/res-scheduler';
alter database postgres set app.scheduler_secret = '<the same value>';
```

The function **refuses every request when `SCHEDULER_SECRET` is unset** — it
fails closed rather than falling back to open. If you skip this, nothing runs
and that is the correct behaviour.

### 1.4 Create the cron entries

Re-run the `do $$ ... $$` block at the bottom of
`supabase/migrations/20260815000600_register_jobs.sql`. It skips silently when
the two settings above are missing, which is why it goes after 1.3.

---

## 2. Turning automation on

Two independent switches, on purpose. Both must be thrown.

```sql
-- 1. Soak the machinery with a job that changes no data.
update res_jobs set enabled = true where name = 'heartbeat';
update res_policies set enabled = true where key = 'automation.enabled';
```

Wait **48 hours**, then check it behaved:

```sql
select job_name, status, started_at, finished_at, error
  from res_job_runs order by started_at desc limit 20;

select name, last_status, consecutive_failures, circuit_open_until, lease_until
  from res_jobs;
```

You want: `status = 'ok'` throughout, `consecutive_failures = 0`,
`circuit_open_until` null, and `lease_until` null between runs. A lease stuck
non-null means a run died mid-flight — it expires on its own, but tell me.

### 2.1 Enable the real jobs, one at a time

**Always dry-run first, and read the output yourself.**

```bash
curl -X POST https://feevvddvrjmfbhffccbf.supabase.co/functions/v1/res-scheduler \
  -H "Authorization: Bearer $SCHEDULER_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"job":"expire_traffic_reports","dry_run":true}'
```

`would_affect` lists exactly what it *would* archive. If that looks right:

```sql
update res_jobs set enabled = true where name = 'expire_traffic_reports';
```

Recommended order: `expire_traffic_reports` (archive-only, safest) →
`expire_sponsorships` → `escalate_faults` (notifies people, so last).

### 2.2 Stopping everything

```sql
update res_policies set enabled = false where key = 'automation.enabled';
```

One row, checked before anything else in every run. Use it without hesitation —
nothing is lost by pausing.

To undo a specific bad run:

```sql
-- Find it
select correlation, job_name, action, entity, entity_id, reason, at
  from res_audit_log where job_name = 'escalate_faults' order by at desc limit 50;

-- Put one row back
select res_revert(<audit_id>, 'reverting: <why>');
```

---

## 3. Selling a sponsorship

### 3.1 Find what is free

```sql
select * from res_sponsorship_open_inventory();
```

Suburbs with the most `remaining` slots and existing listings are where to
start — never sell a slot in a suburb with nothing in it.

### 3.2 Sell it

Get the listing's id first (the business must already be listed):

```sql
select id, business_name, suburb from res_handyman_services where suburb = 'Ivory Park';
```

```sql
select res_sell_sponsorship(
  p_subject_table := 'res_handyman_services',
  p_subject_id    := '<listing id>',
  p_surface       := 'services',
  p_suburb        := 'Ivory Park',
  p_months        := 1,
  p_rate_cents    := 15000            -- R150, the founding rate
);
```

This returns a **pending** placement. It is not live yet — deliberately, because
the gap between "agreed" and "paid" is where placements get given away.

### 3.3 Activate when the money lands

```sql
select res_activate_sponsorship('<sponsorship id>', 'EFT ref 88213, 18 Aug');
```

### 3.4 Report at month end

```sql
select res_sponsorship_report('<sponsorship id>');
```

The `summary` field is a sentence you can paste into WhatsApp. It counts
**opens only** — no user, session or IP is stored anywhere, so there is nothing
here that could become a record of who looked at what.

### 3.5 Cancel

```sql
select res_cancel_sponsorship('<sponsorship id>', 'customer asked to stop');
```

No refund logic exists, because no money ever moved through the app.

### What to promise a sponsor

- Position above the list, clearly labelled **Sponsored**. That is all.
- **Not** verification, better reviews, softer moderation, or search ranking.
  None of those are for sale and the code will not do them.
- Be honest about how many people use the app. If asked, say the real number.
  See §3 of [SPONSORSHIP-PLAN.md](SPONSORSHIP-PLAN.md).

---

## 4. Adding a utility or department

Faults route by sector automatically. Giving a provider's staff access to their
queue is a **manual, deliberate** act — there is no self-serve path on purpose.

```sql
-- 1. Confirm the directory entry (seeded by migration 20260815000900)
select id, name, kind from res_infra_providers where kind = 'electricity';

-- 2. Grant one named person access, AFTER verifying them by a channel you
--    found yourself — their organisation's published switchboard, not a number
--    they gave you.
insert into res_infra_partner_admins (provider_id, user_id)
values ('<provider id>', '<profiles.id>');
```

They can then call `res_provider_queue('<provider id>')` and see their sector's
escalated faults, with counts but **no personal data about reporters** — a
provider needs to know 23 households are affected, never which 23.

---

## 5. Daily checks

```sql
-- Anything failing?
select name, last_status, last_error, consecutive_failures
  from res_jobs where last_status = 'failed' or consecutive_failures > 0;

-- What did automation do yesterday?
select action, count(*) from res_audit_log
 where at > now() - interval '1 day' and actor_kind = 'job'
 group by action order by 2 desc;

-- Faults waiting on a provider
select suburb, kind, distinct_reporters, escalated_at
  from res_faults where status = 'escalated' order by priority desc;

-- Placements ending soon
select id, suburb, slot, ends_at from res_sponsorships
 where status = 'active' and ends_at < now() + interval '7 days';
```

The `daily_digest` job that would send this to you automatically is **not
built** — Layer 6 of [SELF-MANAGING.md](SELF-MANAGING.md). Until it is, this
section is the manual version.

---

## 6. When something is wrong

| Symptom | First thing to check |
|---|---|
| No jobs running at all | `select enabled from res_policies where key='automation.enabled'` |
| One job not running | `res_jobs.enabled`, then `circuit_open_until` |
| Job keeps failing | `res_jobs.last_error`, then `res_job_runs.detail` for that correlation |
| A job seems stuck | `lease_until` — it expires by itself; it never needs manual clearing |
| A job did something wrong | `res_audit_log` by `correlation`, then `res_revert` |
| Residents got spammed | Kill switch, then `res_effect_keys` to see what was already sent |
| Sponsored slot not showing | Is the placement `active`? Is `starts_at` past? Is the promoted listing still live? |
| App broke after a deploy | If migrations are not applied, `transitionStatus` falls back to direct writes and logs a warning — check the browser console |
