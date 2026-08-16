import test from 'node:test'
import assert from 'node:assert'
import {
  findMatchingFault,
  escalationDecision,
  summariseEvidence,
  vouchWeight,
  proximityWeight,
  reputationWeight,
  resolutionConfirmed,
  acknowledgementOverdue,
  faultPriority,
  faultConfidence,
  describeEvidence,
  policyFor,
  isClosed,
  DEFAULT_POLICY,
  IMMEDIATE_DANGER,
  SECTOR_OF
} from './faults'
import type { Vouch, FaultLike, FaultKind } from './faults'
import type { Point } from './logic'

// A block in Ivory Park. ~0.001° latitude ≈ 111 m, which is what the offsets
// below are built from.
const HERE: Point = { lat: -25.9800, lon: 28.2100 }
const north = (metres: number): Point => ({ lat: HERE.lat + metres / 111_000, lon: HERE.lon })

const HOUR = 3_600_000
const NOW = Date.parse('2026-08-16T12:00:00Z')
const agoH = (h: number) => new Date(NOW - h * HOUR).toISOString()

const vouch = (over: Partial<Vouch> = {}): Vouch => ({
  userId: 'u-1',
  kind: 'affected',
  at: HERE,
  createdAt: agoH(1),
  reputationScore: 100,
  ...over,
})

/** N distinct neighbours, all genuinely affected, spread down the street. */
const neighbours = (n: number, over: Partial<Vouch> = {}): Vouch[] =>
  Array.from({ length: n }, (_, i) =>
    vouch({ userId: `u-${i}`, at: north(20 * i), ...over }))

// ── Clustering ─────────────────────────────────────────────────────────────

test('twenty neighbours reporting one outage join one fault, not twenty', () => {
  // This is the whole mechanic: without clustering, each report is a lone
  // complaint that never reaches a threshold.
  const existing: FaultLike[] = [{
    id: 'f-1', kind: 'power_outage', at: HERE, createdAt: agoH(1), status: 'reported',
  }]
  for (let i = 0; i < 20; i++) {
    const match = findMatchingFault(
      { kind: 'power_outage', at: north(15 * i), createdAt: agoH(0.5) }, existing, DEFAULT_POLICY, NOW)
    if (15 * i <= DEFAULT_POLICY.radiusM) {
      assert.strictEqual(match?.id, 'f-1', `report at ${15 * i}m should join the fault`)
    }
  }
})

test('a report of a different utility never joins an electricity fault', () => {
  const existing: FaultLike[] = [{
    id: 'f-1', kind: 'power_outage', at: HERE, createdAt: agoH(1), status: 'reported',
  }]
  const match = findMatchingFault({ kind: 'water_outage', at: HERE }, existing, DEFAULT_POLICY, NOW)
  assert.strictEqual(match, null)
})

test('a report outside the radius starts a new fault', () => {
  const existing: FaultLike[] = [{
    id: 'f-1', kind: 'power_outage', at: HERE, createdAt: agoH(1), status: 'reported',
  }]
  const match = findMatchingFault(
    { kind: 'power_outage', at: north(900) }, existing, DEFAULT_POLICY, NOW)
  assert.strictEqual(match, null)
})

test("yesterday's outage is not today's, even in the same street", () => {
  const existing: FaultLike[] = [{
    id: 'f-old', kind: 'power_outage', at: HERE, createdAt: agoH(30), status: 'reported',
  }]
  const match = findMatchingFault(
    { kind: 'power_outage', at: HERE, createdAt: agoH(0) }, existing, DEFAULT_POLICY, NOW)
  assert.strictEqual(match, null, 'a 30-hour-old fault is a separate event')
})

test('a resolved fault does not absorb new reports', () => {
  const existing: FaultLike[] = [{
    id: 'f-1', kind: 'power_outage', at: HERE, createdAt: agoH(1), status: 'resolved',
  }]
  assert.strictEqual(
    findMatchingFault({ kind: 'power_outage', at: HERE }, existing, DEFAULT_POLICY, NOW), null)
})

test('a report joins the nearest of two candidate faults', () => {
  const existing: FaultLike[] = [
    { id: 'f-far',  kind: 'power_outage', at: north(300), createdAt: agoH(2), status: 'reported' },
    { id: 'f-near', kind: 'power_outage', at: north(40),  createdAt: agoH(1), status: 'reported' },
  ]
  const match = findMatchingFault({ kind: 'power_outage', at: HERE }, existing, DEFAULT_POLICY, NOW)
  assert.strictEqual(match?.id, 'f-near')
})

// ── Weighting ──────────────────────────────────────────────────────────────

test('proximity weight is full up close and tapers to a floor at the edge', () => {
  assert.strictEqual(proximityWeight(0, 400), 1)
  assert.strictEqual(proximityWeight(150, 400), 1)
  assert.strictEqual(proximityWeight(400, 400), 0.3)
  const mid = proximityWeight(275, 400)
  assert.ok(mid > 0.3 && mid < 1, 'should taper, not cliff')
})

test('reputation nudges weight but never gates participation', () => {
  // A brand-new resident whose power is genuinely out must still count.
  assert.ok(reputationWeight(0) >= 0.6, 'a new account still carries real weight')
  assert.ok(reputationWeight(1000) <= 1.3, 'a veteran cannot dominate')
  assert.ok(reputationWeight(undefined) > 0.6 && reputationWeight(undefined) < 1.3)
})

test('a vouch from outside the radius is worth nothing', () => {
  assert.strictEqual(vouchWeight(vouch({ at: north(900) }), HERE, DEFAULT_POLICY), 0)
})

test('disputes and resolutions carry no affirmative weight', () => {
  assert.strictEqual(vouchWeight(vouch({ kind: 'disputed' }), HERE), 0)
  assert.strictEqual(vouchWeight(vouch({ kind: 'resolved' }), HERE), 0)
})

test('no single voucher can exceed the weight cap', () => {
  const w = vouchWeight(vouch({ reputationScore: 100000 }), HERE, DEFAULT_POLICY)
  assert.ok(w <= DEFAULT_POLICY.maxVoucherWeight)
})

// ── The escalation decision ────────────────────────────────────────────────

test('one person alone does not dispatch a crew', () => {
  const d = escalationDecision({ kind: 'power_outage', at: HERE }, [vouch()], DEFAULT_POLICY, NOW)
  assert.strictEqual(d.escalate, false)
  assert.match(d.reason, /waiting for 4 more neighbours/)
})

test('the refusal reason tells people exactly how to help', () => {
  const d = escalationDecision({ kind: 'power_outage', at: HERE }, neighbours(3), DEFAULT_POLICY, NOW)
  assert.strictEqual(d.escalate, false)
  assert.match(d.reason, /waiting for 2 more neighbours to confirm \(3 of 5\)/)
})

test('enough genuine neighbours escalates', () => {
  const d = escalationDecision({ kind: 'power_outage', at: HERE }, neighbours(6), DEFAULT_POLICY, NOW)
  assert.strictEqual(d.escalate, true)
  assert.match(d.reason, /6 neighbours confirm/)
})

// ── Adversarial: this is where the design earns its keep ───────────────────

test('one person with five accounts cannot manufacture an outage', () => {
  // Same userId five times is collapsed to one vouch by the latest-per-user
  // rule; the count of DISTINCT reporters is what the threshold reads.
  const sybil = Array.from({ length: 5 }, (_, i) =>
    vouch({ userId: 'attacker', createdAt: agoH(i * 0.1) }))
  const d = escalationDecision({ kind: 'power_outage', at: HERE }, sybil, DEFAULT_POLICY, NOW)
  assert.strictEqual(d.escalate, false)
  assert.strictEqual(d.evidence.distinctReporters, 1)
})

test('a distant brigade cannot escalate a fault they are nowhere near', () => {
  // Ten accounts, all real, all outside the radius: zero weight each.
  const distant = Array.from({ length: 10 }, (_, i) =>
    vouch({ userId: `far-${i}`, at: north(1200) }))
  const d = escalationDecision({ kind: 'power_outage', at: HERE }, distant, DEFAULT_POLICY, NOW)
  assert.strictEqual(d.escalate, false)
  assert.strictEqual(d.evidence.weightedScore, 0)
})

test('enough heads but weak evidence asks for someone closer instead of refusing flatly', () => {
  // Six brand-new accounts clustered at the very edge of the radius: they pass
  // the head count but not the weighted bar.
  const edge = Array.from({ length: 6 }, (_, i) =>
    vouch({ userId: `e-${i}`, at: north(395), reputationScore: 0 }))
  const d = escalationDecision({ kind: 'power_outage', at: HERE }, edge, DEFAULT_POLICY, NOW)
  assert.strictEqual(d.escalate, false)
  assert.match(d.reason, /closer to the fault would help/)
})

test('a contested report is held back rather than escalated', () => {
  const contested = [...neighbours(5), ...Array.from({ length: 4 }, (_, i) =>
    vouch({ userId: `d-${i}`, kind: 'disputed' }))]
  const d = escalationDecision({ kind: 'power_outage', at: HERE }, contested, DEFAULT_POLICY, NOW)
  assert.strictEqual(d.escalate, false)
  assert.match(d.reason, /dispute this/)
})

test('a person who says affected and later resolved is counted once, as resolved', () => {
  const v = [
    vouch({ userId: 'u-a', kind: 'affected',  createdAt: agoH(3) }),
    vouch({ userId: 'u-a', kind: 'resolved',  createdAt: agoH(1) }),
  ]
  const e = summariseEvidence(v, HERE, DEFAULT_POLICY, NOW)
  assert.strictEqual(e.affectedCount, 0)
  assert.strictEqual(e.resolvedCount, 1)
  assert.strictEqual(e.distinctReporters, 0)
})

test('stale vouches fall out of the window and stop propping a fault up', () => {
  const old = neighbours(6, { createdAt: agoH(20) })
  const e = summariseEvidence(old, HERE, DEFAULT_POLICY, NOW)
  assert.strictEqual(e.distinctReporters, 0, 'a 20h-old vouch is outside a 6h window')
})

// ── Immediate danger ───────────────────────────────────────────────────────

test('a downed live wire escalates on the first report, without corroboration', () => {
  // The asymmetry is deliberate: a false dispatch costs an hour of a crew's
  // time; waiting on a true one can cost a life.
  const d = escalationDecision({ kind: 'power_line_down', at: HERE }, [vouch()], DEFAULT_POLICY, NOW)
  assert.strictEqual(d.escalate, true)
  assert.match(d.reason, /immediate physical danger/)
})

test('every immediate-danger kind escalates alone', () => {
  for (const kind of IMMEDIATE_DANGER) {
    const d = escalationDecision({ kind, at: HERE }, [vouch()], DEFAULT_POLICY, NOW)
    assert.strictEqual(d.escalate, true, `${kind} should escalate on one report`)
  }
})

test('even an immediate danger is held back when neighbours actively dispute it', () => {
  // Otherwise one account could dispatch crews at will, forever.
  const contested = [vouch(), ...Array.from({ length: 3 }, (_, i) =>
    vouch({ userId: `d-${i}`, kind: 'disputed' }))]
  const d = escalationDecision({ kind: 'power_line_down', at: HERE }, contested, DEFAULT_POLICY, NOW)
  assert.strictEqual(d.escalate, false)
})

test('an ordinary streetlight fault does not get danger treatment', () => {
  assert.ok(!IMMEDIATE_DANGER.has('streetlight_out'))
  const d = escalationDecision({ kind: 'streetlight_out', at: HERE }, [vouch()], DEFAULT_POLICY, NOW)
  assert.strictEqual(d.escalate, false)
})

test('policyFor loosens thresholds only for danger kinds', () => {
  assert.strictEqual(policyFor('power_outage').minDistinctReporters, 5)
  assert.strictEqual(policyFor('power_line_down').minDistinctReporters, 1)
})

// ── Resolution and accountability ──────────────────────────────────────────

test('residents close the loop: a provider claim alone is not proof', () => {
  const e = summariseEvidence([
    ...Array.from({ length: 3 }, (_, i) => vouch({ userId: `r-${i}`, kind: 'resolved' })),
  ], HERE, DEFAULT_POLICY, NOW)
  assert.ok(resolutionConfirmed(e))
})

test('resolution is not confirmed while more people still report it broken', () => {
  const e = summariseEvidence([
    ...Array.from({ length: 3 }, (_, i) => vouch({ userId: `r-${i}`, kind: 'resolved' })),
    ...neighbours(5),
  ], HERE, DEFAULT_POLICY, NOW)
  assert.ok(!resolutionConfirmed(e))
})

test('acknowledgement overdue respects per-sector targets', () => {
  const escalated = agoH(6)
  assert.ok(acknowledgementOverdue('electricity', escalated, null, NOW), '6h > 4h target')
  assert.ok(!acknowledgementOverdue('roads', escalated, null, NOW), '6h < 72h target')
  assert.ok(!acknowledgementOverdue('electricity', escalated, agoH(5), NOW), 'acknowledged is never overdue')
})

test('priority puts danger first but does not starve old small faults', () => {
  const small = summariseEvidence(neighbours(2), HERE, DEFAULT_POLICY, NOW)
  const big = summariseEvidence(neighbours(20), HERE, DEFAULT_POLICY, NOW)

  const danger = faultPriority({ kind: 'power_line_down', createdAt: agoH(1) }, small, NOW)
  const large = faultPriority({ kind: 'power_outage', createdAt: agoH(1) }, big, NOW)
  const oldSmall = faultPriority({ kind: 'power_outage', createdAt: agoH(150) }, small, NOW)
  const newSmall = faultPriority({ kind: 'power_outage', createdAt: agoH(1) }, small, NOW)

  assert.ok(danger > large, 'a live wire outranks a large ordinary outage')
  assert.ok(oldSmall > newSmall, 'age lifts a small fault so it is not starved forever')
})

test('confidence decays when nobody re-confirms', () => {
  const e = summariseEvidence(neighbours(8), HERE, DEFAULT_POLICY, NOW)
  const fresh = faultConfidence(e, agoH(0), NOW)
  const stale = faultConfidence(e, agoH(48), NOW)
  assert.ok(fresh > stale)
  assert.ok(stale < 0.3, 'a fault nobody has mentioned in two days is probably fixed')
})

// ── Taxonomy ───────────────────────────────────────────────────────────────

test('every fault kind maps to a sector, so every fault can be routed', () => {
  const kinds = Object.keys(SECTOR_OF) as FaultKind[]
  assert.ok(kinds.length >= 12)
  for (const k of kinds) {
    assert.ok(SECTOR_OF[k], `${k} has no sector and could not be sent anywhere`)
  }
})

test('isClosed covers every terminal state', () => {
  for (const s of ['resolved', 'verified', 'lapsed', 'rejected']) {
    assert.ok(isClosed(s), `${s} should be closed`)
  }
  for (const s of ['reported', 'corroborated', 'escalated', 'acknowledged', 'in_progress']) {
    assert.ok(!isClosed(s), `${s} should be open`)
  }
})

test('describeEvidence reads like a person wrote it', () => {
  const e = summariseEvidence([...neighbours(3),
    vouch({ userId: 'w-1', kind: 'witnessed' }),
    vouch({ userId: 'd-1', kind: 'disputed' })], HERE, DEFAULT_POLICY, NOW)
  assert.strictEqual(describeEvidence(e), '3 affected · 1 witnessed · 1 disputes it')
  assert.strictEqual(describeEvidence(summariseEvidence([], HERE, DEFAULT_POLICY, NOW)), 'No confirmations yet')
})
