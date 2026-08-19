import test from 'node:test'
import assert from 'node:assert'
import {
  visiblePlaces,
  countByKind,
  nearest,
  clusterPlaces,
  clusterCellFor,
  searchLocalPlaces,
  PLACE_ORDER,
  PLACE_LABEL,
  PLACE_COLOR,
  DEFAULT_VISIBLE
} from './mapPlaces'
import type { Place, PlaceKind } from './mapPlaces'

const HERE = { lat: -25.9800, lon: 28.2100 }
const north = (m: number) => ({ lat: HERE.lat + m / 111_000, lon: HERE.lon })

const place = (over: Partial<Place> = {}): Place => ({
  id: 'p-1', kind: 'vendor', title: 'Spaza', subtitle: null,
  lat: HERE.lat, lon: HERE.lon, suburb: 'Ivory Park', radiusM: null, ...over,
})

// ── The product decision encoded here ──────────────────────────────────────

test('assets come before problems', () => {
  // A map that leads with danger teaches only fear. On a load-shedding evening
  // water, wifi and power are the most useful things on the screen.
  const assets: PlaceKind[] = ['water_point', 'wifi', 'generator']
  const assetRanks = assets.map(k => PLACE_ORDER.indexOf(k))
  const problemRank = PLACE_ORDER.indexOf('lost_found')

  for (const rank of assetRanks) {
    assert.ok(rank >= 0 && rank < problemRank, 'assets must sort ahead')
  }
  assert.strictEqual(PLACE_ORDER[0], 'water_point')
})

test('the default layers are the ones that help during an outage', () => {
  for (const k of ['water_point', 'wifi', 'generator'] as PlaceKind[]) {
    assert.ok(DEFAULT_VISIBLE.includes(k), `${k} should be on by default`)
  }
  // Not everything on by default, or the first view is unreadable.
  assert.ok(DEFAULT_VISIBLE.length < PLACE_ORDER.length)
})

test('the places layer never uses the hazard layer colours', () => {
  // Red and amber belong to road closures and alerts. A blue-ish water pin
  // that shares a colour with "road closed" would be actively misleading.
  const hazardColours = ['#ef4444', '#f59e0b']
  for (const [kind, colour] of Object.entries(PLACE_COLOR)) {
    assert.ok(!hazardColours.includes(colour), `${kind} reuses a hazard colour`)
  }
})

test('every kind has a label and a colour, so nothing renders unnamed', () => {
  for (const k of PLACE_ORDER) {
    assert.ok(PLACE_LABEL[k], `${k} has no label`)
    assert.ok(PLACE_COLOR[k], `${k} has no colour`)
  }
  assert.strictEqual(Object.keys(PLACE_LABEL).length, PLACE_ORDER.length)
})

// ── Filtering ──────────────────────────────────────────────────────────────

test('only switched-on kinds are shown, in asset-first order', () => {
  const places = [
    place({ id: 'room', kind: 'room' }),
    place({ id: 'water', kind: 'water_point' }),
    place({ id: 'vendor', kind: 'vendor' }),
  ]
  const shown = visiblePlaces(places, new Set(['room', 'water_point', 'vendor']))
  assert.deepStrictEqual(shown.map(p => p.id), ['water', 'vendor', 'room'])
})

test('switching a layer off removes it entirely', () => {
  const places = [place({ kind: 'room' }), place({ id: 'p-2', kind: 'water_point' })]
  assert.deepStrictEqual(
    visiblePlaces(places, new Set(['water_point'])).map(p => p.kind), ['water_point'])
  assert.deepStrictEqual(visiblePlaces(places, new Set()), [])
})

test('counts drive the legend', () => {
  const counts = countByKind([
    place({ kind: 'vendor' }), place({ id: 'b', kind: 'vendor' }),
    place({ id: 'c', kind: 'water_point' }),
  ])
  assert.deepStrictEqual(counts, { vendor: 2, water_point: 1 })
})

// ── Nearest ────────────────────────────────────────────────────────────────

test('nearest answers the question that matters during an outage', () => {
  const places = [
    place({ id: 'far', kind: 'water_point', ...north(2000) }),
    place({ id: 'near', kind: 'water_point', ...north(150) }),
    place({ id: 'closer-but-wrong-kind', kind: 'vendor', ...north(10) }),
  ]
  assert.strictEqual(nearest(places, 'water_point', HERE)?.id, 'near')
})

test('nearest returns null rather than guessing when there is none', () => {
  assert.strictEqual(nearest([place({ kind: 'vendor' })], 'water_point', HERE), null)
  assert.strictEqual(nearest([], 'wifi', HERE), null)
})

// ── Clustering ─────────────────────────────────────────────────────────────

test('pins on top of each other become one cluster', () => {
  const places = [
    place({ id: 'a' }), place({ id: 'b' }), place({ id: 'c' }),
  ]
  const clusters = clusterPlaces(places, 100)
  assert.strictEqual(clusters.length, 1)
  assert.strictEqual(clusters[0].places.length, 3)
})

test('pins further apart than the cell stay separate', () => {
  const places = [place({ id: 'a' }), place({ id: 'b', ...north(900) })]
  assert.strictEqual(clusterPlaces(places, 100).length, 2)
})

test('a cluster sits on a real pin, never on an averaged point', () => {
  // An averaged position can land in the middle of a road or a river, and a
  // pin where nothing actually is reads as a bug.
  const a = place({ id: 'a' })
  const b = place({ id: 'b', ...north(30) })
  const [cluster] = clusterPlaces([a, b], 200)

  assert.strictEqual(cluster.places.length, 2)
  const sitsOnAMember = cluster.places.some(
    p => p.lat === cluster.lat && p.lon === cluster.lon)
  assert.ok(sitsOnAMember, 'the cluster anchor must be one of its members')
})

test('clustering off at street level shows every pin individually', () => {
  const places = [place({ id: 'a' }), place({ id: 'b' })]
  assert.strictEqual(clusterCellFor(18), 0)
  assert.strictEqual(clusterPlaces(places, 0).length, 2)
})

test('cells widen as you zoom out', () => {
  const zooms = [17, 15, 13, 11, 9]
  const cells = zooms.map(clusterCellFor)
  for (let i = 1; i < cells.length; i++) {
    assert.ok(cells[i] > cells[i - 1], `cell should grow between zoom ${zooms[i - 1]} and ${zooms[i]}`)
  }
})

test('clustering is stable — the same input always groups the same way', () => {
  // A cluster that reshuffles on every pan is worse than no clustering.
  const places = Array.from({ length: 20 }, (_, i) =>
    place({ id: `p-${i}`, ...north(i * 15) }))

  const first = clusterPlaces(places, 200).map(c => c.places.map(p => p.id).join(','))
  const again = clusterPlaces([...places].reverse(), 200)
    .map(c => c.places.map(p => p.id).sort().join(','))

  assert.strictEqual(first.length, again.length,
    'the same pins must produce the same number of clusters regardless of input order')
})

test('an empty map clusters to nothing without throwing', () => {
  assert.deepStrictEqual(clusterPlaces([], 100), [])
})

// ── Local search ───────────────────────────────────────────────────────────
// The map's search box only ever asked Nominatim, so a resident could find
// "Ivory Park" but not "plumber" — the app's own directory was unsearchable
// from the one screen that shows where everything is.

test('a resident can find a trade by name, not just an address', () => {
  const places = [
    place({ id: 'plumb', kind: 'service', title: 'Sipho Plumbing', subtitle: 'plumbing' }),
    place({ id: 'shop', kind: 'vendor', title: 'Mama Rose Spaza', subtitle: 'airtime' }),
  ]
  assert.deepStrictEqual(
    searchLocalPlaces(places, 'plumb').map(m => m.place.id), ['plumb'])
})

test('a title that starts with the query outranks one that merely contains it', () => {
  // People type the first few letters of what they want.
  const places = [
    place({ id: 'contains', title: 'Best Water Supplies' }),
    place({ id: 'starts', title: 'Water Point North' }),
  ]
  assert.deepStrictEqual(
    searchLocalPlaces(places, 'water').map(m => m.place.id), ['starts', 'contains'])
})

test('subtitle and kind are searchable, but rank below the title', () => {
  const places = [
    place({ id: 'by-kind', kind: 'water_point', title: 'Corner tap', subtitle: null }),
    place({ id: 'by-title', kind: 'vendor', title: 'Water shop', subtitle: null }),
  ]
  const found = searchLocalPlaces(places, 'water')
  assert.deepStrictEqual(found.map(m => m.place.id), ['by-title', 'by-kind'])
})

test('a one-character query returns nothing rather than the whole suburb', () => {
  const places = [place({ title: 'Sipho Plumbing' })]
  assert.deepStrictEqual(searchLocalPlaces(places, 's'), [])
  assert.deepStrictEqual(searchLocalPlaces(places, '  '), [])
})

test('search is case-insensitive and ignores surrounding spaces', () => {
  const places = [place({ id: 'x', title: 'Sipho Plumbing' })]
  for (const q of ['SIPHO', '  sipho  ', 'SiPhO']) {
    assert.strictEqual(searchLocalPlaces(places, q).length, 1, `failed for ${JSON.stringify(q)}`)
  }
})

test('results are capped so the dropdown stays readable', () => {
  const places = Array.from({ length: 30 }, (_, i) =>
    place({ id: `p-${i}`, title: `Water point ${i}` }))
  assert.strictEqual(searchLocalPlaces(places, 'water').length, 6)
  assert.strictEqual(searchLocalPlaces(places, 'water', 3).length, 3)
})

test('no match returns empty rather than a nearest guess', () => {
  assert.deepStrictEqual(searchLocalPlaces([place({ title: 'Spaza' })], 'zzzz'), [])
})
