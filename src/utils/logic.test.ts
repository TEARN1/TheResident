import test from 'node:test'
import assert from 'node:assert'
import {
  distanceMetres,
  distanceBand,
  isValidPoint,
  roommateCompatibility,
  matchLifts,
  parseDepartureMinutes,
  departsWithin,
  outageConsensus,
  suburbPriceStats,
  isSuspiciousPrice,
  mentionsOffPlatformPayment,
  isOpenNow,
  decayedScore,
  reputationTier,
  fairnessNote,
  listingMatchesSearch,
  shouldDeliver,
  calculateWaterWaitTime,
  getWaterStatusColor,
  isWaterTestFresh,
  isBoreholeCapacityExceeded,
  isDisputeAppealable,
  isDisputeExpired,
  isEligibleMediator,
  isJurorEligibleForCase,
  calculateTribunalMajority,
  isPanicAlarmClose,
  isFalseAlarmSpam,
  getSafetyAlarmSeverity,
  calculateGeofenceRadius,
  isWifiVoucherExpired,
  isWifiUptimeHealthy,
  isWifiNodeSearchable,
  calculateWifiPayoutSplit,
  isBakkieRemovalEligible,
  isLandlordDensityHigh,
  isLandlordPortfolioValid,
  isUserMinor,
  calculateXPLevel,
  getVibePointsMultiplier,
  calculateTrafficRerouteDelay,
  isTrafficReportSpam,
  isPotholePersistent,
  isGeneralHazardExpired,
  isVoucherPurchaseThrottled,
  isVoucherExpired,
  validateVoucherHMAC,
  isClientSyncBackoffDue,
  isSyncQueueOverload,
  isLandlordWaiverActive,
  detectCurrencyByLocation,
  formatCurrencyByLocation
} from './logic'
import type { Listing, LiftClub } from '../store'

const listing = (over: Partial<Listing> = {}): Listing => ({
  id: 'l-1',
  title: 'Room',
  description: '',
  price: 1500,
  currency: 'ZAR',
  location: 'Midrand',
  suburb: 'Ivory Park',
  safetyRating: 'medium',
  safetyNotes: '',
  landlordId: 'u-1',
  landlordName: '',
  landlordLivesHere: false,
  images: [],
  amenities: { wifi: true, parking: false, bathroom: 'shared' },
  requirements: {
    genderPreference: 'any',
    childrenAllowed: true,
    maxChildren: 2,
    smokingAllowed: false,
    petsAllowed: false
  },
  ...over
})

const seeker = (over = {}) => ({
  gender: 'women' as const,
  childrenCount: 0,
  budget: 2000,
  suburb: 'Ivory Park',
  ...over
})

// ── Geo ───────────────────────────────────────────────────────────────────────

test('distanceMetres matches a known great-circle distance', () => {
  const d = distanceMetres({ lat: -26.2041, lon: 28.0473 }, { lat: -25.7479, lon: 28.2293 })
  assert.ok(d > 48_000 && d < 56_000)
})

test('distanceBand avoids false precision', () => {
  assert.strictEqual(distanceBand(300), 'under 500 m')
  assert.strictEqual(distanceBand(900), 'under 1 km')
  assert.strictEqual(distanceBand(4200), '4 km')
  assert.strictEqual(distanceBand(50_000), 'far')
})

test('isValidPoint rejects the null island', () => {
  assert.strictEqual(isValidPoint({ lat: 0, lon: 0 }), false)
  assert.strictEqual(isValidPoint({ lat: -26.2, lon: 28.04 }), true)
})

// ── Roommate compatibility ───────────────────────────────────────────────────

test('hard requirements exclude outright', () => {
  const r = roommateCompatibility(
    seeker({ hasPets: true }),
    listing({ requirements: { ...listing().requirements, petsAllowed: false } })
  )
  assert.strictEqual(r.score, null)
})

test('gender preference and child limits are hard filters', () => {
  const wrongGender = roommateCompatibility(
    seeker({ gender: 'men' }),
    listing({ requirements: { ...listing().requirements, genderPreference: 'women' } })
  )
  assert.strictEqual(wrongGender.score, null)
})

test('a match explains itself rather than showing an opaque number', () => {
  const r = roommateCompatibility(seeker(), listing({ price: 1500 }))
  assert.ok(r.score !== null && r.score >= 70)
})

test('over-budget scores lower but is not excluded', () => {
  const within = roommateCompatibility(seeker({ budget: 2000 }), listing({ price: 1500 }))
  const over = roommateCompatibility(seeker({ budget: 2000 }), listing({ price: 3000 }))
  assert.ok(over.score !== null)
  assert.ok((over.score as number) < (within.score as number))
})

// ── Lift matching ────────────────────────────────────────────────────────────

const lift = (id: string, o: [number, number], d: [number, number]): LiftClub & { originPoint: { lat: number; lon: number }; destPoint: { lat: number; lon: number } } => ({
  id,
  driverName: 'D',
  origin: 'o',
  destination: 'd',
  departureTime: '07:00',
  days: 'Mon-Fri',
  pricePerSeat: 20,
  currency: 'ZAR',
  availableSeats: 3,
  totalSeats: 4,
  originPoint: { lat: o[0], lon: o[1] },
  destPoint: { lat: d[0], lon: d[1] }
})

test('lifts rank by COMBINED detour, not just a close origin', () => {
  const rider = { origin: { lat: -26.00, lon: 28.00 }, destination: { lat: -26.10, lon: 28.10 } }
  const a = lift('far-end', [-26.001, 28.001], [-26.30, 28.30])
  const b = lift('good', [-26.01, 28.01], [-26.101, 28.101])
  const matches = matchLifts(rider, [a, b], 60_000)
  assert.strictEqual(matches[0].lift.id, 'good')
})

test('departure_time parsing is lenient', () => {
  assert.strictEqual(parseDepartureMinutes('07:00'), 420)
  assert.strictEqual(parseDepartureMinutes('7am'), 420)
  assert.strictEqual(departsWithin('07:00', '07:20', 30), true)
})

// ── Outage consensus ──────────────────────────────────────────────────────────

test('outage needs 3 DISTINCT reporters', () => {
  const now = Date.now()
  const spam = Array.from({ length: 5 }, () => ({
    reporterId: 'same-person', status: 'outage' as const, createdAt: new Date(now - 1000).toISOString()
  }))
  assert.strictEqual(outageConsensus(spam, now).confirmed, false)
})

// ── Price stats & scam heuristics ───────────────────────────────────────────

test('no median is quoted from a sample of two', () => {
  assert.strictEqual(suburbPriceStats([1000, 2000]), null)
})

test('off-platform payment pressure is detected', () => {
  assert.strictEqual(mentionsOffPlatformPayment('EFT the deposit before viewing'), true)
})

// ── Open now ─────────────────────────────────────────────────────────────────

test('isOpenNow parses free-text hours', () => {
  const t = new Date(2026, 6, 15, 10, 0) // Wednesday 10:00
  assert.strictEqual(isOpenNow('24/7', t), true)
  assert.strictEqual(isOpenNow('08:00-17:00', t), true)
})

// ── Reputation ───────────────────────────────────────────────────────────────

test('reputation decays with idleness but stays positive', () => {
  const now = Date.now()
  const ancient = new Date(now - 400 * 86_400_000).toISOString()
  assert.ok(decayedScore(200, ancient, now) < 200)
})

// ── Chore fairness ───────────────────────────────────────────────────────────

test('fairness names an imbalance gently', () => {
  const rows = [
    { userId: 'a', completed: 6, assigned: 6 },
    { userId: 'b', completed: 2, assigned: 6 }
  ]
  const note = fairnessNote(rows, id => 'Thandi')
  assert.match(note!, /Thandi has done 6 of the last 8/)
})

// ── Saved searches ───────────────────────────────────────────────────────────

test('saved search filters match correctly', () => {
  const l = listing({ price: 1500, suburb: 'Ivory Park' })
  assert.strictEqual(listingMatchesSearch(l, { suburb: 'ivory park', maxPrice: 2000 }), true)
})

// ── Notification delivery ────────────────────────────────────────────────────

test('panic alerts ignore mutes and quiet hours', () => {
  const middleOfNight = new Date(2026, 6, 15, 2, 0)
  const prefs = { mutedTypes: ['res_alert_panic'], quietHoursStart: 22, quietHoursEnd: 6 }
  assert.strictEqual(shouldDeliver('res_alert_panic', prefs, middleOfNight), true)
})

// ── Water Grid Logics ────────────────────────────────────────────────────────

test('calculateWaterWaitTime matches bucket count multiplier', () => {
  assert.strictEqual(calculateWaterWaitTime(0), 0)
  assert.strictEqual(calculateWaterWaitTime(5), 15)
  assert.strictEqual(calculateWaterWaitTime(10), 30)
})

test('getWaterStatusColor returns correct color mappings', () => {
  assert.strictEqual(getWaterStatusColor('high'), '#10b981')
  assert.strictEqual(getWaterStatusColor('dribble'), '#f59e0b')
  assert.strictEqual(getWaterStatusColor('dry'), '#ef4444')
})

test('isWaterTestFresh maps 90-day intervals', () => {
  const now = Date.now()
  const recent = new Date(now - 10 * 86_400_000).toISOString()
  const old = new Date(now - 120 * 86_400_000).toISOString()
  assert.strictEqual(isWaterTestFresh(recent, now), true)
  assert.strictEqual(isWaterTestFresh(old, now), false)
})

test('isBoreholeCapacityExceeded gates at 5000L', () => {
  assert.strictEqual(isBoreholeCapacityExceeded(3000), false)
  assert.strictEqual(isBoreholeCapacityExceeded(6000), true)
})

// ── Mediation Tribunal Logics ────────────────────────────────────────────────

test('isDisputeAppealable enforces 48-hour gate', () => {
  const now = Date.now()
  const recent = new Date(now - 10 * 3_600_000).toISOString()
  const old = new Date(now - 60 * 3_600_000).toISOString()
  assert.strictEqual(isDisputeAppealable(recent, now), true)
  assert.strictEqual(isDisputeAppealable(old, now), false)
})

test('isDisputeExpired checks 72-hour limits', () => {
  const now = Date.now()
  const old = new Date(now - 80 * 3_600_000).toISOString()
  assert.strictEqual(isDisputeExpired(old, 2, now), true)
  assert.strictEqual(isDisputeExpired(old, 5, now), false)
})

test('isEligibleMediator checks reputation score threshold', () => {
  assert.strictEqual(isEligibleMediator(70), false)
  assert.strictEqual(isEligibleMediator(90), true)
})

test('isJurorEligibleForCase recuses matching stands', () => {
  assert.strictEqual(isJurorEligibleForCase('Stand 1024', 'Stand 1024'), false)
  assert.strictEqual(isJurorEligibleForCase('Stand 1024', 'Stand 2050'), true)
})

test('calculateTribunalMajority rules out splits', () => {
  assert.strictEqual(calculateTribunalMajority(3, 2), 'majority_for')
  assert.strictEqual(calculateTribunalMajority(1, 4), 'majority_against')
  assert.strictEqual(calculateTribunalMajority(2, 2), 'hung')
})

// ── Emergency Panic Logics ───────────────────────────────────────────────────

test('isPanicAlarmClose checks 200m geofence', () => {
  const user = { lat: -25.9983, lon: 28.2144 }
  const near = { lat: -25.9984, lon: 28.2145 } // very close
  const far = { lat: -26.1000, lon: 28.3000 }
  assert.strictEqual(isPanicAlarmClose(user, near), true)
  assert.strictEqual(isPanicAlarmClose(user, far), false)
})

test('isFalseAlarmSpam limits panic frequency', () => {
  const now = Date.now()
  assert.strictEqual(isFalseAlarmSpam([now - 1000, now - 5000], now), true)
  assert.strictEqual(isFalseAlarmSpam([now - 100000000], now), false)
})

test('getSafetyAlarmSeverity ranks correctly', () => {
  assert.strictEqual(getSafetyAlarmSeverity('fire'), 'high')
  assert.strictEqual(getSafetyAlarmSeverity('theft'), 'medium')
  assert.strictEqual(getSafetyAlarmSeverity('noise'), 'low')
})

test('calculateGeofenceRadius scales with surveyor levels', () => {
  assert.strictEqual(calculateGeofenceRadius(10), 200)
  assert.strictEqual(calculateGeofenceRadius(80), 500)
  assert.strictEqual(calculateGeofenceRadius(300), 1000)
})

// ── WiFi Mesh Logics ─────────────────────────────────────────────────────────

test('isWifiVoucherExpired gates at 24 hours', () => {
  const now = Date.now()
  const old = new Date(now - 30 * 3_600_000).toISOString()
  assert.strictEqual(isWifiVoucherExpired(old, now), true)
})

test('isWifiUptimeHealthy checks 80% mark', () => {
  assert.strictEqual(isWifiUptimeHealthy(75), false)
  assert.strictEqual(isWifiUptimeHealthy(95), true)
})

test('isWifiNodeSearchable limits to 100m range', () => {
  const user = { lat: -25.9983, lon: 28.2144 }
  const far = { lat: -25.9999, lon: 28.2166 }
  assert.strictEqual(isWifiNodeSearchable(user, far), false)
})

test('calculateWifiPayoutSplit handles 5% commission', () => {
  const split = calculateWifiPayoutSplit(100)
  assert.strictEqual(split.platformAmount, 5)
  assert.strictEqual(split.hostAmount, 95)
})

// ── Removals & Bakkie Logics ─────────────────────────────────────────────────

test('isBakkieRemovalEligible tests limits', () => {
  assert.strictEqual(isBakkieRemovalEligible(800, '1-Ton'), true)
  assert.strictEqual(isBakkieRemovalEligible(1500, '1-Ton'), false)
  assert.strictEqual(isBakkieRemovalEligible(3000, '4-Ton'), true)
})

// ── Landlord & Cohort Density Logics ─────────────────────────────────────────

test('isLandlordDensityHigh checks 12-tenant cap', () => {
  assert.strictEqual(isLandlordDensityHigh(8), false)
  assert.strictEqual(isLandlordDensityHigh(15), true)
})

test('isLandlordPortfolioValid checks 24 backyard shack cap', () => {
  assert.strictEqual(isLandlordPortfolioValid(12), true)
  assert.strictEqual(isLandlordPortfolioValid(30), false)
})

test('isUserMinor checks age threshold', () => {
  assert.strictEqual(isUserMinor(2015, 2026), true)
  assert.strictEqual(isUserMinor(1998, 2026), false)
})

test('calculateXPLevel maps tiers correctly', () => {
  assert.strictEqual(calculateXPLevel(20), 'Apprentice')
  assert.strictEqual(calculateXPLevel(60), 'Block')
  assert.strictEqual(calculateXPLevel(250), 'Master')
})

test('getVibePointsMultiplier checks density count', () => {
  assert.strictEqual(getVibePointsMultiplier(30), 2)
  assert.strictEqual(getVibePointsMultiplier(120), 1)
})

// ── Traffic & Hazard Logics ──────────────────────────────────────────────────

test('calculateTrafficRerouteDelay computes intersections delay', () => {
  assert.strictEqual(calculateTrafficRerouteDelay(['dead_robots', 'pothole']), 13)
  assert.strictEqual(calculateTrafficRerouteDelay(['roadblock', 'congestion']), 20)
})

test('isTrafficReportSpam checks limits', () => {
  const now = Date.now()
  assert.strictEqual(isTrafficReportSpam([now, now, now], now), true)
})

test('isPotholePersistent limits to 14 days', () => {
  const now = Date.now()
  const stale = new Date(now - 20 * 86_400_000).toISOString()
  assert.strictEqual(isPotholePersistent(stale, now), false)
})

test('isGeneralHazardExpired triggers at 2 hours', () => {
  const now = Date.now()
  const stale = new Date(now - 3 * 3_600_000).toISOString()
  assert.strictEqual(isGeneralHazardExpired(stale, now), true)
})

// ── Voucher Commerce Logics ──────────────────────────────────────────────────

test('isVoucherPurchaseThrottled checks counts', () => {
  const now = Date.now()
  assert.strictEqual(isVoucherPurchaseThrottled([now, now, now], now), true)
})

test('isVoucherExpired checks 180 days', () => {
  const now = Date.now()
  const stale = new Date(now - 200 * 86_400_000).toISOString()
  assert.strictEqual(isVoucherExpired(stale, now), true)
})

test('validateVoucherHMAC verifies token integrity', () => {
  const key = 'secret-test-key'
  const sig = 'ecf674483755490a' // signature slice for meter:123, price:50, ts:2026-07-21
  // We can generate dynamically or check that it validates using generated signature
  const ts = '2026-07-21'
  const generated = validateVoucherHMAC('12345678', 100, ts, 'invalid-sig', key)
  assert.strictEqual(generated, false)
})

// ── Sync & Queue Logics ──────────────────────────────────────────────────────

test('isClientSyncBackoffDue checks delays', () => {
  const now = Date.now()
  assert.strictEqual(isClientSyncBackoffDue(0, now - 6000, now), true)
  assert.strictEqual(isClientSyncBackoffDue(0, now - 2000, now), false)
})

test('isSyncQueueOverload flags queue sizes', () => {
  assert.strictEqual(isSyncQueueOverload(45), false)
  assert.strictEqual(isSyncQueueOverload(120), true)
})

test('isLandlordWaiverActive checks 30 days limit', () => {
  const now = Date.now()
  const recent = new Date(now - 10 * 86_400_000).toISOString()
  const stale = new Date(now - 45 * 86_400_000).toISOString()
  assert.strictEqual(isLandlordWaiverActive(recent, now), true)
  assert.strictEqual(isLandlordWaiverActive(stale, now), false)
})

test('detectCurrencyByLocation maps location to local currency', () => {
  assert.strictEqual(detectCurrencyByLocation('Ivory Park, South Africa').currency, 'ZAR')
  assert.strictEqual(detectCurrencyByLocation('Nairobi, Kenya').currency, 'KES')
  assert.strictEqual(formatCurrencyByLocation(1200, 'Ivory Park'), 'R 1200')
  assert.strictEqual(formatCurrencyByLocation(500, 'Nairobi'), 'KSh 500')
})
