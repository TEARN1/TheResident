// Home area — the Resident-owned answer to "roughly where does this person
// live", and Phase A of the official-area-broadcast strategy
// (docs/OFFICIAL-BROADCAST-STRATEGY.md).
//
// Nothing here tracks anyone. There is no watchPosition, no background
// collection, and no inference: a home area exists only because the resident
// deliberately set one, and disappears the moment they clear it.
//
// The pure functions below mirror what theresident_home_area_schema.sql does
// server-side, so the UI can show a resident exactly what will be stored
// before they agree to store it. The SQL is the authority — these are for
// display and for refusing an obviously-bad value before a round trip.
import { supabase } from './supabase'
import { resilientCall } from './resilientCall'

export type HomeAreaGranularity = 'coarse' | 'exact'

export interface HomeArea {
  lat: number
  lon: number
  granularity: HomeAreaGranularity
  suburb: string | null
  city: string | null
  label: string | null
  setAt: string
}

/** Decimal places kept when coarsening. Mirrors res_coarsen_coord. */
export const COARSE_DECIMALS = 2

/**
 * Roughly how wide the coarse grid is, for telling the resident plainly what
 * "approximate" buys them. 0.01 degrees of latitude is ~1.11km; longitude
 * narrows toward the poles, so this is the honest upper bound, not a promise
 * of exactly 1.1km in every direction.
 */
export const COARSE_GRID_KM = 1.1

export function isValidCoord(lat: number, lon: number): boolean {
  return (
    Number.isFinite(lat) && Number.isFinite(lon) &&
    lat >= -90 && lat <= 90 &&
    lon >= -180 && lon <= 180
  )
}

/** Mirrors res_coarsen_coord: round to the ~1km grid. */
export function coarsenCoord(value: number): number {
  return Number(value.toFixed(COARSE_DECIMALS))
}

export function coarsen(lat: number, lon: number): { lat: number; lon: number } {
  return { lat: coarsenCoord(lat), lon: coarsenCoord(lon) }
}

/**
 * What to show a resident for their saved home area. Prefers the human
 * address, then the suburb/city pair, and only falls back to coordinates when
 * there is genuinely nothing else — the app's own rule, learned the hard way
 * on the map search box, is that people should see places, not numbers.
 */
export function describeHomeArea(area: HomeArea | null): string {
  if (!area) return 'Not set'
  if (area.label) return area.label
  const place = [area.suburb, area.city].filter(Boolean).join(', ')
  if (place) return place
  return `${area.lat.toFixed(COARSE_DECIMALS)}, ${area.lon.toFixed(COARSE_DECIMALS)}`
}

export function granularityLabel(granularity: HomeAreaGranularity): string {
  return granularity === 'exact'
    ? 'Exact location'
    : `Approximate (about ${COARSE_GRID_KM}km)`
}

// ── Network ────────────────────────────────────────────────────────────────

interface DbRow {
  lat: number
  lon: number
  granularity: HomeAreaGranularity
  suburb: string | null
  city: string | null
  label: string | null
  set_at: string
}

function mapRow(row: DbRow): HomeArea {
  return {
    lat: row.lat,
    lon: row.lon,
    granularity: row.granularity,
    suburb: row.suburb,
    city: row.city,
    label: row.label,
    setAt: row.set_at
  }
}

/** RLS makes this self-only — there is no query that returns anyone else's. */
export async function fetchMyHomeArea(): Promise<HomeArea | null> {
  if (!supabase) return null
  const client = supabase
  return resilientCall(async () => {
    const { data, error } = await client.from('res_home_areas').select('*').maybeSingle()
    if (error) throw error
    return data ? mapRow(data as DbRow) : null
  })
}

export async function setHomeArea(input: {
  lat: number
  lon: number
  granularity: HomeAreaGranularity
  suburb?: string | null
  city?: string | null
  label?: string | null
}): Promise<HomeArea> {
  if (!supabase) throw new Error('Not connected')
  if (!isValidCoord(input.lat, input.lon)) throw new Error('That location does not look right.')
  const client = supabase
  return resilientCall(async () => {
    const { data, error } = await client.rpc('res_set_home_area', {
      p_lat: input.lat,
      p_lon: input.lon,
      p_granularity: input.granularity,
      p_suburb: input.suburb ?? null,
      p_city: input.city ?? null,
      p_label: input.label ?? null
    })
    if (error) throw error
    return mapRow((Array.isArray(data) ? data[0] : data) as DbRow)
  })
}

export async function clearHomeArea(): Promise<void> {
  if (!supabase) throw new Error('Not connected')
  const client = supabase
  return resilientCall(async () => {
    const { error } = await client.rpc('res_clear_home_area')
    if (error) throw error
  })
}
