# Runbook — ops findings

What each finding means, how to confirm it, and how to undo what the system
did. Written in advance, calmly, so the response at 2 a.m. is not improvised.

Findings appear in **Profile → Ops Console** (platform admins only), in the
Monday digest, and — for the watchdog — as `ops-watchdog` issues.

---

## Panic alert unanswered after 5 minutes — critical
**Means:** a resident pressed panic, nobody tapped "coming", and the alert
has already been widened to 10 km and sent to community and platform admins.
**Do now:** open the alert from the notification. If you can reach the
resident or anyone nearby, do. The app cannot call emergency services — you
can.
**Afterwards:** the median first-response time on the console is the number
that says whether escalation is working. Two of these in a week means the
neighbourhood has too few active responders, which is a growth problem, not
a code problem.

## N alert(s) closed after 6 hours with nobody responding — critical
**Means:** alerts ended as `expired_unanswered`. Previously these were
silently recorded as false alarms.
**Confirm:** `select * from res_alerts where status = 'expired_unanswered' order by created_at desc;`
**Undo:** nothing to undo. Follow up with the resident if it was a panic.

## <job> changed N rows (cap M) and has switched itself off — critical
**Means:** a nightly job changed far more rows than it ever should, so it
stopped itself. The rows it changed *that night* stay changed.
**Confirm:** `select * from res_maintenance_runs where task = '<job>' order by ran_at desc limit 5;`
then look at what it touched (e.g. listings paused today:
`select id, title from res_listings where status = 'paused' and updated_at > now() - interval '1 day';`).
**Undo:** every capped job is reversible by design — a paused listing is
republished by setting `status = 'open'`. Fix the cause, then switch the job
back on in the Ops Console. If the cap itself is too low for real growth,
raise `max_affected` in `res_automation_jobs`.

## <task> has failed N times in two days — warn
**Means:** the job errors every night; the error text is on the console.
**Common cause:** a column or table renamed without updating the function.
**Undo:** switch the job off in the console while you fix it.

## Repeated failed sign-ins on one account — warn / critical
**Means:** more than 10 (warn) or 30 (critical) failed sign-ins on one
account in an hour. Usually someone forgetting a password; occasionally an
attack.
**Confirm:** `select created_at, action, details from res_security_logs where user_id = '<id>' and created_at > now() - interval '1 day' order by created_at desc;`
**Do:** nothing automatic happens to the account, deliberately. If it is an
attack, the resident should reset their password.

## Brute-force attempts blocked / Burst of blocked injection attempts — warn
**Means:** the guards worked. Worth a look only if it recurs or spreads
across many accounts (the brute-force finding goes critical at 5+ accounts).

## Account role switched — info
**Means:** someone changed tenant/landlord/visitor. Rare; glance at it.

## Ops watchdog issue: "The nightly maintenance run last ran …"
**Means:** pg_cron stopped, or the free-tier project paused from inactivity.
Every in-database check is silent when this happens — which is why this
check runs from GitHub instead.
**Confirm:** Supabase dashboard → is the project paused? Then
`select * from cron.job;` and `select * from cron.job_run_details order by start_time desc limit 20;`
**Fix:** restore the project; re-run section 49 of
`theresident_schema_part3.sql` if the cron jobs are missing.

## Ops watchdog issue: "The global stop is ON"
**Means:** every automated job is off, including alert escalation. Fine for
an emergency; dangerous if forgotten. Switch it back on in the console.

## "A broken deploy was rolled back" / "The live deploy is broken"
**Means:** the browser smoke test failed against production after a deploy.
If `VERCEL_TOKEN` is set, the previous deployment is already live again.
**Do:** read the failing run's output, fix forward, redeploy.

## "Nightly backup failed"
**Means:** no verified backup was kept that night. One failure is a warning;
three in a row means you have no recent backup. Read the run log — the
usual causes are an expired `DATABASE_URL` or a PostgreSQL major version
change on Supabase.
