# The Resident

A neighbourhood app for South African residents, landlords and the officials
who serve them. Built on Next.js 16 (App Router), React 19, Redux Toolkit and
Supabase.

It does four things that hang together:

- **Housing** — landlords keep a private room inventory (occupants, photos,
  why a room costs what it does) and publish a room as a listing only when
  they choose to.
- **Community** — a notice board, groups, a market, chores and disputes, plus
  a directory of schools, clinics, utilities and businesses you can follow.
- **Service Desk** — report an infrastructure fault to whoever is responsible
  for fixing it, corroborate a neighbour's report, and see how long each
  provider actually takes. The point is the public track record, not the
  complaint.
- **Official area broadcasts** — a verified ward councillor, municipality,
  library, clinic or police station selects the area it is responsible for and
  reaches every resident inside it. See
  [`docs/OFFICIAL-BROADCAST-STRATEGY.md`](docs/OFFICIAL-BROADCAST-STRATEGY.md).

## Getting started

```bash
npm install
npm run dev          # http://localhost:3000
```

Needs `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
NEXT_PUBLIC_VAPID_PUBLIC_KEY=...   # optional, see docs/PUSH-SETUP.md
```

## Checks

Everything below must pass before a commit. There is no step here that a CI
run does differently.

```bash
npx tsc --noEmit     # types
npx eslint src/      # lint
npm test             # pure-logic unit tests (node:test)
npm run sql-test     # schema + RLS, against a throwaway local Postgres
npm run build        # production build
```

`npm run sql-test` needs a local PostgreSQL 16 with PostGIS:

```bash
sudo apt-get update && sudo apt-get install -y postgresql-16 postgresql-16-postgis-3
```

## How this repository is arranged

| Path | What lives there |
|---|---|
| `src/app/` | App Router pages. `dashboard/` is the signed-in app. |
| `src/app/dashboard/components/` | Feature components, grouped by area. |
| `src/utils/` | Pure functions first, network calls after. The pure half is what the unit tests cover. |
| `src/store/` | Redux slices, thunks, and the `res_*` sync middleware. |
| `supabase/functions/` | Deno edge functions. Excluded from the Next typecheck — see the README there. |
| `sql-tests/` | The SQL suite. `run.sh` builds a throwaway Postgres, applies the schema files in dependency order, and runs the assertions. |
| `*.sql` (repo root) | Schema files, applied in the order listed in `sql-tests/run.sh`. |
| `docs/` | Strategy and setup documents. |

## Two things worth knowing before changing anything

**The database is the security boundary, not the client.** Every rule that
matters — who may read a row, who may broadcast to an area, who may mark an
office as paid — is an RLS policy or a `security definer` function. The
TypeScript mirrors some of those rules for the sake of the UI, and says so
where it does. Never move a check from SQL into a component.

**Supabase grants `EXECUTE` and `ALL` to `anon` and `authenticated` by default
on anything newly created.** A schema file that grants without revoking first
leaves the rest open. This has caused three separate leaks in this project,
including one where signed-out callers could enumerate a unit's followers. Any
new function or table must `revoke` before it `grant`s, and
`sql-tests/97-anon-grants.test.sql` exists to catch it when that is forgotten.

## Contracts with the wider platform

`CONTRACT.md` defines what The Resident may and may not touch on the shared
Gruvs database. The short version: tables prefixed `res_` are ours; `profiles`,
`notifications`, `events`, `messages` and `follows` are shared and read-mostly;
and a handful of columns (`push_token`, `email`, names, `lat`/`lon`,
`birth_*`) must never be read at all. That last rule is why residents have
their own `res_home_areas` pin rather than reusing the coordinates that already
exist on `profiles`.

## Setup that is not in the code

- [`docs/PUSH-SETUP.md`](docs/PUSH-SETUP.md) — the three secrets that turn on
  push notifications.
- Official boundaries: `scripts/import-boundaries.mjs` loads Municipal
  Demarcation Board GeoJSON into `res_jurisdictions`. Until it is run, no
  official has an area to broadcast to.
- Official verification is a manual `verified` flag on `res_org_units`.
