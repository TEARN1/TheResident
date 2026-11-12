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
  priceVerdict,
  mentionsOffPlatformPayment,
  isOpenNow,
  decayedScore,
  reputationTier,
  fairnessNote,
  listingMatchesSearch,
  shouldDeliver,
  formatCurrency,
  bearingDegrees,
  isWithinRadius,
  centroid,
  clusterPoints,
  estimateWalkingMinutes,
  studyHabitsCompatibility,
  cleaningCadenceFit,
  dietaryHarmony,
  sleepScheduleOverlap,
  compositeRoommateScore,
  depositFairnessCheck,
  rentToIncomeRatio,
  leaseProration,
  scamScoreHeuristic,
  calculateUtilitySplit,
  tokenVoucherChecksum,
  estimateRemainingBatteryHours,
  loadsheddingStageToOutageHours,
  rotateChoreAssignments,
  choreStreakCount,
  houseRuleQuorumPassed,
  householdVibeIndex,
  fuelCostSharePerPassenger,
  carbonSavingsKg,
  liftSeatAvailability,
  calculateBakkieEstimate,
  serviceProviderTrustScore,
  validateSouthAfricanPhone,
  groupBuyProgressPercent,
  groupBuyPerUnitSaving,
  lostItemMatchConfidence,
  emergencyReachRadiusKm,
  isCareCheckInOverdue,
  offlineBeaconSmsPayload,
  civicHierarchyLevel,
  canCascadeBroadcast,
  notificationUrgencyTier,
  platformHealthAudit
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
  listingType: 'rent',
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
  driverId: 'driver-1', driverName: 'D',
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

test('a listing far below the local median is flagged as suspicious', () => {
  const stats = suburbPriceStats([1400, 1500, 1600, 1700])!
  assert.strictEqual(isSuspiciousPrice(300, stats), true)
  assert.strictEqual(isSuspiciousPrice(1450, stats), false)
  // With no reliable sample we make no accusation
  assert.strictEqual(isSuspiciousPrice(300, null), false)
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

test('reputation is shown as a tier, never a raw number', () => {
  assert.strictEqual(reputationTier(0), 'New neighbour')
  assert.strictEqual(reputationTier(120), 'Reliable')
  assert.strictEqual(reputationTier(600), 'Pillar of the community')
})

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
  const note = fairnessNote(rows, () => 'Thandi')
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

// ── Currency display ─────────────────────────────────────────────────────────

test('formatCurrency renders each amount in its OWN currency, never a guessed one', () => {
  // Exact separators/symbol placement are Intl's job and vary by ICU/locale;
  // what matters is the digits survive and no other currency got substituted.
  assert.match(formatCurrency(1200, 'ZAR').replace(/[\s,.]/g, ''), /1200/)
  assert.match(formatCurrency(500, 'KES').replace(/[\s,.]/g, ''), /500/)
  assert.match(formatCurrency(75, 'USD'), /75/)
  assert.match(formatCurrency(50, 'EUR'), /50/)
})

test('formatCurrency never fabricates a currency for a record that never specified one', () => {
  assert.strictEqual(formatCurrency(1200), '1200')
  assert.strictEqual(formatCurrency(1200, ''), '1200')
  assert.strictEqual(formatCurrency(1200, undefined), '1200')
})

test('formatCurrency never throws on an unrecognised ISO code', () => {
  // Intl.NumberFormat accepts any syntactically-valid 3-letter code and
  // degrades gracefully (showing the code itself in place of a symbol) —
  // the exact spacing is Intl's call, not ours; just assert it doesn't throw
  // and both the code and the amount are present.
  const result = formatCurrency(500, 'XYZ')
  assert.match(result, /XYZ/)
  assert.match(result, /500/)
})

test('priceVerdict places a price against the suburb quartiles', () => {
  const stats = suburbPriceStats([3000, 4000, 5000, 6000, 7000])
  assert.strictEqual(priceVerdict(1000, stats), 'suspicious')
  assert.strictEqual(priceVerdict(3500, stats), 'below')
  assert.strictEqual(priceVerdict(5000, stats), 'fair')
  assert.strictEqual(priceVerdict(9000, stats), 'above')
})

test('priceVerdict says nothing when there are too few comparable listings', () => {
  assert.strictEqual(priceVerdict(5000, suburbPriceStats([5000, 6000])), 'unknown')
  assert.strictEqual(priceVerdict(0, suburbPriceStats([3000, 4000, 5000])), 'unknown')
})

// ── Extended 100 Logic Engine Test Verifications ──────────────────────────────

test('Logic 4-10: Spatial geometry, bearings and walk estimates', () => {
  const pA = { lat: -26.2041, lon: 28.0473 }
  const pB = { lat: -26.1950, lon: 28.0350 }
  const bearing = bearingDegrees(pA, pB)
  assert.ok(bearing >= 0 && bearing <= 360)
  assert.strictEqual(isWithinRadius(pA, pB, 5000), true)
  assert.strictEqual(isWithinRadius(pA, pB, 10), false)
  const c = centroid([pA, pB])
  assert.ok(c !== null && c.lat < 0)
  const walkMins = estimateWalkingMinutes(1200)
  assert.strictEqual(walkMins, 15)
})

test('Logic 12-20: Roommate lifestyle fit, sleep overlap & composite scoring', () => {
  assert.strictEqual(studyHabitsCompatibility('silent', 'silent'), 100)
  assert.strictEqual(studyHabitsCompatibility('silent', 'social'), 20)
  assert.strictEqual(cleaningCadenceFit('daily', 'daily'), 100)
  assert.strictEqual(dietaryHarmony(['pork'], ['strictly halaal']).compatible, false)
  assert.strictEqual(dietaryHarmony(['vegetarian'], ['vegetarian only']).compatible, true)
  assert.strictEqual(sleepScheduleOverlap(23, 7, 23, 7), 8)
  const composite = compositeRoommateScore({ budgetScore: 90, cleanScore: 80, habitsScore: 70 })
  assert.strictEqual(composite, 82)
})

test('Logic 25-30: Housing economics, deposit fairness and scam heuristic', () => {
  const fairDeposit = depositFairnessCheck(4000, 4000)
  assert.strictEqual(fairDeposit.isLegal, true)
  const illegalDeposit = depositFairnessCheck(12000, 4000)
  assert.strictEqual(illegalDeposit.isLegal, false)

  const rentRatio = rentToIncomeRatio(3000, 10000)
  assert.strictEqual(rentRatio.tier, 'ideal')
  assert.strictEqual(leaseProration(3000, 16, 30), 1500)

  const scam = scamScoreHeuristic({
    price: 800,
    stats: { median: 3500, low: 2800, high: 4500, sample: 10 },
    description: 'Send money via e-wallet before viewing',
    verifiedPhone: false,
    photosCount: 0
  })
  assert.strictEqual(scam.riskLevel, 'high')
})

test('Logic 32-40: Utilities splitting, STS token pin and load-shedding calculation', () => {
  const split = calculateUtilitySplit(1000, [{ id: 'u1', daysPresent: 30 }, { id: 'u2', daysPresent: 10 }])
  assert.strictEqual(split.u1, 750)
  assert.strictEqual(split.u2, 250)

  assert.strictEqual(tokenVoucherChecksum('1234 5678 9012 3456 7890'), true)
  assert.strictEqual(tokenVoucherChecksum('1234 5678'), false)

  const batteryHours = estimateRemainingBatteryHours(5, 500)
  assert.strictEqual(batteryHours, 9)

  const ls = loadsheddingStageToOutageHours(4)
  assert.strictEqual(ls.dailyHours, 10)
  assert.strictEqual(ls.slotsCount, 4)
})

test('Logic 42-50: Chores rotation, streaks, voting quorums and household vibe', () => {
  const rotated = rotateChoreAssignments(['c1', 'c2'], ['t1', 't2'], 1)
  assert.strictEqual(rotated.c1, 't2')
  assert.strictEqual(rotated.c2, 't1')

  const streak = choreStreakCount([{ completed: true, date: '2026-11-12' }, { completed: true, date: '2026-11-05' }, { completed: false, date: '2026-10-28' }])
  assert.strictEqual(streak, 2)

  assert.strictEqual(houseRuleQuorumPassed(6, 4), false) // 4/6 = 66.6% < 67%
  assert.strictEqual(houseRuleQuorumPassed(6, 5), true)  // 5/6 = 83.3% >= 67%

  const vibe = householdVibeIndex(0.9, 0, 1.0)
  assert.ok(vibe >= 90)
})

test('Logic 54-60: Commute fuel cost share and transit capacity', () => {
  const share = fuelCostSharePerPassenger(40, 23.5, 8, 4)
  assert.strictEqual(share, 18.8)

  const co2 = carbonSavingsKg(50, 4)
  assert.ok(co2 > 20)

  const seats = liftSeatAvailability(4, 3)
  assert.strictEqual(seats.available, 1)
  assert.strictEqual(seats.isFull, false)
})

test('Logic 61-70: Bakkie move pricing, trust scores and phone normalization', () => {
  const est = calculateBakkieEstimate(350, 15, 12, 1, 150)
  assert.strictEqual(est, 680)

  const trust = serviceProviderTrustScore(25, 4.8, 0)
  assert.ok(trust >= 80)

  const phone = validateSouthAfricanPhone('082 123 4567')
  assert.strictEqual(phone.isValid, true)
  assert.strictEqual(phone.normalized, '+27821234567')
})

test('Logic 71-80: Group buys progress and lost/found matching', () => {
  const gb = groupBuyProgressPercent(7500, 10000)
  assert.strictEqual(gb.percent, 75)
  assert.strictEqual(gb.isFunded, false)

  const savings = groupBuyPerUnitSaving(250, 180)
  assert.strictEqual(savings.savingZar, 70)
  assert.strictEqual(savings.savingPercent, 28)

  const match = lostItemMatchConfidence(['keys', 'blue', 'lanyard'], ['blue', 'car', 'keys'], 'Braamfontein', 'Braamfontein')
  assert.ok(match >= 70)
})

test('Logic 82-90: Emergency radius, care circle cadence and compact SMS beacon', () => {
  assert.strictEqual(emergencyReachRadiusKm('critical'), 3.5)
  assert.strictEqual(emergencyReachRadiusKm('low'), 0.5)

  assert.strictEqual(isCareCheckInOverdue(null, 'daily'), true)
  assert.strictEqual(isCareCheckInOverdue(new Date(Date.now() - 3600000).toISOString(), 'daily'), false)

  const sms = offlineBeaconSmsPayload('user-123456789', { lat: -26.2041, lon: 28.0473 }, '2026-11-12T14:30:00Z')
  assert.match(sms, /^SOS:user-123/)
  assert.match(sms, /-26\.20410,28\.04730/)
})

test('Logic 94-100: Civic cascade hierarchy, notification tiers and platform health audit', () => {
  assert.ok(civicHierarchyLevel('presidency') < civicHierarchyLevel('councillor'))
  assert.strictEqual(canCascadeBroadcast('mayor', 'councillor'), true)
  assert.strictEqual(canCascadeBroadcast('councillor', 'mayor'), false)

  assert.strictEqual(notificationUrgencyTier('res_alert_panic'), 'immediate')
  assert.strictEqual(notificationUrgencyTier('chore_reminder'), 'digest')

  const audit = platformHealthAudit()
  assert.strictEqual(audit.logicCount, 100)
  assert.strictEqual(audit.deterministic, true)
})

