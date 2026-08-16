# The Resident as civic infrastructure — strategy and architecture

*A deep analysis of the platform pivot: from neighbourhood coordination app to
the substrate that institutions and residents share.*

---

## 0. The thesis, stated plainly

Today The Resident is an app people use *inside* a neighbourhood. The pivot is
to make it the layer the neighbourhood *runs on* — where a school closing, a
water main bursting, a load-shedding block, a road closure, a political
gathering and a Saturday morning race all become the same kind of object:

> **a thing, happening somewhere, for a period of time, announced by someone
> whose authority to announce it is knowable.**

Everything below follows from taking that sentence literally. It is also the
"chairs" idea in engineering terms: you are not a participant in the
conversation, you are the surface it happens on. That has a hard consequence —
**a substrate must be neutral, rule-governed and predictable**, or nobody
builds on it. The rules matter more than the features.

Two pillars:

- **Pillar I — The Route & Risk Engine.** Precise planning over space: measure
  it, draw it, score its risk, avoid what's closed, warn when the plan breaks.
- **Pillar II — The Civic Layer.** Verified authority to announce, scoped to a
  jurisdiction, arranged as a pyramid, accountable after the fact.

They are not two projects. They converge on one table you already have.

---

## 1. What you already own (verified against the live database)

This is the single most important finding in this document, and it reframes
the whole effort from "build two big systems" to "connect what's there".

| Asset | State | Why it matters here |
|---|---|---|
| **PostGIS 3.3.7** | installed | Distance, intersection, buffering, route measurement — all native SQL |
| **`map_zones.geom`** | `geometry(Geometry, 4326)` | Already accepts **Point, LineString, Polygon, MultiPolygon**. A race route and a closure polygon are the same column |
| `map_zones.starts_at / ends_at` | present | Zones are already time-bounded — *planned* events, not just live ones |
| `map_zones.severity` | integer | A risk weight already exists |
| `map_zones.confirm_count / dispute_count` | present, via `zone_verify` | **Crowd verification already works, cross-app, with no ownership gate** |
| `map_zones.ext_source / ext_id` | present | Hooks for ingesting *external* data (utility feeds, published schedules) already designed in |
| `map_zones.source_app` | present | Gruvs and Resident write the same map |
| `res_report_map_zone` | live RPC | Rate-limited 5/hr, duration-bounded, kind-validated |
| `res_neighbourhood_status` | `kind ∈ (power, water, network)`, `status ∈ (up, down, **stage**)` | **`stage` is load-shedding.** The civic outage model is already half-built |
| `outageConsensus()` | tested, in `logic.ts` | N distinct reporters in a window = confirmed. The trust primitive exists |
| `distanceMetres()` | haversine, tested | Accurate metre-level distance already available |
| `pg_cron` + `pg_net` | installed | Scheduled civic events need no new infrastructure |
| `res_alerts` | severity + community scoping + `res_broadcast_alert` | The emergency broadcast rail exists |

And what you **don't** have, which defines the real work:

| Gap | Consequence |
|---|---|
| No routing engine — `navigation.ts` deep-links to Google/Waze | "A→B avoiding closed C" cannot be answered in-app today |
| `distanceBand()` returns `'far'`, `'about 1 km'` | Deliberately vague. **Useless for a 21.1 km race.** This is exactly your "kilometre/metre precision" complaint, and it's a 20-line fix |
| No concept of an **authority** — every account is a person | A school and a resident are indistinguishable to the system |
| No jurisdiction model | Nothing stops a person in one suburb announcing an outage in another |
| No route object | Routes can't be saved, measured, shared or watched |
| No spatial index strategy for `geom` | Intersection queries will degrade as zones grow |

---

# PILLAR I — The Route & Risk Engine

## 1.1 The precision problem (start here — it's cheap and it's blocking)

`distanceBand()` was written for *social* distance ("is this room near me?"),
where vagueness is a feature — it avoids implying false precision about a
listing's location. For **race and route planning it is actively wrong**: a
runner needs `21.10 km`, not `far`.

The fix is not to change `distanceBand` — it's correct for its job. It's to add
a second, explicit register:

```ts
// src/utils/measure.ts
export type Units = 'metric' | 'imperial'
export type Precision = 'social' | 'exact'   // 'about 1 km'  vs  '1.04 km'

formatDistance(metres, { units, precision })   // '1.04 km' | '0.65 mi'
formatRouteLength(metres, units)               // '21.10 km' — always 2dp
paceFor(metres, seconds)                       // '5:32 /km' — race planning
```

Then a **user setting** (`res_profiles.measurement_units`,
`res_profiles.distance_precision`) and a **context override**: race and route
surfaces always use `exact`, regardless of the user's default, because in that
context vagueness is the bug.

**Why this ordering:** it is the smallest change that makes the map credible to
the audience you're describing (race organisers, planners). Nothing else in
Pillar I is worth building if the numbers read as approximations.

## 1.2 Routes as first-class objects

A route is a LineString plus intent. `map_zones` can hold the geometry, but
routes deserve their own table because they carry a plan, not a hazard.

```sql
create table public.res_routes (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null references public.profiles(id) on delete cascade,
  authority_id  uuid references public.res_authorities(id),  -- Pillar II
  title         text not null,
  kind          text not null check (kind in
                  ('race','parade','march','patrol','commute','delivery',
                   'school_run','evacuation','tour')),
  geom          geometry(LineString, 4326) not null,
  length_m      numeric generated always as
                  (st_length(geom::geography)) stored,        -- exact, never drifts
  elevation_gain_m numeric,
  status        text not null default 'draft',
  starts_at     timestamptz,
  ends_at       timestamptz,
  is_public     boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index on public.res_routes using gist (geom);
```

`length_m` as a **generated column** is the key detail: the distance is computed
by PostGIS from the geometry itself and cannot drift from the drawn line. An
organiser edits the route, the distance updates. No stale numbers, ever.

Derived for free from PostGIS:

| Need | Query |
|---|---|
| Exact length | `ST_Length(geom::geography)` |
| Kilometre markers | `ST_LineInterpolatePoint(geom, n * 1000 / length_m)` |
| Where am I along it? | `ST_LineLocatePoint(geom, my_position)` |
| Split a leg | `ST_LineSubstring(geom, 0.25, 0.5)` |
| Corridor around it | `ST_Buffer(geom::geography, 50)` |

That last one is the whole "war plan" in one function. See 1.4.

## 1.3 Segments: the risk-tracking layer

Your "war plan with risk tracking" means a route is not uniform — some
stretches are dangerous, dark, unsurfaced, without signal. Model that as
annotations on fractions of the line:

```sql
create table public.res_route_segments (
  id           uuid primary key default gen_random_uuid(),
  route_id     uuid not null references public.res_routes(id) on delete cascade,
  from_frac    numeric not null check (from_frac between 0 and 1),
  to_frac      numeric not null check (to_frac   between 0 and 1),
  risk_kind    text not null check (risk_kind in
                 ('blind_corner','no_shoulder','poor_surface','steep',
                  'no_signal','poor_lighting','water_crossing','livestock',
                  'heavy_traffic','known_incident_area','unlit_underpass')),
  severity     int not null check (severity between 1 and 3),
  note         text,
  mitigation   text,        -- 'marshal here', 'water point', 'medic'
  added_by     uuid references public.profiles(id)
);
```

Fractions, not coordinates: edit the route and the annotations stay attached to
the same *relative* stretch. Storing absolute points would orphan every
annotation on the first edit.

**The resulting artefact — the Route Risk Plan — is the product:** a printable,
shareable brief showing every kilometre, every hazard, every mitigation, every
marshal and medical point. That is what a race organiser, a march organiser or
a patrol coordinator actually needs and currently builds in WhatsApp and
spreadsheets.

### A constraint I'd build in from the start

Risk annotation of *places* has a well-documented failure mode: it hardens into
a permanent map of "bad areas", which stigmatises neighbourhoods and becomes
self-reinforcing long after the reason has gone. Given the communities this app
serves, that is not an abstract concern.

Design against it structurally, not by policy:

- **Incident-based, time-decayed.** Risk comes from dated incidents that decay
  (the `severity × recency` shape `decayedScore()` already implements), never
  from a standing label on an area.
- **Segment-scoped, not area-scoped.** "This underpass is unlit" is actionable.
  "This suburb is dangerous" is a slur with coordinates.
- **Never demographic.** No proxy variables. No inferred ones.
- **Always attributed and disputable.** `zone_verify` already gives you the
  mechanism — a risk nobody else confirms should fade.

This isn't only ethics; it's accuracy. A decaying incident map is *more useful*
than a static fear map, because it tells you about tonight rather than 2019.

## 1.4 Hazard-on-my-route: the feature nobody else has

This is the strongest idea in what you described, and PostGIS makes it nearly
free:

```sql
-- Every live hazard intersecting a 50 m corridor around a route
select z.*
  from map_zones z, res_routes r
 where r.id = $1
   and z.status = 'active'
   and tstzrange(z.starts_at, z.ends_at) && tstzrange(r.starts_at, r.ends_at)
   and st_dwithin(z.geom::geography, r.geom::geography, 50);
```

From that one query you get:

1. **Planning view** — organiser sees every closure, roadblock and hazard that
   touches the route, before the day.
2. **Live watch** — a job (Layer 3 of the self-managing plan) re-runs it on a
   schedule; when a *new* hazard intersects a *published* route, everyone
   registered on that route is notified. Effect-keyed, so once each.
3. **Advertiser/organiser view** — exactly your "the person advertising the race
   should know where not to go".

The "live watch" job is a natural fit for the substrate already built: bounded
batch, idempotent via effect keys, auditable, reversible. It would be the
highest-value job in the catalogue.

## 1.5 Routing with avoidance (A → B, B is closed, go via C)

This is the one part with no in-house answer today. Options, honestly compared:

| Option | Avoidance support | Cost | Verdict |
|---|---|---|---|
| Deep-link to Google/Waze (today) | none — can't inject your closures | free | Fine as a fallback; can never answer your question |
| **OpenRouteService** (`avoid_polygons`) | **native** — pass closure polygons directly | free tier, key required | **Recommended start.** Exactly the primitive you described |
| GraphHopper | `block_area` | free tier | Solid alternative |
| Mapbox Directions | exclusions (limited) | paid | Good, costs money |
| `pgrouting` + OSM extract | total control | self-hosted compute, heavy | The endgame if volume justifies it |
| Client-side graph | total control | too heavy for low-end phones | No — your users' devices matter |

**Recommended architecture — closure-aware routing with a cache:**

```
1. Client asks: A → B, profile = walking|driving
2. Server collects active closure polygons near the A–B corridor from map_zones
3. Hash that closure set  →  closure_fingerprint
4. Look up res_route_cache (origin_cell, dest_cell, profile, closure_fingerprint)
5. Hit  → return instantly
   Miss → call ORS with avoid_polygons, store, return
6. When any zone in the corridor changes, the fingerprint changes,
   and the cache entry is simply never matched again
```

Three things make this work at low cost:

- **Geohash the endpoints** (~100 m cells) so near-identical requests share a
  cached route. In a suburb, thousands of trips collapse to dozens of routes.
- **The fingerprint is the cache key**, so cache invalidation is automatic —
  there is no invalidation job to get wrong. A stale route can't be served
  because a changed closure set can't match an old key.
- **A `prune_route_cache` job** (self-managing Layer 3) clears entries whose
  fingerprints no longer exist.

Failure posture: if ORS is down, the circuit breaker (Layer 5) trips and the
app degrades to the current deep-link behaviour with a visible "live closures
not applied" banner. **Degraded and honest beats absent or silently wrong** —
particularly here, where "wrong" means routing someone into a roadblock.

---

# PILLAR II — The Civic Layer

## 2.1 The one problem that decides whether this works

Everything you described — schools announcing closures, utilities announcing
load shedding, politicians announcing gatherings — reduces to a single hard
question:

> **How does a resident know the announcement is real?**

Get this wrong and you have not built civic infrastructure; you have built a
high-credibility channel for impersonation. The failure modes are concrete: a
fake water-outage notice triggers panic buying; a fake school closure leaves
children unsupervised; a fake gathering announcement sends a crowd somewhere
dangerous, or marks people who attend.

So authority is not a badge you add later. **It is the schema.**

## 2.2 The authority model

```sql
create table public.res_authorities (
  id            uuid primary key default gen_random_uuid(),
  kind          text not null check (kind in (
                  'national_department','province','municipality','ward',
                  'school','clinic','hospital','police_station','utility',
                  'transport_operator','political_structure','ngo',
                  'faith_organisation','body_corporate','street_committee')),
  name          text not null,
  parent_id     uuid references public.res_authorities(id),   -- the pyramid
  jurisdiction  geometry(MultiPolygon, 4326),                 -- where it may speak
  -- Verification is a HUMAN act with evidence. Never automation's to grant.
  verification  text not null default 'unverified' check (verification in
                  ('unverified','self_declared','community_endorsed','verified')),
  verified_at   timestamptz,
  verified_by   uuid references public.profiles(id),
  evidence_note text,
  reliability   numeric,      -- earned, see 2.6
  status        text not null default 'active',
  created_at    timestamptz not null default now()
);
create index on public.res_authorities using gist (jurisdiction);

create table public.res_authority_members (
  authority_id uuid not null references public.res_authorities(id) on delete cascade,
  user_id      uuid not null references public.profiles(id) on delete cascade,
  role         text not null check (role in ('owner','admin','broadcaster','observer')),
  can_broadcast_kinds text[] not null default '{}',  -- narrow grants, not blanket
  added_by     uuid references public.profiles(id),
  added_at     timestamptz not null default now(),
  primary key (authority_id, user_id)
);
```

Two design decisions worth defending:

**`jurisdiction` is geometry, not a text field.** An authority can only
broadcast where `ST_Within(broadcast.geom, authority.jurisdiction)`. A ward
councillor physically cannot announce a province-wide event. This is enforced in
the database, not in the UI, because UI rules are advisory and database
constraints are not.

**`can_broadcast_kinds` is a narrow grant per member.** The school secretary can
post closures; only the principal can post emergencies. This is your "levels"
and it's also basic blast-radius control: a compromised low-level account
cannot issue an evacuation notice.

## 2.3 The pyramid, concretely

`parent_id` gives you the hierarchy you described. What it *buys* you:

- **Inherited jurisdiction** — a child's area must be within its parent's.
  Enforced by trigger; a ward cannot claim more ground than its municipality.
- **Escalation** — an unanswered ward-level issue escalates to municipality.
  This is the dispute ladder from the self-managing plan, applied to civics.
- **Verification by delegation** — the hardest part of verification is
  bootstrapping. A verified municipality can vouch for its wards; a verified
  department can vouch for its schools. **Trust flows down the pyramid**, so you
  need to verify a few dozen roots by hand, not ten thousand leaves.
- **Fan-out with scope** — a national announcement renders for every child
  jurisdiction, but a resident sees it once, scoped to their ward.

```
national_department (Basic Education)          ← verified by hand, once
  └── province (Gauteng)                       ← vouched by parent
        └── municipality (Joburg)              ← vouched by parent
              └── ward (Ward 79)               ← vouched by parent
                    └── school (Ivory Park Primary)
                    └── street_committee (Zone 5 Block C)
```

## 2.4 Broadcasts

```sql
create table public.res_broadcasts (
  id             uuid primary key default gen_random_uuid(),
  authority_id   uuid not null references public.res_authorities(id),
  issued_by      uuid not null references public.profiles(id),
  kind           text not null check (kind in (
                   'planned_outage','live_outage','service_restored',
                   'closure','schedule_change','civic_gathering',
                   'public_consultation','emergency','deadline','notice')),
  sector         text check (sector in (
                   'electricity','water','sanitation','education','health',
                   'transport','safety','housing','refuse','governance')),
  title          text not null,
  body           text,
  geom           geometry(Geometry, 4326) not null,
  starts_at      timestamptz not null,
  ends_at        timestamptz,
  severity       int not null default 2 check (severity between 1 and 4),
  status         text not null default 'scheduled',
  supersedes     uuid references public.res_broadcasts(id),
  -- Accountability (2.6)
  outcome        text check (outcome in ('occurred','partial','did_not_occur','unknown')),
  outcome_at     timestamptz,
  confirm_count  int not null default 0,
  dispute_count  int not null default 0,
  created_at     timestamptz not null default now()
);
```

Lifecycle — and note this is *precisely* the machinery already built in
`res_transition()`:

```
draft → scheduled → active → ended → assessed
             ↓         ↓
         cancelled  superseded
```

A `promote_scheduled_broadcasts` job flips `scheduled → active` at `starts_at`
and `active → ended` at `ends_at`. **The load-shedding schedule you described
is, mechanically, a cron job over a state machine — which is exactly what was
built last session.** The self-managing work is not a detour from this vision;
it is its engine.

## 2.5 The bootstrap problem, and the answer

The obvious plan — sign up the municipality, then launch — fails. Institutions
adopt slowly, and an empty civic layer teaches residents to ignore it.

**Invert it. Make the civic layer valuable when institutions are absent, so
their arrival is an upgrade rather than a precondition.**

Three tiers of the same information, all live from day one:

| Tier | Source | Trust presentation |
|---|---|---|
| **Crowd** | Residents report via `res_neighbourhood_status` (`power/water/network` × `up/down/stage`) — *already built* | "14 neighbours report water down" + consensus via `outageConsensus()` |
| **Ingested** | Public schedules and feeds pulled in via `map_zones.ext_source` / `ext_id` — *the hooks already exist* | "From published schedule — not confirmed by the utility" |
| **Authority** | Verified institution broadcasts | Verified badge, push-eligible, accountable |

A resident gets a useful answer to "is the water coming back?" on day one from
the crowd tier. When the municipality eventually joins, their notice slots into
the same surface with a stronger badge. **The crowd tier is also the leverage**
— it is what makes an institution want an account, because their absence is
visible next to their neighbours' reports.

For load shedding specifically, published schedules are the ideal first
ingestion target: they're predictable, public, structured, and residents
already organise their day around them. Worth evaluating the licensing and
terms of any specific feed before wiring it in — that's a real constraint, not
a formality.

## 2.6 Accountability — the genuinely novel part

Once a broadcast's window passes, ask the people it was aimed at: **did it
actually happen?**

`zone_verify` already implements confirm/dispute with no ownership gate. Point
the same mechanism at broadcasts, and an `assess_broadcasts` job computes, per
authority:

- **Reliability** — how often announced events actually occurred
- **Punctuality** — announced 3 hours ahead, or 20 minutes after it started?
- **Restoration accuracy** — "back by 14:00", actually back at 19:40

This turns announcements into a track record. It is the difference between a
notice board and civic infrastructure, and I don't know of another product
doing it at neighbourhood resolution.

**Bound it carefully**, because this is powerful and therefore dangerous:

- Score **the reliability of announcements**, never people. "Ward 79's outage
  notices are accurate 82% of the time" is a fact about a process. A rating of a
  named politician is a defamation surface and a harassment vector — the app
  must not host it.
- **No scores on emergency broadcasts.** Nobody should hesitate to warn people
  because a false alarm would hurt their number. Asymmetric costs again: the
  same reasoning that stops a job auto-closing a critical alert.
- **Right of reply** — an authority can annotate a disputed broadcast.
- **Publish the method.** A score whose derivation is secret is untrustworthy
  by construction.

## 2.7 Civic gatherings — highest value, highest risk

"Politicians announcing where they'll meet and what for" is real civic utility:
ward meetings, consultations, service-delivery feedback. It is also the most
abusable object in the entire design. Safeguards, built in rather than bolted on:

- **Verified authorities only.** No self-declared account may announce a
  gathering. This one rule removes most of the risk.
- **Jurisdiction-bound.** Enforced geometrically, as in 2.2.
- **Immutable audit.** Every gathering broadcast writes to `res_audit_log`,
  including edits — you can always answer "who announced this, when".
- **No individual targeting.** A gathering names a place and a purpose, never a
  private person or residence.
- **Rate-limited and cool-down bound**, so a compromised account can't flood.
- **Fast suspension.** An authority's broadcast rights are revocable in one
  update, and revocation propagates down the pyramid immediately.

I'd also keep announcements **factual by schema**: place, time, purpose,
convenor, expected duration. Campaign material is a different product with
different rules; conflating them turns neutral infrastructure into a partisan
surface and destroys the "chairs" position.

---

## 3. The Teams-shaped question

You mentioned Teams. What's actually transferable is not chat — you have DMs
already — but three specific things:

1. **Org → team → channel → member**, which maps to
   `authority → sub-authority → sector → member`.
2. **Announcement vs conversation as distinct objects.** A broadcast is not a
   message; it has a lifecycle, a geometry and a truth value. Keeping them
   separate is why the accountability loop in 2.6 is even possible.
3. **Role-scoped posting rights**, already modelled in `can_broadcast_kinds`.

`res_communities` + `res_community_members` (roles `member/admin/founder`) is
the informal version of this and should stay informal. The authority model is
its formal, verified, jurisdictional sibling. Don't merge them — a street
WhatsApp-style group and a municipal department need different rules, and
collapsing them would either over-formalise neighbours or under-verify
institutions.

---

## 4. Sequencing — what to build, in what order, and why

Ordered by **value delivered per unit of risk and effort**, with each phase
useful on its own.

| # | Phase | Contents | Why here |
|---|---|---|---|
| **1** | **Precision** | `measure.ts`, units + precision settings, exact mode on route surfaces | Days of work. Without it the map isn't credible to planners. Zero risk |
| **2** | **Routes** | `res_routes`, `res_route_segments`, draw-and-measure UI, GiST indexes | Unlocks races, marches, patrols. Pure addition, no new trust surface |
| **3** | **Hazard-on-route** | The `ST_DWithin` query + a watch job + notifications | **The differentiator.** Builds directly on the job substrate already shipped |
| **4** | **Risk plan artefact** | Printable/shareable route risk brief | Turns the data into the thing organisers actually hand out |
| **5** | **Crowd civic tier** | Extend `res_neighbourhood_status` into an outage timeline + consensus display | Civic value with **zero institutional dependency**. Also the adoption lever |
| **6** | **Avoidance routing** | ORS integration, `res_route_cache`, fingerprinting, circuit breaker | Costs money and adds a dependency — earn it once routes are used |
| **7** | **Authority model** | `res_authorities`, members, jurisdiction, manual verification of first roots | The heavy phase. Needs a real human verification process, not just code |
| **8** | **Broadcasts** | `res_broadcasts` + lifecycle jobs + scoped delivery | The government channel proper |
| **9** | **Ingestion** | `ext_source` feeds — published schedules first | Fills the layer before institutions arrive |
| **10** | **Accountability** | Confirm/dispute on broadcasts, reliability scoring, published method | The endgame that makes it infrastructure rather than a noticeboard |

**Phases 1–4 need nobody's permission.** They're pure engineering on assets you
already own, and they're where I'd start. Phase 7 is where this stops being a
software project and becomes an institutional one — that's the moment to be
clear-eyed about, because no amount of good code substitutes for a human
verification process.

---

## 5. Honest risks

| Risk | Severity | Mitigation |
|---|---|---|
| **Impersonation of an authority** | Critical | Verification is human, evidenced, revocable; unverified accounts visibly marked and push-ineligible |
| **Routing someone into danger** | Critical | Never present a route as safe; degrade honestly when closure data is stale; show data age on every hazard |
| **Neighbourhood stigmatisation** | High | Incident-based, time-decayed, segment-scoped risk; never area labels or demographic proxies |
| **Gathering announcements misused** | High | Verified-only, jurisdiction-bound, audited, fast revocation, factual schema |
| **Civic layer sits empty and dies** | High | Crowd tier first (§2.5) — value without institutional adoption |
| **Stale closures routing people wrongly** | Medium | `ends_at` already exists; expiry jobs already built; show confidence and age |
| **ORS quota / outage** | Medium | Cache by fingerprint; circuit breaker; degrade to deep-links |
| **PostGIS query cost at scale** | Medium | GiST indexes on every geometry column from day one; corridor-bounded queries |
| **Scope collapse** | High | Phases 1–4 stand alone. Ship them before touching Pillar II |

---

## 6. Where this connects to the work already done

Nothing in the last session becomes obsolete — it becomes the engine:

- **`res_transition()`** runs broadcast and route lifecycles.
- **The job substrate** runs schedule promotion, hazard watching, cache pruning,
  broadcast assessment.
- **The Guard** already forbids automation from writing `is_verified` and trust
  columns — which is *exactly* the rule the authority layer needs. **Authority
  must never be automation-grantable**, and that's already enforced.
- **`res_audit_log`** is what makes civic broadcasts accountable and reversible.
- **The kill switch** matters far more when the app is telling thousands of
  people where to go.

The self-managing architecture was the prerequisite for this vision, built
before the vision was stated. That's fortunate — build it the other way round
and the civic layer would have no brakes.
