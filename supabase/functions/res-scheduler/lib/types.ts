// Shared types for the automation dispatcher.
// See docs/SELF-MANAGING.md Layer 2.

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

/** Handle a job receives. Everything it needs, nothing it doesn't. */
export interface JobContext {
  /** service_role client. Bypasses RLS — every write must go through the Guard. */
  db: SupabaseClient
  /** Groups every audit row this run writes, so the whole run can be reverted. */
  correlation: string
  /** Rows per statement. */
  batchSize: number
  /** Hard cap for the whole run. Exceeding it aborts rather than half-committing. */
  maxRows: number
  /** When true: select and report, write nothing. */
  dryRun: boolean
  jobName: string
  log: (msg: string, extra?: Record<string, unknown>) => void
}

export interface JobResult {
  rowsScanned: number
  rowsAffected: number
  /** Rows a dry run WOULD have touched — surfaced to the operator verbatim. */
  wouldAffect?: Array<Record<string, unknown>>
  detail?: Record<string, unknown>
}

export interface Job {
  name: string
  /** Tables this job may touch. The Guard denies everything else. */
  allowlist: string[]
  run: (ctx: JobContext) => Promise<JobResult>
}
