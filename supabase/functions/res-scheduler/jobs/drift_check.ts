// drift_check — has the live database stopped matching the migrations?
//
// Layer 5 of docs/SELF-MANAGING.md. Compares the live schema against the
// accepted snapshot and opens an incident naming exactly what changed.
//
// The thing this job is designed NOT to do is cry wolf. Applying a migration
// re-accepts the snapshot, so a normal deploy produces silence; only change
// nobody recorded speaks. Additive differences (a new table, a new column) are
// reported at severity 4 and never open an incident, because that is what a
// migration looks like in the window before acceptance.

import type { Job, JobContext, JobResult } from '../lib/types.ts'
import { compareSchema, isUnexplainedDrift, summariseDrift } from '../../../../src/utils/drift.ts'
import type { SchemaSnapshot } from '../../../../src/utils/drift.ts'

export const driftCheck: Job = {
  name: 'drift_check',
  allowlist: [],   // reads schema metadata, writes only incidents

  async run(ctx: JobContext): Promise<JobResult> {
    const { data: liveRaw, error: liveErr } = await ctx.db.rpc('res_schema_facts')
    if (liveErr) throw new Error(`read live schema: ${liveErr.message}`)

    const { data: acceptedRaw, error: accErr } = await ctx.db.rpc('res_accepted_schema')
    if (accErr) throw new Error(`read accepted schema: ${accErr.message}`)

    // No baseline yet means the snapshot migration has not run. That is a
    // setup gap, not drift, and saying so is more useful than comparing
    // against nothing and declaring everything new.
    if (!acceptedRaw) {
      ctx.log('no accepted schema baseline — run migration 20260815001700')
      return {
        rowsScanned: 0, rowsAffected: 0,
        detail: { skipped: 'no accepted baseline' },
      }
    }

    const live = liveRaw as SchemaSnapshot
    const accepted = acceptedRaw as SchemaSnapshot
    const findings = compareSchema(accepted, live)
    const unexplained = isUnexplainedDrift(findings)
    const summary = summariseDrift(findings)

    ctx.log('drift compared', {
      findings: findings.length,
      unexplained,
      tables: live.tables.length,
      functions: live.functions.length,
    })

    if (ctx.dryRun) {
      return {
        rowsScanned: live.tables.length + live.functions.length,
        rowsAffected: 0,
        wouldAffect: findings.map(f => ({
          severity: f.severity, kind: f.kind, subject: f.subject, message: f.message,
        })),
        detail: { summary, unexplained },
      }
    }

    if (unexplained) {
      // Severity comes from the worst finding, so an RLS flip pages and a
      // missing column does not.
      const worst = findings[0]
      await ctx.db.rpc('res_open_incident', {
        p_kind: 'schema_drift',
        p_severity: worst.severity,
        p_message: summary ?? 'schema drift detected',
        p_detail: { findings: findings.slice(0, 20) },
      })
    } else {
      // Recovered, or only additive change. Close it so the digest reflects
      // now rather than the worst moment of the week.
      await ctx.db.rpc('res_close_incident', { p_kind: 'schema_drift', p_auto: true })
    }

    return {
      rowsScanned: live.tables.length + live.functions.length,
      rowsAffected: unexplained ? 1 : 0,
      detail: {
        summary,
        unexplained,
        bySeverity: findings.reduce((acc: Record<string, number>, f) => {
          const k = `sev${f.severity}`
          acc[k] = (acc[k] ?? 0) + 1
          return acc
        }, {}),
      },
    }
  },
}
