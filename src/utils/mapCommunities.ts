/**
 * mapCommunities.ts — nearby resident communities for the map's
 * "Communities" layer, via res_communities_near.
 *
 * Different shape from the other content layers: a community isn't a
 * single point of interest, it's an area — res_communities carries its own
 * radius_m, so this layer draws an actual catchment circle, not just a pin.
 *
 * Read-only + best-effort, matching mapZones.ts's style.
 */
import { supabase } from './supabase'

export interface NearbyCommunity {
  id: string
  name: string
  kind: string
  isPrivate: boolean
  lat: number
  lon: number
  radiusM: number
  memberCount: number
  distanceM: number
}

export async function fetchNearbyCommunities(
  lat: number,
  lon: number,
  radiusM = 15000
): Promise<NearbyCommunity[]> {
  if (!supabase || lat == null || lon == null) return []
  try {
    const { data, error } = await supabase.rpc('res_communities_near', {
      p_lat: lat, p_lng: lon, p_radius_m: radiusM
    })
    if (error) throw error
    return (data || []).map((c: {
      id: string; name: string; kind: string; is_private: boolean
      lat: number; lon: number; radius_m: number; member_count: number; distance_m: number
    }) => ({
      id: c.id,
      name: c.name,
      kind: c.kind,
      isPrivate: c.is_private,
      lat: c.lat,
      lon: c.lon,
      radiusM: Number(c.radius_m || 0),
      memberCount: c.member_count || 0,
      distanceM: c.distance_m
    }))
  } catch {
    return []
  }
}
