// Geographic primitives, with ZERO imports — deliberately.
//
// These used to live in logic.ts, which imports types from '../store' and so
// transitively reaches Redux. That is harmless in Next.js and fatal in a
// Supabase edge function: the fault-escalation job runs under Deno and must
// import the same distance maths the client uses, without dragging a state
// library into a scheduled job.
//
// So the rule for this file is simple and worth keeping: it imports nothing,
// ever. Anything that needs to be shared between the app and the edge runtime
// belongs here or in a file with the same property.
//
// logic.ts re-exports both symbols, so every existing import still works.

export interface Point {
  lat: number
  lon: number
}

const EARTH_RADIUS_M = 6_371_000
const toRad = (deg: number) => (deg * Math.PI) / 180

/** Great-circle (haversine) distance in metres. */
export function distanceMetres(a: Point, b: Point): number {
  const dLat = toRad(b.lat - a.lat)
  const dLon = toRad(b.lon - a.lon)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2
  return EARTH_RADIUS_M * 2 * Math.asin(Math.sqrt(h))
}
