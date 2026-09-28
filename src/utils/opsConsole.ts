// The Ops Console's data: every scheduled job with its on/off switch, the
// findings the system raised about itself, and the daily numbers.
//
// All three calls are admin-gated RPCs (section 49): they check
// res_is_platform_admin() server-side, and the tables behind them have no
// client grants at all. Nothing here is the security boundary.
import { supabase } from './supabase'

export type Severity = 'info' | 'warn' | 'critical'

export interface OpsJob {
  key: string
  description: string
  schedule: 'nightly' | 'hourly' | 'minutely'
  autonomy: number
  enabled: boolean
  maxAffected: number | null
  disabledReason: string | null
  lastRun: string | null
  lastOk: boolean | null
  lastAffected: number | null
  lastError: string | null
  failures48h: number
}

export interface OpsFinding {
  id: string
  source: string
  severity: Severity
  summary: string
  details: Record<string, unknown>
  firstSeen: string
  lastSeen: string
  occurrences: number
}

export interface OpsMetricsDay {
  day: string
  residentsTotal: number
  residentsNew: number
  listingsOpen: number
  alertsRaised: number
  alertsUnanswered: number
  medianFirstResponseSecs: number | null
  reportsOpen: number
  notificationsSent: number
  clientErrors: number
}

export interface OpsOverview {
  jobs: OpsJob[]
  findings: OpsFinding[]
  metrics: OpsMetricsDay[]
  lastNightlyRun: string | null
}

type Row = Record<string, unknown>

export function toOverview(raw: Row | null): OpsOverview {
  const r = raw || {}
  return {
    jobs: ((r.jobs as Row[]) || []).map(j => ({
      key: j.key as string,
      description: j.description as string,
      schedule: j.schedule as OpsJob['schedule'],
      autonomy: j.autonomy as number,
      enabled: !!j.enabled,
      maxAffected: (j.max_affected as number | null) ?? null,
      disabledReason: (j.disabled_reason as string | null) ?? null,
      lastRun: (j.last_run as string | null) ?? null,
      lastOk: (j.last_ok as boolean | null) ?? null,
      lastAffected: (j.last_affected as number | null) ?? null,
      lastError: (j.last_error as string | null) ?? null,
      failures48h: (j.failures_48h as number) || 0
    })),
    findings: ((r.findings as Row[]) || []).map(f => ({
      id: f.id as string,
      source: f.source as string,
      severity: f.severity as Severity,
      summary: f.summary as string,
      details: (f.details as Record<string, unknown>) || {},
      firstSeen: f.first_seen as string,
      lastSeen: f.last_seen as string,
      occurrences: (f.occurrences as number) || 1
    })),
    metrics: ((r.metrics as Row[]) || []).map(m => ({
      day: m.day as string,
      residentsTotal: m.residents_total as number,
      residentsNew: m.residents_new as number,
      listingsOpen: m.listings_open as number,
      alertsRaised: m.alerts_raised as number,
      alertsUnanswered: m.alerts_unanswered as number,
      medianFirstResponseSecs: (m.median_first_response_secs as number | null) ?? null,
      reportsOpen: m.reports_open as number,
      notificationsSent: m.notifications_sent as number,
      clientErrors: m.client_errors as number
    })),
    lastNightlyRun: (r.last_nightly_run as string | null) ?? null
  }
}

export async function fetchOpsOverview(): Promise<OpsOverview | null> {
  if (!supabase) return null
  const { data, error } = await supabase.rpc('res_ops_overview')
  if (error) throw error
  return toOverview(data as Row)
}

export async function setJobEnabled(key: string, enabled: boolean): Promise<void> {
  if (!supabase) return
  const { error } = await supabase.rpc('res_ops_set_job_enabled', { p_key: key, p_enabled: enabled })
  if (error) throw error
}

export async function acknowledgeFinding(id: string): Promise<void> {
  if (!supabase) return
  const { error } = await supabase.rpc('res_ops_ack_finding', { p_id: id })
  if (error) throw error
}

// The nightly run is scheduled for 02:20. Anything older than a day and a
// bit means it has stopped, however green each job's last result looks.
export function nightlyRunIsStale(lastRun: string | null, now = Date.now()): boolean {
  if (!lastRun) return true
  return now - new Date(lastRun).getTime() > 26 * 60 * 60 * 1000
}
