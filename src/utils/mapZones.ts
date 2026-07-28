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
}

function geojsonPoint(g: any): [number, number] | null {
  if (!g) return null
  const c =
    g.type === 'Point' ? g.coordinates :
    g.type === 'LineString' ? g.coordinates?.[0] :
    g.type === 'Polygon' ? g.coordinates?.[0]?.[0] :
    g.type === 'MultiPolygon' ? g.coordinates?.[0]?.[0]?.[0] :
    null
  if (!c || c.length < 2) return null
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
      let g: any = null
      try { g = typeof z.geojson === 'string' ? JSON.parse(z.geojson) : z.geojson } catch { /* skip */ }
      const p = geojsonPoint(g)
      if (!p) continue
      out.push({
        id: z.id, source_app: z.source_app, kind: z.kind,
        label: z.label, note: z.note, status: z.status,
        severity: z.severity, lat: p[0], lon: p[1],
      })
    }
    return out
  } catch {
    return []
  }
}