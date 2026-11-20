import { NextResponse } from 'next/server'
import { distanceM, roughEtaSeconds } from '../../../utils/liveJob'
import { osrmStepText, type RouteStep } from '../../../utils/routeSteps'

// Road route for live jobs on the Vibe Map, from our own routing engine
// (OSRM on the droplet, ROUTING_URL e.g. http://127.0.0.1:5000). Until it is
// set up, or if it does not answer, the map gets a straight line and a rough
// arrival time, marked as such so the screen never pretends it is a road.

export interface RouteAnswer {
  source: 'road' | 'straight'
  /** [lon, lat] pairs, as the map draws them. */
  line: [number, number][]
  distanceM: number
  durationS: number
  steps: RouteStep[]
}

const num = (v: string | null) => (v === null || v.trim() === '' ? NaN : Number(v))
const point = (lat: number, lon: number) =>
  Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams
  const from = { lat: num(q.get('fromLat')), lon: num(q.get('fromLon')) }
  const to = { lat: num(q.get('toLat')), lon: num(q.get('toLon')) }
  if (!point(from.lat, from.lon) || !point(to.lat, to.lon)) {
    return NextResponse.json({ error: 'fromLat, fromLon, toLat and toLon are needed' }, { status: 400 })
  }
  // A job is local: refuse continent-sized requests rather than tie up the engine.
  if (distanceM(from, to) > 1_500_000) return NextResponse.json({ error: 'too far apart' }, { status: 400 })

  const base = process.env.ROUTING_URL?.replace(/\/+$/, '')
  if (base) {
    try {
      const url = `${base}/route/v1/driving/${from.lon},${from.lat};${to.lon},${to.lat}?overview=full&geometries=geojson&steps=true`
      const res = await fetch(url, { signal: AbortSignal.timeout(4000), cache: 'no-store' })
      if (res.ok) {
        const body = await res.json() as {
          code?: string
          routes?: { distance: number; duration: number; geometry: { coordinates: [number, number][] }; legs: { steps: Parameters<typeof osrmStepText>[0][] }[] }[]
        }
        const r = body.code === 'Ok' ? body.routes?.[0] : undefined
        if (r) {
          const answer: RouteAnswer = {
            source: 'road',
            line: r.geometry.coordinates,
            distanceM: Math.round(r.distance),
            durationS: Math.round(r.duration),
            steps: r.legs.flatMap((l) => l.steps).map((s) => ({
              text: osrmStepText(s),
              distanceM: Math.round(s.distance),
              at: s.maneuver.location
            }))
          }
          return NextResponse.json(answer, { headers: { 'Cache-Control': 'no-store' } })
        }
      }
    } catch {
      // Engine down or slow: fall through to the straight line.
    }
  }

  const answer: RouteAnswer = {
    source: 'straight',
    line: [[from.lon, from.lat], [to.lon, to.lat]],
    distanceM: Math.round(distanceM(from, to)),
    durationS: roughEtaSeconds(from, to),
    steps: []
  }
  return NextResponse.json(answer, { headers: { 'Cache-Control': 'no-store' } })
}
