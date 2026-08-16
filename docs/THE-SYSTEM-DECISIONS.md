# Solving the hard parts — my recommendations

*Companion to [THE-SYSTEM.md](THE-SYSTEM.md). That document says what could be
built. This one says what I think you should actually do, what I'd cut, the
mechanisms I'd use to solve each named risk, and four things I missed the first
time that matter more than most of what I included.*

Everything here is my judgment, marked as such. Where I'd want a lawyer or a
domain expert rather than an engineer, I say so.

---

# PART A — What I'd change about my own plan

## A1. Ten phases is a wish list, not a plan

Phases 7–10 (authority, broadcasts, ingestion, accountability) are a different
company from phases 1–4. Different users, different sales motion, different
risk profile, different regulatory exposure. Presenting them as one roadmap
makes it feel like a straight line, and it isn't.

**Recommendation:** treat Pillar I as the product and Pillar II as a bet you
fund *from* Pillar I's traction. Not "phase 7 comes after phase 6" — a separate
decision, made later, with evidence.

## A2. I sequenced ingestion last. That's backwards

I put authority accounts at phase 7 and external data ingestion at phase 9.
Wrong way round, and it's the most consequential error in the document.

The highest-value civic information — load-shedding schedules, planned water
interruptions — is **already published** and needs no authority account, no
verification process, no institutional relationship. Meanwhile the authority
model is the single most expensive, slowest, highest-risk component.

**Recommendation:** ingestion moves to immediately after the crowd tier.
Sequence becomes crowd → ingested → *(long pause, evidence gathering)* →
authority. You may find that crowd plus ingestion covers 80% of the civic value,
at which point the authority layer becomes an optimisation rather than a
foundation. That would be the best possible outcome: the ambitious thing turns
out to be unnecessary.

## A3. `res_authorities` is probably in the wrong repo

`CONTRACT.md` §2 is unambiguous: `res_`-prefixed tables belong to The Resident,
unprefixed ones to The Gruvs. But an authority — a school, a municipality — is
not a Resident concept. It serves both apps, exactly like `profiles` does.

If you build `res_authorities` and later need it in The Gruvs, you will either
duplicate it (two verification states for one school — a genuine disaster) or
migrate it across an ownership boundary while live.

**Recommendation:** decide this *before* writing the table, not after. My view:
authorities are shared identity infrastructure and belong alongside `profiles`
as a Gruvs-owned, unprefixed table (`authorities`, `authority_members`), with
The Resident writing only its own extension. That matches how `profiles` /
`res_profiles` already works, and that pattern exists precisely because you hit
this problem once already. Costs a conversation now; costs a migration later.

## A4. Races and civic notices are one map but two products

The unifying abstraction — *a thing, somewhere, for a time, announced by
someone* — is genuinely elegant. Elegance is not a business case.

A race organiser and a resident checking whether the water is back are not the
same person, don't discover the app the same way, and don't value the same
things. What they share is the **map and the hazard layer**, which is real and
is why both belong in one system. But go-to-market is separate.

**Recommendation:** build shared infrastructure, plan separate adoption. Don't
let "it's all one platform" hide that you need two distinct reasons for people
to show up.

## A5. The single thing I'd build first

If I could build only one thing to test this entire thesis:

> **A drawn route, with live hazards on it, that tells you when something
> changes.**

It exercises every hard part — geometry, time windows, crowd verification,
notification delivery, the job substrate — for one concrete user who will tell
you within a week whether it's useful. Everything else in both documents is
inference until that exists.

---

# PART B — Solving each risk, concretely

## B1. Authority impersonation *(Critical)*

**The reframe that matters:** you cannot prevent impersonation. Every
verification system in the world is defeated eventually. What you can control is
whether an impersonation is **slow, expensive, small, visible and reversible**.
Design for detection and recall, not for a perfect gate.

Five mechanisms, in order of value:

### 1. Graduated reach — the strongest structural answer

Verification doesn't unlock a badge. It unlocks **reach**. Damage is bounded by
design, so a successful impersonation of an unverified account is barely worth
attempting.

| Level | Radius | Push? | Kinds allowed | Presentation |
|---|---|---|---|---|
| `unverified` | 500 m | never | `notice` only | Grey, "unverified — treat with caution" |
| `self_declared` | 2 km | never | + `closure`, `deadline` | "Claims to be X. Not verified" |
| `community_endorsed` | ward | digest only | + `planned_outage` | "Endorsed by N residents" |
| `verified` | full jurisdiction | yes | all except `emergency` | Verified badge |
| `verified` + emergency grant | full jurisdiction | high-priority | all | Separately granted, separately revocable |

Note the last row: **emergency broadcast is a separate grant from
verification.** Being a real school doesn't make you an emergency broadcaster.

### 2. Verify against independently-published contact details — never applicant-supplied

This is the rule that does the actual work, and it's the one most systems get
wrong. If an applicant claims to be Ivory Park Primary and gives you a phone
number, that number proves nothing. Verification must use a channel **you found
yourself**, from the institution's own published presence:

- Email challenge to an address at the institution's controlled domain
  (`.gov.za`, `.edu.za` and equivalents are administratively controlled — a
  strong, cheap, automatable signal).
- Callback to a switchboard number listed on the institution's official site or
  a public registry — not on the application form.
- For high-tier authorities: physical correspondence, or in-person.

### 3. Vouching with real liability

Trust flows down the pyramid, but a voucher must have skin in the game: if a
child authority abuses its access, **the parent's reliability score takes the
hit too**. Without that, vouching becomes rubber-stamping within a month.

### 4. A public authority register

Every verified authority, when, by whom, evidence class, every capability
change — publicly listed and diffable. Impersonation is detected fastest by the
real institution noticing. Make it trivially easy for them to look, and make it
a page you can point a suspicious journalist at.

### 5. Recall that travels as far as the error

**Corrections must reach exactly the audience the original reached.** Most
systems retract quietly and leave the false version circulating. Concretely: a
retracted broadcast pushes a correction to every device that received the
original, marks it struck-through in place rather than deleting it (deletion
destroys the evidence of what happened), and the audit log preserves the whole
sequence. Revocation of an authority's rights propagates down the pyramid
immediately.

**Target metric:** time from report-of-impersonation to reach-zero. If that's
under five minutes, you can survive impersonation. If it's hours, you can't.

---

## B2. Routing someone into danger *(Critical)*

### The attack I under-weighted: fake closures as traffic manipulation

A person who reports a false closure can divert traffic away from a competitor's
shop, away from a polling station, or *toward* a chosen street. Once routing
consumes crowd reports, every crowd report becomes an attack surface. The
existing 5/hour rate limit does not address this — one report is enough.

**Solutions, layered:**

**Proximity-gated reporting.** To report a closure you must be within ~150 m of
it, recently. Not perfect (GPS can be spoofed) but it converts a trivial remote
attack into an effortful physical one, which removes almost all of it.

**Two confidence thresholds, not one.** This is the important idea:

| Threshold | Meaning |
|---|---|
| **Display** (low) | One proximate report → shown on the map, marked unconfirmed |
| **Routing** (high) | Authority-sourced, *or* N independent proximate confirmations, *or* a trusted reporter with history |

A single unconfirmed report should never reroute a community. It should still be
visible, because the person who reported it may well be right and the next
person deserves to know.

**Reputation-weighted confirmation.** `res_reputation` already exists. A
first-day account's report is not a veteran reporter's report. Weight, don't
gate — gating excludes new residents entirely, which is its own failure.

**Never assert safety.** Present hazards, never verdicts. "3 known hazards on
this route" — never "safe route". The moment the app says *safe*, it owns the
outcome, morally and probably legally.

**Always show data age and source** on every hazard. "Reported 4 hours ago,
confirmed by 6" lets a person apply their own judgment, which is the only
judgment that should be load-bearing.

**Preserve user agency.** "Routed around a reported closure — show direct route
instead." Never silently reroute; people know things the map doesn't.

**Emergency profile.** For evacuation or emergency routing, use authority and
high-confidence data only. That is not the moment for crowd-sourced guesses.

---

## B3. Neighbourhood stigmatisation *(High)*

The temptation you will face — and it will be strong, because it demos
beautifully and users will ask for it — is a **suburb safety score**. Refuse it.

**Refuse it at schema level, not policy level.** Don't create an area-risk
column. Don't create the aggregate view. A rule that lives only in a policy
document gets implemented by a well-meaning contributor in eighteen months; a
column that doesn't exist can't be rendered.

Beyond that:

**Re-confirmation, not just decay.** A hazard must be periodically re-confirmed
to persist. Ask people who pass near it: "still there?" This turns passive users
into sensors, and it means the map reflects tonight rather than accumulated
history. Cheap to build, and it's the difference between a living map and an
archive of old fears.

**Balance the map.** `res_shared_resources` already holds water points, wifi
hotspots and generators. Render assets and hazards on the same surface. A map
that shows only danger teaches only fear, and it's also less accurate — the
lit, busy, well-served stretch is information too.

**Bias audit without collecting demographics.** Compare risk-annotation density
against actual incident reports per area. Where annotation greatly exceeds
incidents, you're likely looking at perception rather than events. You can
detect that without ever storing a demographic field.

**Local right of reply.** People who live on a segment can dispute its
annotation. `zone_verify` already does this — point it at segments.

---

## B4. Civic gatherings misused *(High)*

Beyond verified-only and jurisdiction-bound, the one that matters most:

**Do not build RSVP or attendee lists for political gatherings. At all.**

Not "make it private", not "restrict access" — **do not create the list.** A
record of who intends to attend a political meeting is a targeting database, and
its existence is the risk regardless of the access controls around it. Access
controls fail, get subpoenaed, get breached, or get changed by a future product
decision. Data you never collected does none of those things.

`res_notice_events` already has an `rsvps uuid[]` array. That's fine for a
street braai. Civic gatherings must be a **different object with no attendee
field**, not a reuse of the notice with a flag set.

Also: factual schema only — place, time, purpose, convenor, expected duration.
The moment the object carries campaign material, the platform stops being
neutral ground and the "chairs" position collapses. That position is your
strategic asset; protect it structurally.

---

## B5. The civic layer sits empty *(High)*

**Claim, don't create.** Pre-populate unclaimed authority placeholders from
public registries (school lists, ward boundaries, clinic directories). When a
school arrives, they *claim* an existing page rather than building one.
Claim-flows convert dramatically better than create-flows — this is the Google
Business Profile playbook and it works.

The safeguard: an unclaimed placeholder must be visibly inert — no
announcements possible, clearly marked "not yet claimed", so it can never itself
be mistaken for an official presence.

**Make absence informative.** "No official notice. 14 neighbours report water
down since 06:00." The gap between what residents report and what institutions
say is itself the product, and it's the thing that eventually brings the
institution to the table.

---

## B6. Stale closures *(Medium)* — the asymmetry

Worth thinking about carefully rather than defaulting to aggressive expiry.

- A **missing** closure sends someone into a blocked road: wasted trip,
  possibly unsafe.
- A **stale** closure diverts thousands unnecessarily: at scale, arguably worse.

**Solution: decay confidence continuously rather than expiring in a binary
step.** As confidence falls, the zone drops below the *routing* threshold first
(stops diverting people) while remaining above the *display* threshold (still
visible, marked "unconfirmed, last seen 6 hours ago"). It leaves the map only
when it falls below both.

That single mechanism — two thresholds plus continuous decay — resolves the
asymmetry without a judgment call, and it reuses the `decayedScore()` shape
already written and tested in `logic.ts`.

---

## B7. Routing dependency *(Medium)* — you may never need it

Worth stating plainly: **most of Pillar I's value needs no routing engine.**

- A race route is *drawn*, not routed.
- Hazard-on-route is a PostGIS intersection.
- Risk plans are annotations.

Only A→B avoidance needs a router. Defer it until people are actually asking. If
you do build it: server-side only (never expose the key), cache by closure
fingerprint, and chain fallbacks ORS → GraphHopper → deep-link with a visible
"live closures not applied" banner when degraded.

---

## B8. PostGIS cost at scale *(Medium)*

**GiST indexes on every geometry column from day one.** Retrofitting is painful
and the omission is invisible until it's urgent.

**Precompute the intersections.** Rather than querying route↔hazard live on
every view, maintain a `res_route_hazards` table updated when either side
changes. That's exactly the **reconciler** pattern from the self-managing plan —
compare desired vs actual, repair — and it turns a repeated expensive query into
a cheap lookup plus a background job you already have the machinery for.

**Bound every query by corridor.** Bounding-box filter first, precise geometry
second. Never scan all zones.

---

# PART C — Four things I missed

These matter more than several items I did include.

## C1. Offline. This is the big one

**Load shedding means no power, no wifi, degraded towers, and dying phones. The
moment a resident most needs the load-shedding schedule is precisely the moment
they cannot fetch it.** A civic layer that requires connectivity fails exactly
when it matters, which makes it worse than useless — it trains people not to
rely on it.

I did not mention this once in the architecture. It should have been near the
top.

**What this changes:**

- **Pre-cache the next 24–48 hours** of scheduled broadcasts and the local
  hazard set, aggressively, whenever connectivity exists. Schedules are known in
  advance — that's the entire point of a schedule.
- **The last known state must be useful and honestly labelled.** "As of 14:20 —
  you are offline" beats a spinner or an error every time.
- **Service worker / installable PWA** so the app opens at all without a
  connection.
- **Consider a no-data fallback for critical alerts.** SMS or USSD reaches a
  dying phone on a congested network when an HTTP request won't. Costs money,
  and I'd want you to size it against real usage before committing — but for
  emergency-tier broadcasts specifically it may be the difference between the
  system working and not.
- **Make schedules shareable as an image or text**, so they propagate through
  WhatsApp — which is where they'll actually spread regardless of what you build.

The existing offline queue (and its data-loss bug, F8 in the self-managing plan)
becomes materially more important under this vision. I'd fix it before building
any of this.

## C2. Data cost

Prepaid data is a real constraint for the users you're describing. A map-heavy,
tile-fetching, image-rich civic app can be genuinely unaffordable to the people
who need it most — and the ones it excludes are the ones least able to get the
information elsewhere.

**Recommendation:** a text-first "lite" civic view that costs kilobytes, not
megabytes. No tiles, no images — just "Water: down since 06:00, 14 reports,
official ETA 16:00." Make it the default on slow connections. This is an
accessibility requirement in the substantive sense, not a nice-to-have.

## C3. Who pays

The civic layer has no revenue model, and municipal procurement runs in years,
not quarters. Building Pillar II expecting institutional revenue would be a
serious strategic error.

**My recommendation:** don't monetise civic at all. Civic information is the
**trust anchor and the daily-open reason** — it's why the app is on the home
screen. Revenue continues to come from the commerce the resulting attention
enables: provider subscriptions, boosts, the existing `pricing.ts` catalogue.

Civic buys retention and acquisition. Commerce pays the bills. Keeping that
separation clean also protects the neutrality that makes the civic layer
credible in the first place — a civic channel with a sponsor is not neutral
ground, and everyone can tell.

## C4. Legal exposure — get real advice before Pillar II

I'm flagging this as an engineer, not a lawyer, and you should treat it as a
prompt to get proper counsel rather than as guidance:

- **Liability** if someone is harmed following a route or acting on a hazard
  map. "Never assert safety" (B2) is partly a design principle and partly a
  liability posture.
- **Impersonation of official communications** may have specific statutory
  consequences in your jurisdiction — for the impersonator and potentially for
  the platform that carried it.
- **POPIA** (South Africa's data protection act) applies to location data,
  which is among the most sensitive categories, and to anything resembling the
  attendee lists I recommended against in B4.
- **Political content** near elections is often specifically regulated.

Phases 1–4 are ordinary product work. Phase 7 onward is a regulated-adjacent
product, and the time to get advice is before the schema, not after launch.

---

# PART D — What I'd do, in order

My actual recommendation, if this were mine:

| Step | Why |
|---|---|
| **1. Fix the offline queue bug (F8)** | It loses user writes today, and C1 makes offline central to the whole vision |
| **2. `measure.ts` + precision settings** | Days of work; without it the map isn't credible to planners |
| **3. `res_routes` + draw-and-measure** | Generated `length_m` from PostGIS; can't drift |
| **4. Hazard-on-route + watch job** | **The differentiator.** Runs on the job substrate already shipped |
| **5. Route risk plan artefact** | The thing an organiser actually hands out |
| **6. Decide the cross-app authority question (A3)** | A conversation now, a migration later |
| **7. Crowd civic tier + offline cache** | Civic value with zero institutional dependency |
| **8. Ingestion of published schedules** | Moved up from phase 9 — highest value per unit of effort |
| **— stop and look at evidence —** | Do people use it? Do institutions ask to join? |
| **9. Authority model, if the evidence says yes** | Expensive, slow, regulated. Earn it |

Steps 1–5 are pure engineering on assets you already own and need nobody's
permission. Step 8 is where you'll learn whether the civic thesis is real.

## The two decisions I need from you

1. **Where do authorities live** — Resident-owned `res_authorities`, or shared
   Gruvs-owned `authorities`? (A3.) This is cheap now and expensive later, and
   it's genuinely your call because it depends on how you see the two apps
   relating long-term.

2. **Do I start at step 1 or step 2?** My recommendation is 1 — the offline
   queue is losing writes today and offline just became central to the vision —
   but it's unglamorous, and if you want to see the route engine first, that's a
   legitimate call.
