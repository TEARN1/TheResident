import test from 'node:test'
import assert from 'node:assert'
import {
  formatDistance,
  formatRouteLength,
  formatPace,
  formatDuration,
  pathLengthMetres,
  pathMarkers,
  proximityLabel
} from './measure'
import { distanceBand } from './logic'
import type { Point } from './geo'

const HERE: Point = { lat: -25.9800, lon: 28.2100 }
const north = (m: number): Point => ({ lat: HERE.lat + m / 111_000, lon: HERE.lon })

test('the exact register does what distanceBand deliberately will not', () => {
  // distanceBand is right for "is this room near me". It is useless for
  // anything measured — which is the whole reason this module exists.
  assert.strictEqual(distanceBand(21_100), 'far')
  assert.strictEqual(formatRouteLength(21_100), '21.10 km')
})

test('a half marathon reads as a half marathon', () => {
  assert.strictEqual(formatRouteLength(21_097.5), '21.10 km')
  assert.strictEqual(formatRouteLength(42_195), '42.20 km')
  assert.strictEqual(formatRouteLength(5_000), '5.00 km')
})

test('route length keeps two decimals at every scale — it is a contract with the runner', () => {
  assert.strictEqual(formatRouteLength(800), '0.80 km')
  assert.strictEqual(formatRouteLength(100_000), '100.00 km')
})

test('short distances read in metres, not fractions of a kilometre', () => {
  assert.strictEqual(formatDistance(80), '80 m')
  assert.strictEqual(formatDistance(999), '999 m')
  assert.strictEqual(formatDistance(1000), '1.00 km')
  assert.strictEqual(formatDistance(15_400), '15.4 km')
})

test('imperial is a real conversion, not a relabelled metric number', () => {
  assert.strictEqual(formatDistance(1609.344, 'imperial'), '1.00 mi')
  assert.strictEqual(formatDistance(30, 'imperial'), '98 ft')
  assert.strictEqual(formatRouteLength(42_195, 'imperial'), '26.22 mi')
})

test('nonsense input degrades to a dash rather than NaN', () => {
  for (const bad of [NaN, -1, Infinity]) {
    assert.strictEqual(formatDistance(bad), '—')
    assert.strictEqual(formatRouteLength(bad), '—')
  }
  assert.strictEqual(formatPace(0, 100), '—')
  assert.strictEqual(formatPace(1000, 0), '—')
  assert.strictEqual(formatDuration(NaN), '—')
})

test('pace is the unit runners plan in', () => {
  assert.strictEqual(formatPace(1000, 332), '5:32 /km')
  assert.strictEqual(formatPace(10_000, 3000), '5:00 /km')
  // Seconds pad, so 5:05 never renders as 5:5
  assert.strictEqual(formatPace(1000, 305), '5:05 /km')
})

test('duration reads at a glance', () => {
  assert.strictEqual(formatDuration(45), '45s')
  assert.strictEqual(formatDuration(605), '10m 05s')
  assert.strictEqual(formatDuration(7325), '2h 02m')
})

test('path length is cumulative along the drawn line, not start-to-end', () => {
  // An out-and-back is 400 m of running, even though it finishes where it started.
  const outAndBack = [HERE, north(200), HERE]
  const length = pathLengthMetres(outAndBack)
  assert.ok(Math.abs(length - 400) < 5, `expected ~400 m, got ${length}`)

  assert.strictEqual(pathLengthMetres([]), 0)
  assert.strictEqual(pathLengthMetres([HERE]), 0)
})

test('kilometre markers land at true distance, not at drawn vertices', () => {
  // A straight 2.5 km line drawn with only two points still gets markers at
  // 1 km and 2 km — interpolated, not snapped to a vertex.
  const markers = pathMarkers([HERE, north(2500)], 1000)
  assert.strictEqual(markers.length, 2)
  assert.strictEqual(markers[0].metres, 1000)
  assert.strictEqual(markers[1].metres, 2000)

  const firstFromStart = pathLengthMetres([HERE, markers[0].at])
  assert.ok(Math.abs(firstFromStart - 1000) < 5,
    `1 km marker should sit 1 km along the line, was ${firstFromStart} m`)
})

test('a path shorter than one interval has no markers', () => {
  assert.deepStrictEqual(pathMarkers([HERE, north(400)], 1000), [])
})

test('zero-length segments do not stall marker placement', () => {
  // Duplicate points are common when a route is drawn by tapping.
  const markers = pathMarkers([HERE, HERE, north(1500), north(1500)], 1000)
  assert.strictEqual(markers.length, 1)
})

test('proximity tells you the rule before the server refuses you', () => {
  const near = proximityLabel(120, 400)
  assert.ok(near.withinLimit)
  assert.strictEqual(near.label, '120 m away')

  const far = proximityLabel(812, 400)
  assert.ok(!far.withinLimit)
  assert.match(far.label, /too far to confirm/)
  assert.match(far.label, /limit 400 m/)
})

test('the proximity boundary is inclusive', () => {
  assert.ok(proximityLabel(400, 400).withinLimit)
  assert.ok(!proximityLabel(401, 400).withinLimit)
})
