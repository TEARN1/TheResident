import { supabase } from './supabase'
import { withTimeout } from './resilientCall'

/**
 * The content-complaint review queue.
 *
 * WHY THIS FILE EXISTS. res_reports has existed all along, with a full status
 * workflow, and residents could file into it. Nothing in the codebase ever
 * READ it — there was no queue, no reviewer, and no way to act on a
 * complaint. Meanwhile the app told every reporter "it is hidden from you now
 * and will be reviewed", which was untrue on both counts.
 *
 * For a platform carrying residents' statements about named landlords and
 * service providers, being able to act on a complaint is the difference
 * between a defensible position and an indefensible one. A process nobody can
 * execute is not a process.
 *
 * The server is the security boundary: res_pending_reports and
 * res_resolve_report both raise admin_required for anyone who is not a
 * platform admin, verified against the live database. Nothing here is trusted.
 */

export type ReportSubjectType = 'listing' | 'market_item' | 'notice' | 'gossip_post'

export interface PendingReport {
  subjectType: ReportSubjectType
  subjectId: string
  reportCount: number
  reasons: string[]
  firstReportedAt: string
  lastReportedAt: string
  details: string[]
  currentlyHidden: boolean
}

/** How the subject type reads to a person, rather than to the database. */
export function describeSubject(t: string): string {
  switch (t) {
    case 'listing': return 'Room listing'
    case 'market_item': return 'Marketplace item'
    case 'notice': return 'Notice'
    case 'gossip_post': return 'Feed post'
    default: return t
  }
}

/**
 * Complaints about the same thing from different people are the signal worth
 * acting on. One person objecting is common and often says more about the
 * objector; several independent people usually does not.
 */
export function severityOf(r: Pick<PendingReport, 'reportCount' | 'reasons'>): 'high' | 'medium' | 'low' {
  // A safety complaint is treated as serious on its own — waiting for a
  // second reporter before looking at "unsafe" is the wrong trade.
  if (r.reasons.some(x => x === 'unsafe' || x === 'scam')) return 'high'
  if (r.reportCount >= 3) return 'high'
  if (r.reportCount === 2) return 'medium'
  return 'low'
}

export async function fetchPendingReports(limit = 100): Promise<PendingReport[]> {
  if (!supabase) return []
  const client = supabase
  const { data, error } = await withTimeout(
    client.rpc('res_pending_reports', { p_limit: limit }), 15000, 'report queue')
  if (error) throw error
  return (data ?? []).map((r: Record<string, unknown>) => ({
    subjectType: String(r.subject_type) as ReportSubjectType,
    subjectId: String(r.subject_id),
    reportCount: Number(r.report_count ?? 0),
    reasons: (r.reasons as string[]) ?? [],
    firstReportedAt: String(r.first_reported_at ?? ''),
    lastReportedAt: String(r.last_reported_at ?? ''),
    details: (r.details as string[]) ?? [],
    currentlyHidden: Boolean(r.currently_hidden)
  }))
}

export async function resolveReport(
  subjectType: string,
  subjectId: string,
  action: 'hide' | 'restore' | 'dismiss',
  note?: string
): Promise<void> {
  if (!supabase) throw new Error('Not connected')
  const client = supabase
  const { error } = await withTimeout(
    client.rpc('res_resolve_report', {
      p_subject_type: subjectType,
      p_subject_id: subjectId,
      p_action: action,
      p_note: note ?? null
    }), 15000, 'moderation decision')
  if (error) throw error
}
