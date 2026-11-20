// Live jobs (bakkie, truck, tow truck) on the Vibe Map: the stages a job
// moves through, and the arithmetic both screens share. Pure, so it is tested
// on its own (liveJob.test.ts).

export type JobStage = 'requested' | 'accepted' | 'on_the_way' | 'arrived' | 'loaded' | 'delivered' | 'cancelled'

export interface LatLon { lat: number; lon: number }

export const JOB_STAGES: JobStage[] = ['requested', 'accepted', 'on_the_way', 'arrived', 'loaded', 'delivered']

export const STAGE_LABEL: Record<JobStage, string> = {
  requested: 'Waiting for the driver',
  accepted: 'Driver accepted',
  on_the_way: 'On the way to pick up',
  arrived: 'Driver has arrived',
  loaded: 'Loaded, heading to drop-off',
  delivered: 'Delivered',
  cancelled: 'Cancelled'
}

/** What the driver's button says to move the job on. */
export const NEXT_ACTION: Partial<Record<JobStage, string>> = {
  requested: 'Accept job',
  accepted: 'Start driving to pick-up',
  on_the_way: "I've arrived",
  arrived: 'Loaded, start the drop-off',
  loaded: 'Delivered'
}

export function nextStage(stage: JobStage): JobStage | null {
  const i = JOB_STAGES.indexOf(stage)
  return i >= 0 && i < JOB_STAGES.length - 1 ? JOB_STAGES[i + 1] : null
}

/** The driver's position is shared only between accepting and delivering. */
export function isLive(stage: JobStage): boolean {
  return stage === 'accepted' || stage === 'on_the_way' || stage === 'arrived' || stage === 'loaded'
}

export function canCancel(stage: JobStage): boolean {
  return stage === 'requested' || stage === 'accepted' || stage === 'on_the_way' || stage === 'arrived'
}

/** Where the driver is heading right now: the pick-up until loaded, then the drop-off. */
export function currentTarget(stage: JobStage, pickup: LatLon | null, dropoff: LatLon | null): LatLon | null {
  if (stage === 'loaded') return dropoff
  if (stage === 'accepted' || stage === 'on_the_way' || stage === 'arrived') return pickup
  return null
}

const R = 6371000

/** Great-circle distance in metres. */
export function distanceM(a: LatLon, b: LatLon): number {
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLon = toRad(b.lon - a.lon)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)))
}

/**
 * Rough driving time when no road route is available: straight-line distance
 * times 1.35 (roads are not straight), at 30 km/h in town. Only a fallback:
 * the routing engine's duration is used whenever it answers.
 */
export function roughEtaSeconds(from: LatLon, to: LatLon): number {
  return Math.round((distanceM(from, to) * 1.35) / (30 / 3.6))
}

export function formatDistance(m: number): string {
  if (!Number.isFinite(m)) return ''
  return m < 1000 ? `${Math.max(10, Math.round(m / 10) * 10)} m` : `${(m / 1000).toFixed(m < 10000 ? 1 : 0)} km`
}

export function formatEta(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return ''
  const min = Math.max(1, Math.round(seconds / 60))
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  return `${h} h ${min % 60} min`
}

/** Distance in metres from a point to the nearest part of a route line. */
export function distanceToRouteM(p: LatLon, route: [number, number][]): number {
  if (route.length === 0) return Infinity
  if (route.length === 1) return distanceM(p, { lon: route[0][0], lat: route[0][1] })
  // Flat projection around the point: fine at street scale.
  const k = Math.cos((p.lat * Math.PI) / 180)
  const toXY = ([lon, lat]: [number, number]) => [((lon - p.lon) * Math.PI / 180) * R * k, ((lat - p.lat) * Math.PI / 180) * R]
  let best = Infinity
  for (let i = 0; i < route.length - 1; i++) {
    const [ax, ay] = toXY(route[i])
    const [bx, by] = toXY(route[i + 1])
    const dx = bx - ax, dy = by - ay
    const len2 = dx * dx + dy * dy
    const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len2))
    const cx = ax + t * dx, cy = ay + t * dy
    best = Math.min(best, Math.hypot(cx, cy))
  }
  return best
}

/**
 * Off the route: further from it than 60 m, or than the GPS reading's own
 * accuracy (a 40 m-accurate fix cannot say the driver left a 30 m street).
 */
export function isOffRoute(p: LatLon, route: [number, number][], accuracyM = 0): boolean {
  return distanceToRouteM(p, route) > Math.max(60, accuracyM * 1.5)
}

/**
 * Whether a new GPS fix is worth sending: the driver moved 15 m or more, or
 * 10 s passed. Keeps the database and the customer's screen up to date
 * without a write every second.
 */
export function shouldSend(prev: { at: number; lat: number; lon: number } | null, next: { at: number; lat: number; lon: number }): boolean {
  if (!prev) return true
  if (next.at - prev.at >= 10_000) return true
  return next.at - prev.at >= 2_000 && distanceM(prev, next) >= 15
}

export function parseStage(value: unknown): JobStage {
  return (JOB_STAGES as string[]).includes(String(value)) || value === 'cancelled' ? (value as JobStage) : 'requested'
}
