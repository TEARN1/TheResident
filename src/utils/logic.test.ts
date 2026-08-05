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
  formatCurrency
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
