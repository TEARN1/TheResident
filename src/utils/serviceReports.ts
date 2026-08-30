// The Service Desk — reporting an infrastructure fault to whoever owes the
// fix, and measuring how long they take.
//
// See theresident_service_desk_schema.sql for the real access control (RLS +
// res_shares_locality / res_is_provider_admin) and the authoritative response
// targets. The pure functions at the top of this file mirror that SQL for
// client-side UX — showing a clock, sorting by urgency, colouring a badge —
// and are unit tested, since a Postgres policy cannot be exercised from
// `npm test`. They are NOT the security boundary; the DB is.
import { supabase } from './supabase'
import { resilientCall } from './resilientCall'

export type ServiceCategory =
  | 'power' | 'water' | 'sewerage' | 'network' | 'fiber'
  | 'road' | 'waste' | 'streetlight' | 'other'

export type ServiceSeverity = 'low' | 'medium' | 'high' | 'critical'

export type ServiceStatus =
  | 'submitted' | 'acknowledged' | 'in_progress'
  | 'resolved' | 'closed' | 'rejected'

/** How a report is tracking against the response target it was filed under. */
export type SlaState = 'on_time' | 'due_soon' | 'overdue' | 'done'

export interface ServiceReport {
  id: string
  reference: string
  reporterId: string
  providerId: string | null
  providerNameRaw: string | null
  category: ServiceCategory
  title: string
  detail: string | null
  severity: ServiceSeverity
  suburb: string | null
  city: string | null
  lat: number | null
  lon: number | null
  status: ServiceStatus
  targetHours: number
  acknowledgedAt: string | null
  firstResponseAt: string | null
  resolvedAt: string | null
  closedAt: string | null
  createdAt: string
}

export interface ServiceReportUpdate {
  id: string
  reportId: string
  authorId: string | null
  kind: 'comment' | 'status_change' | 'system' | 'corroboration'
  body: string | null
  fromStatus: string | null
  toStatus: string | null
  createdAt: string
}

export interface ProviderPerformance {
  providerId: string
  providerName: string
  openCount: number
  resolvedCount: number
  medianAckHours: number | null
  medianResolveHours: number | null
  oldestOpenDays: number | null
  overdueCount: number
}

export const CATEGORY_LABEL: Record<ServiceCategory, string> = {
  power: 'Electricity', water: 'Water', sewerage: 'Sewerage',
  network: 'Mobile network', fiber: 'Fibre / internet', road: 'Roads',
  waste: 'Refuse', streetlight: 'Street lights', other: 'Something else'
}

/** Statuses where the clock has stopped — nobody still owes a fix. */
const SETTLED: ServiceStatus[] = ['resolved', 'closed', 'rejected']

export const isSettled = (status: ServiceStatus): boolean => SETTLED.includes(status)

/**
 * Mirrors res_default_target_hours(). Kept in sync deliberately rather than
 * fetched, so the form can show "we expect this within 2 days" before the row
 * exists. The DB snapshots its own value at insert time and that is what the
 * report is actually judged against.
 */
export function defaultTargetHours(category: ServiceCategory, severity: ServiceSeverity): number {
  const bySeverity = (critical: number, high: number, medium: number, low: number): number =>
    severity === 'critical' ? critical
      : severity === 'high' ? high
      : severity === 'medium' ? medium
      : low

  switch (category) {
    case 'sewerage': return bySeverity(12, 24, 48, 72)
    case 'water': return bySeverity(12, 24, 48, 72)
    case 'power': return bySeverity(8, 24, 48, 72)
    case 'network': return bySeverity(24, 48, 72, 120)
    case 'fiber': return bySeverity(24, 48, 72, 120)
    case 'road': return bySeverity(24, 72, 168, 336)
    case 'waste': return bySeverity(24, 48, 96, 168)
    case 'streetlight': return bySeverity(48, 96, 168, 336)
    default: return bySeverity(24, 48, 72, 168)
  }
}

/** Whole hours between two instants; negative if `to` precedes `from`. */
export function hoursBetween(from: string, to: string | number = Date.now()): number {
  const start = new Date(from).getTime()
  const end = typeof to === 'number' ? to : new Date(to).getTime()
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 0
  return (end - start) / 3_600_000
}

/** When the provider was expected to have dealt with this, as an ISO string. */
export function targetDeadline(report: Pick<ServiceReport, 'createdAt' | 'targetHours'>): string {
  return new Date(new Date(report.createdAt).getTime() + report.targetHours * 3_600_000).toISOString()
}

/**
 * How a report is tracking. "due_soon" starts at 75% of the target elapsed —
 * early enough to be worth surfacing, late enough not to cry wolf on a report
 * filed an hour ago.
 */
export function slaState(
  report: Pick<ServiceReport, 'createdAt' | 'targetHours' | 'status'>,
  now: number = Date.now()
): SlaState {
  if (isSettled(report.status as ServiceStatus)) return 'done'
  const elapsed = hoursBetween(report.createdAt, now)
  if (elapsed >= report.targetHours) return 'overdue'
  if (elapsed >= report.targetHours * 0.75) return 'due_soon'
  return 'on_time'
}

/** Hours the provider took to first acknowledge, or null if they never have. */
export function hoursToAcknowledge(report: Pick<ServiceReport, 'createdAt' | 'acknowledgedAt'>): number | null {
  return report.acknowledgedAt ? hoursBetween(report.createdAt, report.acknowledgedAt) : null
}

/** Hours from filing to resolution, or null if still open. */
export function hoursToResolve(report: Pick<ServiceReport, 'createdAt' | 'resolvedAt'>): number | null {
  return report.resolvedAt ? hoursBetween(report.createdAt, report.resolvedAt) : null
}

/** Median of a numeric list; null for an empty list. Even counts average the middle pair. */
export function median(values: number[]): number | null {
  const clean = values.filter(v => Number.isFinite(v)).sort((a, b) => a - b)
  if (clean.length === 0) return null
  const mid = Math.floor(clean.length / 2)
  return clean.length % 2 === 0 ? (clean[mid - 1] + clean[mid]) / 2 : clean[mid]
}

/**
 * Durations as a resident would say them out loud: "3 days", "4 hours".
 * Deliberately coarse — "72.4 hours" reads like a machine, and the precision
 * is false anyway given when people actually get around to filing.
 */
export function describeDuration(hours: number | null): string {
  if (hours === null || !Number.isFinite(hours)) return '—'
  const h = Math.max(0, hours)
  if (h < 1) return 'under an hour'
  if (h < 24) {
    const rounded = Math.round(h)
    return `${rounded} hour${rounded === 1 ? '' : 's'}`
  }
  const days = Math.round(h / 24)
  return `${days} day${days === 1 ? '' : 's'}`
}

/** Open reports first, most overdue at the top; settled ones fall to the bottom. */
export function sortByUrgency(reports: ServiceReport[], now: number = Date.now()): ServiceReport[] {
  const rank: Record<SlaState, number> = { overdue: 0, due_soon: 1, on_time: 2, done: 3 }
  return [...reports].sort((a, b) => {
    const byState = rank[slaState(a, now)] - rank[slaState(b, now)]
    if (byState !== 0) return byState
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  })
}

// ── Network layer ──────────────────────────────────────────────────────────
// Everything below talks to Supabase. RLS decides what comes back; these
// functions never filter for security, only for what the screen needs.

interface DbRow { [key: string]: unknown }

function mapReport(row: DbRow): ServiceReport {
  return {
    id: row.id as string,
    reference: row.reference as string,
    reporterId: row.reporter_id as string,
    providerId: (row.provider_id as string | null) ?? null,
    providerNameRaw: (row.provider_name_raw as string | null) ?? null,
    category: row.category as ServiceCategory,
    title: row.title as string,
    detail: (row.detail as string | null) ?? null,
    severity: row.severity as ServiceSeverity,
    suburb: (row.suburb as string | null) ?? null,
    city: (row.city as string | null) ?? null,
    lat: row.lat === null || row.lat === undefined ? null : Number(row.lat),
    lon: row.lon === null || row.lon === undefined ? null : Number(row.lon),
    status: row.status as ServiceStatus,
    targetHours: Number(row.target_hours),
    acknowledgedAt: (row.acknowledged_at as string | null) ?? null,
    firstResponseAt: (row.first_response_at as string | null) ?? null,
    resolvedAt: (row.resolved_at as string | null) ?? null,
    closedAt: (row.closed_at as string | null) ?? null,
    createdAt: row.created_at as string
  }
}

function mapUpdate(row: DbRow): ServiceReportUpdate {
  return {
    id: row.id as string,
    reportId: row.report_id as string,
    authorId: (row.author_id as string | null) ?? null,
    kind: row.kind as ServiceReportUpdate['kind'],
    body: (row.body as string | null) ?? null,
    fromStatus: (row.from_status as string | null) ?? null,
    toStatus: (row.to_status as string | null) ?? null,
    createdAt: row.created_at as string
  }
}

export interface InfraProvider {
  id: string
  name: string
  kind: string
  contactEmail: string | null
  contactPhone: string | null
}

export async function fetchProviders(): Promise<InfraProvider[]> {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('res_infra_providers')
    .select('id, name, kind, contact_email, contact_phone')
    .order('name')
    .limit(200)
  if (error || !data) return []
  return data.map(r => ({
    id: r.id as string,
    name: r.name as string,
    kind: r.kind as string,
    contactEmail: (r.contact_email as string | null) ?? null,
    contactPhone: (r.contact_phone as string | null) ?? null
  }))
}

/** Reports the caller is allowed to see — RLS already scopes this to their area. */
export async function fetchServiceReports(limit = 100): Promise<ServiceReport[]> {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('res_service_reports')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error || !data) return []
  return data.map(mapReport)
}

export async function fetchReportUpdates(reportId: string): Promise<ServiceReportUpdate[]> {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('res_service_report_updates')
    .select('*')
    .eq('report_id', reportId)
    .order('created_at', { ascending: true })
    .limit(200)
  if (error || !data) return []
  return data.map(mapUpdate)
}

/** How many neighbours have said "me too", keyed by report id. */
export async function fetchConfirmationCounts(reportIds: string[]): Promise<Record<string, number>> {
  if (!supabase || reportIds.length === 0) return {}
  const { data, error } = await supabase
    .from('res_service_report_confirmations')
    .select('report_id')
    .in('report_id', reportIds)
  if (error || !data) return {}
  const counts: Record<string, number> = {}
  for (const row of data) {
    const id = String(row.report_id)
    counts[id] = (counts[id] || 0) + 1
  }
  return counts
}

export interface NewServiceReport {
  category: ServiceCategory
  title: string
  detail?: string
  severity: ServiceSeverity
  suburb: string
  city: string
  providerId?: string | null
  providerNameRaw?: string | null
  lat?: number | null
  lon?: number | null
}

export async function submitServiceReport(input: NewServiceReport): Promise<ServiceReport> {
  if (!supabase) throw new Error('Not connected')
  const client = supabase
  return resilientCall(async () => {
    const { data, error } = await client.rpc('res_submit_service_report', {
      p_category: input.category,
      p_title: input.title,
      p_detail: input.detail ?? null,
      p_severity: input.severity,
      p_suburb: input.suburb,
      p_city: input.city,
      p_provider: input.providerId ?? null,
      p_provider_name_raw: input.providerNameRaw ?? null,
      p_lat: input.lat ?? null,
      p_lon: input.lon ?? null
    })
    if (error) throw error
    return mapReport((Array.isArray(data) ? data[0] : data) as DbRow)
  })
  // resilientCall's isRetryableError already excludes 'rate_limit_exceeded'
  // and constraint failures, so a rejection surfaces immediately rather than
  // being retried into an identical second rejection.
}

/** Returns the new corroboration count. */
export async function confirmServiceReport(reportId: string): Promise<number> {
  if (!supabase) throw new Error('Not connected')
  const { data, error } = await supabase.rpc('res_confirm_service_report', { p_report: reportId })
  if (error) throw error
  return Number(data ?? 0)
}

export async function setServiceReportStatus(
  reportId: string,
  status: ServiceStatus,
  note?: string
): Promise<ServiceReport> {
  if (!supabase) throw new Error('Not connected')
  const { data, error } = await supabase.rpc('res_set_service_report_status', {
    p_report: reportId,
    p_status: status,
    p_note: note ?? null
  })
  if (error) throw error
  return mapReport((Array.isArray(data) ? data[0] : data) as DbRow)
}

export async function commentOnServiceReport(reportId: string, body: string): Promise<void> {
  if (!supabase) throw new Error('Not connected')
  const { error } = await supabase.rpc('res_comment_service_report', {
    p_report: reportId,
    p_body: body
  })
  if (error) throw error
}

export async function fetchProviderPerformance(providerId?: string): Promise<ProviderPerformance[]> {
  if (!supabase) return []
  const { data, error } = await supabase.rpc('res_provider_performance', {
    p_provider: providerId ?? null
  })
  if (error || !data) return []
  return (data as DbRow[]).map(r => ({
    providerId: r.provider_id as string,
    providerName: r.provider_name as string,
    openCount: Number(r.open_count ?? 0),
    resolvedCount: Number(r.resolved_count ?? 0),
    medianAckHours: r.median_ack_hours === null ? null : Number(r.median_ack_hours),
    medianResolveHours: r.median_resolve_hours === null ? null : Number(r.median_resolve_hours),
    oldestOpenDays: r.oldest_open_days === null ? null : Number(r.oldest_open_days),
    overdueCount: Number(r.overdue_count ?? 0)
  }))
}
