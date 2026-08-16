// Distance and pace formatting, in two deliberately different registers.
//
// logic.ts already has distanceBand(): 'under 500 m', 'about 1 km', 'far'.
// That vagueness is CORRECT for its job — it describes how near a room or a
// neighbour is without implying false precision about someone's address, and
// making it exact would leak location.
//
// It is wrong for anything measured. A runner planning a 21.1 km route, a
// resident deciding whether they are close enough to vouch for a fault, an
// organiser marshalling a course — all of them need a number, not a mood. So
// this file is the exact register, and the two coexist rather than one
// replacing the other.
//
// Zero imports beyond ./geo, so the edge runtime can use it too.

import { distanceMetres } from './geo'
import type { Point } from './geo'

export type Units = 'metric' | 'imperial'

/**
 * 'social' defers to distanceBand() — approximate, privacy-preserving.
 * 'exact'  gives a real measurement.
 */
export type Precision = 'social' | 'exact'

export interface MeasurementPrefs {
  units: Units
  precision: Precision
}

export const DEFAULT_PREFS: MeasurementPrefs = {
  units: 'metric',
  precision: 'social',
}

const M_PER_MILE = 1609.344
const M_PER_FOOT = 0.3048

/**
 * A measured distance, always exact.
 *
 * Metres below 1 km (or feet below a mile), because "0.08 km" is a worse way
 * of saying "80 m" for anyone actually walking it.
 */
export function formatDistance(metres: number, units: Units = 'metric'): string {
  if (!Number.isFinite(metres) || metres < 0) return '—'

  if (units === 'imperial') {
    const miles = metres / M_PER_MILE
    if (miles < 0.1) return `${Math.round(metres / M_PER_FOOT)} ft`
    if (miles < 10) return `${miles.toFixed(2)} mi`
    return `${miles.toFixed(1)} mi`
  }

  if (metres < 1000) return `${Math.round(metres)} m`
  const km = metres / 1000
  if (km < 10) return `${km.toFixed(2)} km`
  return `${km.toFixed(1)} km`
}

/**
 * A route length. ALWAYS two decimals, never abbreviated.
 *
 * A race distance is a contract with the people running it: 21.10 km and
 * 21.1 km read differently to someone who trained for a half marathon, and
 * "about 21 km" is not a distance at all.
 */
export function formatRouteLength(metres: number, units: Units = 'metric'): string {
  if (!Number.isFinite(metres) || metres < 0) return '—'
  return units === 'imperial'
    ? `${(metres / M_PER_MILE).toFixed(2)} mi`
    : `${(metres / 1000).toFixed(2)} km`
}

/** Pace, the unit runners actually plan in. */
export function formatPace(metres: number, seconds: number, units: Units = 'metric'): string {
  if (!Number.isFinite(metres) || !Number.isFinite(seconds) || metres <= 0 || seconds <= 0) return '—'
  const perUnit = units === 'imperial'
    ? seconds / (metres / M_PER_MILE)
    : seconds / (metres / 1000)
  const mins = Math.floor(perUnit / 60)
  const secs = Math.round(perUnit % 60)
  const label = units === 'imperial' ? '/mi' : '/km'
  return `${mins}:${secs.toString().padStart(2, '0')} ${label}`
}

/** Duration in a form a person reads at a glance. */
export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '—'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.round(seconds % 60)
  if (h > 0) return `${h}h ${m.toString().padStart(2, '0')}m`
  if (m > 0) return `${m}m ${s.toString().padStart(2, '0')}s`
  return `${s}s`
}

/** Cumulative length of a drawn path — what a route's distance actually is. */
export function pathLengthMetres(points: Point[]): number {
  if (points.length < 2) return 0
  let total = 0
  for (let i = 1; i < points.length; i++) {
    total += distanceMetres(points[i - 1], points[i])
  }
  return total
}

/**
 * Evenly spaced markers along a path — kilometre boards on a race route.
 * Returns the interpolated position of each, so a marker lands at the true
 * distance rather than at whichever drawn vertex happens to be nearest.
 */
export function pathMarkers(points: Point[], everyMetres = 1000): Array<{ at: Point; metres: number }> {
  const markers: Array<{ at: Point; metres: number }> = []
  if (points.length < 2 || everyMetres <= 0) return markers

  let travelled = 0
  let next = everyMetres

  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]
    const b = points[i]
    const seg = distanceMetres(a, b)
    if (seg === 0) continue

    while (next <= travelled + seg) {
      const ratio = (next - travelled) / seg
      markers.push({
        at: {
          lat: a.lat + (b.lat - a.lat) * ratio,
          lon: a.lon + (b.lon - a.lon) * ratio,
        },
        metres: next,
      })
      next += everyMetres
    }
    travelled += seg
  }

  return markers
}

/**
 * How near someone is to a thing they are reporting on.
 *
 * Used by the fault UI to answer "am I close enough to vouch?" before the
 * server refuses — being told the rule up front is a far better experience
 * than being rejected after typing.
 */
export function proximityLabel(metres: number, limitM: number, units: Units = 'metric'): {
  withinLimit: boolean
  label: string
} {
  const within = metres <= limitM
  return {
    withinLimit: within,
    label: within
      ? `${formatDistance(metres, units)} away`
      : `${formatDistance(metres, units)} away — too far to confirm (limit ${formatDistance(limitM, units)})`,
  }
}
