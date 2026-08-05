// Pure business logic for The Resident.
//
// Everything here is a deterministic function of its inputs — no Supabase, no
// Redux, no DOM — so the rules can be tested directly (see logic.test.ts).
// Rules that must not be forgeable by a client (rate limits, reputation,
// counters, eligibility) deliberately live in SQL instead; this file holds the
// ranking, matching and presentation logic that the UI needs to run locally.

import type { Listing, RoommateSeeker, LiftClub, LandlordPreferences } from '../store'

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
  // Which utility this report is about — optional so existing single-utility
  // callers (and older tests) don't have to supply it; SafetyTab filters by it
  // to keep power/water/network consensus independent of each other.
  kind?: 'power' | 'water' | 'network'
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

// ── Currency display ──────────────────────────────────────────────────────────
//
// Every priced record (Listing, LiftClub, UtilityToken, RoommateSeeker, …)
// already carries its own `currency` ISO code — the app never needed to guess.
// formatCurrency renders it with Intl.NumberFormat, which handles symbol,
// placement and grouping correctly for any currency in any locale with zero
// hardcoded country list. The locale itself is left undefined so the browser's
// own locale drives formatting conventions (decimal comma vs point, etc.) —
// nothing here assumes any one country or region.

const CURRENCY_FALLBACK_SYMBOL: Record<string, string> = {
  ZAR: 'R', USD: '$', EUR: '€', GBP: '£', KES: 'KSh', NGN: '₦', GHS: 'GH₵'
}

/** Formats an amount in its OWN currency — never guessed from a location string. */
export function formatCurrency(amount: number, currencyCode?: string | null): string {
  const code = (currencyCode || '').toUpperCase().trim()
  if (!/^[A-Z]{3}$/.test(code)) {
    // No usable currency code on the record — show the number plainly rather
    // than silently asserting a currency that was never specified.
    return String(amount)
  }
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: code,
      minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
      maximumFractionDigits: 2
    }).format(amount)
  } catch {
    // An unrecognised ISO code (rare, but Intl throws rather than guessing).
    const symbol = CURRENCY_FALLBACK_SYMBOL[code] || `${code} `
    return `${symbol} ${amount}`
  }
}
