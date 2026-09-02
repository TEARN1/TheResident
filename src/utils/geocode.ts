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

// Every keystroke in MapSearchBox and every map click/marker re-render can
// re-issue the same search/reverse-geocode request against Nominatim's free,
// rate-limited API. A small in-memory cache (per browser tab, cleared on
// reload) makes repeats — retyping a search, re-opening the same popup —
// free instead of a fresh network round trip.
const CACHE_LIMIT = 200
const searchCache = new Map<string, GeocodeResult[]>()
const reverseCache = new Map<string, string | null>()
const partsCache = new Map<string, ReverseGeocodeParts>()

function rememberIn<K, V>(cache: Map<K, V>, key: K, value: V) {
  cache.set(key, value)
  if (cache.size > CACHE_LIMIT) {
    const oldest = cache.keys().next().value
    if (oldest !== undefined) cache.delete(oldest)
  }
}

export async function searchPlaces(query: string, signal?: AbortSignal): Promise<GeocodeResult[]> {
  const q = query.trim()
  if (q.length < 3) return []
  const cacheKey = q.toLowerCase()
  const cached = searchCache.get(cacheKey)
  if (cached) return cached
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=5`
    const res = await fetch(url, { signal, headers: { Accept: 'application/json' } })
    if (!res.ok) return []
    const data = await res.json()
    if (!Array.isArray(data)) return []
    const results = data.map((r: { place_id: number; display_name: string; lat: string; lon: string }) => ({
      id: String(r.place_id),
      label: r.display_name,
      lat: parseFloat(r.lat),
      lon: parseFloat(r.lon)
    })).filter((r: GeocodeResult) => Number.isFinite(r.lat) && Number.isFinite(r.lon))
    rememberIn(searchCache, cacheKey, results)
    return results
  } catch {
    return []
  }
}

export interface ReverseGeocodeParts {
  label: string | null
  suburb: string | null
  city: string | null
}

/**
 * Structured reverse geocode — the same Nominatim call as reverseGeocode, but
 * keeping the suburb/city fields instead of throwing away everything except
 * display_name.
 *
 * The home-area feature needs these separately: the label is what a resident
 * is shown ("12 Vine Street, Kreuzberg"), while suburb/city are what get
 * normalised onto res_profiles so area targeting can still reach residents
 * who never dropped a pin. PropertiesPanel's geocode-mismatch check reads the
 * same `address` object inline; this is that parsing done once, reusably.
 */
export async function reverseGeocodeParts(
  lat: number,
  lon: number,
  signal?: AbortSignal
): Promise<ReverseGeocodeParts> {
  const empty: ReverseGeocodeParts = { label: null, suburb: null, city: null }
  const cacheKey = `${lat.toFixed(4)},${lon.toFixed(4)}`
  const cached = partsCache.get(cacheKey)
  if (cached) return cached
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`
    const res = await fetch(url, { signal, headers: { Accept: 'application/json' } })
    if (!res.ok) return empty
    const data = await res.json()
    const addr = data?.address || {}
    const parts: ReverseGeocodeParts = {
      label: data?.display_name || null,
      // Nominatim's naming varies by country and by how densely an area is
      // mapped, so fall through the plausible keys rather than assuming one.
      suburb: addr.suburb || addr.neighbourhood || addr.city_district || addr.village || null,
      city: addr.city || addr.town || addr.municipality || addr.county || null
    }
    rememberIn(partsCache, cacheKey, parts)
    return parts
  } catch {
    return empty
  }
}

export async function reverseGeocode(lat: number, lon: number, signal?: AbortSignal): Promise<string | null> {
  // Rounded to ~11m precision — plenty for a display address, and turns
  // near-identical popup opens into cache hits instead of near-misses.
  const cacheKey = `${lat.toFixed(4)},${lon.toFixed(4)}`
  if (reverseCache.has(cacheKey)) return reverseCache.get(cacheKey) ?? null
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`
    const res = await fetch(url, { signal, headers: { Accept: 'application/json' } })
    if (!res.ok) return null
    const data = await res.json()
    const label = data.display_name || null
    rememberIn(reverseCache, cacheKey, label)
    return label
  } catch {
    return null
  }
}

