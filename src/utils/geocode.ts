/**
 * geocode.ts — thin client for OSM's free Nominatim search API.
 *
 * No API key: Nominatim's usage policy asks for a descriptive User-Agent or
 * Referer per request. Browser `fetch` calls already send an Origin/Referer
 * header automatically, so nothing extra is needed here — we just keep
 * request volume low by debouncing on the caller's side (see useDebouncedValue)
 * and capping results.
 */

export interface GeocodeResult {
  id: string
  label: string
  lat: number
  lon: number
}

export async function searchPlaces(query: string, signal?: AbortSignal): Promise<GeocodeResult[]> {
  const q = query.trim()
  if (q.length < 3) return []
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=5`
    const res = await fetch(url, { signal, headers: { Accept: 'application/json' } })
    if (!res.ok) return []
    const data = await res.json()
    if (!Array.isArray(data)) return []
    return data.map((r: { place_id: number; display_name: string; lat: string; lon: string }) => ({
      id: String(r.place_id),
      label: r.display_name,
      lat: parseFloat(r.lat),
      lon: parseFloat(r.lon)
    })).filter((r: GeocodeResult) => Number.isFinite(r.lat) && Number.isFinite(r.lon))
  } catch {
    return []
  }
}

export async function reverseGeocode(lat: number, lon: number, signal?: AbortSignal): Promise<string | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`
    const res = await fetch(url, { signal, headers: { Accept: 'application/json' } })
    if (!res.ok) return null
    const data = await res.json()
    return data.display_name || null
  } catch {
    return null
  }
}

