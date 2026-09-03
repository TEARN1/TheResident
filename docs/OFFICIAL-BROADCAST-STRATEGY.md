# Official Area Broadcasts — strategy

**Status:** Phases A through E are **built and live**; F is not.

> **Push needs three secrets before it does anything** — see
> `docs/PUSH-SETUP.md`. Until they are set, urgent notices still reach the
> in-app bell and banner; they just will not wake a closed phone.
>
> **Two things still gate real use.** `res_jurisdictions` is empty until
> someone runs `scripts/import-boundaries.mjs` against Municipal Demarcation
> Board data — with no boundaries loaded, no official has an area to send to.
> And official verification is still a manual `verified` flag, so the door is
> closed by default rather than guarded by a process.
**Decision owner:** you. **Written:** during the session that shipped the
Service Desk, the institution directory, and urgency broadcasts.

| Phase | State |
|---|---|
| A — resident home area | ✅ built, applied, tested |
| B — jurisdictions, boundary import, containment + verification gate | ✅ built, applied, tested |
| C — map targeting UI + audience preview | not started |
| D — send, fan-out, receipts, public record | not started |
| E — Web Push | blocked on a VAPID key from you |
| F — billing | blocked on your payment portal |

**Boundaries are not loaded yet.** The machinery is live but
`res_jurisdictions` is empty until someone runs
`scripts/import-boundaries.mjs` against Municipal Demarcation Board GeoJSON —
see §5. Until then no official has an area, and the containment gate refuses
everything, which is the correct default.

---

## 1. What we're trying to build

A verified official opens a map, **selects the area they are responsible for**,
writes one message, presses send — and **every resident inside that area is
notified**.

The ladder runs the full height of government:

| Who | Area they speak to |
|---|---|
| Ward councillor | their ward |
| Mayor / municipal manager | the municipality or metro |
| District official | the district |
| Premier / provincial department | the province |
| President / national department | the country |

And the same machinery serves institutions, which is where the day-to-day value
actually sits:

- A **library** telling parents in its catchment where learners can study.
- A **police station** reaching its precinct about a crime pattern.
- A **clinic** announcing changed hours or a vaccination drive.
- A **school** reaching feeder-area families.
- A **utility** announcing a planned water or power shutdown.

The requirement in one sentence: *one message, one area, everyone in it.*

---

## 2. Why today's system doesn't do this

The app already has organisation broadcasts (`res_org_units`,
`res_org_broadcasts`, `res_fanout_broadcast`). They work — but they resolve
their audience through `res_resolve_broadcast_audience()`, which walks the
org-unit tree and returns **followers**: people who went and opted in.

That is the wrong shape for government. A resident who has never heard of the
app's directory still needs to know the water is going off tomorrow. Reaching
only your followers is a newsletter. Reaching everyone in a ward is civic
communication. **They are different consent models, and they need different
audience resolvers.**

So this is an extension alongside the existing feature, not a reuse of it. Both
survive: follow-based for anyone, area-based for verified officials.

### What already exists and gets reused

| Piece | What it gives us |
|---|---|
| `res_org_units` | Already has the tiers we need — `municipality`, `ward`, `utility`, `isp`, `clinic`, `school` — plus `verified`, `sector`, `suburb`, `city`, contact fields |
| `res_org_broadcasts` | `priority` (normal/important/urgent/critical), `category`, `expires_at` |
| `res_org_broadcast_receipts` | Per-recipient `seen_at` / `acknowledged_at` |
| `res_fanout_broadcast()` | Writes into the shared `notifications` rail with deep-link `action_url` and a `data` payload. Hard cap: **20,000 recipients**, then raises `audience_too_large` |
| `res_check_broadcast_priority()` | **Unverified units already cannot send urgent/critical.** This is the hook official verification plugs into |
| `res_check_rate_limit()` + 5/hour trigger | Abuse control already in place |
| `UrgentBroadcastBanner.tsx` | A banner that persists until explicitly acknowledged |
| **PostGIS, live** | `map_zones.geom`, SRID 4326 — real geometry work already has precedent in this database |

---

## 3. The blocker, stated plainly

**There is no Resident-owned location for a resident.**

`res_profiles` holds only free-text `suburb` and `city`. Coordinates *do* exist
on the shared `profiles` table (`lat`, `lon`, `home_base_lat`, `home_base_lon`) —
but `CONTRACT.md` §3 is explicit:

> Never read (Gruvs-private): `push_token, email, first_name, surname,
> emergency_contacts, lat/lon, birth_*`.

So The Resident may not touch them. Today there is nothing to test against a
polygon. **Establishing a Resident-owned home point is step one of every version
of this feature**, and no amount of map UI matters until it exists.

---

## 4. The core idea: authority is a polygon, not a permission

Give every official body a **jurisdiction** — a stored polygon. A councillor's
is their ward. A mayor's is the municipality. A premier's is the province. The
president's is the country. A library's or police station's is a service area or
precinct.

Then one rule governs the entire hierarchy:

> **You may broadcast to any area fully contained within your own jurisdiction,
> and nowhere else.**

Enforced server-side as `ST_Covers(jurisdiction, target_area)`.

> **Correction, found while building Phase B.** An earlier draft of this
> document said `ST_Within`. That is wrong twice over. `geography` does not
> support `ST_Within` at all, and — the trap that actually matters — on
> `geography` a polygon does not even **cover itself**: `ST_Covers(g, g)`
> returns false, because geography edges are geodesics and polygon-covers-
> polygon is not reliably supported there. Left uncorrected, *"send to my whole
> ward"* — the single most common action in this feature — would have been
> silently refused in production. Boundaries are therefore **stored** as
> geography (correct for point-in-polygon and for radius targeting with
> `ST_DWithin`) while polygon containment **casts both sides to `::geometry`**.
> The local test harness caught this; `sql-tests/90-jurisdictions.test.sql`
> now pins both behaviours so it cannot be "simplified" back.

Why this is the right design:

- A mayor can target one ward or the whole city — both are inside their polygon.
- A councillor **cannot** reach past their ward, no matter what they draw. Not
  because a rule says so, but because the geometry refuses.
- The president can reach anything, because their polygon contains everything.
- Institutions need no special case — a library just has a differently-shaped
  polygon.

No per-tier permission matrix, no trust, no "please don't spam the country"
policy to enforce by hand. **The boundary does the enforcing.**

---

## 5. Data model

Four pieces. All `res_`-prefixed per `CONTRACT.md` §2. The first two are built;
`res_area_broadcasts` arrived in Phase D — see `theresident_area_broadcast_send_schema.sql`.

### `res_home_areas` — where a resident is, Resident-owned

```
user_id      uuid primary key -> profiles(id)
lat, lon     double precision   -- CONTRACT.md §4: locations are lat/lon doubles
granularity  text               -- 'coarse' | 'exact'
suburb, city, label  text       -- from the same reverse-geocode as the pin
set_at       timestamptz
```

- **Opt-in.** The resident drops a pin for their home area; nothing is inferred
  and nothing is collected in the background.
- **RLS: strictly self.** Only the owner may select or write their own row.
- **Officials never read this table.** Matching happens *inside* a
  `security definer` function that returns recipient ids, never coordinates.
  There is no code path by which an official learns where anyone lives.
- Default to `coarse` — round the stored point to a grid so the database holds
  "roughly this neighbourhood", which is all a containment test needs.

### `res_jurisdictions` — the boundaries

```
id            uuid primary key
name          text          -- 'Ward 12, City of Tshwane'
level         text          -- ward | municipality | district | province | national | service_area
external_ref  text          -- official ward/municipal code; upsert key with level
parent_id     uuid          -- wards nest in municipalities, for labelling
boundary      geography(MultiPolygon, 4326)
```

GiST index on `boundary`. Seeded from official **Municipal Demarcation Board**
GeoJSON (wards, local and district municipalities, provinces) — public data, so
the ladder from councillor to president is real from day one rather than
hand-drawn.

`service_area` rows are for institutions and are drawn by us or by the
institution during onboarding.

**Loading them:** `scripts/import-boundaries.mjs` takes a GeoJSON file and a
level and upserts through the service-role-only `res_upsert_jurisdiction` RPC.
The data is deliberately not committed — the national ward set is tens of MB
and is redetermined periodically. Import parents before children (provinces →
municipalities → wards) so `parent_id` resolves. Re-running after a
redetermination **updates** a ward rather than creating a second one that
would double-notify everyone inside it.

### `res_org_units.jurisdiction_id`

One nullable column binding a verified body to its polygon. Null means the unit
has no geographic authority and keeps follow-based broadcasting only.

### `res_area_broadcasts` — the permanent record

```
unit_id, target_geom, target_label ('Ward 12'), priority, category,
title, body, recipient_count, sent_at
```

Every area broadcast is a public record: who said it, to which area, reaching
how many people. This is deliberate — see §8.

---

## 6. How an official picks the area

Four mechanisms. All four produce the same `target_geom` and all four pass
through the same containment check, so the security story is identical
regardless of which one is used. Ship in this order:

**(a) "My whole area" — one tap.** The default and the 90% case. The councillor
opens the composer, their ward is already selected, they type and send.

**(b) A named sub-area inside your jurisdiction.** A mayor picking one ward out
of their city; a provincial department picking three municipalities. A list plus
map highlight — no drawing required.

**(c) Radius around a point.** Drop a pin, drag a circle: *"everyone within 3km
of this library"*. The natural fit for libraries, clinics and police stations,
whose catchment is a distance rather than a boundary.

**(d) Freehand polygon.** Draw any shape, for the genuinely ad-hoc: *"these four
streets are flooded"*, *"this block has no water"*. Still clipped to the
jurisdiction.

The map itself is the interface you described — the official sees their own area,
sees what they're about to reach, and confirms it visually before sending.

---

## 7. Resolving the audience

A single `security definer` function, `res_resolve_area_audience(target_geom,
priority)`:

1. **Pinned residents** — `ST_Covers(target_geom, res_home_areas.point)`.
2. **UNION unpinned residents** — match `res_profiles.suburb` / `city` against
   the suburb names the target area covers. This is the fallback that keeps
   reach usable before pin adoption is high, and it's why the first phase also
   normalises suburb text.
3. **Minus muted recipients**, except where priority is `critical`.
4. **Deduplicate, cap, count.**

Returns a count (for the preview) and the recipient ids (for fan-out). Never
returns a coordinate.

### The mandatory preview

Before the send button enables, the official must see:

> *This will reach approximately **4,200 residents** in Ward 12.*

This is not decoration. It prevents the accidental province-wide send, it makes
the official think about proportionality, and it is the natural place to meter
usage when billing arrives.

---

## 8. Consent, privacy and transparency

Sending to people who never chose you is a serious thing. The rules:

**Mute tiers**

| Priority | Can a resident mute it? |
|---|---|
| `critical` — evacuation, disaster, missing child | **No.** Always delivered |
| `important` — planned outage, road closure, clinic hours | Yes, per sender and per category |
| `normal` — newsletters, events | Yes, and easily |

The one non-mutable tier is what justifies the entire feature existing. Every
other tier is the resident's choice. An app that cannot be silenced gets
uninstalled, and an uninstalled app saves nobody during a flood.

**Privacy guarantees**

- No background location tracking, ever. Matching uses a stored home point the
  resident set deliberately.
- The home point is never rendered, exported, or returned to any official.
- Categories are mandatory on every broadcast, so a resident can mute *"library
  events"* without muting *"the police station"*.

**Transparency, both directions**

- Every broadcast a resident receives shows **who sent it, what area it covered,
  and how many people got it**.
- Every official's send history is **permanently public on their profile**.

That last point turns the feature into something an official actually wants:
a visible record of having communicated. It pairs directly with the Service
Desk's *"how long does this provider take to fix things"* measurement — one
tracks what they said, the other tracks what they did.

---

## 9. Verification — the biggest risk

**Anyone claiming to be the mayor is the single largest danger in this feature.**
A fake evacuation order is a real-world harm, not a bug report.

You've said you want to leave identity verification for later. That's fine — the
design closes the door by default instead:

> **Area broadcasting requires `verified = true` AND a bound jurisdiction.**

An unverified unit keeps follow-based broadcasting exactly as it works today,
and cannot reach a single person who didn't opt in. When you're ready to vet
officials, verification is **a flag you flip** — no new code needed, because
`res_check_broadcast_priority()` already gates on `verified`.

When you do build it, the credible options are: an official government email
domain, a letter on letterhead reviewed by you, or in-person verification via
the councillor you already know. Start manual. At this scale, manual is correct.

---

## 10. Anti-abuse

- Reuse the existing 5-broadcasts-per-unit-per-hour trigger and
  `res_check_rate_limit()`.
- **Per-level daily caps**, inversely proportional to reach: a councillor may
  send more messages to fewer people; a premier fewer messages to more.
- **Raise the 20,000 fan-out cap per level**, with a hard ceiling and a manual
  approval step above a threshold. A national broadcast should require a
  deliberate second action, not a single click.
- Mandatory category, so muting is surgical rather than all-or-nothing.
- Because every send is publicly recorded (§8), abuse is visible rather than
  silent — which is its own deterrent.

---

## 11. Delivery reality — read this before promising anything

**What works today:** in-app notification bell, the urgent banner that persists
until acknowledged, realtime delivery while the app is open.

**What does not:** reaching a phone when the app is closed. That needs Web Push
with a VAPID key, which is still outstanding and which only you can provision.

This matters more here than anywhere else in the app. *"The mayor announced an
evacuation"* is worth very little if it appears the next time someone happens to
open the app. **Push is a hard prerequisite for the emergency use case**, even
though the targeting can be built before it.

**SMS** is the other channel officials will expect, and the one that reaches
residents who don't have the app at all. It costs real money per message and is
a separate build. Naming it here so it isn't a surprise later.

---

## 12. Rollout phases

| Phase | What | Blocked on |
|---|---|---|
| **A** | ✅ **Done.** `res_home_areas` + home-pin UI + suburb normalisation | — |
| **B** | ✅ **Done.** `res_jurisdictions`, `scripts/import-boundaries.mjs`, `res_org_units.jurisdiction_id`, containment rule + verification gate | — |
| **C** | Map targeting UI (a → b → c → d) + audience-count preview | A, B |
| **D** | Send, fan-out, receipts, public record | C |
| **E** | Web Push so emergencies reach closed phones | **VAPID key from you** |
| **F** | Billing | **Your payment portal** |

Phase A is the unglamorous one and the one everything else waits on. It's also
independently useful — a home area improves housing search, the Service Desk's
neighbour matching, and safety alerts, whether or not this feature ships.

---

## 13. Commercial model (sketch — not to be built yet)

You described a six-month free probation for officials and facilities, then a
subscription. The clean value line:

- **Free forever:** follow-based broadcasting. Anyone can create a unit and speak
  to people who chose to follow them. This is the recruitment engine — it costs
  us nothing and populates the directory.
- **Paid:** area broadcasting. *Reaching everyone in a ward* is the capability
  worth paying for, and the one with real infrastructure cost behind it.

Indicative tiers, cheapest to dearest: **ward councillor → institution (library,
clinic, school) → municipality / metro → provincial → national (negotiated)**.
Price on population reached, not on message count — it's the honest metric and
it matches what the preview already shows them.

Six months free from the day a body is verified, as you described. It gets the
councillor you already know onto the platform with no friction, and gives you
half a year of usage data before anyone is asked for money.

**Billing is plumbing, not new infrastructure**: `paystack-checkout` and
`paystack-webhook` edge functions are already deployed and `res_subscriptions`
already exists. When you hand over the portal details, this is wiring, not
architecture.

---

## 14. Open questions for you

1. **Which councillor/ward do we pilot with?** The design is much easier to
   validate against one real ward with one real official than in the abstract.
2. **How do you want to verify officials when the time comes** — email domain,
   letterhead, or in person?
3. **Do institutions draw their own service area, or do you draw it for them**
   during onboarding?
4. **Is SMS in scope eventually?** It changes the economics and the tier
   pricing significantly.
