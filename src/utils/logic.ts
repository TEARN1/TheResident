// Pure business logic for The Resident.
//
// Everything here is a deterministic function of its inputs — no Supabase, no
// Redux, no DOM — so the rules can be tested directly (see logic.test.ts).
// Rules that must not be forgeable by a client (rate limits, reputation,
// counters, eligibility) deliberately live in SQL instead; this file holds the
// ranking, matching and presentation logic that the UI needs to run locally.

import type { Listing, RoommateSeeker, LiftClub, LandlordPreferences } from '../store'
import { createHmac } from 'crypto'

// ── Geo (#29, #30) ────────────────────────────────────────────────────────────

export interface Point {
  lat: number
  lon: number
}

const EARTH_RADIUS_M = 6_371_000
const toRad = (deg: number) => (deg * Math.PI) / 180

// Logic 1: Great-circle distance in metres.
export function distanceMetres(a: Point, b: Point): number {
  const dLat = toRad(b.lat - a.lat)
  const dLon = toRad(b.lon - a.lon)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2
  return EARTH_RADIUS_M * 2 * Math.asin(Math.sqrt(h))
}

// Logic 2: Distance bands classification.
export function distanceBand(metres: number): string {
  if (metres < 500) return 'under 500 m'
  if (metres < 1000) return 'under 1 km'
  if (metres < 2000) return 'about 1 km'
  if (metres < 5000) return `${Math.round(metres / 1000)} km`
  if (metres < 20000) return `${Math.round(metres / 1000)} km`
  return 'far'
}

// Logic 3: Coordinate point validation.
export const isValidPoint = (p: Partial<Point> | null | undefined): p is Point =>
  !!p && typeof p.lat === 'number' && typeof p.lon === 'number' &&
  Number.isFinite(p.lat) && Number.isFinite(p.lon) &&
  !(p.lat === 0 && p.lon === 0) // the null island: our columns default to 0

// ── Roommate compatibility (#27) ──────────────────────────────────────────────

export interface CompatibilityResult {
  /** 0–100, or null when a hard requirement excludes the pair outright. */
  score: number | null
  /** #27.3 — the reasons, so the number is never opaque. */
  reasons: string[]
  /** Why they were excluded, when score is null. */
  blockers: string[]
}

// Logic 4: Roommate matching compatibility checks.
export function roommateCompatibility(
  seeker: Pick<RoommateSeeker, 'gender' | 'childrenCount' | 'budget' | 'suburb'> & { hasPets?: boolean; smokes?: boolean },
  listing: Pick<Listing, 'price' | 'suburb' | 'requirements'>
): CompatibilityResult {
  const req: LandlordPreferences = listing.requirements
  const reasons: string[] = []
  const blockers: string[] = []

  // Hard filters
  if (req.genderPreference !== 'any' && req.genderPreference !== 'couple' &&
      req.genderPreference !== seeker.gender) {
    blockers.push(`This room is for ${req.genderPreference} only`)
  }
  if (seeker.childrenCount > 0 && !req.childrenAllowed) {
    blockers.push('Children are not allowed here')
  }
  if (seeker.childrenCount > 0 && req.childrenAllowed && seeker.childrenCount > req.maxChildren) {
    blockers.push(`Up to ${req.maxChildren} child${req.maxChildren === 1 ? '' : 'ren'} allowed`)
  }
  if (seeker.hasPets && !req.petsAllowed) {
    blockers.push('Pets are not allowed here')
  }
  if (seeker.smokes && !req.smokingAllowed) {
    blockers.push('Smoking is not allowed here')
  }
  if (blockers.length > 0) {
    return { score: null, reasons: [], blockers }
  }

  let score = 0

  // Budget (45 pts) — within budget scores full; over budget falls away fast.
  if (listing.price <= seeker.budget) {
    score += 45
    reasons.push('Within your budget')
  } else {
    const overBy = (listing.price - seeker.budget) / Math.max(seeker.budget, 1)
    score += Math.max(0, Math.round(45 * (1 - overBy * 2)))
    if (overBy <= 0.1) reasons.push('Slightly over budget')
  }

  // Location (25 pts)
  if (seeker.suburb && listing.suburb &&
      seeker.suburb.trim().toLowerCase() === listing.suburb.trim().toLowerCase()) {
    score += 25
    reasons.push('In your suburb')
  }

  // Positive accommodations (30 pts) — things the landlord allows that this seeker actually needs.
  if (seeker.childrenCount > 0 && req.childrenAllowed) {
    score += 15
    reasons.push('Children welcome')
  } else if (seeker.childrenCount === 0) {
    score += 10
  }
  if (seeker.hasPets && req.petsAllowed) {
    score += 15
    reasons.push('Pets welcome')
  } else if (!seeker.hasPets) {
    score += 10
  }

  return { score: Math.max(0, Math.min(100, score)), reasons, blockers: [] }
}

// ── Lift matching (#29) ───────────────────────────────────────────────────────

export interface LiftMatch {
  lift: LiftClub
  /** Extra distance the rider walks at both ends, in metres. */
  detourM: number
}

// Logic 5: Match lift clubs by detour walking segments.
export function matchLifts(
  rider: { origin: Point; destination: Point },
  lifts: Array<LiftClub & { originPoint?: Point; destPoint?: Point }>,
  maxDetourM = 5000
): LiftMatch[] {
  return lifts
    .filter(l => isValidPoint(l.originPoint) && isValidPoint(l.destPoint))
    .map(l => ({
      lift: l as LiftClub,
      detourM:
        distanceMetres(rider.origin, l.originPoint as Point) +
        distanceMetres(rider.destination, l.destPoint as Point)
    }))
    .filter(m => m.detourM <= maxDetourM)
    .sort((a, b) => a.detourM - b.detourM)
}

// Logic 6: ParseDepartureMinutes parses free text times.
export function parseDepartureMinutes(text: string | null | undefined): number | null {
  if (!text) return null
  const t = text.trim().toLowerCase()

  const m = t.match(/^(\d{1,2})\s*[:h.]?\s*(\d{2})?\s*(am|pm)?/)
  if (!m) return null

  let hours = parseInt(m[1], 10)
  const mins = m[2] ? parseInt(m[2], 10) : 0
  const meridiem = m[3]

  if (Number.isNaN(hours) || hours > 23 || mins > 59) return null
  if (meridiem === 'pm' && hours < 12) hours += 12
  if (meridiem === 'am' && hours === 12) hours = 0

  return hours * 60 + mins
}

// Logic 7: Departure window comparison rules.
export function departsWithin(
  liftTime: string | null | undefined,
  wantedTime: string | null | undefined,
  windowMinutes = 30
): boolean {
  const a = parseDepartureMinutes(liftTime)
  const b = parseDepartureMinutes(wantedTime)
  if (a === null || b === null) return true // unparseable: don't exclude
  return Math.abs(a - b) <= windowMinutes
}

// ── Neighbourhood status consensus (#3) ───────────────────────────────────────

export interface StatusReport {
  reporterId: string
  status: 'active' | 'restored' | 'outage'
  createdAt: string
}

export interface Consensus {
  confirmed: boolean
  reporters: number
}

// Logic 8: Outage consensus checker.
export function outageConsensus(
  reports: StatusReport[],
  now: number = Date.now(),
  windowMinutes = 30,
  threshold = 3
): Consensus {
  const cutoff = now - windowMinutes * 60_000
  const reporters = new Set(
    reports
      .filter(r => r.status === 'outage' && new Date(r.createdAt).getTime() >= cutoff)
      .map(r => r.reporterId)
  )
  return { confirmed: reporters.size >= threshold, reporters: reporters.size }
}

// ── Price benchmarking & scam heuristics (#22, #32) ───────────────────────────

export interface PriceStats {
  median: number
  low: number
  high: number
  sample: number
}

// Logic 9: Calculate suburb median benchmark stats.
export function suburbPriceStats(prices: number[], minSample = 3): PriceStats | null {
  const sorted = prices.filter(p => Number.isFinite(p) && p > 0).sort((a, b) => a - b)
  if (sorted.length < minSample) return null

  const quantile = (q: number) => {
    const pos = (sorted.length - 1) * q
    const base = Math.floor(pos)
    const rest = pos - base
    const next = sorted[base + 1]
    return next !== undefined ? sorted[base] + rest * (next - sorted[base]) : sorted[base]
  }

  return {
    median: quantile(0.5),
    low: quantile(0.25),
    high: quantile(0.75),
    sample: sorted.length
  }
}

// Logic 10: Suspicious price heuristic.
export function isSuspiciousPrice(price: number, stats: PriceStats | null): boolean {
  if (!stats) return false
  return price < stats.median * 0.5
}

// Logic 11: Detect mentions of off-platform payment.
const PAYMENT_PRESSURE = [
  /\b(eft|deposit|upfront|e-?wallet|western union|money ?gram)\b/i,
  /\bpay (me |us )?(first|before|now|today)\b/i,
  /\bsend (the )?(money|cash|funds)\b/i,
  /\bbank (details|account)\b/i
]

export function mentionsOffPlatformPayment(text: string): boolean {
  return PAYMENT_PRESSURE.some(re => re.test(text))
}

// ── Vendor / resource availability (#6, #8) ───────────────────────────────────

// Logic 12: Determine if merchant is open now.
export function isOpenNow(hours: string | null | undefined, now: Date = new Date()): boolean | null {
  if (!hours) return null
  const text = hours.toLowerCase()

  if (/24\s*\/?\s*7|always|any ?time/.test(text)) return true

  const day = now.getDay() // 0 = Sunday
  const isWeekend = day === 0 || day === 6
  if (/weekday/.test(text) && isWeekend) return false
  if (/weekend/.test(text) && !isWeekend) return false

  const range = text.match(/(\d{1,2})\s*(?::(\d{2}))?\s*(am|pm)?\s*(?:-|to|until|till)\s*(\d{1,2})\s*(?::(\d{2}))?\s*(am|pm)?/)
  if (!range) return null

  const to24 = (h: string, m: string | undefined, mer: string | undefined, assumePm: boolean) => {
    let hh = parseInt(h, 10)
    const mm = m ? parseInt(m, 10) : 0
    if (mer === 'pm' && hh < 12) hh += 12
    else if (mer === 'am' && hh === 12) hh = 0
    else if (!mer && assumePm && hh < 12) hh += 12
    return hh * 60 + mm
  }

  const open = to24(range[1], range[2], range[3], false)
  const close = to24(range[4], range[5], range[6], false)
  const openAdj = !range[3] && range[6] === 'pm' && parseInt(range[1], 10) < 12 && parseInt(range[1], 10) >= 6
    ? open + 12 * 60
    : open

  const nowMins = now.getHours() * 60 + now.getMinutes()
  if (close <= openAdj) {
    // Wraps past midnight
    return nowMins >= openAdj || nowMins < close
  }
  return nowMins >= openAdj && nowMins < close
}

// ── Reputation (#19) ──────────────────────────────────────────────────────────

// Logic 13: Apply idle reputation decay.
export function decayedScore(score: number, lastActionAt: string, now: number = Date.now()): number {
  const days = (now - new Date(lastActionAt).getTime()) / 86_400_000
  if (days <= 30) return score
  const idleMonths = Math.floor((days - 30) / 30)
  return Math.max(0, Math.round(score * Math.pow(0.9, idleMonths)))
}

// Logic 14: Map reputation score to community tier names.
export function reputationTier(score: number): string {
  if (score >= 500) return 'Pillar of the community'
  if (score >= 250) return 'Trusted neighbour'
  if (score >= 100) return 'Reliable'
  if (score >= 25) return 'Getting known'
  return 'New neighbour'
}

// ── Chore fairness (#37) ──────────────────────────────────────────────────────

export interface FairnessRow {
  userId: string
  completed: number
  assigned: number
}

// Logic 15: Generate chore fairness warnings.
export function fairnessNote(rows: FairnessRow[], nameOf: (id: string) => string): string | null {
  const totalCompleted = rows.reduce((sum, r) => sum + r.completed, 0)
  if (totalCompleted < 4 || rows.length < 2) return null

  const top = [...rows].sort((a, b) => b.completed - a.completed)[0]
  if (top.completed / totalCompleted >= 0.6) {
    return `${nameOf(top.userId)} has done ${top.completed} of the last ${totalCompleted} chores.`
  }
  return null
}

// ── Saved searches (#31) ──────────────────────────────────────────────────────

export interface SearchFilters {
  suburb?: string
  maxPrice?: number
  wifi?: boolean
  parking?: boolean
  bathroom?: 'shared' | 'private' | 'ensuite'
}

// Logic 16: Check if listing matches saved filters.
export function listingMatchesSearch(listing: Listing, f: SearchFilters): boolean {
  if (f.suburb && listing.suburb.trim().toLowerCase() !== f.suburb.trim().toLowerCase()) return false
  if (typeof f.maxPrice === 'number' && listing.price > f.maxPrice) return false
  if (f.wifi && !listing.amenities.wifi) return false
  if (f.parking && !listing.amenities.parking) return false
  if (f.bathroom && listing.amenities.bathroom !== f.bathroom) return false
  return true
}

// ── Notification digest (#46) ─────────────────────────────────────────────────

export const PANIC_TYPE = 'res_alert_panic'

// Logic 17: Notification delivery gating check.
export function shouldDeliver(
  type: string,
  prefs: { mutedTypes: string[]; quietHoursStart?: number | null; quietHoursEnd?: number | null },
  now: Date = new Date()
): boolean {
  if (type === PANIC_TYPE) return true
  if (prefs.mutedTypes.includes(type)) return false

  const { quietHoursStart: qs, quietHoursEnd: qe } = prefs
  if (typeof qs === 'number' && typeof qe === 'number') {
    const h = now.getHours()
    const inQuiet = qs < qe ? h >= qs && h < qe : h >= qs || h < qe
    if (inQuiet) return false
  }
  return true
}

// ── Water Grid Logics ────────────────────────────────────────────────────────

// Logic 18: Calculate tap queue wait time (3 minutes per bucket).
export function calculateWaterWaitTime(bucketsCount: number): number {
  return Math.max(0, bucketsCount * 3)
}

// Logic 19: Get pressure color hex code.
export function getWaterStatusColor(pressure: string): string {
  if (pressure === 'high') return '#10b981'
  if (pressure === 'dribble') return '#f59e0b'
  if (pressure === 'dry') return '#ef4444'
  return '#94a3b8'
}

// Logic 20: Verify water safety certificates are under 90 days.
export function isWaterTestFresh(lastTestedAt: string, now: number = Date.now()): boolean {
  const days = (now - new Date(lastTestedAt).getTime()) / 86_400_000
  return days <= 90
}

// Logic 21: Flag borehole capacity volumes exceeding 5000 Liters.
export function isBoreholeCapacityExceeded(listedCapacity: number): boolean {
  return listedCapacity > 5000
}

// ── Mediation Tribunal Logics ────────────────────────────────────────────────

// Logic 22: Validate dispute appeal eligibility window (< 48 hours).
export function isDisputeAppealable(resolvedAt: string, now: number = Date.now()): boolean {
  const hours = (now - new Date(resolvedAt).getTime()) / 3_600_000
  return hours <= 48
}

// Logic 23: Expire dispute listings older than 72 hours without 5 jurors.
export function isDisputeExpired(createdAt: string, jurorsCount: number, now: number = Date.now()): boolean {
  if (jurorsCount >= 5) return false
  const hours = (now - new Date(createdAt).getTime()) / 3_600_000
  return hours > 72
}

// Logic 24: Gated mediator selection trust thresholds (> 85).
export function isEligibleMediator(score: number): boolean {
  return score >= 85
}

// Logic 25: Recusal checker preventing jurors from same stand.
export function isJurorEligibleForCase(jurorHomeStand: string, disputantHomeStand: string): boolean {
  return jurorHomeStand.trim().toLowerCase() !== disputantHomeStand.trim().toLowerCase()
}

// Logic 26: Compute jury split decisions out of 5 jurors.
export function calculateTribunalMajority(votesFor: number, votesAgainst: number): 'majority_for' | 'majority_against' | 'hung' {
  const total = votesFor + votesAgainst
  if (total < 5) return 'hung'
  if (votesFor >= 3) return 'majority_for'
  if (votesAgainst >= 3) return 'majority_against'
  return 'hung'
}

// ── Emergency Panic Logics ───────────────────────────────────────────────────

// Logic 27: Proximity check for panic rings (< 200m).
export function isPanicAlarmClose(userLoc: Point, alarmLoc: Point, radiusM = 200): boolean {
  return distanceMetres(userLoc, alarmLoc) <= radiusM
}

// Logic 28: Throttles users triggering panic alarms multiple times in 24 hours.
export function isFalseAlarmSpam(panicTimes: number[], now: number = Date.now()): boolean {
  const oneDayAgo = now - 86_400_000
  const recentPanics = panicTimes.filter(t => t >= oneDayAgo)
  return recentPanics.length >= 2
}

// Logic 29: Resolve alarm severity priority rankings.
export function getSafetyAlarmSeverity(type: string): 'high' | 'medium' | 'low' {
  if (type === 'fire' || type === 'medical' || type === 'panic') return 'high'
  if (type === 'theft' || type === 'scam') return 'medium'
  return 'low'
}

// Logic 30: Scale geofence radar ranges based on responder surveyor levels.
export function calculateGeofenceRadius(responderXP: number): number {
  if (responderXP >= 200) return 1000
  if (responderXP >= 50) return 500
  return 200
}

// ── WiFi Mesh Logics ─────────────────────────────────────────────────────────

// Logic 31: Expire guest WiFi vouchers after 24 hours.
export function isWifiVoucherExpired(activatedAt: string, now: number = Date.now()): boolean {
  const hours = (now - new Date(activatedAt).getTime()) / 3_600_000
  return hours > 24
}

// Logic 32: Audit host weekly uptime (requires >= 80%).
export function isWifiUptimeHealthy(weeklyUptimePercent: number): boolean {
  return weeklyUptimePercent >= 80
}

// Logic 33: Constraint restricting node visibility to 100 meters.
export function isWifiNodeSearchable(userLoc: Point, hostLoc: Point): boolean {
  return distanceMetres(userLoc, hostLoc) <= 100
}

// Logic 34: 5% platform commission splits logic on mesh purchases.
export function calculateWifiPayoutSplit(amount: number): { hostAmount: number; platformAmount: number } {
  const platformAmount = parseFloat((amount * 0.05).toFixed(2))
  const hostAmount = parseFloat((amount - platformAmount).toFixed(2))
  return { hostAmount, platformAmount }
}

// ── Removals & Bakkie Logics ─────────────────────────────────────────────────

// Logic 35: Removals payload class matching constraints.
export function isBakkieRemovalEligible(payloadWeightKg: number, bakkieClass: '1-Ton' | '2-Ton' | '4-Ton'): boolean {
  const limits = { '1-Ton': 1000, '2-Ton': 2000, '4-Ton': 4000 }
  return payloadWeightKg <= limits[bakkieClass]
}

// ── Landlord & Cohort Density Logics ─────────────────────────────────────────

// Logic 36: Flag landlord stands exceeding 12 active tenants.
export function isLandlordDensityHigh(activeTenants: number): boolean {
  return activeTenants > 12
}

// Logic 37: Limit backyard room structures to 24 units.
export function isLandlordPortfolioValid(backyardCount: number): boolean {
  return backyardCount <= 24
}

// Logic 38: Age gate verification blocker.
export function isUserMinor(birthYear: number, currentYear: number = new Date().getFullYear()): boolean {
  return currentYear - birthYear < 18
}

// Logic 39: Map XP counts to surveyor tier roles.
export function calculateXPLevel(xp: number): 'Apprentice' | 'Block' | 'Master' {
  if (xp >= 200) return 'Master'
  if (xp >= 50) return 'Block'
  return 'Apprentice'
}

// Logic 40: Density booster multiplier rules.
export function getVibePointsMultiplier(suburbDensityCount: number): number {
  return suburbDensityCount < 50 ? 2 : 1
}

// ── Traffic & Hazard Logics ──────────────────────────────────────────────────

// Logic 41: Compute travel delays for intersection hazards.
export function calculateTrafficRerouteDelay(reportTypes: string[]): number {
  let delay = 0
  reportTypes.forEach(t => {
    if (t === 'dead_robots') delay += 10
    else if (t === 'pothole') delay += 3
    else if (t === 'roadblock') delay += 15
    else if (t === 'congestion') delay += 5
  })
  return delay
}

// Logic 42: Throttle traffic warnings to max 3 per hour.
export function isTrafficReportSpam(reportTimes: number[], now: number = Date.now()): boolean {
  const oneHourAgo = now - 3_600_000
  const recentReports = reportTimes.filter(t => t >= oneHourAgo)
  return recentReports.length >= 3
}

// Logic 43: Expire potholes after 14 days.
export function isPotholePersistent(createdAt: string, now: number = Date.now()): boolean {
  const days = (now - new Date(createdAt).getTime()) / 86_400_000
  return days <= 14
}

// Logic 44: Expire general traffic warnings after 2 hours.
export function isGeneralHazardExpired(createdAt: string, now: number = Date.now()): boolean {
  const hours = (now - new Date(createdAt).getTime()) / 3_600_000
  return hours > 2
}

// ── Voucher Commerce Logics ──────────────────────────────────────────────────

// Logic 45: Limit voucher purchases to 3 per hour.
export function isVoucherPurchaseThrottled(purchases: number[], now: number = Date.now()): boolean {
  const oneHourAgo = now - 3_600_000
  const recentPurchases = purchases.filter(t => t >= oneHourAgo)
  return recentPurchases.length >= 3
}

// Logic 46: Reject vouchers older than 180 days.
export function isVoucherExpired(purchaseDate: string, now: number = Date.now()): boolean {
  const days = (now - new Date(purchaseDate).getTime()) / 86_400_000
  return days > 180
}

// Logic 47: Verify HMAC tokens cryptographically on client meters.
export function validateVoucherHMAC(
  meter: string,
  price: number,
  ts: string,
  sig: string,
  key: string
): boolean {
  const dataToSign = `${meter}:${price}:${ts}`
  const expectedSig = createHmac('sha256', key)
    .update(dataToSign)
    .digest('hex')
    .slice(0, 16)
  return expectedSig === sig
}

// ── Sync & Queue Logics ──────────────────────────────────────────────────────

// Logic 48: Determine client sync exponential backoff intervals.
export function isClientSyncBackoffDue(retryCount: number, lastRetryTime: number, now: number = Date.now()): boolean {
  const delays = [5000, 15000, 45000, 135000]
  const expectedDelay = delays[Math.min(retryCount, delays.length - 1)] || 900000
  return now - lastRetryTime >= expectedDelay
}

// Logic 49: Check local storage sync queue limit bounds.
export function isSyncQueueOverload(queueLength: number): boolean {
  return queueLength > 100
}

// Logic 50: Check platform commission waiver status.
export function isLandlordWaiverActive(joinedAt: string, now: number = Date.now()): boolean {
  const days = (now - new Date(joinedAt).getTime()) / 86_400_000
  return days <= 30
}
