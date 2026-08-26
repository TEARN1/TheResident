/**
 * mapZones.ts — The Resident's window into the SHARED living map (map_zones).
 *
 * The Gruvs and The Resident share one Supabase project and one `map_zones`
 * table. This reads the same `zones_near` RPC The Gruvs uses, so Gruvs event
 * closures / routes AND community civic alerts (mirrored from res_alerts /
 * res_neighbourhood_status) all surface on The Resident's Leaflet map too.
 *
 * GeoJSON in → a simple {lat,lon} point out, so Leaflet can drop a marker.
 * Read-only + best-effort: a map hiccup never breaks the page.
 */
import { supabase } from './supabase'

export interface SharedZone {
  id: string
  source_app: string
  kind: string
  label: string | null
  note: string | null
  status: string
  severity: number
  lat: number
  lon: number
  confirmCount: number
  disputeCount: number
  endsAt: string | null
  startsAt: string | null
  // Populated only when the underlying geometry is a road segment
  // (LineString) rather than a single point — a road closure reported
  // point A → point B, not just one dropped pin. [lat, lon][] so it can be
  // handed straight to Leaflet's L.polyline.
  path: [number, number][] | null
}

interface GeoJsonGeometry {
  type?: string
  coordinates?: unknown
}

function toLatLon(c: unknown): [number, number] | null {
  if (!Array.isArray(c) || c.length < 2) return null
  const lat = Number(c[1])
  const lon = Number(c[0])
  return Number.isFinite(lat) && Number.isFinite(lon) ? [lat, lon] : null
}

// A representative single point for popup anchoring / distance calc — for a
// LineString (a road segment, point A → point B) that's the segment's
// midpoint, not its start, so "how far away is this" and the popup land
// where the closure actually is rather than skewed toward one end.
function geojsonPoint(g: GeoJsonGeometry | null): [number, number] | null {
  if (!g) return null
  if (g.type === 'LineString') {
    const coords = (g.coordinates as unknown[] | undefined) || []
    const a = toLatLon(coords[0])
    const b = toLatLon(coords[coords.length - 1])
    if (a && b) return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
    return a || b
  }
  const c: unknown =
    g.type === 'Point' ? g.coordinates :
    g.type === 'Polygon' ? ((g.coordinates as unknown[][] | undefined)?.[0])?.[0] :
    g.type === 'MultiPolygon' ? (((g.coordinates as unknown[][][] | undefined)?.[0])?.[0])?.[0] :
    null
  return toLatLon(c)
}

// The full path when the geometry is a LineString — a road-closure segment
// to draw as a polyline, not a single dropped pin.
function geojsonPath(g: GeoJsonGeometry | null): [number, number][] | null {
  if (!g || g.type !== 'LineString') return null
  const coords = (g.coordinates as unknown[] | undefined) || []
  const path = coords.map(toLatLon).filter((p): p is [number, number] => p !== null)
  return path.length >= 2 ? path : null
}

export async function fetchSharedZones(
  lat: number,
  lon: number,
  radiusM = 8000
): Promise<SharedZone[]> {
  if (!supabase || lat == null || lon == null) return []
  try {
    const { data, error } = await supabase.rpc('zones_near', {
      p_lat: lat, p_lng: lon, p_radius_m: radiusM, p_at: new Date().toISOString(),
    })
    if (error) throw error
    const out: SharedZone[] = []
    for (const z of data || []) {
      let g: GeoJsonGeometry | null = null
      try { g = typeof z.geojson === 'string' ? JSON.parse(z.geojson) : z.geojson } catch { /* skip */ }
      const p = geojsonPoint(g)
      if (!p) continue
      out.push({
        id: z.id, source_app: z.source_app, kind: z.kind,
        label: z.label, note: z.note, status: z.status,
        severity: z.severity, lat: p[0], lon: p[1],
        confirmCount: z.confirm_count || 0, disputeCount: z.dispute_count || 0,
        endsAt: z.ends_at || null, startsAt: z.starts_at || null,
        path: geojsonPath(g),
      })
    }
    return out
  } catch {
    return []
  }
}

/**
 * Confirm or dispute a zone on the shared map — Gruvs- or Resident-sourced,
 * doesn't matter. zone_verify has no ownership gate: any signed-in user from
 * either app can vote, which is what makes the map genuinely two-directional
 * rather than read-only for one side. Throws on failure so the caller can
 * surface a real error instead of a silent no-op.
 */
export async function verifyZone(zoneId: string, vote: 'confirm' | 'dispute'): Promise<void> {
  if (!supabase) throw new Error('Not connected')
  const { error } = await supabase.rpc('zone_verify', { p_zone: zoneId, p_vote: vote })
  if (error) throw error
}

export type ReportableZoneKind = 'road_closed' | 'heavy_traffic' | 'detour' | 'no_parking'

/**
 * Report a road closure/detour/traffic/no-parking zone with a chosen
 * duration. map_zones has no direct INSERT policy — this goes through
 * res_report_map_zone, which validates kind/duration/coordinates and rate-
 * limits to 5 reports/hour server-side. Throws on failure (including the
 * rate limit) so the caller can show the real reason, not a silent no-op.
 */
export async function reportZone(args: {
  kind: ReportableZoneKind
  lat: number
  lon: number
  label?: string
  note?: string
  severity?: 1 | 2 | 3
  durationHours: number
}): Promise<string> {
  if (!supabase) throw new Error('Not connected')
  const { data, error } = await supabase.rpc('res_report_map_zone', {
    p_kind: args.kind,
    p_lat: args.lat,
    p_lon: args.lon,
    p_label: args.label ?? null,
    p_note: args.note ?? null,
    p_severity: args.severity ?? 2,
    p_duration_hours: args.durationHours
  })
  if (error) throw error
  return data as string
}

// road_closed and detour are the two kinds that mean "a stretch of road",
// not a single spot — those get the point A → point B flow. heavy_traffic
// and no_parking stay single-pin reports (a jam or a no-parking spot isn't
// a segment with two ends the way a closure is).
export type SegmentZoneKind = 'road_closed' | 'detour'
const SEGMENT_KINDS = new Set<ReportableZoneKind>(['road_closed', 'detour'])
export const isSegmentKind = (k: ReportableZoneKind): k is SegmentZoneKind => SEGMENT_KINDS.has(k)

/**
 * Report a road closure/detour as a segment (point A → point B), not a
 * single pin — res_report_road_segment validates coordinates/duration/
 * start-time window and rate-limits 5/hr server-side, same as reportZone.
 * p_starts_at lets a resident report a closure that hasn't started yet
 * ("road works from Monday 8am"), not just ones already in effect.
 */
export async function reportRoadSegment(args: {
  kind: SegmentZoneKind
  lat1: number
  lon1: number
  lat2: number
  lon2: number
  label?: string
  note?: string
  severity?: 1 | 2 | 3
  startsAt?: string | null
  durationHours: number
}): Promise<string> {
  if (!supabase) throw new Error('Not connected')
  const { data, error } = await supabase.rpc('res_report_road_segment', {
    p_kind: args.kind,
    p_lat1: args.lat1,
    p_lon1: args.lon1,
    p_lat2: args.lat2,
    p_lon2: args.lon2,
    p_label: args.label ?? null,
    p_note: args.note ?? null,
    p_severity: args.severity ?? 2,
    p_starts_at: args.startsAt ?? null,
    p_duration_hours: args.durationHours
  })
  if (error) throw error
  return data as string
}