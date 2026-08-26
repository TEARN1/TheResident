/**
 * mapMarket.ts — nearby marketplace items for the map's "Marketplace"
 * layer, via res_market_items_near.
 *
 * Read-only + best-effort, matching mapZones.ts's style.
 */
import { supabase } from './supabase'

export interface NearbyMarketItem {
  id: string
  title: string
  category: string
  price: number | null
  currency: string
  image: string | null
  lat: number
  lon: number
  distanceM: number
}

export async function fetchNearbyMarketItems(
  lat: number,
  lon: number,
  radiusM = 8000
): Promise<NearbyMarketItem[]> {
  if (!supabase || lat == null || lon == null) return []
  try {
    const { data, error } = await supabase.rpc('res_market_items_near', {
      p_lat: lat, p_lng: lon, p_radius_m: radiusM
    })
    if (error) throw error
    return (data || []).map((m: {
      id: string; title: string; category: string; price: number | null
      currency: string | null; image: string | null
      lat: number; lon: number; distance_m: number
    }) => ({
      id: m.id,
      title: m.title,
      category: m.category,
      price: m.price,
      currency: m.currency || 'ZAR',
      image: m.image,
      lat: m.lat,
      lon: m.lon,
      distanceM: m.distance_m
    }))
  } catch {
    return []
  }
}
