// res-scheduler — the automation dispatcher. Layer 2 of docs/SELF-MANAGING.md.
//
// One edge function for every scheduled job, so there is one deploy target and
// one log stream rather than eleven. pg_cron calls it with a job name; it owns
// the execution contract and nothing else. Business logic lives in jobs/.
//
// Execution contract, in this exact order:
//   1. Global kill switch          — before anything else, always
//   2. Job enabled? circuit open?
//   3. Acquire lease               — crash-safe; expires on its own
//   4. Open a run row
//   5. Run the job, bounded        — every write via the Guard
//   6. Close the run               — 3 consecutive failures trips the circuit
//
// Steps 1–4 and 6 are res_scheduler_begin/res_scheduler_end in Postgres, so
// the decision to run and the record that it ran are one transaction. A
// function killed mid-run cannot leave a job permanently locked.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import type { Job, JobContext } from './lib/types.ts'
import { heartbeat } from './jobs/heartbeat.ts'
import { expireTrafficReports } from './jobs/expire_traffic_reports.ts'

const JOBS: Record<string, Job> = {
  [heartbeat.name]: heartbeat,
  [expireTrafficReports.name]: expireTrafficReports,
}

const SCHEDULER_SECRET = Deno.env.get('SCHEDULER_SECRET')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

interface RunRequest {
  job: string
  /** Select and report without writing. Every job supports it; use it first. */
  dry_run?: boolean
}

Deno.serve(async (req: Request) => {
  // This endpoint runs as service_role and bypasses RLS. It must never be
  // publicly callable, and it refuses to start at all if the secret is
  // unconfigured rather than falling back to open.
  if (!SCHEDULER_SECRET) {
    console.error('SCHEDULER_SECRET is not set; refusing all requests')
    return json({ error: 'scheduler not configured' }, 503)
  }
  const auth = req.headers.get('Authorization')
  if (auth !== `Bearer ${SCHEDULER_SECRET}`) {
    return json({ error: 'unauthorized' }, 401)
  }

  let body: RunRequest
  try {
    body = await req.json()
  } catch {
    return json({ error: 'invalid json' }, 400)
  }

  const job = JOBS[body.job]
  if (!job) {
    return json({ error: `unknown job '${body.job}'`, known: Object.keys(JOBS) }, 404)
  }

  const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  })

  const dryRun = body.dry_run === true
  const owner = crypto.randomUUID()

  // ── Begin: kill switch, enabled, circuit, lease, run row ─────────────────
  const { data: begun, error: beginError } = await db.rpc('res_scheduler_begin', {
    p_job: job.name,
    p_owner: owner,
    p_dry_run: dryRun,
  })

  if (beginError) {
    console.error(`begin failed for ${job.name}: ${beginError.message}`)
    return json({ error: beginError.message }, 500)
  }

  // No row = the job must not run. The reason is already recorded on res_jobs;
  // this is a normal outcome, not a failure.
  const run = Array.isArray(begun) ? begun[0] : begun
  if (!run) {
    return json({ job: job.name, status: 'skipped' }, 200)
  }

  const ctx: JobContext = {
    db,
    correlation: run.correlation,
    batchSize: run.batch_size,
    maxRows: run.max_rows,
    dryRun,
    jobName: job.name,
    log: (msg, extra) =>
      console.log(JSON.stringify({ job: job.name, correlation: run.correlation, msg, ...extra })),
  }

  const started = Date.now()

  try {
    const result = await job.run(ctx)

    // 'partial' means the run hit its cap and there is more to do — the next
    // scheduled tick continues. It is deliberately distinct from 'ok' so a job
    // that never finishes its backlog is visible rather than looking healthy.
    const status = result.rowsScanned >= ctx.maxRows ? 'partial' : 'ok'

    await db.rpc('res_scheduler_end', {
      p_run_id: run.run_id,
      p_status: status,
      p_rows_scanned: result.rowsScanned,
      p_rows_affected: result.rowsAffected,
      p_detail: { ...result.detail, ms: Date.now() - started, dry_run: dryRun,
                  would_affect: result.wouldAffect },
    })

    return json({
      job: job.name,
      status,
      dry_run: dryRun,
      correlation: run.correlation,
      rows_scanned: result.rowsScanned,
      rows_affected: result.rowsAffected,
      would_affect: result.wouldAffect,
      ms: Date.now() - started,
    }, 200)

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`job ${job.name} failed: ${message}`)

    // Always close the run. A run row stuck in 'running' would hold its lease
    // until expiry and make the failure look like a hang instead of an error.
    await db.rpc('res_scheduler_end', {
      p_run_id: run.run_id,
      p_status: 'failed',
      p_detail: { ms: Date.now() - started, dry_run: dryRun },
      p_error: message,
    })

    return json({ job: job.name, status: 'failed', error: message }, 500)
  }
})

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}
