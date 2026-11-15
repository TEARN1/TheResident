import test from 'node:test'
import assert from 'node:assert'
import {
  SA_TAXI_RANKS,
  getTaxiRanksNear,
  searchTaxiDestinations,
  calculateTaxiFrontSeatChange,
  getTaxiHandSignalGuide,
  distanceKm,
} from './taxiRoutes'

test('SA_TAXI_RANKS contains major metropolitan ranks across JHB, PTA, CPT, DUR', () => {
  assert.ok(SA_TAXI_RANKS.length >= 5)
  const cities = new Set(SA_TAXI_RANKS.map(r => r.city))
  assert.ok(cities.has('JHB'))
  assert.ok(cities.has('PTA'))
  assert.ok(cities.has('CPT'))
  assert.ok(cities.has('DUR'))

  const noord = SA_TAXI_RANKS.find(r => r.id === 'rank-mtn-noord')
  assert.ok(noord)
  assert.strictEqual(noord.associationCode, 'SANTACO-GP-JHB-01')
  assert.ok(noord.routes.length >= 4)
})

test('getTaxiRanksNear returns nearby ranks ordered by proximity', () => {
  // Near Braamfontein (-26.1926, 28.0305)
  const nearby = getTaxiRanksNear(-26.1926, 28.0305, 10)
  assert.ok(nearby.length >= 2)
  assert.ok(nearby[0].distanceKm <= nearby[1].distanceKm)
  // Closest rank should be MTN Noord or Bree
  assert.ok(nearby[0].id === 'rank-mtn-noord' || nearby[0].id === 'rank-bree-street')
})

test('searchTaxiDestinations finds relevant routes for queries', () => {
  const sowetoRoutes = searchTaxiDestinations('Soweto')
  assert.ok(sowetoRoutes.length >= 1)
  assert.ok(sowetoRoutes[0].route.destination.includes('Baragwanath'))

  const fourwaysRoutes = searchTaxiDestinations('Fourways')
  assert.ok(fourwaysRoutes.length >= 1)
  assert.strictEqual(fourwaysRoutes[0].route.fareZAR, 32)
})

test('calculateTaxiFrontSeatChange calculates correct change and coin/note breakdown', () => {
  // 3 passengers @ R22 = R66. Passenger tenders R100 note. Change = R34.
  const change = calculateTaxiFrontSeatChange(22, 3, 100)
  assert.strictEqual(change.totalFareDueZAR, 66)
  assert.strictEqual(change.changeDueZAR, 34)
  assert.strictEqual(change.isShortPayment, false)
  assert.strictEqual(change.shortfallZAR, 0)
  // R34 = 1x R20, 1x R10, 2x R2
  assert.strictEqual(change.coinsAndNotes.notesR20, 1)
  assert.strictEqual(change.coinsAndNotes.notesR10, 1)
  assert.strictEqual(change.coinsAndNotes.coinsR2, 2)
  assert.ok(change.summaryText.includes('Change R34.00'))

  // Exact payment
  const exact = calculateTaxiFrontSeatChange(20, 1, 20)
  assert.strictEqual(exact.changeDueZAR, 0)
  assert.strictEqual(exact.isShortPayment, false)
  assert.ok(exact.summaryText.includes('Exact fare'))

  // Short payment: 2 passengers @ R25 = R50. Only R40 tendered.
  const short = calculateTaxiFrontSeatChange(25, 2, 40)
  assert.strictEqual(short.isShortPayment, true)
  assert.strictEqual(short.shortfallZAR, 10)
  assert.strictEqual(short.changeDueZAR, 0)
  assert.ok(short.summaryText.includes('Short payment by R10.00'))
})

test('getTaxiHandSignalGuide returns valid South African hand signals', () => {
  const guide = getTaxiHandSignalGuide()
  assert.ok(guide.length >= 6)
  const shortLeft = guide.find(g => g.meaning.includes('Short Left'))
  assert.ok(shortLeft)
  assert.strictEqual(shortLeft.gestureEmoji, '👇')
})

test('distanceKm accurately calculates distances', () => {
  // Distance from Braamfontein to Sandton should be ~10-12 km
  const d = distanceKm({ lat: -26.1926, lon: 28.0305 }, { lat: -26.1076, lon: 28.0567 })
  assert.ok(d >= 9 && d <= 12)
})
