import { test } from 'node:test'
import assert from 'node:assert'
import {
  nextStage, isLive, canCancel, currentTarget, distanceM, roughEtaSeconds, formatDistance, formatEta,
  distanceToRouteM, isOffRoute, shouldSend, parseStage
} from './liveJob'

const BRAAM = { lat: -26.1929, lon: 28.0305 }
const SANDTON = { lat: -26.1076, lon: 28.0567 }

test('a job moves one stage at a time and ends at delivered', () => {
  assert.strictEqual(nextStage('requested'), 'accepted')
  assert.strictEqual(nextStage('arrived'), 'loaded')
  assert.strictEqual(nextStage('loaded'), 'delivered')
  assert.strictEqual(nextStage('delivered'), null)
  assert.strictEqual(nextStage('cancelled'), null)
})

test('the driver is shared only while the job is under way', () => {
  for (const s of ['accepted', 'on_the_way', 'arrived', 'loaded'] as const) assert.ok(isLive(s))
  for (const s of ['requested', 'delivered', 'cancelled'] as const) assert.ok(!isLive(s))
  assert.ok(canCancel('arrived'))
  assert.ok(!canCancel('loaded'))
})

test('the driver heads to the pick-up, then the drop-off', () => {
  assert.deepStrictEqual(currentTarget('on_the_way', BRAAM, SANDTON), BRAAM)
  assert.deepStrictEqual(currentTarget('loaded', BRAAM, SANDTON), SANDTON)
  assert.strictEqual(currentTarget('delivered', BRAAM, SANDTON), null)
})

test('distance and the rough arrival time are sensible for Joburg', () => {
  const d = distanceM(BRAAM, SANDTON)
  assert.ok(d > 9500 && d < 10000, `got ${d}`)
  const eta = roughEtaSeconds(BRAAM, SANDTON)
  assert.ok(eta > 20 * 60 && eta < 35 * 60, `got ${eta}`)
  assert.strictEqual(formatDistance(240), '240 m')
  assert.strictEqual(formatDistance(9700), '9.7 km')
  assert.strictEqual(formatEta(90), '2 min')
  assert.strictEqual(formatEta(3900), '1 h 5 min')
})

test('off-route detection allows for GPS accuracy', () => {
  const route: [number, number][] = [[28.0305, -26.1929], [28.0305, -26.1829]]
  const onLine = { lat: -26.1879, lon: 28.0305 }
  const near = { lat: -26.1879, lon: 28.0310 } // ~50 m east
  const far = { lat: -26.1879, lon: 28.0330 } // ~250 m east
  assert.ok(distanceToRouteM(onLine, route) < 1)
  assert.ok(!isOffRoute(near, route))
  assert.ok(isOffRoute(far, route))
  assert.ok(!isOffRoute(far, route, 200)) // a 200 m-accurate fix proves nothing
})

test('positions are sent when the driver moves or every 10 seconds', () => {
  const a = { at: 0, ...BRAAM }
  assert.ok(shouldSend(null, a))
  assert.ok(!shouldSend(a, { at: 3000, ...BRAAM }))
  assert.ok(shouldSend(a, { at: 3000, lat: BRAAM.lat + 0.0003, lon: BRAAM.lon }))
  assert.ok(shouldSend(a, { at: 10_000, ...BRAAM }))
})

test('unknown stages read as requested', () => {
  assert.strictEqual(parseStage('loaded'), 'loaded')
  assert.strictEqual(parseStage('cancelled'), 'cancelled')
  assert.strictEqual(parseStage('flying'), 'requested')
})
