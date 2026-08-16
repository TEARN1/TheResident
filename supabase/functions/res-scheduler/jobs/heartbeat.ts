// heartbeat — a job that does nothing, on purpose.
//
// It exists to soak the substrate before any job that changes data runs on it.
// If the dispatcher, leasing, kill switch, run logging and circuit breaker all
// behave for 48 hours with a job whose only possible failure is in the
// machinery itself, then the machinery is not what breaks later.
//
// Keep it enabled permanently after the soak: a scheduler with no traffic is
// indistinguishable from a scheduler that has silently stopped, and this is
// what makes "no jobs ran last night" visible rather than invisible.

import type { Job, JobContext, JobResult } from '../lib/types.ts'

export const heartbeat: Job = {
  name: 'heartbeat',
  allowlist: [],   // writes nothing, so it needs nothing

  async run(ctx: JobContext): Promise<JobResult> {
    ctx.log('heartbeat ok', { dryRun: ctx.dryRun })
    return {
      rowsScanned: 0,
      rowsAffected: 0,
      detail: { at: new Date().toISOString(), correlation: ctx.correlation },
    }
  },
}
