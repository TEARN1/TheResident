import test from 'node:test'
import assert from 'node:assert'
import { parseZoneDetails, formatZoneNote } from './mapZones'

test('parseZoneDetails extracts structured traffic and detour tags', () => {
  const parsed = parseZoneDetails({
    kind: 'road_closed',
    label: '4th Ave Closure',
    note: '[TYPE: funeral] [TRAFFIC: Gridlock / Blocked] [DETOUR: Bypass via 7th Ave] Family tent erected for ceremony'
  })

  assert.strictEqual(parsed.eventType, 'funeral')
  assert.strictEqual(parsed.trafficDensity, 'gridlock')
  assert.strictEqual(parsed.detourHint, 'Bypass via 7th Ave')
  assert.strictEqual(parsed.cleanNote, 'Family tent erected for ceremony')
  assert.strictEqual(parsed.displayLabel, '4th Ave Closure')
})

test('parseZoneDetails infers event type from natural language keywords', () => {
  const p1 = parseZoneDetails({
    kind: 'road_closed',
    label: 'Street Tent Vigil',
    note: 'Neighbourhood memorial vigil service until Sunday'
  })
  assert.strictEqual(p1.eventType, 'funeral')
  assert.strictEqual(p1.trafficDensity, 'gridlock')

  const p2 = parseZoneDetails({
    kind: 'route',
    label: 'Annual 10km Marathon',
    note: '[CORRIDOR: Stadium -> Campus -> 2nd Ave] Race runners on course'
  })
  assert.strictEqual(p2.eventType, 'marathon')
  assert.strictEqual(p2.corridor, 'Stadium -> Campus -> 2nd Ave')

  const p3 = parseZoneDetails({
    kind: 'alert',
    label: 'Robot Outage',
    note: 'Loadshedding stage 4 dead traffic lights at Jan Smuts intersection'
  })
  assert.strictEqual(p3.eventType, 'dead_robots')

  const p4 = parseZoneDetails({
    kind: 'alert',
    label: 'Vehicle Collision',
    note: '2-car accident blocking right lane, metro police on scene'
  })
  assert.strictEqual(p4.eventType, 'accident')
})

test('parseZoneDetails extracts pointsman status and custom waypoints geometry', () => {
  const p = parseZoneDetails({
    kind: 'alert',
    label: 'Dead Robots with Volunteer',
    note: '[POINTSMAN: volunteer] [ROUTE_GEO: 28.0305,-26.1926;28.0350,-26.1950] Volunteer on duty'
  })
  assert.strictEqual(p.pointsmanStatus, 'volunteer')
  assert.ok(p.routeCoordinates)
  assert.strictEqual(p.routeCoordinates.length, 2)
  assert.strictEqual(p.routeCoordinates[0][0], 28.0305)
})

test('formatZoneNote produces clean structured tag serialization including geometry', () => {
  const formatted = formatZoneNote({
    eventType: 'marathon',
    trafficDensity: 'gridlock',
    detourHint: 'Use 7th Ave bypass',
    corridor: 'Main Rd',
    pointsmanStatus: 'police',
    routeCoordinates: [[28.03, -26.19], [28.04, -26.20]],
    userNote: 'Tent on road until 16:00'
  })

  assert.ok(formatted.includes('[TYPE: marathon]'))
  assert.ok(formatted.includes('[TRAFFIC: gridlock]'))
  assert.ok(formatted.includes('[DETOUR: Use 7th Ave bypass]'))
  assert.ok(formatted.includes('[POINTSMAN: police]'))
  assert.ok(formatted.includes('[ROUTE_GEO: 28.03000,-26.19000;28.04000,-26.20000]'))
  assert.ok(formatted.includes('Tent on road until 16:00'))
})
