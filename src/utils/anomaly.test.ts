import test from 'node:test'
import assert from 'node:assert'
import {
  summarise,
  detect,
  detectAll,
  criticalConditions,
  needsImmediateAttention,
  RULES,
  DEFAULT_RULE
} from './anomaly'
import type { AnomalyRule, MetricPoint, SystemState } from './anomaly'

const rule = (over: Partial<AnomalyRule> = {}): AnomalyRule => ({
  metric: 'signups',
  label: 'new residents joining',
  ...DEFAULT_RULE,
  ...over,
})

/** `n` points of a steady value, with optional jitter. */
const steady = (n: number, value: number, jitter = 0): MetricPoint[] =>
  Array.from({ length: n }, (_, i) => ({
    at: new Date(Date.UTC(2026, 7, 1, i)).toISOString(),
    value: value + (jitter ? (i % 2 ? jitter : -jitter) : 0),
  }))

const healthy: SystemState = {
  worstConsecutiveFailures: 0,
  criticalAlertsOpen: 0,
  oldestCriticalAlertMinutes: 0,
  overdueAcknowledgements: 0,
  percentRowsChanged: 1,
  driftDetected: false,
}

// ── Statistics ─────────────────────────────────────────────────────────────

test('summarise handles an empty history without dividing by zero', () => {
  assert.deepStrictEqual(summarise([]), { mean: 0, stdDev: 0, samples: 0 })
})

test('summarise computes a mean and spread', () => {
  const s = summarise(steady(10, 10, 2))
  assert.strictEqual(s.mean, 10)
  assert.strictEqual(s.stdDev, 2)
  assert.strictEqual(s.samples, 10)
})

// ── Silence is the default ─────────────────────────────────────────────────
// A person woken by three false alarms stops reading the fourth, and the
// fourth is the real one. Each of these is a reason to stay quiet.

test('too little history means no claim at all', () => {
  // Two days of data cannot tell you what normal looks like.
  assert.strictEqual(detect(rule({ minSamples: 24 }), 500, steady(5, 10)), null)
})

test('a small absolute change never alerts, however many sigma it is', () => {
  // 1 -> 3 is enormous statistically and completely uninteresting in fact.
  const history = steady(48, 1, 0.1)
  assert.strictEqual(detect(rule({ minAbsoluteDelta: 3, direction: 'both' }), 3, history), null)
})

test('a change within normal variation is not an anomaly', () => {
  const history = steady(48, 100, 10)
  assert.strictEqual(detect(rule({ direction: 'both' }), 105, history), null)
})

test('direction is respected — a metric falling is not a failure for an up-only rule', () => {
  const history = steady(48, 100, 2)
  assert.strictEqual(detect(rule({ direction: 'up' }), 10, history), null,
    'job failures dropping is the system working, not an incident')
  assert.ok(detect(rule({ direction: 'up' }), 400, history))
})

test('a metric falling is caught by a down rule', () => {
  const history = steady(48, 100, 2)
  const found = detect(rule({ direction: 'down' }), 20, history)
  assert.ok(found)
  assert.strictEqual(found!.direction, 'down')
})

// ── Detection ──────────────────────────────────────────────────────────────

test('a genuine collapse in signups is reported, with the numbers', () => {
  const history = steady(48, 50, 5)
  const found = detect(rule({ direction: 'down' }), 5, history)
  assert.ok(found)
  assert.strictEqual(found!.current, 5)
  assert.strictEqual(found!.mean, 50)
  assert.match(found!.message, /new residents joining is down 90%/)
  assert.match(found!.message, /5 vs a usual 50/)
})

test('a flat history with a sudden change is significant but not overstated', () => {
  // stdDev of 0 makes z undefined; the code must not report Infinity sigma as
  // though it measured something.
  const history = steady(48, 0)
  const found = detect(rule({ direction: 'up', minAbsoluteDelta: 3 }), 40, history)
  assert.ok(found)
  assert.strictEqual(found!.z, Infinity)
  assert.strictEqual(found!.severity, 3)
  assert.match(found!.message, /40 vs a usual 0.0/)
})

test('severity scales with how far out it is, and never reaches 1', () => {
  const history = steady(48, 100, 5)
  const far = detect(rule({ direction: 'up' }), 400, history)
  assert.ok(far)
  assert.ok(far!.severity >= 2, 'a large deviation is serious')

  for (const value of [130, 200, 400, 5000]) {
    const a = detect(rule({ direction: 'up' }), value, history)
    if (a) {
      assert.ok(a.severity > 1,
        'a statistical deviation is never on its own an emergency — sev 1 is for certainties')
    }
  }
})

test('detectAll skips metrics with no current reading and sorts worst first', () => {
  const history = { signups: steady(48, 50, 2), job_failures: steady(24, 0) }
  const found = detectAll({ signups: 2, job_failures: 9 }, history)

  assert.ok(found.length >= 1)
  assert.ok(found.every(a => a.metric !== 'faults_reported'), 'no reading, no claim')
  for (let i = 1; i < found.length; i++) {
    assert.ok(found[i - 1].severity <= found[i].severity, 'sorted by severity')
  }
})

test('the watched metric list stays small and every rule is complete', () => {
  // Watching everything means reading nothing.
  assert.ok(RULES.length <= 12, 'keep the watch list short enough to actually read')
  for (const r of RULES) {
    assert.ok(r.label.length > 3, `${r.metric} needs a human-readable label`)
    assert.ok(r.minSamples > 0 && r.sigma > 0 && r.minAbsoluteDelta > 0,
      `${r.metric} has a threshold that would let noise through`)
  }
})

// ── Hard conditions ────────────────────────────────────────────────────────

test('a healthy system produces no incidents at all', () => {
  assert.deepStrictEqual(criticalConditions(healthy), [])
  assert.strictEqual(needsImmediateAttention([]), false)
})

test('an unprocessed critical alert is severity 1 — the worst state this app has', () => {
  const incidents = criticalConditions({
    ...healthy, criticalAlertsOpen: 1, oldestCriticalAlertMinutes: 40,
  })
  assert.strictEqual(incidents[0].kind, 'critical_alert_unprocessed')
  assert.strictEqual(incidents[0].severity, 1)
  assert.ok(needsImmediateAttention(incidents))
})

test('a critical alert only just raised is not yet an incident', () => {
  // Responders need a few minutes before absence means anything.
  assert.deepStrictEqual(
    criticalConditions({ ...healthy, criticalAlertsOpen: 1, oldestCriticalAlertMinutes: 5 }),
    [])
})

test('schema drift is severity 1 — automation may be acting on wrong assumptions', () => {
  const incidents = criticalConditions({ ...healthy, driftDetected: true })
  assert.strictEqual(incidents[0].severity, 1)
  assert.match(incidents[0].message, /no longer matches the migrations/)
})

test('automation touching a quarter of a table in a day stops everything', () => {
  const incidents = criticalConditions({ ...healthy, percentRowsChanged: 40 })
  assert.strictEqual(incidents[0].kind, 'rate_of_change')
  assert.strictEqual(incidents[0].severity, 1)
})

test('a repeatedly failing job is serious but not an emergency', () => {
  const incidents = criticalConditions({ ...healthy, worstConsecutiveFailures: 3 })
  assert.strictEqual(incidents[0].severity, 2)
  assert.ok(!needsImmediateAttention(incidents), 'a stopped job can wait until morning')
})

test('an unresponsive provider is reported, gently', () => {
  const incidents = criticalConditions({ ...healthy, overdueAcknowledgements: 4 })
  assert.strictEqual(incidents[0].kind, 'provider_unresponsive')
  assert.strictEqual(incidents[0].severity, 3)
})

test('several problems at once are ordered worst first', () => {
  const incidents = criticalConditions({
    worstConsecutiveFailures: 5,
    criticalAlertsOpen: 2,
    oldestCriticalAlertMinutes: 60,
    overdueAcknowledgements: 3,
    percentRowsChanged: 2,
    driftDetected: false,
  })
  assert.strictEqual(incidents[0].severity, 1)
  for (let i = 1; i < incidents.length; i++) {
    assert.ok(incidents[i - 1].severity <= incidents[i].severity)
  }
})
