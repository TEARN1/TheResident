// The places layer — the permanent half of the map.
//
// map_zones answers "what is wrong here, right now". This answers "what is
// here at all": rooms, spaza shops, water points, wifi, generators, skills,
// things for sale, lost pets, community boundaries.
//
// They are deliberately separate. A zone expires; a borehole does not. Putting
// places in map_zones would mean inventing fake end dates and polluting the
// hazard confirm/dispute counts — see the header of migration 20260815001800.

import { supabase } from './supabase'
import { distanceMetres } from './geo'
import type { Point } from './geo'

export type PlaceKind =
  | 'water_point' | 'wifi' | 'generator'
  | 'vendor' | 'service' | 'skill'
  | 'room' | 'for_sale' | 'lost_found' | 'community'

export interface Place {
  id: string
  kind: PlaceKind
  title: string
  subtitle: string | null
  lat: number
  lon: number
  suburb: string | null
  /** Only communities carry one — they are areas, not points. */
  radiusM: number | null
}

/**
 * Assets before problems.
 *
 * The order here decides what a resident sees first when pins overlap, and
 * that is a product decision rather than a rendering detail: a map that leads
 * with danger teaches only fear. Water, wifi and power come first because on a
 * load-shedding evening they are the most useful things on the screen.
 */
export const PLACE_ORDER: readonly PlaceKind[] = [
  'water_point', 'wifi', 'generator',
  'vendor', 'service', 'skill',
  'room', 'for_sale', 'lost_found', 'community',
]

export const PLACE_LABEL: Record<PlaceKind, string> = {
  water_point: 'Water',
  wifi: 'Wifi',
  generator: 'Power',
  vendor: 'Spaza / vendor',
  service: 'Local pro',
  skill: 'Skill',
  room: 'Room to rent',
  for_sale: 'For sale',
  lost_found: 'Lost & found',
  community: 'Community',
}

/**
 * Colours chosen so assets read as calm and problems read as urgent. The
 * hazard layer already owns red and amber, so nothing here uses them.
 */
export const PLACE_COLOR: Record<PlaceKind, string> = {
  water_point: '#38bdf8',
  wifi: '#22d3ee',
  generator: '#a78bfa',
  vendor: '#34d399',
  service: '#D4AF37',
  skill: '#fbbf24',
  room: '#f472b6',
  for_sale: '#94a3b8',
  lost_found: '#c084fc',
  community: '#64748b',
}

/** Kinds shown before a resident turns anything on — the genuinely useful ones. */
export const DEFAULT_VISIBLE: readonly PlaceKind[] = [
  'water_point', 'wifi', 'generator', 'vendor', 'service',
]

interface PlaceRow {
  id: string
  place_kind: string
  title: string | null
  subtitle: string | null
  lat: number
  lon: number
  suburb: string | null
  radius_m: number | null
}

export async function fetchPlacesNear(
  lat: number, lon: number, radiusM = 8000, limit = 400
): Promise<Place[]> {
  if (!supabase || lat == null || lon == null) return []

  const { data, error } = await supabase.rpc('res_places_near', {
    p_lat: lat, p_lon: lon, p_radius_m: radiusM, p_limit: limit,
  })

  // Best-effort, like fetchSharedZones: a places outage must degrade the map,
  // never break it.
  if (error) return []

  return ((data ?? []) as PlaceRow[])
    .filter(r => Number.isFinite(r.lat) && Number.isFinite(r.lon))
    .map(r => ({
      id: r.id,
      kind: r.place_kind as PlaceKind,
      title: r.title ?? PLACE_LABEL[r.place_kind as PlaceKind] ?? 'Place',
      subtitle: r.subtitle,
      lat: Number(r.lat),
      lon: Number(r.lon),
      suburb: r.suburb,
      radiusM: r.radius_m == null ? null : Number(r.radius_m),
    }))
}

/** Filters to the kinds a resident has switched on, in asset-first order. */
export function visiblePlaces(places: Place[], active: Set<string>): Place[] {
  const rank = new Map(PLACE_ORDER.map((k, i) => [k, i]))
  return places
    .filter(p => active.has(p.kind))
    .sort((a, b) => (rank.get(a.kind) ?? 99) - (rank.get(b.kind) ?? 99))
}

/** Counts per kind, for the legend. A legend without counts teaches nothing. */
export function countByKind(places: Place[]): Record<string, number> {
  const out: Record<string, number> = {}
  for (const p of places) out[p.kind] = (out[p.kind] ?? 0) + 1
  return out
}

/**
 * Nearest place of a kind — what powers "where is the closest water point".
 *
 * That question is the single most useful thing this layer can answer during
 * an outage, so it gets a named function rather than being buried in a
 * component.
 */
export function nearest(places: Place[], kind: PlaceKind, from: Point): Place | null {
  let best: Place | null = null
  let bestDistance = Infinity
  for (const p of places) {
    if (p.kind !== kind) continue
    const d = distanceMetres(from, { lat: p.lat, lon: p.lon })
    if (d < bestDistance) { bestDistance = d; best = p }
  }
  return best
}

/**
 * Groups pins that sit within a few pixels of each other.
 *
 * Without this, one map source was fine and ten make a dense suburb an
 * unreadable pile of dots. Grid-based rather than distance-based because it is
 * O(n) and stable as you pan — a cluster that reshuffles on every drag is
 * worse than no clustering at all.
 */
export interface Cluster {
  lat: number
  lon: number
  places: Place[]
}

export function clusterPlaces(places: Place[], cellMetres: number): Cluster[] {
  if (cellMetres <= 0 || places.length === 0) {
    return places.map(p => ({ lat: p.lat, lon: p.lon, places: [p] }))
  }

  // Rough metres-per-degree; exact enough for deciding which bucket a pin
  // falls in, and far cheaper than a projection.
  const latStep = cellMetres / 111_000
  const buckets = new Map<string, Place[]>()

  for (const p of places) {
    const lonStep = latStep / Math.max(0.1, Math.cos((p.lat * Math.PI) / 180))
    const key = `${Math.floor(p.lat / latStep)}:${Math.floor(p.lon / lonStep)}`
    const list = buckets.get(key)
    if (list) list.push(p)
    else buckets.set(key, [p])
  }

  return [...buckets.values()].map(group => ({
    // Anchor a cluster on its first member rather than the group's average:
    // an averaged point can land in the middle of a road or a river, and a pin
    // in a place nothing actually is reads as a bug.
    lat: group[0].lat,
    lon: group[0].lon,
    places: group,
  }))
}

/** Cell size for a zoom level. Tighter as you zoom in, off entirely up close. */
export function clusterCellFor(zoom: number): number {
  if (zoom >= 17) return 0        // street level: show everything
  if (zoom >= 15) return 60
  if (zoom >= 13) return 250
  if (zoom >= 11) return 1200
  return 5000
}

// ── Searching the neighbourhood's own places ───────────────────────────────

export interface PlaceMatch {
  place: Place
  /** Lower is better. Exposed so callers can merge with other result sources. */
  rank: number
}

/**
 * Matches loaded places against a typed query.
 *
 * The map's search box only ever asked Nominatim, so a resident could find
 * "Ivory Park" but not "plumber" — the app's own directory was unsearchable
 * from the one screen showing where everything is.
 *
 * Ranking is deliberately simple and explainable: a title that starts with the
 * query beats one that merely contains it, which beats a match on the subtitle
 * or the kind. People type the first few letters of what they want, and a
 * fuzzy scorer that occasionally ranks a distant guess first is worse than a
 * plain rule they can predict.
 */
export function searchLocalPlaces(places: Place[], query: string, limit = 6): PlaceMatch[] {
  const q = query.trim().toLowerCase()
  if (q.length < 2) return []

  const matches: PlaceMatch[] = []

  for (const place of places) {
    const title = place.title.toLowerCase()
    const subtitle = (place.subtitle ?? '').toLowerCase()
    const kind = PLACE_LABEL[place.kind].toLowerCase()

    let rank: number
    if (title.startsWith(q)) rank = 0
    else if (title.includes(q)) rank = 1
    else if (subtitle.includes(q)) rank = 2
    else if (kind.includes(q)) rank = 3
    else continue

    matches.push({ place, rank })
  }

  return matches
    .sort((a, b) => a.rank - b.rank || a.place.title.localeCompare(b.place.title))
    .slice(0, limit)
}
