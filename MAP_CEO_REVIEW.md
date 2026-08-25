# VibeMap — reviewed by four infrastructure CEOs

Companion to The Gruvs' `CEO_REVIEW.md`, which uses six *social* operators
(Zuckerberg, Mosseri, Chew, Roslansky, Koum, Dorsey). This one deliberately uses
four **platform / infrastructure** operators instead, because a map is not a
feed — it is a rendering, power, and data-access problem before it is a social one.

**Target:** `src/app/dashboard/components/VibeMap.tsx` (632 lines) plus
`LiveLocationToggle.tsx`.

---

## The honest answer to "would they be happy?"

**No — three of the four would have blocked it, and none for cosmetic reasons.**
Not because it's bad work: the feature logic is genuinely good, the CARTO tile
decision is *correct and well-reasoned*, and the cross-app zone bridge is real.
They'd block it on the four things a platform company measures and an app
developer usually doesn't: **power, frames, reach, and access.**

What they were reviewing, measured rather than asserted:

| Property | Before |
|---|---|
| Component size | 632 lines, 20 `useState`, 9 `useEffect`, 14 handlers, 4 drawers |
| Marker rendering | 1–2 Leaflet `circleMarker`s per zone, **default SVG renderer** — one DOM node each |
| Update strategy | `group.clearLayers()` → rebuild **every** marker |
| Rebuild triggers | `[zones, currentUser, savedPins, alertRadiusM]` — a slider drag rebuilt the whole map |
| Geofence scan | O(pins × zones), computed **inline on every render**, new array identity each time |
| Accessibility | **0** `aria-*`, `role`, `tabIndex` or `onKeyDown` in 632 lines |
| Live location | `enableHighAccuracy: true`, `maximumAge: 5000` — continuous GPS |
| Tiles | CARTO basemaps, keyless, correct attribution |

---

## Tim Cook — Apple

I'm looking at one line and it decides everything: `enableHighAccuracy: true`
with a five-second `maximumAge`. That pins the GPS radio on for as long as the
toggle is on. You have shipped the most power-hungry location configuration that
exists, to a user in a market where a dead phone at night is a safety event, not
an inconvenience — for a feature whose label promises "roughly where I am." That
is also a far larger privacy disclosure than the switch implies: metre-level,
continuous, streamed to a channel. **Ship: coarse positioning by default, and
never let the precision exceed what the label admits to.**

## Jensen Huang — Nvidia

Every zone becomes an SVG node, and you throw all of them away and rebuild on
`clearLayers()` whenever anything changes — including dragging the alert-radius
slider, which usually doesn't change a single pixel of the result. Then the
geofence scan runs pins × zones on *every render* and returns a fresh array, so
it invalidates the rebuild it feeds. You've built a system whose cost grows with
density, on a map whose entire value *is* density. **Ship: draw to one canvas,
not N DOM nodes, and never recompute what didn't change.** That's a one-word map
option and a `useMemo` — it is not a rewrite.

## Sundar Pichai — Google

The tile decision is right, and I want to be clear about that: you understood
that OSM's demo server isn't a production CDN, and you chose a keyless provider
with correct attribution and no vendor lock. That's the instinct that scales.
But the map itself has no *ranking*. Every zone is drawn with equal weight, so at
ten zones it's a map and at four hundred it's noise — the user's question is
never "show me everything", it's "what matters to me, here, now." Severity
scales the radius; nothing scales the *attention*. **Ship: a relevance order —
proximity × severity × recency — and a cap on what's drawn at once.**

## Satya Nadella — Microsoft

Zero accessibility attributes in six hundred lines. A Leaflet canvas is an
opaque rectangle to assistive technology, so today a blind user opens this and
finds nothing — and the geofence alert, which is *safety* information, exists
only as red pixels. That isn't a nice-to-have; it's the line between software
you can sell to an institution and software you can't. Separately, 632 lines
with twenty state variables is a screen, not a platform — the moment Gruvs wants
this same map, you'll copy it. **Ship: label the region, announce alerts in a
live region, and start pulling the layers apart behind a typed contract.**

---

## Where they disagree

**1. Cook vs Pichai — precision.** Pichai's ranking wants signal: the tighter
the location, the better the relevance. Cook's answer is that precision you
didn't need is a liability you now own. **I take Cook, without splitting it.**
This is a neighbourhood-safety app whose own doctrine already says visibility is
safety and coordinates never leave the database precisely; a ranking model that
needs metre-level continuous GPS to work is the wrong model here. Rank on coarse
distance buckets and accept the slightly worse ordering.

**2. Huang vs Nadella — where the effort goes.** Huang wants the render path
fast; Nadella wants it decomposed and accessible first. **I take Huang for the
performance work and Nadella for the accessibility, and reject Nadella's
decomposition for now.** Rationale: canvas + memo is a handful of lines and pays
off immediately on the cheap Android handsets this launches on; accessibility is
similarly cheap and is a floor, not an optimisation. Splitting a 632-line
component into a layer architecture is real work that pays off only when a
*second* consumer exists — and Gruvs already has its own map. Do it when the
duplication is real, not in anticipation of it.

---

## What was actually changed

| Change | CEO | File |
|---|---|---|
| `preferCanvas: true` — all markers render into one canvas element instead of one SVG node each | Huang | `VibeMap.tsx` |
| `geofenceHits` memoised on `[savedPins, zones, alertRadiusM]`; added a `geofenceZoneIds` Set so the marker loop is O(1) per zone instead of a linear scan | Huang | `VibeMap.tsx` |
| Marker effect now depends on `geofenceZoneIds`, not `savedPins`/`alertRadiusM` — dragging the radius slider no longer rebuilds every marker (verified the effect body references neither, so there's no stale closure) | Huang | `VibeMap.tsx` |
| `enableHighAccuracy: false`, `maximumAge: 30000` — coarse network positioning instead of continuous GPS | Cook | `LiveLocationToggle.tsx` |
| `role="region"` + `aria-label` on the map container | Nadella | `VibeMap.tsx` |
| `aria-live="polite"` text summary of zone count and geofence alerts, so safety info is not visual-only | Nadella | `VibeMap.tsx` |

Verified: `tsc --noEmit` clean, `eslint` clean on both files (0 errors,
0 warnings). No behaviour change to what the map *shows* — only to how it draws,
what it costs, and who can perceive it.

## Deliberately NOT done

- **Pichai's relevance ranking.** It changes which zones a user sees, which is a
  product decision about a safety surface — not something to slip into a
  performance pass. It is the highest-value next step.
- **Nadella's decomposition.** Premature at one consumer; see the disagreement
  above.
- **Keyboard navigation between markers.** The live region makes the map's
  *information* available; making every marker tabbable needs a real interaction
  design (marker list? roving tabindex?), and a half-done version is worse than
  an honest summary.
