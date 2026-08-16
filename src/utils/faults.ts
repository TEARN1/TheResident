// Collective infrastructure faults — the vouching engine.
//
// The idea: one person saying "the power is out" is a complaint. Twenty
// neighbours independently saying it, from twenty different houses, within the
// same hour and the same few hundred metres, is EVIDENCE — and evidence is
// something a utility can act on and can be held to.
//
// So this file answers four questions, and nothing else. It is deliberately
// pure (no Supabase, no I/O) so every rule below is testable in isolation:
//
//   1. Does a new report belong to a fault that already exists?  (clustering)
//   2. How much is one person's vouch actually worth?            (weighting)
//   3. Is there now enough evidence to escalate to the provider? (threshold)
//   4. How stale is this, and who should be chased?              (decay / SLA)
//
// The adversarial framing matters. A vouching system that escalates on raw
// counts is trivially gamed: one person with five accounts, or a group with a
// grudge, can manufacture an outage that dispatches a real crew to a real
// street where nothing is wrong. Every rule here exists to make that expensive
// while keeping it effortless for the honest neighbour who just lost power.

import { distanceMetres } from './geo'
import type { Point } from './geo'

// ── Taxonomy ───────────────────────────────────────────────────────────────

export type FaultKind =
  | 'power_outage'        // no supply
  | 'power_line_down'     // a conductor on the ground — immediately dangerous
  | 'substation_damage'   // the box/mini-sub is damaged, burning or open
  | 'meter_box_damage'    // shared/house connection box
  | 'streetlight_out'
  | 'water_outage'
  | 'water_leak'
  | 'burst_pipe'
  | 'sewage_spill'
  | 'refuse_uncollected'
  | 'network_outage'
  | 'road_damage'

export type FaultSector =
  | 'electricity' | 'water' | 'sanitation' | 'refuse' | 'telecoms' | 'roads'

export const SECTOR_OF: Record<FaultKind, FaultSector> = {
  power_outage: 'electricity',
  power_line_down: 'electricity',
  substation_damage: 'electricity',
  meter_box_damage: 'electricity',
  streetlight_out: 'electricity',
  water_outage: 'water',
  water_leak: 'water',
  burst_pipe: 'water',
  sewage_spill: 'sanitation',
  refuse_uncollected: 'refuse',
  network_outage: 'telecoms',
  road_damage: 'roads',
}

/**
 * Faults where the hazard is physical, immediate and potentially lethal.
 *
 * These deliberately bypass the corroboration threshold. A live conductor lying
 * in a street where children walk must not wait for the twentieth neighbour to
 * confirm it — the cost of dispatching a crew to a false report is an hour of
 * someone's time; the cost of waiting on a true one is a life. Those are not
 * symmetric, so the rule is not symmetric.
 */
export const IMMEDIATE_DANGER: ReadonlySet<FaultKind> = new Set<FaultKind>([
  'power_line_down',
  'substation_damage',
  'sewage_spill',
])

export type VouchKind =
  | 'affected'   // it is happening to me, at my house
  | 'witnessed'  // I can see it, but I am not affected
  | 'disputed'   // this is not happening / not true
  | 'resolved'   // it has been fixed

// ── Inputs ─────────────────────────────────────────────────────────────────

export interface Vouch {
  userId: string
  kind: VouchKind
  /** Where the voucher was when they vouched. */
  at: Point
  createdAt: string
  /** res_reputation.score for the voucher, if known. */
  reputationScore?: number
}

export interface FaultLike {
  id: string
  kind: FaultKind
  at: Point
  createdAt: string
  status: string
}

export interface EscalationPolicy {
  /** Distinct human reporters required before a provider is told. */
  minDistinctReporters: number
  /** Weighted evidence required — resists one person with several accounts. */
  minWeightedScore: number
  /** Reports outside this window are a different event, not this one. */
  windowHours: number
  /** Corroboration must come from within this radius of the fault. */
  radiusM: number
  /** No single voucher may contribute more than this, whatever their standing. */
  maxVoucherWeight: number
  /** Above this ratio of disputes to affirmations, refuse to escalate. */
  disputeRatioAbort: number
}

/**
 * Defaults. These are also seeded into res_policies so they can be tuned per
 * deployment without a code change — a dense informal settlement and a
 * low-density suburb need different radii, and only operators know which is
 * which.
 */
export const DEFAULT_POLICY: EscalationPolicy = {
  minDistinctReporters: 5,
  minWeightedScore: 4.0,
  windowHours: 6,
  radiusM: 400,
  maxVoucherWeight: 1.5,
  disputeRatioAbort: 0.4,
}

/** Immediate-danger faults escalate on far less, for the reason given above. */
export const DANGER_POLICY: EscalationPolicy = {
  ...DEFAULT_POLICY,
  minDistinctReporters: 1,
  minWeightedScore: 0.5,
  radiusM: 250,
}

export function policyFor(kind: FaultKind, base: EscalationPolicy = DEFAULT_POLICY): EscalationPolicy {
  return IMMEDIATE_DANGER.has(kind)
    ? { ...base, ...DANGER_POLICY, windowHours: base.windowHours }
    : base
}

// ── 1. Clustering: is this the same fault? ─────────────────────────────────

const HOUR_MS = 3_600_000

/**
 * Finds the fault a new report should join, or null if it is a new event.
 *
 * Without this, twenty neighbours reporting one outage create twenty separate
 * faults, each with one voucher, none of which ever reaches a threshold — the
 * exact opposite of the intent. Clustering is what turns individual complaints
 * into collective evidence.
 *
 * Ties are broken by proximity, then by age: a report joins the nearest live
 * fault, and where two are equidistant, the older one — so an event
 * accumulates onto a single record rather than splitting.
 */
export function findMatchingFault(
  report: { kind: FaultKind; at: Point; createdAt?: string },
  open: FaultLike[],
  policy: EscalationPolicy = DEFAULT_POLICY,
  now: number = Date.now()
): FaultLike | null {
  const reportedAt = report.createdAt ? new Date(report.createdAt).getTime() : now
  const windowMs = policy.windowHours * HOUR_MS

  const candidates = open
    .filter(f => f.kind === report.kind)
    .filter(f => !isClosed(f.status))
    .map(f => ({
      fault: f,
      distance: distanceMetres(report.at, f.at),
      age: reportedAt - new Date(f.createdAt).getTime(),
    }))
    .filter(c => c.distance <= policy.radiusM)
    // A fault that started eight hours ago and one starting now are different
    // events even in the same street — yesterday's outage is not today's.
    .filter(c => c.age >= -windowMs && c.age <= windowMs)
    .sort((a, b) => (a.distance - b.distance) || (b.age - a.age))

  return candidates.length > 0 ? candidates[0].fault : null
}

export function isClosed(status: string): boolean {
  return status === 'resolved' || status === 'verified' || status === 'lapsed' || status === 'rejected'
}

// ── 2. Weighting: what is one vouch worth? ─────────────────────────────────

/**
 * Proximity multiplier. Full weight close in, tapering to a floor at the edge
 * of the policy radius.
 *
 * Someone standing at the substation knows more than someone four streets away
 * who noticed their lights flicker — but the distant neighbour is not worthless,
 * because an outage genuinely affects a wide area. Hence a taper, not a cliff.
 */
export function proximityWeight(distanceM: number, radiusM: number): number {
  if (distanceM <= 150) return 1
  if (distanceM >= radiusM) return 0.3
  const span = radiusM - 150
  const over = distanceM - 150
  return 1 - 0.7 * (over / span)
}

/**
 * Reputation multiplier, deliberately compressed into [0.6, 1.3].
 *
 * A new resident whose power is genuinely out must still be able to raise a
 * fault — this is infrastructure for everyone, not a loyalty scheme. So
 * reputation nudges weight; it never gates participation. The narrow band is
 * the point.
 */
export function reputationWeight(score: number | undefined): number {
  if (score === undefined || Number.isNaN(score)) return 0.85   // unknown ≈ neutral
  if (score <= 0) return 0.6
  if (score >= 200) return 1.3
  return 0.6 + (score / 200) * 0.7
}

const KIND_BASE: Record<VouchKind, number> = {
  affected: 1,
  witnessed: 0.6,
  disputed: 0,
  resolved: 0,
}

export function vouchWeight(
  vouch: Vouch,
  faultAt: Point,
  policy: EscalationPolicy = DEFAULT_POLICY
): number {
  const base = KIND_BASE[vouch.kind]
  if (base === 0) return 0

  const distance = distanceMetres(vouch.at, faultAt)
  // Outside the radius entirely, a vouch carries no weight — it is probably a
  // different event, and accepting it would let distant accounts inflate a
  // local fault.
  if (distance > policy.radiusM) return 0

  const raw = base * proximityWeight(distance, policy.radiusM) * reputationWeight(vouch.reputationScore)
  return Math.min(raw, policy.maxVoucherWeight)
}

// ── 3. The escalation decision ─────────────────────────────────────────────

export interface EvidenceSummary {
  distinctReporters: number
  affectedCount: number
  witnessCount: number
  disputeCount: number
  resolvedCount: number
  weightedScore: number
  disputeRatio: number
}

export function summariseEvidence(
  vouches: Vouch[],
  faultAt: Point,
  policy: EscalationPolicy = DEFAULT_POLICY,
  now: number = Date.now()
): EvidenceSummary {
  const cutoff = now - policy.windowHours * HOUR_MS

  // One vouch per person: the last one they gave. Someone who says "affected"
  // and later "resolved" must not be counted as both.
  const latest = new Map<string, Vouch>()
  for (const v of vouches) {
    const t = new Date(v.createdAt).getTime()
    if (t < cutoff) continue
    const existing = latest.get(v.userId)
    if (!existing || t > new Date(existing.createdAt).getTime()) {
      latest.set(v.userId, v)
    }
  }

  let affected = 0, witness = 0, disputed = 0, resolved = 0, weighted = 0
  for (const v of latest.values()) {
    switch (v.kind) {
      case 'affected':  affected++;  break
      case 'witnessed': witness++;   break
      case 'disputed':  disputed++;  break
      case 'resolved':  resolved++;  break
    }
    weighted += vouchWeight(v, faultAt, policy)
  }

  const affirmations = affected + witness
  return {
    distinctReporters: affirmations,
    affectedCount: affected,
    witnessCount: witness,
    disputeCount: disputed,
    resolvedCount: resolved,
    weightedScore: Number(weighted.toFixed(3)),
    disputeRatio: affirmations === 0 ? (disputed > 0 ? 1 : 0) : disputed / affirmations,
  }
}

export interface EscalationDecision {
  escalate: boolean
  reason: string
  evidence: EvidenceSummary
}

/**
 * The single decision this whole file exists to make: is there enough evidence
 * to put this in front of a provider?
 *
 * Returns a reason either way, because the reason is written into the audit log
 * and shown to residents. "Waiting for 2 more neighbours to confirm" is a
 * vastly better experience than silence, and it tells people exactly how to
 * help — which is itself what makes the mechanism work.
 */
export function escalationDecision(
  fault: { kind: FaultKind; at: Point },
  vouches: Vouch[],
  basePolicy: EscalationPolicy = DEFAULT_POLICY,
  now: number = Date.now()
): EscalationDecision {
  const policy = policyFor(fault.kind, basePolicy)
  const evidence = summariseEvidence(vouches, fault.at, policy, now)

  if (evidence.disputeRatio > policy.disputeRatioAbort) {
    return {
      escalate: false,
      reason: `held back: ${evidence.disputeCount} neighbours dispute this against ` +
              `${evidence.distinctReporters} confirming it`,
      evidence,
    }
  }

  if (IMMEDIATE_DANGER.has(fault.kind) && evidence.distinctReporters >= policy.minDistinctReporters) {
    return {
      escalate: true,
      reason: `${fault.kind.replace(/_/g, ' ')} is an immediate physical danger — ` +
              `escalated on ${evidence.distinctReporters} report(s) without waiting for corroboration`,
      evidence,
    }
  }

  if (evidence.distinctReporters < policy.minDistinctReporters) {
    const need = policy.minDistinctReporters - evidence.distinctReporters
    return {
      escalate: false,
      reason: `waiting for ${need} more neighbour${need === 1 ? '' : 's'} to confirm ` +
              `(${evidence.distinctReporters} of ${policy.minDistinctReporters})`,
      evidence,
    }
  }

  if (evidence.weightedScore < policy.minWeightedScore) {
    // Enough heads, not enough evidence: typically reports clustered at the
    // very edge of the radius, or all from brand-new accounts. Ask for someone
    // closer rather than refusing outright.
    return {
      escalate: false,
      reason: `${evidence.distinctReporters} reports, but weighted evidence is ` +
              `${evidence.weightedScore} of ${policy.minWeightedScore} needed — ` +
              `confirmation from closer to the fault would help`,
      evidence,
    }
  }

  return {
    escalate: true,
    reason: `${evidence.distinctReporters} neighbours confirm ` +
            `(${evidence.affectedCount} affected, ${evidence.witnessCount} witnessed), ` +
            `weighted evidence ${evidence.weightedScore}`,
    evidence,
  }
}

// ── 4. Resolution, staleness and accountability ────────────────────────────

/**
 * Residents close the loop, not the provider alone. A provider marking a job
 * done is a claim; neighbours confirming the lights are on is the fact.
 */
export function resolutionConfirmed(
  evidence: EvidenceSummary,
  minConfirmations = 3
): boolean {
  return evidence.resolvedCount >= minConfirmations &&
         evidence.resolvedCount > evidence.affectedCount
}

/**
 * Hours a provider has to acknowledge before the fault is flagged as unanswered.
 * Not a contractual SLA — a visible, published expectation, which is often
 * more effective than a contract nobody reads.
 */
export const ACKNOWLEDGE_TARGET_HOURS: Record<FaultSector, number> = {
  electricity: 4,
  water: 4,
  sanitation: 8,
  refuse: 24,
  telecoms: 24,
  roads: 72,
}

export function acknowledgementOverdue(
  sector: FaultSector,
  escalatedAt: string,
  acknowledgedAt: string | null,
  now: number = Date.now()
): boolean {
  if (acknowledgedAt) return false
  const target = ACKNOWLEDGE_TARGET_HOURS[sector] * HOUR_MS
  return now - new Date(escalatedAt).getTime() > target
}

/**
 * Queue priority for a provider: how dangerous, how many people, how long.
 *
 * Danger is a separate BAND, not a bonus. An earlier version added a constant
 * for immediate-danger faults, and a large enough ordinary outage simply
 * outscored it — which would have put a downed live conductor below a
 * neighbourhood-wide but perfectly safe power cut. Scale must never outrank
 * physical danger, so the danger band sits an order of magnitude above
 * anything the other terms can reach (their combined ceiling is ~220).
 *
 * Age is included deliberately so a small fault cannot be starved forever by a
 * stream of larger ones. Watching your street's problem never rise is exactly
 * what makes people stop reporting.
 */
export function faultPriority(
  fault: { kind: FaultKind; createdAt: string },
  evidence: EvidenceSummary,
  now: number = Date.now()
): number {
  const DANGER_BAND = 1000
  const danger = IMMEDIATE_DANGER.has(fault.kind) ? DANGER_BAND : 0
  const people = Math.min(evidence.affectedCount, 50) * 1.5      // ≤ 75
  const ageHours = (now - new Date(fault.createdAt).getTime()) / HOUR_MS
  const age = Math.min(ageHours, 168) * 0.25                     // ≤ 42
  return Number((danger + people + evidence.weightedScore + age).toFixed(2))
}

/**
 * Confidence decays when nobody re-confirms. Reuses the shape of decayedScore()
 * in logic.ts: a fault nobody has mentioned for two days is probably fixed, and
 * a map full of fixed faults teaches people to ignore the map.
 */
export function faultConfidence(
  evidence: EvidenceSummary,
  lastVouchAt: string,
  now: number = Date.now()
): number {
  const hours = (now - new Date(lastVouchAt).getTime()) / HOUR_MS
  const halfLife = 24
  const decay = Math.pow(0.5, hours / halfLife)
  return Number(Math.min(1, (evidence.weightedScore / 8) * decay).toFixed(3))
}

/** Human summary for the fault card. */
export function describeEvidence(evidence: EvidenceSummary): string {
  if (evidence.distinctReporters === 0) return 'No confirmations yet'
  const parts: string[] = []
  if (evidence.affectedCount > 0) {
    parts.push(`${evidence.affectedCount} affected`)
  }
  if (evidence.witnessCount > 0) {
    parts.push(`${evidence.witnessCount} witnessed`)
  }
  if (evidence.disputeCount > 0) {
    parts.push(`${evidence.disputeCount} dispute${evidence.disputeCount === 1 ? 's' : ''} it`)
  }
  return parts.join(' · ')
}
