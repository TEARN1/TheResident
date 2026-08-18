// metrics_rollup — counts what happened in the last hour, and notices when
// those counts are abnormal.
//
// Layer 6 of docs/SELF-MANAGING.md. Two responsibilities, kept together
// because the second is worthless without the first:
//
//   1. Record an hourly count for each watched metric.
//   2. Compare the newest count against the previous week and open an incident
//      when it is genuinely out of character.
//
// The detection rules live in src/utils/anomaly.ts, pure and tested, precisely
// so the thresholds that decide whether somebody gets woken up are not buried
// in a job nobody can run locally.

import type { Job, JobContext, JobResult } from '../lib/types.ts'
import {
  detectAll,
  criticalConditions,
  RULES,
} from '../../../../src/utils/anomaly.ts'
import type { MetricPoint, SystemState } from '../../../../src/utils/anomaly.ts'

const HOUR_MS = 3_600_000
const HISTORY_HOURS = 24 * 7

export const metricsRollup: Job = {
  name: 'metrics_rollup',
  // Writes only to observability tables, via RPCs. It touches no domain data
  // at all, which is why the allowlist is empty.
  allowlist: [],

  async run(ctx: JobContext): Promise<JobResult> {
    const now = new Date()
    const bucket = new Date(Math.floor(now.getTime() / HOUR_MS) * HOUR_MS)
    const since = new Date(bucket.getTime() - HOUR_MS).toISOString()

    // ── 1. Count the last hour ───────────────────────────────────────────
    const counts: Record<string, number> = {
      signups: await countSince(ctx, 'res_profiles', 'created_at', since),
      listings_created: await countSince(ctx, 'res_listings', 'created_at', since),
      faults_reported: await countSince(ctx, 'res_faults', 'created_at', since),
      faults_escalated: await countSince(ctx, 'res_faults', 'escalated_at', since),
      alerts_raised: await countSince(ctx, 'res_alerts', 'created_at', since),
      job_failures: await countJobFailures(ctx, since),
      rows_affected: await sumRowsAffected(ctx, since),
    }

    if (!ctx.dryRun) {
      for (const [name, value] of Object.entries(counts)) {
        const { error } = await ctx.db.rpc('res_record_metric', {
          p_name: name, p_value: value, p_bucket: bucket.toISOString(),
        })
        if (error) throw new Error(`record ${name}: ${error.message}`)
      }
    }

    // ── 2. Compare against the previous week ─────────────────────────────
    // History deliberately EXCLUDES this bucket. Including it drags the mean
    // toward whatever is happening now, and the system slowly learns to accept
    // its own failure as normal.
    const history = await loadHistory(ctx, bucket)
    const anomalies = detectAll(counts, history, RULES)

    // ── 3. Conditions that are wrong by definition ───────────────────────
    const state = await readSystemState(ctx)
    const critical = criticalConditions(state)

    // schema_drift is owned by drift_check, which runs daily and produces a
    // specific message ("RLS has been turned OFF on res_faults"). This job runs
    // hourly and only knows drift as a boolean, so if it also wrote that
    // incident it would overwrite the useful message with a generic one twelve
    // times before anyone read the digest. One incident, one owner.
    const OWNED_BY_THIS_JOB = ['critical_alert_unprocessed', 'rate_of_change',
                               'job_failing', 'provider_unresponsive']

    if (!ctx.dryRun) {
      for (const inc of critical) {
        if (!OWNED_BY_THIS_JOB.includes(inc.kind)) continue
        await ctx.db.rpc('res_open_incident', {
          p_kind: inc.kind, p_severity: inc.severity, p_message: inc.message,
        })
      }
      // Close what has recovered, so the digest reflects now rather than the
      // worst moment of the week.
      const stillOpen = new Set(critical.map(i => i.kind))
      for (const kind of OWNED_BY_THIS_JOB) {
        if (!stillOpen.has(kind)) {
          await ctx.db.rpc('res_close_incident', { p_kind: kind, p_auto: true })
        }
      }

      for (const a of anomalies) {
        await ctx.db.rpc('res_open_incident', {
          p_kind: `anomaly_${a.metric}`,
          p_severity: a.severity,
          p_message: a.message,
          p_detail: { current: a.current, mean: a.mean, z: Number.isFinite(a.z) ? a.z : null },
        })
      }
    }

    ctx.log('rolled up', { counts, anomalies: anomalies.length, critical: critical.length })

    return {
      rowsScanned: Object.keys(counts).length,
      rowsAffected: ctx.dryRun ? 0 : Object.keys(counts).length + critical.length + anomalies.length,
      wouldAffect: ctx.dryRun
        ? [...critical.map(c => ({ kind: c.kind, severity: c.severity, message: c.message })),
           ...anomalies.map(a => ({ kind: `anomaly_${a.metric}`, severity: a.severity, message: a.message }))]
        : undefined,
      detail: { counts, anomalies: anomalies.map(a => a.message), critical: critical.map(c => c.message) },
    }
  },
}

async function countSince(
  ctx: JobContext, table: string, column: string, since: string
): Promise<number> {
  const { count, error } = await ctx.db
    .from(table)
    .select('*', { count: 'exact', head: true })
    .gte(column, since)
  // A missing table or column must not take down the whole rollup — a metric
  // we cannot read is reported as zero and the rest still runs.
  if (error) return 0
  return count ?? 0
}

async function countJobFailures(ctx: JobContext, since: string): Promise<number> {
  const { count } = await ctx.db
    .from('res_job_runs')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'failed')
    .gte('started_at', since)
  return count ?? 0
}

async function sumRowsAffected(ctx: JobContext, since: string): Promise<number> {
  const { data } = await ctx.db
    .from('res_job_runs')
    .select('rows_affected')
    .gte('started_at', since)
  const rows = (data ?? []) as Array<{ rows_affected: number | null }>
  return rows.reduce((sum, r) => sum + (r.rows_affected ?? 0), 0)
}

async function loadHistory(
  ctx: JobContext, bucket: Date
): Promise<Record<string, MetricPoint[]>> {
  const from = new Date(bucket.getTime() - HISTORY_HOURS * HOUR_MS).toISOString()
  const { data } = await ctx.db
    .from('res_metrics')
    .select('name, bucket, value')
    .gte('bucket', from)
    .lt('bucket', bucket.toISOString())     // excludes the current bucket

  const out: Record<string, MetricPoint[]> = {}
  for (const row of (data ?? []) as Array<{ name: string; bucket: string; value: number }>) {
    ;(out[row.name] ??= []).push({ at: row.bucket, value: Number(row.value) })
  }
  return out
}

async function readSystemState(ctx: JobContext): Promise<SystemState> {
  const { data: jobs } = await ctx.db
    .from('res_jobs')
    .select('consecutive_failures')
  const worst = Math.max(0, ...((jobs ?? []) as Array<{ consecutive_failures: number }>)
    .map(j => j.consecutive_failures ?? 0))

  // Critical alerts nobody has responded to. This is the condition that
  // matters most in the entire system: it is the one thing a person opened the
  // app to do, and nothing happened.
  const { data: alerts } = await ctx.db
    .from('res_alerts')
    .select('created_at')
    .eq('severity', 'critical')
    .eq('status', 'active')
    .order('created_at', { ascending: true })

  const critical = (alerts ?? []) as Array<{ created_at: string }>
  const oldestMinutes = critical.length === 0
    ? 0
    : Math.floor((Date.now() - new Date(critical[0].created_at).getTime()) / 60_000)

  const { count: overdue } = await ctx.db
    .from('res_faults')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'escalated')
    .is('acknowledged_at', null)
    .lt('escalated_at', new Date(Date.now() - 8 * HOUR_MS).toISOString())

  // Drift is owned by the drift_check job, which runs daily and knows how to
  // tell a migration apart from a hand-edit. Reading its incident here rather
  // than re-deriving it keeps one definition of "drifted" in the system.
  const { data: driftIncident } = await ctx.db
    .from('res_incidents')
    .select('id')
    .eq('kind', 'schema_drift')
    .is('closed_at', null)
    .maybeSingle()

  return {
    worstConsecutiveFailures: worst,
    criticalAlertsOpen: critical.length,
    oldestCriticalAlertMinutes: oldestMinutes,
    overdueAcknowledgements: overdue ?? 0,
    percentRowsChanged: await percentRowsChangedByAutomation(ctx),
    driftDetected: driftIncident !== null,
  }
}

/**
 * How much of the largest res_ table automation rewrote in 24h.
 *
 * This is the rate-of-change circuit breaker from Layer 8: automation touching
 * a quarter of a table in a day is either a bug or a policy nobody meant to
 * set, and either way it should stop and be looked at. Measured against the
 * largest table rather than summed across all of them, so one big table cannot
 * mask a small one being rewritten wholesale.
 */
async function percentRowsChangedByAutomation(ctx: JobContext): Promise<number> {
  const since = new Date(Date.now() - 24 * HOUR_MS).toISOString()

  const { data: audit } = await ctx.db
    .from('res_audit_log')
    .select('entity')
    .eq('actor_kind', 'job')
    .gte('at', since)

  const rows = (audit ?? []) as Array<{ entity: string }>
  if (rows.length === 0) return 0

  const perEntity = new Map<string, number>()
  for (const r of rows) perEntity.set(r.entity, (perEntity.get(r.entity) ?? 0) + 1)

  let worst = 0
  for (const [entity, changed] of perEntity) {
    const { count } = await ctx.db.from(entity).select('*', { count: 'exact', head: true })
    // An empty table cannot be 30% rewritten in any meaningful sense, and
    // dividing by zero here would make a fresh install look like an emergency.
    if (!count || count === 0) continue
    worst = Math.max(worst, Math.round((changed / count) * 100))
  }
  return worst
}
