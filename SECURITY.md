# Security

TheResident is solo-maintained and free/open-source only. This documents
what's covered, what isn't, and how to report a problem — required even at
zero budget, since "ask the security team" isn't an option here.

## Reporting a vulnerability
Email the maintainer directly (see the repo's contact/profile) with:
- What you found and how to reproduce it.
- What you think the impact is.
Please don't open a public GitHub issue for anything exploitable — give a
reasonable window to fix it first.

## What's covered
- **Client-side attack surface**: `utils/security.ts` scans and neutralizes
  XSS, SQLi, path traversal, SSRF, command injection, NoSQL injection,
  header injection, open redirect, prototype pollution, LDAP injection,
  XXE, and validates JWTs, password strength, and file uploads. Verified
  by `npm run fuzzer` — 30,000+ simulated attacks across 16 categories,
  100% blocked. Run it after any change that touches user input handling.
- **Stored XSS via Leaflet popups**: `VibeMap.tsx`'s `bindPopup()` sets raw
  HTML (bypasses React's escaping) — all four popup types (zone reports,
  saved pins, search results, listing pins) now run user-controlled text
  through `encodeHTMLEntities` before interpolation.
- **Brute-force login protection**: 5 failed attempts locks an account for
  60 seconds (`registerFailedAttempt`/`lockedUntil` in `store/index.ts`),
  logged as `auth_failed` / `brute_force_blocked`.
- **RLS coverage**: `resident_schema.sql` (26 tables) — every table has
  `ENABLE ROW LEVEL SECURITY` and at least one `CREATE POLICY`. A further 12
  Resident-owned tables existed only in the live project with no schema in
  this repo at all (see Known gaps); they are now documented in
  `theresident_undocumented_tables_schema.sql`, and
  `src/store/schemaCoverage.test.ts` fails the build if any future table is
  queried by the client without a versioned `create table`. The one
  known gap is `public.spatial_ref_sys` (a PostGIS system table owned by
  `supabase_admin`, not this project's role — `ALTER TABLE` silently
  no-ops on it from the SQL Editor); it holds only public EPSG coordinate
  data, not user data, and the only real fix is a Supabase support ticket.
- **`deploy_production_schema.sql` was deleted** — an audit found it was a
  superseded first draft that conflicted with the live schema on 4 tables
  (different, incompatible column names the app code doesn't use) and
  wrongly tried to `CREATE TABLE public.profiles`, which `CONTRACT.md`
  reserves to The Gruvs. `resident_schema.sql` already covers everything
  in it that was actually correct (including `res_traffic_reports`, its
  one seemingly-unique table).
- **Service-role key**: confirmed server-only (`SUPABASE_SERVICE_ROLE_KEY`,
  no `NEXT_PUBLIC_` prefix), gitignored, never committed, no client-side
  usage anywhere in `src/`.
- **Session data on logout**: the whole Redux tree (verification doc URLs,
  dispute details, messages, listings — everything except the language
  preference) is wiped on logout, not just `auth.currentUser`, since logout
  is a client-side route push rather than a full page reload and a second
  person could otherwise briefly see the first person's already-fetched
  data on a shared device.
- **Retry never bypasses a permission failure**: `utils/resilientCall.ts`'s
  `isRetryableError` explicitly excludes RLS/permission-denied/JWT errors
  from the automatic retry — a rejected write stays rejected.
- **Error messages**: `utils/errors.ts`'s `unwrapDbError` maps raw
  Postgres/RLS errors to plain-language messages instead of surfacing table
  names, policy names, or constraint names to the client.
- **Auditable account-affecting actions**: role switches, org broadcast
  sends, XSS-blocked input, auth success/failure, and brute-force lockouts
  write via `addLog` (`store/index.ts`) and are persisted to
  `res_security_logs` in Postgres — read them from the Supabase dashboard,
  which uses the service role and bypasses RLS.

  The table is insert-only for both `anon` and `authenticated` (the most
  useful events — failed logins, brute-force lockouts, XSS blocked on the
  signup form — happen *before* anyone is authenticated, so anonymous
  inserts must be allowed, with `user_id` forced null so an entry can never
  be forged against another account). There is deliberately **no select
  policy**: an audit trail its own subject can read, or that an attacker can
  read to confirm what was detected, is worth less. Rate-limited by trigger
  (60/min per user, 300/min anonymous) since an anon-insertable table is a
  spam target, and prunable past 180 days via `res_prune_security_logs()`.
  See `theresident_security_log_schema.sql`.

  Historical note, because it shaped the design: for most of this app's life
  `addLog` wrote **only to in-memory Redux** — never synced, never stored,
  never rendered in any UI, and cleared on both refresh and logout. This
  file and `MAINTENANCE.md` nevertheless described it as a reviewable audit
  trail. It wasn't; the entries never left the user's browser tab. Treat any
  claim here as unverified until there's a test or a query behind it.
- **Org broadcast messaging (Batch 10)**: opt-in only (`res_org_follows` is
  strictly self-service — nobody can see or create another person's follow
  row); posting requires a `sender` membership on the target unit or an
  ancestor of it (`res_user_is_sender_of_or_above`), enforced by RLS, not
  just client code; rate-limited server-side to 5 broadcasts per unit per
  hour via a trigger (`res_check_broadcast_rate_limit`), mirroring the map
  closure-report pattern. See `theresident_org_broadcast_schema.sql`.

## Known gaps
- **12 tables' live RLS is still unverified.** `res_gossip_posts`,
  `res_gossip_comments`, `res_trust_connections`, `res_saved_pins`,
  `res_saved_searches`, `res_reviews`, `res_reputation`,
  `res_subscriptions`, `res_notification_prefs`, `res_properties`,
  `res_moderation_actions`, `res_infra_providers` were created ad-hoc in the
  Supabase dashboard and never versioned. Their table definitions are now
  reconstructed in `theresident_undocumented_tables_schema.sql`, but that
  file's RLS section is **commented out on purpose**: it was inferred from
  what client code assumes, and `drop policy`/`create policy` is the only
  idempotent idiom Postgres offers, so running it blind would replace
  working policies on tables already serving traffic. Run that file's STEP 1
  (read-only), compare, then enable what you've confirmed. Until then,
  treat these 12 as unaudited — in particular check whether any has RLS
  **disabled**, which would make it readable by any authenticated user.
- **RPC privilege review**: whether Supabase RPCs called from the client
  (`ensure_res_profile`, `res_trust_gate`, `res_broadcast_alert`, etc.) run
  as `SECURITY DEFINER` or `SECURITY INVOKER` isn't versioned in this repo
  — those definitions live only in the Supabase dashboard. Needs a manual
  review there; a `DEFINER` function must re-check permissions itself,
  since RLS on the table it queries won't help.
- **Rate limiting is server-side** and exists for map closure reports
  (`res_report_map_zone` RPC), login brute-force, and org broadcasts
  (`res_check_broadcast_rate_limit` trigger). Review submissions,
  trust-connection requests, and dispute filings still have no rate limit —
  needs a server-side RPC/trigger + policy, matching those patterns, not
  something addable from client code alone.
- **`theresident_org_broadcast_schema.sql` has not been applied to the live
  database** by this session — this repo has no Supabase CLI/credentials
  access, so every schema file here (including this one) must be run
  manually in the Supabase SQL editor before Batch 10's UI has anything to
  read/write.
- **RLS policies live in Supabase, not fully mirrored in this repo** — the
  schema files here (`resident_schema.sql`, `theresident_db_hardening.sql`,
  `theresident_org_broadcast_schema.sql`) are the source of truth for what was *deployed*, but
  the live policy set should be exported and diffed against them quarterly
  (see `MAINTENANCE.md`) in case of an out-of-band dashboard change.

## Reading the Supabase security advisor

Supabase emails "security vulnerabilities detected in your projects" on a
schedule. Most of what it reports is not ours and not a vulnerability, so the
triage is recorded here rather than redone from scratch each time. Re-check
with `get_advisors` after any DDL change; the shape below was re-verified on
10 September 2026 (359 findings), function by function against the live
catalogs rather than against this repo's SQL files.

| Finding | Count | Verdict |
|---|---|---|
| `rls_disabled_in_public` on `spatial_ref_sys` | 1 (ERROR) | **Not actionable.** PostGIS's own coordinate-system reference table — public, read-only reference data, owned by the extension. Enabling RLS on it needs superuser and Supabase does not grant that. A permanent false positive. |
| `authenticated_security_definer_function_executable` | 292 | Informational. It flags every SECURITY DEFINER function reachable by a signed-in user, which is what such a function is *for*. The Resident's are individually reviewed — see `sql-tests/94-definer-authorisation.test.sql` and `98-fail-open-on-null.test.sql`. |
| `anon_security_definer_function_executable` | 27 | Only **3** are defined by us, all deliberate: `res_log_client_error` (must work before sign-in, or a crash on the login screen is never reported) and the kin-verification pair (unguessable-UUID capability links). The other 24 are Gruvs-owned or PostGIS — see the cross-app note below, which corrects an earlier entry here that counted `zones_near` as ours. |
| `rls_enabled_no_policy` | 33 | Only **2** are ours: `res_client_errors` and `res_maintenance_runs`. Deny-all is deliberate — both are written by SECURITY DEFINER RPCs and read through `res_client_error_summary_for_admin`, which is itself gated on `res_is_platform_admin()`. A policy on either would widen access, not tighten it. |
| `extension_in_public` | 4 | Supabase's own default placement of PostGIS et al. |
| `materialized_view_in_api` | 1 | Not Resident-owned. |
| `auth_leaked_password_protection` | 1 | **Real, and outstanding.** A dashboard toggle (Authentication → Policies) that checks new passwords against HaveIBeenPwned. Free, one click, and cannot be enabled from code. |

The one line worth acting on is the last one.

### Two things in that table are Gruvs's, and worth telling them

Neither is ours to change — CONTRACT.md §2 — but both are real, and they
share this database:

* **`maintenance_status()` is callable by `anon`.** It returns pg_cron job
  names and their last run status, the count of account deletions past their
  30-day deadline, and how stale the oldest check-in is. That is an
  operations dashboard, readable by anyone on the internet who knows the
  URL. It reads Gruvs tables only, so no Resident data is exposed.
* **`is_admin(p_user_id uuid)` is callable by `anon`.** It answers "is this
  person an administrator" to a signed-out caller.

The trigger functions in the same list (`notify_checkin_welcome`,
`notify_business_invoice_paid`, `notify_founder_new_invoice_request`,
`enforce_report_rate_limit`) hold their EXECUTE via a `PUBLIC` grant rather
than an explicit `anon` one. Revoking `PUBLIC` on a trigger function cannot
break the trigger — triggers do not check EXECUTE — so those are the cheapest
four to close.

### A cross-app dependency that a lint fix would break

`zones_near` is **defined by Gruvs but consumed by The Resident**
(`src/utils/mapZones.ts`). It appears in the anon list, and revoking `anon`
EXECUTE on it to satisfy the linter would silently break the map for every
signed-out visitor to this app — with no error either side would notice,
because the call fails at the API layer and the map simply renders empty.

`src/store/schemaDrift.test.ts` pins the name, which catches the function
being renamed or dropped. It does **not** catch the grant being narrowed.
If the map ever goes blank for guests and nothing else changed, check this
grant first.
