# Hosting: getting off the Vercel bill

## What happened

On **8 September 2026** Vercel emailed:

> Your free team `tearns-projects` has used **100% of the included free tier
> usage for Deployment Storage (10 GB)**. Upgrade to Pro… to avoid service
> disruption.

Vercel Pro is **$20/month**. DigitalOcean, which is already paid for, billed
**$4.00 of usage in August 2026** (invoice total $4.39 including tax). Paying
a second, larger bill for hosting one Next.js app is not a good trade.

## Why the storage filled up

Vercel builds **every push to every branch** by default and keeps the build
artifacts of **every deployment**, permanently, until the deployment is
deleted. Storage is cumulative — it is not a monthly allowance that resets.

Development on this project happens on long-lived `claude/**` branches, and
every commit was pushed to **two** of them. A single day's work therefore
produced dozens of complete preview deployments that nobody ever opened, each
one consuming storage forever. That is the bulk of the 10 GB.

The traffic is not the problem. There are two production profiles and one
property in the database. **The bill is from build artifacts, not users.**

---

## Fixed already, in this repo

**Working branches no longer deploy.** `vercel.json` now has an
`ignoreCommand` pointing at `scripts/vercel-should-build.sh`:

| Push | Result |
|---|---|
| `main` | builds and deploys — this is production |
| any branch with an open pull request | builds a preview, because someone wants to look at it |
| any other branch | **skipped** |

This stops new storage being consumed. It does not reclaim what is already
used — see below.

**The container build works.** The repo has always had a `Dockerfile`, but it
copied `.next/standalone`, and `next.config.ts` never set
`output: 'standalone'` — so that directory was never produced and
`docker build` failed at the COPY step. The container path off Vercel did not
actually work. It does now, verified by running the exact command the
container runs (`node .next/standalone/server.js`) and checking that `/`,
`/auth` and `/privacy` return 200 and `/dashboard/*` redirects.

The base image also moved from Node 18 to Node 20, matching what CI builds and
tests against.

---

## What only you can do

### 1. Reclaim the 10 GB (five minutes, free)

Deleting old deployments is the only way to get the storage back, and it can
only be done from the dashboard:

**vercel.com → tearns-projects → the-resident → Deployments** — delete the
old ones. Keep the current production deployment and anything you might still
want to roll back to. Everything else is dead weight.

Do the same for `the-gruvs-pt23`, which is in the same team and shares the
same quota.

### 2. Decide where it runs

Both options use the same working Dockerfile.

**Option A — DigitalOcean App Platform.** Managed: it builds from the repo on
every push to `main`, provisions HTTPS, and restarts on failure. Closest to
what Vercel was doing. The spec is written and ready at `.do/app.yaml`; fill
in the values marked `SET_ME` and either run
`doctl apps create --spec .do/app.yaml` or paste it into
**Apps → Create → Import from App Spec**.

**Option B — the Droplet you already pay for.** If the existing $4/month of
usage is a Droplet with room on it, running this container alongside whatever
is there costs **nothing extra**. You take on TLS (Caddy does it in about
three lines) and restarts yourself.

> I could not verify current App Platform pricing — DigitalOcean's site is
> blocked from this environment — so **check the price in your own dashboard
> before applying the spec.** Option B is the one that is definitely free if
> the Droplet has capacity.

### 3. The two misconfigured domains

Vercel has been emailing about this since July: *"2 misconfigured domains
across 1 project."* If those domains are ones you want, they need DNS pointed
at wherever the app ends up. If they are not, remove them — they are
generating a monthly alert for nothing.

---

## Things that do NOT move

- **Supabase** — database, auth, storage and edge functions are unaffected by
  where the front end runs. See `docs/REGION-DECISION.md` for the separate
  argument about moving the database itself to `af-south-1`.
- **GitHub Actions CI** — unchanged, and independent of the host.

## The one real gotcha

`NEXT_PUBLIC_*` variables are **compiled into the browser bundle at build
time**, not read at runtime. Vercel injects them into the build automatically,
so this is invisible there. In a container it has to be deliberate: they are
`ARG`s in the Dockerfile and `scope: BUILD_TIME` in `.do/app.yaml`.

Set them only at runtime and the app will build cleanly, deploy successfully,
and then be unable to reach Supabase at all — because the client was compiled
with `undefined` where the URL should be. It looks like a broken database, not
a missing variable, which is what makes it expensive to debug.

The reverse also matters: `SUPABASE_SERVICE_ROLE_KEY` and the signing keys are
**runtime-only secrets**. A build arg is recorded in the image's layer history,
so anyone who can pull the image can read it. They must never be build args.
