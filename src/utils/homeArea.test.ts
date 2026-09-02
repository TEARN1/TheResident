import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  coarsen, coarsenCoord, isValidCoord, describeHomeArea, granularityLabel,
  type HomeArea
} from './homeArea'

const area = (over: Partial<HomeArea> = {}): HomeArea => ({
  lat: -26.0,
  lon: 28.2,
  granularity: 'coarse',
  suburb: null,
  city: null,
  label: null,
  setAt: '2026-09-01T00:00:00Z',
  ...over
})

test('coarsenCoord matches what res_coarsen_coord stores server-side', () => {
  // The SQL rounds to 2 decimals; if these ever drift, the UI would promise a
  // resident one thing and the database would store another.
  assert.equal(coarsenCoord(-25.99551234), -26.0)
  assert.equal(coarsenCoord(28.20241234), 28.2)
  assert.equal(coarsenCoord(0.005), 0.01)
})

test('coarsen blunts both coordinates together', () => {
  assert.deepEqual(coarsen(-25.99551234, 28.20241234), { lat: -26.0, lon: 28.2 })
})

test('isValidCoord rejects impossible and non-finite coordinates', () => {
  assert.ok(isValidCoord(-26, 28))
  assert.ok(isValidCoord(-90, 180))
  assert.ok(!isValidCoord(91, 28))
  assert.ok(!isValidCoord(-26, 181))
  assert.ok(!isValidCoord(NaN, 28))
  assert.ok(!isValidCoord(-26, Infinity))
})

test('describeHomeArea shows a place, falling back to numbers only as a last resort', () => {
  assert.equal(describeHomeArea(null), 'Not set')
  assert.equal(
    describeHomeArea(area({ label: '12 Vine Street, Kreuzberg' })),
    '12 Vine Street, Kreuzberg'
  )
  assert.equal(describeHomeArea(area({ suburb: 'Kreuzberg', city: 'Berlin' })), 'Kreuzberg, Berlin')
  assert.equal(describeHomeArea(area({ suburb: 'Kreuzberg' })), 'Kreuzberg')
  // Nothing human available — only then do coordinates appear.
  assert.equal(describeHomeArea(area()), '-26.00, 28.20')
})

test('granularityLabel tells the resident what precision they picked', () => {
  assert.match(granularityLabel('coarse'), /Approximate/)
  assert.equal(granularityLabel('exact'), 'Exact location')
})
