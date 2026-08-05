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
}

interface GeoJsonGeometry {
  type?: string
  coordinates?: unknown
}

function geojsonPoint(g: GeoJsonGeometry | null): [number, number] | null {
  if (!g) return null
  const c: unknown =
    g.type === 'Point' ? g.coordinates :
    g.type === 'LineString' ? (g.coordinates as unknown[] | undefined)?.[0] :
    g.type === 'Polygon' ? ((g.coordinates as unknown[][] | undefined)?.[0])?.[0] :
    g.type === 'MultiPolygon' ? (((g.coordinates as unknown[][][] | undefined)?.[0])?.[0])?.[0] :
    null
  if (!Array.isArray(c) || c.length < 2) return null
  return [Number(c[1]), Number(c[0])] // [lat, lon]
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
        endsAt: z.ends_at || null,
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