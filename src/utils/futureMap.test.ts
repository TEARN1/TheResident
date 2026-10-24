import test from 'node:test'
import assert from 'node:assert'
import {
  arcPoints,
  circlePolygon,
  distanceKm,
  eventPulse,
  formatDistance,
  isochroneFeatures,
  metresPerPixel,
  parseLocalStart,
  pickStreams,
  rankHotspots,
  detourBypassArc,
  marathonCorridorPolyline,
  calculateSmartDetour,
  zoneTimeStatus,
} from './futureMap'

// Wednesday 8 Oct 2026, 20:00 local time.
const NOW = new Date(2026, 9, 8, 20, 0)

test('parseLocalStart reads a bare date as local midnight, not UTC', () => {
  const p = parseLocalStart('2026-10-09')
  assert.ok(p)
  assert.strictEqual(p.allDay, true)
  assert.strictEqual(p.date.getHours(), 0)
  assert.strictEqual(p.date.getDate(), 9)
  assert.strictEqual(parseLocalStart('2026-10-09T21:30')?.date.getHours(), 21)
  assert.strictEqual(parseLocalStart('soon'), null)
  assert.strictEqual(parseLocalStart(''), null)
})

test('eventPulse: on now, tonight, soon, later', () => {
  assert.strictEqual(eventPulse('2026-10-08T19:00', NOW), 'live') // started an hour ago
  assert.strictEqual(eventPulse('2026-10-08T20:45', NOW), 'live') // doors in 45 min
  assert.strictEqual(eventPulse('2026-10-08T23:30', NOW), 'tonight')
  assert.strictEqual(eventPulse('2026-10-08', NOW), 'tonight') // today, time TBC
  assert.strictEqual(eventPulse('2026-10-10T20:00', NOW), 'soon')
  assert.strictEqual(eventPulse('2026-10-20T20:00', NOW), 'later')
  assert.strictEqual(eventPulse('2026-10-08T10:00', NOW), 'later') // long finished
  assert.strictEqual(eventPulse('nonsense', NOW), 'later')
})

test('rankHotspots puts on-now first, then by start, and skips events with no position', () => {
  const ranked = rankHotspots([
    { id: 'later', startsAt: '2026-10-25T20:00', lat: -26.2, lon: 28.04 },
    { id: 'nopos', startsAt: '2026-10-08T20:30' },
    { id: 'tonight', startsAt: '2026-10-08T23:00', lat: -26.19, lon: 28.03 },
    { id: 'live', startsAt: '2026-10-08T19:30', lat: -26.18, lon: 28.02 },
    { id: 'soon', startsAt: '2026-10-09T21:00', lat: -26.17, lon: 28.01 },
  ], NOW)
  assert.deepStrictEqual(ranked.map(h => h.id), ['live', 'tonight', 'soon', 'later'])
  assert.strictEqual(rankHotspots([{ id: 'a', startsAt: '2026-10-08', lat: 1, lon: 1 }, { id: 'b', startsAt: '2026-10-08', lat: 1, lon: 1 }], NOW, 1).length, 1)
})

test('pickStreams keeps nearby hotspots only, soonest first', () => {
  const me = { lat: -26.1926, lon: 28.0305 }
  const ranked = rankHotspots([
    { id: 'far', startsAt: '2026-10-08T19:30', lat: -33.92, lon: 18.42 }, // Cape Town
    { id: 'here', startsAt: '2026-10-08T23:00', lat: -26.1926, lon: 28.0305 }, // on top of you
    { id: 'near-soon', startsAt: '2026-10-09T21:00', lat: -26.2, lon: 28.04 },
    { id: 'near-live', startsAt: '2026-10-08T19:30', lat: -26.205, lon: 28.06 },
  ], NOW)
  assert.deepStrictEqual(pickStreams(me, ranked).map(h => h.id), ['near-live', 'near-soon'])
  assert.deepStrictEqual(pickStreams(null, ranked), [])
})

test('arcPoints runs from a to b and bows off the straight line', () => {
  const a = { lat: 0, lon: 0 }, b = { lat: 0, lon: 1 }
  const pts = arcPoints(a, b, 10)
  assert.strictEqual(pts.length, 11)
  assert.deepStrictEqual(pts[0], [0, 0])
  assert.deepStrictEqual(pts[10], [1, 0])
  assert.ok(Math.abs(pts[5][1]) > 0.05, 'the midpoint is pushed sideways')
})

test('circlePolygon is closed and has the requested radius', () => {
  const c = { lat: -26.1926, lon: 28.0305 }
  const ring = circlePolygon(c, 400, 32)
  assert.deepStrictEqual(ring[0].map(n => n.toFixed(9)), ring[32].map(n => n.toFixed(9)))
  for (const [lon, lat] of ring) {
    const m = distanceKm(c, { lat, lon }) * 1000
    assert.ok(Math.abs(m - 400) < 4, `ring point ${m.toFixed(1)}m from centre`)
  }
})

test('isochroneFeatures draws the 10-minute ring under the 5-minute ring', () => {
  const fc = isochroneFeatures({ lat: -26.19, lon: 28.03 })
  assert.deepStrictEqual(fc.features.map(f => f.properties.mins), [10, 5])
  assert.strictEqual(isochroneFeatures(null).features.length, 0)
})

test('formatDistance and metresPerPixel', () => {
  assert.strictEqual(formatDistance(349.6), '350m away')
  assert.strictEqual(formatDistance(1234), '1.2km away')
  // Zoom 0 at the equator: the whole world across 512 px.
  assert.ok(Math.abs(metresPerPixel(0, 0) - 40075016.686 / 512) < 1e-6)
  assert.ok(metresPerPixel(-26, 15) < metresPerPixel(0, 15))
})

test('detourBypassArc produces a semicircular bypass around a blocked point', () => {
  const p = { lat: -26.1926, lon: 28.0305 };
  const arc = detourBypassArc(p, 300, 20);
  assert.strictEqual(arc.length, 21);
  assert.notDeepStrictEqual(arc[0], [p.lon, p.lat]);
});

test('marathonCorridorPolyline produces a closed loop corridor', () => {
  const p = { lat: -26.1926, lon: 28.0305 };
  const loop = marathonCorridorPolyline(p, 500, 24);
  assert.strictEqual(loop.length, 25);
  assert.strictEqual(loop[0][0].toFixed(5), loop[24][0].toFixed(5));
});

test('calculateSmartDetour generates bypass waypoints and navigation urls', () => {
  const user = { lat: -26.1950, lon: 28.0300 };
  const blocked = { lat: -26.1926, lon: 28.0305 };
  const plan = calculateSmartDetour(user, blocked, '7th Ave bypass');
  assert.ok(plan.bypassPoint);
  assert.ok(plan.googleMapsUrl.includes('waypoints='));
  assert.ok(plan.wazeUrl.includes('waze.com'));
  assert.strictEqual(plan.delaySavingsMinutes, 20);
});

test('zoneTimeStatus detects active, upcoming and expired horizons', () => {
  const base = new Date('2026-10-24T10:00:00Z');
  const zone = {
    startsAt: '2026-10-24T14:00:00Z',
    endsAt: '2026-10-24T20:00:00Z',
  };

  // At horizon = 0 (10:00), zone is upcoming
  assert.strictEqual(zoneTimeStatus(zone, 0, base), 'upcoming');
  // At horizon = 5 (15:00), zone is active
  assert.strictEqual(zoneTimeStatus(zone, 5, base), 'active');
  // At horizon = 12 (22:00), zone is expired
  assert.strictEqual(zoneTimeStatus(zone, 12, base), 'expired');
});
