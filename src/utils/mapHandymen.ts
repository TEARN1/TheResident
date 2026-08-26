/**
 * mapHandymen.ts — nearby handymen/service businesses for the map's
 * "Handymen & services" layer, via res_handyman_near.
 *
 * Read-only + best-effort, matching mapZones.ts's style: a map hiccup
 * never breaks the page.
 */
import { supabase } from './supabase'

export interface NearbyHandyman {
  id: string
  businessName: string
  category: string
  priceEstimate: string | null
  rating: number
  image: string | null
  lat: number
  lon: number
  distanceM: number
}

export async function fetchNearbyHandymen(
  lat: number,
  lon: number,
  radiusM = 8000
): Promise<NearbyHandyman[]> {
  if (!supabase || lat == null || lon == null) return []
  try {
    const { data, error } = await supabase.rpc('res_handyman_near', {
      p_lat: lat, p_lng: lon, p_radius_m: radiusM
    })
    if (error) throw error
    return (data || []).map((h: {
      id: string; business_name: string; category: string
      price_estimate: string | null; rating: number | null; image: string | null
      lat: number; lon: number; distance_m: number
    }) => ({
      id: h.id,
      businessName: h.business_name,
      category: h.category,
      priceEstimate: h.price_estimate,
      rating: Number(h.rating || 0),
      image: h.image,
      lat: h.lat,
      lon: h.lon,
      distanceM: h.distance_m
    }))
  } catch {
    return []
  }
}
