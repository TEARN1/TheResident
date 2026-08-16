// expire_traffic_reports — the first job to ship.
//
// Chosen deliberately as job number one: it is archive-only, touches no money,
// no trust and no notifications, and fixes the app's most visible symptom of
// nobody being at the wheel. Crowd-reported hazards currently live forever, so
// the VibeMap slowly fills with potholes that were fixed months ago and
// roadblocks that lifted the same afternoon. Stale safety data is worse than
// no safety data: it teaches people to ignore the map.
//
// Different hazards decay at genuinely different rates, so a single TTL would
// be wrong in both directions — congestion is meaningless after an hour, a
// pothole is real for weeks.

import type { Job, JobContext, JobResult } from '../lib/types.ts'
import { Guard } from '../lib/guard.ts'

/** Hours a report stays live, by type. */
const TTL_HOURS: Record<string, number> = {
  congestion: 2,      // traffic clears; an hour-old jam is not news
  accident: 6,        // scene clearance
  dead_robots: 12,    // outages are usually fixed within a day
  roadblock: 24,      // policing operations rarely outlast a day
  other: 48,
  pothole: 720,       // 30 days — these persist, and reporting one twice is noise
}

const DEFAULT_TTL_HOURS = 48

export const expireTrafficReports: Job = {
  name: 'expire_traffic_reports',
  allowlist: ['res_traffic_reports'],

  async run(ctx: JobContext): Promise<JobResult> {
    const guard = new Guard(ctx.db, {
      jobName: ctx.jobName,
      allowlist: expireTrafficReports.allowlist,
      correlation: ctx.correlation,
      maxRows: ctx.maxRows,
      dryRun: ctx.dryRun,
    })

    // Select the oldest first: if the cap is hit, the most stale data is the
    // part that got cleaned up, and the next run continues from there.
    const { data: rows, error } = await ctx.db
      .from('res_traffic_reports')
      .select('id, report_type, created_at, suburb')
      .is('archived_at', null)
      .order('created_at', { ascending: true })
      .limit(ctx.batchSize)

    if (error) throw new Error(`select failed: ${error.message}`)

    interface ReportRow {
      id: string
      report_type: string
      created_at: string
      suburb: string | null
    }
    const scanned = (rows ?? []) as ReportRow[]

    const now = Date.now()
    const expired = scanned.filter((r: ReportRow) => {
      const ttl = TTL_HOURS[r.report_type] ?? DEFAULT_TTL_HOURS
      const ageHours = (now - new Date(r.created_at).getTime()) / 3_600_000
      return ageHours > ttl
    })

    ctx.log(`scanned ${scanned.length}, ${expired.length} past TTL`)

    if (ctx.dryRun) {
      return {
        rowsScanned: scanned.length,
        rowsAffected: 0,
        wouldAffect: expired.map((r: ReportRow) => ({
          id: r.id,
          type: r.report_type,
          suburb: r.suburb,
          ageHours: Math.round((now - new Date(r.created_at).getTime()) / 3_600_000),
          ttlHours: TTL_HOURS[r.report_type] ?? DEFAULT_TTL_HOURS,
        })),
      }
    }

    for (const r of expired) {
      const ttl = TTL_HOURS[r.report_type] ?? DEFAULT_TTL_HOURS
      const ageHours = Math.round((now - new Date(r.created_at).getTime()) / 3_600_000)

      // Archived, never deleted. A hazard report is evidence about a place;
      // it may matter later even once it stops being current.
      await guard.update(
        'res_traffic_reports',
        r.id,
        { archived_at: new Date().toISOString() },
        'traffic_report.expire',
        `${r.report_type} report is ${ageHours}h old, past its ${ttl}h freshness window`,
        { reversible: true }
      )
    }

    return {
      rowsScanned: scanned.length,
      rowsAffected: guard.rowsAffected,
      detail: {
        byType: expired.reduce((acc: Record<string, number>, r: ReportRow) => {
          const k = r.report_type
          acc[k] = (acc[k] ?? 0) + 1
          return acc
        }, {}),
      },
    }
  },
}
