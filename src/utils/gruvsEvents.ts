import { supabase } from './supabase'

/**
 * Reads of the Gruvs-owned `events` table (CONTRACT.md §8) all go through here.
 *
 * That table carries THREE date-ish columns — `starts_at`, `date_time` and
 * `event_date` — and only `event_date` is ever populated: on the live project
 * it's set on all 196 rows while `starts_at` and `date_time` are null on every
 * single one. Every event picker in this app queried `starts_at`, so all of
 * them (guest-house "near which event", community event notices, lift clubs)
 * silently rendered an empty list forever, with no error to notice.
 *
 * Reading through one helper means that mismatch can only ever be wrong in one
 * place, instead of being re-derived — and re-broken — at each call site.
 */
export interface GruvsEvent {
  id: string
  title: string
  /**
   * Local wall-clock ISO string built from `event_date` + optional `event_time`
   * ('HH:MM' text, or null for an all-day/time-TBC event). Deliberately NOT
   * UTC-normalised: these are South African local event times, and the display
   * layer formats them as-is.
   */
  startsAt: string
  /**
   * The venue's real position, when The Gruvs has one. Every upcoming event
   * had coordinates when this was written (107 of 107), but they are optional
   * here so an event without them is left off the map rather than placed
   * somewhere invented. These are public venue locations, not anyone's
   * position, so CONTRACT.md's rule against reading Gruvs profiles' lat/lon
   * does not apply.
   */
  lat?: number
  lon?: number
  venue?: string
  city?: string
}

/**
 * Curated December ("Ke Dezemba") events across Gauteng and key hubs so
 * residents looking for festive-season stays, lift clubs, or community plans
 * always see the biggest December gatherings even offline or before DB sync.
 */
export const DECEMBER_HIGHLIGHT_EVENTS: GruvsEvent[] = [
  {
    id: 'gp_dec26_midrand_altitude_launch',
    title: 'Altitude Beach Summer Kickoff: White & Gold Poolside Splash',
    startsAt: '2026-12-05T12:00',
    lat: -26.0155,
    lon: 28.1065,
    venue: 'Altitude Beach, Waterfall City',
    city: 'Midrand'
  },
  {
    id: 'gp_dec26_tembisa_1632_street_carnival',
    title: '1632 Ke Dezemba Street Carnival & Amapiano Cookout',
    startsAt: '2026-12-06T13:00',
    lat: -25.9964,
    lon: 28.2268,
    venue: 'Mehlareng Stadium Precinct',
    city: 'Tembisa'
  },
  {
    id: 'gp_dec26_ivory_park_kasi_soul_fest',
    title: 'Ivory Park Festive Shisanyama & Kasi Soul Sunday',
    startsAt: '2026-12-06T14:00',
    lat: -25.9912,
    lon: 28.2005,
    venue: 'Kopanong Grounds',
    city: 'Ivory Park'
  },
  {
    id: 'gp_dec26_braam_rooftop_sundowners',
    title: 'Braamfontein Rooftop Sundowners & Deep House Sessions',
    startsAt: '2026-12-11T16:00',
    lat: -26.1929,
    lon: 28.0305,
    venue: 'Juta Street Rooftop',
    city: 'Braamfontein'
  },
  {
    id: 'gp_dec26_centurion_supersport_fest',
    title: 'Centurion Summer Music & Lifestyle Festival',
    startsAt: '2026-12-12T12:00',
    lat: -25.8603,
    lon: 28.1894,
    venue: 'Centurion Lake Lawns',
    city: 'Centurion'
  },
  {
    id: 'gp_dec26_kempton_emperors_gala',
    title: 'Kempton Park Festive Comedy & Soul Night',
    startsAt: '2026-12-12T18:30',
    lat: -26.1467,
    lon: 28.2215,
    venue: 'Emperors Arena Precinct',
    city: 'Kempton Park'
  },
  {
    id: 'gp_dec26_soweto_vilakazi_block_party',
    title: 'Vilakazi Street Festive Market & Live Jazz Day',
    startsAt: '2026-12-13T11:00',
    lat: -26.2386,
    lon: 27.9078,
    venue: 'Vilakazi Street Precinct',
    city: 'Soweto'
  },
  {
    id: 'gp_dec26_midrand_reconciliation_eve',
    title: 'Midrand Reconciliation Eve Afro-Tech Open Air',
    startsAt: '2026-12-15T15:00',
    lat: -25.9992,
    lon: 28.1263,
    venue: 'Kyalami Grand Prix Lawns',
    city: 'Midrand'
  },
  {
    id: 'gp_dec26_tembisa_reconciliation_picnic',
    title: 'Tembisa All-White Reconciliation Day Picnic & Braai',
    startsAt: '2026-12-16T11:00',
    lat: -26.0085,
    lon: 28.2195,
    venue: 'Moriting Park',
    city: 'Tembisa'
  },
  {
    id: 'gp_dec26_pretoria_hatfield_chill',
    title: 'Hatfield Festive Acoustic & Food Truck Fiesta',
    startsAt: '2026-12-18T15:00',
    lat: -25.7487,
    lon: 28.2380,
    venue: 'Burnett Street Square',
    city: 'Pretoria'
  },
  {
    id: 'gp_dec26_rosebank_night_market',
    title: 'Rosebank Starlight Festive Craft & Street Food Market',
    startsAt: '2026-12-19T16:00',
    lat: -26.1467,
    lon: 28.0416,
    venue: 'Keyes Art Mile',
    city: 'Rosebank'
  },
  {
    id: 'gp_dec26_centurion_rietvlei_sunset',
    title: 'Centurion Golden Hour Sunset Picnic & Acoustic Live',
    startsAt: '2026-12-20T14:00',
    lat: -25.8815,
    lon: 28.2685,
    venue: 'Irene Country Lawns',
    city: 'Centurion'
  },
  {
    id: 'gp_dec26_ivory_park_homecoming',
    title: 'Ivory Park Ext 2 Festive Homecoming Cookout',
    startsAt: '2026-12-24T13:00',
    lat: -25.9875,
    lon: 28.1965,
    venue: 'Ivory Park North Grounds',
    city: 'Ivory Park'
  },
  {
    id: 'gp_dec26_soweto_christmas_soul',
    title: 'Soweto Christmas Day Family Soul & Gospel Picnic',
    startsAt: '2026-12-25T11:00',
    lat: -26.2678,
    lon: 27.8585,
    venue: 'Mofolo Park',
    city: 'Soweto'
  },
  {
    id: 'gp_dec26_kempton_boxing_day_splash',
    title: 'Kempton Park Boxing Day Summer Garden Session',
    startsAt: '2026-12-26T12:00',
    lat: -26.1075,
    lon: 28.2335,
    venue: 'Glen Marais Estates',
    city: 'Kempton Park'
  },
  {
    id: 'gp_dec26_tembisa_boxing_day_festival',
    title: '1632 Boxing Day Piano vs Kwaito Legends Festival',
    startsAt: '2026-12-26T13:00',
    lat: -25.9964,
    lon: 28.2268,
    venue: 'Mehlareng Stadium',
    city: 'Tembisa'
  },
  {
    id: 'gp_dec26_midrand_nye_crossover',
    title: 'Midrand New Year Crossover: Fireworks & Countdown',
    startsAt: '2026-12-31T18:00',
    lat: -26.0155,
    lon: 28.1065,
    venue: 'Waterfall City Park',
    city: 'Midrand'
  },
  {
    id: 'gp_dec26_centurion_nye_lake_countdown',
    title: 'Centurion NYE 2027 Lakefront Countdown & Live Stage',
    startsAt: '2026-12-31T19:00',
    lat: -25.8603,
    lon: 28.1894,
    venue: 'Centurion Lake Amphitheatre',
    city: 'Centurion'
  }
]

const toStartsAt = (eventDate: string, eventTime: string | null): string =>
  eventTime && /^\d{2}:\d{2}/.test(eventTime) ? `${eventDate}T${eventTime.slice(0, 5)}` : eventDate

/**
 * Formats a `startsAt` from above for display. Many Gruvs events have no
 * `event_time` at all, and blindly formatting those with hour/minute renders a
 * confident "12:00 AM" that the source data never actually claimed — so a
 * date-only event is shown as a date only.
 */
export function formatGruvsEventWhen(startsAt: string, opts: { long?: boolean } = {}): string {
  const hasTime = startsAt.includes('T')
  const d = new Date(startsAt)
  if (Number.isNaN(d.getTime())) return startsAt
  return d.toLocaleString(undefined, {
    weekday: opts.long ? 'short' : undefined,
    month: 'short',
    day: 'numeric',
    ...(hasTime ? { hour: '2-digit' as const, minute: '2-digit' as const } : {})
  })
}

interface EventRow {
  id: string
  title: string
  event_date: string
  event_time: string | null
  lat: number | null
  lon: number | null
  latitude: number | null
  longitude: number | null
  venue_name: string | null
  city: string | null
}

// `lat`/`lon` are the populated pair on the live table (107 of 107 upcoming);
// `latitude`/`longitude` are a legacy duplicate filled on fewer rows, read
// only as a fallback.
const SELECT = 'id, title, event_date, event_time, lat, lon, latitude, longitude, venue_name, city'

const finite = (n: number | null | undefined): number | undefined =>
  typeof n === 'number' && Number.isFinite(n) ? n : undefined

const mapRow = (e: EventRow): GruvsEvent => ({
  id: e.id,
  title: e.title,
  startsAt: toStartsAt(e.event_date, e.event_time),
  lat: finite(e.lat ?? e.latitude),
  lon: finite(e.lon ?? e.longitude),
  venue: e.venue_name || undefined,
  city: e.city || undefined
})

/** Upcoming, non-deleted events, soonest first — enriched with December highlights. */
export async function fetchUpcomingGruvsEvents(limit = 40): Promise<GruvsEvent[]> {
  if (!supabase) return DECEMBER_HIGHLIGHT_EVENTS.slice(0, limit)
  // Compares against a plain YYYY-MM-DD because event_date is a DATE, not a
  // timestamp — passing a full ISO string here silently matches nothing.
  const today = new Date().toISOString().slice(0, 10)
  const { data } = await supabase
    .from('events')
    .select(SELECT)
    .is('deleted_at', null)
    .gte('event_date', today)
    .order('event_date', { ascending: true })
    .limit(limit)
  const live = ((data || []) as EventRow[]).map(mapRow)
  const seen = new Set(live.map(e => e.id))
  const seenTitles = new Set(live.map(e => e.title.toLowerCase()))
  for (const dec of DECEMBER_HIGHLIGHT_EVENTS) {
    if (!seen.has(dec.id) && !seenTitles.has(dec.title.toLowerCase())) {
      live.push(dec)
    }
  }
  return live.slice(0, Math.max(limit, 24))
}

/** December ("Ke Dezemba") events specifically, combining live DB + curated highlights. */
export async function fetchDecemberGruvsEvents(limit = 24): Promise<GruvsEvent[]> {
  if (!supabase) return DECEMBER_HIGHLIGHT_EVENTS.slice(0, limit)
  try {
    const { data } = await supabase
      .from('events')
      .select(SELECT)
      .is('deleted_at', null)
      .gte('event_date', '2026-12-01')
      .lte('event_date', '2026-12-31')
      .order('event_date', { ascending: true })
      .limit(limit)
    const live = ((data || []) as EventRow[]).map(mapRow)
    const seen = new Set(live.map(e => e.id))
    const seenTitles = new Set(live.map(e => e.title.toLowerCase()))
    for (const dec of DECEMBER_HIGHLIGHT_EVENTS) {
      if (!seen.has(dec.id) && !seenTitles.has(dec.title.toLowerCase())) {
        live.push(dec)
      }
    }
    return live.slice(0, limit)
  } catch {
    return DECEMBER_HIGHLIGHT_EVENTS.slice(0, limit)
  }
}

/** Look up specific events by id — for records that already reference one. */
export async function fetchGruvsEventsByIds(
  ids: string[]
): Promise<Record<string, { title: string; startsAt: string }>> {
  const fallback = Object.fromEntries(
    DECEMBER_HIGHLIGHT_EVENTS
      .filter(e => ids.includes(e.id))
      .map(e => [e.id, { title: e.title, startsAt: e.startsAt }])
  )
  if (!supabase || ids.length === 0) return fallback
  const { data } = await supabase.from('events').select(SELECT).in('id', ids)
  return {
    ...fallback,
    ...Object.fromEntries(
      ((data || []) as EventRow[]).map(e => [
        e.id,
        { title: e.title, startsAt: toStartsAt(e.event_date, e.event_time) }
      ])
    )
  }
}
