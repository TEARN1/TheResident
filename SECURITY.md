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
- **RLS coverage**: `resident_schema.sql` (26 tables) and
  `deploy_production_schema.sql` (7 tables) — every table has
  `ENABLE ROW LEVEL SECURITY` and at least one `CREATE POLICY`. The one
  known gap is `public.spatial_ref_sys` (a PostGIS system table owned by
  `supabase_admin`, not this project's role — `ALTER TABLE` silently
  no-ops on it from the SQL Editor); it holds only public EPSG coordinate
  data, not user data, and the only real fix is a Supabase support ticket.
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
- **Auditable account-affecting actions**: role switches, XSS-blocked
  input, auth success/failure, and brute-force lockouts all write to the
  security log (`addLog` in `store/index.ts`) — the solo maintainer's way
  of seeing what happened without having been online when it did.

## Known gaps
- **RPC privilege review**: whether Supabase RPCs called from the client
  (`ensure_res_profile`, `res_trust_gate`, `res_broadcast_alert`, etc.) run
  as `SECURITY DEFINER` or `SECURITY INVOKER` isn't versioned in this repo
  — those definitions live only in the Supabase dashboard. Needs a manual
  review there; a `DEFINER` function must re-check permissions itself,
  since RLS on the table it queries won't help.
- **Rate limiting is server-side and only exists for map closure reports**
  (`res_report_map_zone` RPC) and login brute-force. Review submissions,
  trust-connection requests, and dispute filings have no rate limit yet —
  needs a server-side RPC + policy, matching the closure-report pattern,
  not something addable from client code alone.
- **RLS policies live in Supabase, not fully mirrored in this repo** — the
  schema files here (`resident_schema.sql`, `deploy_production_schema.sql`,
  `db_hardening.sql`) are the source of truth for what was *deployed*, but
  the live policy set should be exported and diffed against them quarterly
  (see `MAINTENANCE.md`) in case of an out-of-band dashboard change.
