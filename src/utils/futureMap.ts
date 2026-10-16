/**
 * futureMap.ts — the pure maths behind the 3D VibeMap
 * (src/app/dashboard/components/map/VibeMap.tsx).
 *
 * Nothing in here touches the DOM or MapLibre, so it runs under `tsx` tests.
 *
 *   eventPulse / rankHotspots   How "now" a Gruvs event is, which decides the
 *       colour and height of its light beam: live (on now), tonight, soon
 *       (next three days), later. The Gruvs only gives a start time — there is
 *       no attendance count on this side — so the beam shows *when*, not how full.
 *   arcPoints / pickStreams     The glowing route arcs from you to what's near.
 *   circlePolygon / isochrones  The 5- and 10-minute walking rings.
 */

export type LatLon = { lat: number; lon: number }
export type LngLatTuple = [number, number]

export type EventPulse = 'live' | 'tonight' | 'soon' | 'later'

export const PULSE_COLOR: Record<EventPulse, string> = {
  live: '#10b981',
  tonight: '#f59e0b',
  soon: '#c084fc',
  later: '#8b5cf6',
}

/** Beam height in CSS pixels: the sooner it starts, the taller the light. */
export const PULSE_HEIGHT: Record<EventPulse, number> = { live: 130, tonight: 104, soon: 76, later: 50 }

const PULSE_RANK: Record<EventPulse, number> = { live: 0, tonight: 1, soon: 2, later: 3 }

const HOUR = 3600_000

// MapLibre web-mercator: metres per CSS pixel at a latitude and zoom (512px tiles).
export const metresPerPixel = (lat: number, zoom: number): number =>
  (40075016.686 * Math.cos((lat * Math.PI) / 180)) / (512 * Math.pow(2, zoom))

/**
 * A Gruvs `startsAt` is local wall-clock time ('YYYY-MM-DDTHH:MM'), or a bare
 * date when the event has no time. `new Date('YYYY-MM-DD')` would read the bare
 * date as UTC midnight — two hours early in South Africa — so both forms are
 * built from their parts in local time instead.
 */
export function parseLocalStart(startsAt: string): { date: Date; allDay: boolean } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/.exec(String(startsAt || ''))
  if (!m) return null
  const [, y, mo, d, h, mi] = m
  const allDay = h === undefined
  const date = new Date(Number(y), Number(mo) - 1, Number(d), allDay ? 0 : Number(h), allDay ? 0 : Number(mi))
  return Number.isNaN(date.getTime()) ? null : { date, allDay }
}

const sameLocalDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()

export function eventPulse(startsAt: string, now: Date = new Date()): EventPulse {
  const parsed = parseLocalStart(startsAt)
  if (!parsed) return 'later'
  const { date, allDay } = parsed
  if (allDay) {
    if (sameLocalDay(date, now)) return 'tonight'
    const diff = date.getTime() - now.getTime()
    return diff > 0 && diff <= 3 * 24 * HOUR ? 'soon' : 'later'
  }
  const diff = date.getTime() - now.getTime()
  if (diff <= HOUR && diff >= -4 * HOUR) return 'live'
  if (diff < -4 * HOUR) return 'later'
  if (diff <= 18 * HOUR) return 'tonight'
  if (diff <= 3 * 24 * HOUR) return 'soon'
  return 'later'
}

export interface HotspotInput {
  id: string
  startsAt: string
  lat?: number
  lon?: number
}

export interface Hotspot {
  id: string
  lat: number
  lon: number
  pulse: EventPulse
  startMs: number
}

/** Events with a real position, on-now first, then by start time; capped. */
export function rankHotspots(events: HotspotInput[] = [], now: Date = new Date(), max = 12): Hotspot[] {
  return (events || [])
    .map((e): Hotspot | null => {
      const lat = Number(e?.lat), lon = Number(e?.lon)
      if (!e || e.lat == null || e.lon == null || !Number.isFinite(lat) || !Number.isFinite(lon)) return null
      const start = parseLocalStart(e.startsAt)
      return { id: e.id, lat, lon, pulse: eventPulse(e.startsAt, now), startMs: start ? start.date.getTime() : Infinity }
    })
    .filter((h): h is Hotspot => h !== null)
    .sort((a, b) => (PULSE_RANK[a.pulse] - PULSE_RANK[b.pulse]) || (a.startMs - b.startMs))
    .slice(0, max)
}

export function distanceKm(a: LatLon, b: LatLon): number {
  const R = 6371, toR = Math.PI / 180
  const dLat = (b.lat - a.lat) * toR, dLon = (b.lon - a.lon) * toR
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * toR) * Math.cos(b.lat * toR) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(s))
}

/** '350m away' / '1.2km away' — the label every map card uses. */
export function formatDistance(metres: number): string {
  return metres < 1000 ? `${Math.round(metres)}m away` : `${(metres / 1000).toFixed(1)}km away`
}

/** Quadratic arc between two points, bowed sideways so parallel routes fan out. [lon, lat] pairs. */
export function arcPoints(a: LatLon, b: LatLon, steps = 28, bow = 0.22): LngLatTuple[] {
  const mx = (a.lon + b.lon) / 2, my = (a.lat + b.lat) / 2
  const dx = b.lon - a.lon, dy = b.lat - a.lat
  const cx = mx - dy * bow, cy = my + dx * bow // perpendicular offset
  const pts: LngLatTuple[] = []
  for (let i = 0; i <= steps; i++) {
    const t = i / steps, u = 1 - t
    pts.push([u * u * a.lon + 2 * u * t * cx + t * t * b.lon, u * u * a.lat + 2 * u * t * cy + t * t * b.lat])
  }
  return pts
}

/** Which hotspots get a route arc from you: the soonest few within walking-ish range. */
export function pickStreams(origin: LatLon | null, hotspots: Hotspot[] = [], { max = 4, maxKm = 6 } = {}) {
  if (!origin) return []
  return hotspots
    .map(h => ({ ...h, km: distanceKm(origin, h) }))
    .filter(h => h.km > 0.03 && h.km <= maxKm)
    .sort((a, b) => (PULSE_RANK[a.pulse] - PULSE_RANK[b.pulse]) || (a.km - b.km))
    .slice(0, max)
}

/** A closed ring approximating a circle on the ground. [lon, lat] pairs. */
export function circlePolygon(center: LatLon, radiusM: number, steps = 64): LngLatTuple[] {
  const ring: LngLatTuple[] = []
  const dLat = radiusM / 111_320
  const dLon = radiusM / (111_320 * Math.max(0.01, Math.cos((center.lat * Math.PI) / 180)))
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * 2 * Math.PI
    ring.push([center.lon + dLon * Math.cos(a), center.lat + dLat * Math.sin(a)])
  }
  return ring
}

/** Walking rings at ~80 m/min: 5 minutes (400 m) and 10 minutes (800 m). */
export const ISOCHRONES = [
  { mins: 10, radiusM: 800, color: '#06b6d4' },
  { mins: 5, radiusM: 400, color: '#22c55e' },
] as const

export function isochroneFeatures(center: LatLon | null) {
  return {
    type: 'FeatureCollection' as const,
    features: center
      ? ISOCHRONES.map(r => ({
          type: 'Feature' as const,
          properties: { mins: r.mins, color: r.color },
          geometry: { type: 'Polygon' as const, coordinates: [circlePolygon(center, r.radiusM)] },
        }))
      : [],
  }
}
