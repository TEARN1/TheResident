// Noticing when the system is behaving abnormally.
//
// Layer 6 of docs/SELF-MANAGING.md. A system that cannot see itself is
// unattended, not autonomous — but the failure mode of naive alerting is
// worse than no alerting at all: a person who has been woken by three false
// alarms stops reading the fourth, and the fourth is the real one.
//
// So the bar here is deliberately high, and every rule below exists to avoid
// crying wolf:
//
//   * A minimum number of samples before ANY statistical claim. Two days of
//     data cannot tell you what normal looks like.
//   * A minimum absolute change, so a metric moving from 1 to 3 never pages
//     anyone regardless of how many standard deviations that is.
//   * Direction awareness. Job failures rising matters; job failures falling
//     is the system working.
//
// Pure and dependency-free, so it runs in the edge job and in tests alike.

export type Direction = 'up' | 'down' | 'both'

export interface MetricPoint {
  /** ISO timestamp of the bucket. */
  at: string
  value: number
}

export interface AnomalyRule {
  metric: string
  /** Which direction is worth reporting. */
  direction: Direction
  /** Below this many historical points, stay silent. */
  minSamples: number
  /** Below this absolute change from the mean, stay silent. */
  minAbsoluteDelta: number
  /** Standard deviations from the mean before it counts. */
  sigma: number
  /** Plain-English description used in the digest. */
  label: string
}

export const DEFAULT_RULE: Omit<AnomalyRule, 'metric' | 'label'> = {
  direction: 'both',
  minSamples: 24,          // a day of hourly buckets, minimum
  minAbsoluteDelta: 3,
  sigma: 3,
}

/**
 * The metrics worth watching, and which way.
 *
 * Kept small on purpose. Watching everything means reading nothing.
 */
export const RULES: AnomalyRule[] = [
  { metric: 'signups', direction: 'down', minSamples: 48, minAbsoluteDelta: 3, sigma: 3,
    label: 'new residents joining' },
  { metric: 'faults_reported', direction: 'both', minSamples: 48, minAbsoluteDelta: 5, sigma: 3,
    label: 'faults reported' },
  { metric: 'faults_escalated', direction: 'up', minSamples: 48, minAbsoluteDelta: 3, sigma: 3,
    label: 'faults escalated to providers' },
  { metric: 'alerts_raised', direction: 'up', minSamples: 48, minAbsoluteDelta: 3, sigma: 3,
    label: 'safety alerts raised' },
  { metric: 'listings_created', direction: 'down', minSamples: 48, minAbsoluteDelta: 3, sigma: 3,
    label: 'new room listings' },
  { metric: 'job_failures', direction: 'up', minSamples: 12, minAbsoluteDelta: 1, sigma: 2,
    label: 'automation failures' },
  { metric: 'rows_affected', direction: 'up', minSamples: 24, minAbsoluteDelta: 50, sigma: 3,
    label: 'rows changed by automation' },
]

export interface Stats {
  mean: number
  stdDev: number
  samples: number
}

export function summarise(points: MetricPoint[]): Stats {
  const values = points.map(p => p.value).filter(v => Number.isFinite(v))
  if (values.length === 0) return { mean: 0, stdDev: 0, samples: 0 }

  const mean = values.reduce((a, b) => a + b, 0) / values.length
  const variance = values.reduce((acc, v) => acc + (v - mean) ** 2, 0) / values.length
  return { mean, stdDev: Math.sqrt(variance), samples: values.length }
}

export type Severity = 1 | 2 | 3 | 4

export interface Anomaly {
  metric: string
  label: string
  current: number
  mean: number
  stdDev: number
  /** How many standard deviations out. Infinity when history had no variance. */
  z: number
  direction: 'up' | 'down'
  severity: Severity
  /** A sentence for the digest. */
  message: string
}

/**
 * Severity from how far out it is.
 *
 * Nothing here reaches severity 1. A statistical deviation is never, on its
 * own, an emergency — sev 1 is reserved for the hard-coded conditions in
 * criticalConditions(), where something is definitely wrong rather than
 * merely unusual.
 */
function severityFor(z: number): Severity {
  if (!Number.isFinite(z)) return 3
  if (z >= 6) return 2
  if (z >= 4) return 3
  return 4
}

/**
 * Tests one metric's latest value against its history.
 *
 * `history` should NOT include `current`, or the current value drags the mean
 * toward itself and the system slowly learns to accept whatever is happening.
 */
export function detect(
  rule: AnomalyRule, current: number, history: MetricPoint[]
): Anomaly | null {
  const stats = summarise(history)
  if (stats.samples < rule.minSamples) return null

  const delta = current - stats.mean
  const direction: 'up' | 'down' = delta >= 0 ? 'up' : 'down'

  if (rule.direction !== 'both' && rule.direction !== direction) return null
  if (Math.abs(delta) < rule.minAbsoluteDelta) return null

  // No variance in history: everything was identical. A change is real, but
  // z is undefined — treat it as significant without pretending to measure it.
  const z = stats.stdDev === 0 ? Infinity : Math.abs(delta) / stats.stdDev
  if (Number.isFinite(z) && z < rule.sigma) return null

  const pct = stats.mean === 0 ? null : Math.round((delta / stats.mean) * 100)
  const movement = direction === 'up' ? 'up' : 'down'
  const detail = pct === null
    ? `${current} vs a usual ${stats.mean.toFixed(1)}`
    : `${movement} ${Math.abs(pct)}% — ${current} vs a usual ${stats.mean.toFixed(1)}`

  return {
    metric: rule.metric,
    label: rule.label,
    current,
    mean: Number(stats.mean.toFixed(2)),
    stdDev: Number(stats.stdDev.toFixed(2)),
    z: Number.isFinite(z) ? Number(z.toFixed(2)) : Infinity,
    direction,
    severity: severityFor(z),
    message: `${rule.label} is ${detail}`,
  }
}

export function detectAll(
  latest: Record<string, number>, history: Record<string, MetricPoint[]>,
  rules: AnomalyRule[] = RULES
): Anomaly[] {
  const out: Anomaly[] = []
  for (const rule of rules) {
    const current = latest[rule.metric]
    if (current === undefined) continue
    const found = detect(rule, current, history[rule.metric] ?? [])
    if (found) out.push(found)
  }
  return out.sort((a, b) => a.severity - b.severity)
}

// ── Hard conditions ────────────────────────────────────────────────────────

export interface SystemState {
  /** Consecutive failures across all jobs, highest. */
  worstConsecutiveFailures: number
  /** Critical alerts still unprocessed, and how long the oldest has waited. */
  criticalAlertsOpen: number
  oldestCriticalAlertMinutes: number
  /** Faults escalated but never acknowledged, past their sector target. */
  overdueAcknowledgements: number
  /** Automation writes in the last 24h as a share of the largest table. */
  percentRowsChanged: number
  /** Whether the schema drift check passed. */
  driftDetected: boolean
}

export interface Incident {
  kind: string
  severity: Severity
  message: string
}

/**
 * Conditions that are wrong by definition, not by statistics.
 *
 * These do not wait for a baseline, cannot be tuned away by a quiet week, and
 * are the only source of severity 1 in the system. Each one means something is
 * definitely broken rather than merely unusual.
 */
export function criticalConditions(state: SystemState): Incident[] {
  const incidents: Incident[] = []

  // An unprocessed panic alert is the single worst state this app can be in.
  // It is the one thing a person opened the app to do, and nothing happened.
  if (state.criticalAlertsOpen > 0 && state.oldestCriticalAlertMinutes > 15) {
    incidents.push({
      kind: 'critical_alert_unprocessed',
      severity: 1,
      message: `${state.criticalAlertsOpen} critical alert(s) unprocessed, oldest ` +
               `${state.oldestCriticalAlertMinutes} minutes old`,
    })
  }

  if (state.driftDetected) {
    incidents.push({
      kind: 'schema_drift',
      severity: 1,
      message: 'the database no longer matches the migrations — automation may be acting on wrong assumptions',
    })
  }

  // Automation touching a quarter of a table in a day is either a bug or a
  // policy nobody meant to set. Either way it should stop and be looked at.
  if (state.percentRowsChanged > 25) {
    incidents.push({
      kind: 'rate_of_change',
      severity: 1,
      message: `automation changed ${state.percentRowsChanged}% of a table in 24h`,
    })
  }

  if (state.worstConsecutiveFailures >= 3) {
    incidents.push({
      kind: 'job_failing',
      severity: 2,
      message: `a job has failed ${state.worstConsecutiveFailures} times in a row and its circuit is open`,
    })
  }

  if (state.overdueAcknowledgements > 0) {
    incidents.push({
      kind: 'provider_unresponsive',
      severity: 3,
      message: `${state.overdueAcknowledgements} escalated fault(s) past their acknowledgement target`,
    })
  }

  return incidents.sort((a, b) => a.severity - b.severity)
}

/** Whether anything here should reach a person tonight rather than tomorrow. */
export function needsImmediateAttention(incidents: Incident[]): boolean {
  return incidents.some(i => i.severity === 1)
}
