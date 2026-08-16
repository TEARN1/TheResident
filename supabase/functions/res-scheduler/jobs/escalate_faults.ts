// escalate_faults — the job that turns neighbours into evidence.
//
// Reads the vouches on every open fault, applies the scoring rules from
// src/utils/faults.ts, and either escalates to the provider or records exactly
// what is still missing. The "still missing" half matters as much as the
// escalation: "waiting for 2 more neighbours to confirm" tells people how to
// help, and that is what makes the mechanism work at all.
//
// Runs every 5 minutes. An outage is not an emergency for the first few
// minutes, but a downed conductor is, and the danger path escalates on the
// first report — so the loop must be tight.

import type { Job, JobContext, JobResult } from '../lib/types.ts'
import { Guard } from '../lib/guard.ts'
import {
  escalationDecision,
  summariseEvidence,
  faultPriority,
  faultConfidence,
  resolutionConfirmed,
  DEFAULT_POLICY,
  SECTOR_OF,
} from '../../../../src/utils/faults.ts'
import type { EscalationPolicy, FaultKind, Vouch } from '../../../../src/utils/faults.ts'

interface VouchRow {
  fault_id: string
  user_id: string
  kind: Vouch['kind']
  lat: number
  lon: number
  created_at: string
}

interface FaultRow {
  id: string
  kind: FaultKind
  sector: string
  status: string
  lat: number
  lon: number
  suburb: string | null
  reported_by: string
  provider_id: string | null
  created_at: string
  last_vouch_at: string
  resolved_claimed_at: string | null
  false_closure_count: number
}

export const escalateFaults: Job = {
  name: 'escalate_faults',
  allowlist: ['res_faults'],

  async run(ctx: JobContext): Promise<JobResult> {
    const guard = new Guard(ctx.db, {
      jobName: ctx.jobName,
      allowlist: escalateFaults.allowlist,
      correlation: ctx.correlation,
      maxRows: ctx.maxRows,
      dryRun: ctx.dryRun,
    })

    const policy = await loadPolicy(ctx)

    const { data: faults, error } = await ctx.db
      .from('res_faults')
      .select('id, kind, sector, status, lat, lon, suburb, reported_by, provider_id, ' +
              'created_at, last_vouch_at, resolved_claimed_at, false_closure_count')
      .is('archived_at', null)
      .in('status', ['reported', 'corroborated', 'escalated', 'resolved'])
      .order('created_at', { ascending: true })
      .limit(ctx.batchSize)

    if (error) throw new Error(`select faults: ${error.message}`)

    const rows = (faults ?? []) as FaultRow[]
    if (rows.length === 0) return { rowsScanned: 0, rowsAffected: 0 }

    // One query for every vouch across the batch, rather than one per fault.
    const { data: vouchRows, error: vErr } = await ctx.db
      .from('res_fault_vouches')
      .select('fault_id, user_id, kind, lat, lon, created_at')
      .in('fault_id', rows.map(f => f.id))

    if (vErr) throw new Error(`select vouches: ${vErr.message}`)

    // Reputation weighting, in one lookup for the same reason.
    const rawVouches = (vouchRows ?? []) as VouchRow[]
    const userIds = [...new Set(rawVouches.map(v => v.user_id))]
    const reputation = await loadReputation(ctx, userIds)

    const byFault = new Map<string, Vouch[]>()
    for (const v of rawVouches) {
      const list = byFault.get(v.fault_id) ?? []
      list.push({
        userId: v.user_id,
        kind: v.kind,
        at: { lat: v.lat, lon: v.lon },
        createdAt: v.created_at,
        reputationScore: reputation.get(v.user_id),
      })
      byFault.set(v.fault_id, list)
    }

    const now = Date.now()
    const wouldAffect: Array<Record<string, unknown>> = []
    let escalated = 0, lapsed = 0, verified = 0, reopened = 0

    for (const f of rows) {
      const vouches = byFault.get(f.id) ?? []
      const at = { lat: f.lat, lon: f.lon }
      const evidence = summariseEvidence(vouches, at, policy, now)
      const decision = escalationDecision({ kind: f.kind, at }, vouches, policy, now)
      const confidence = faultConfidence(evidence, f.last_vouch_at, now)
      const priority = faultPriority({ kind: f.kind, createdAt: f.created_at }, evidence, now)

      // Always refresh the cached counters, even when no transition follows —
      // residents watching a fault card need to see the count climbing, which
      // is what prompts the next neighbour to confirm.
      if (!ctx.dryRun) {
        await guard.update('res_faults', f.id, {
          distinct_reporters: evidence.distinctReporters,
          affected_count: evidence.affectedCount,
          dispute_count: evidence.disputeCount,
          weighted_score: evidence.weightedScore,
          confidence,
          priority,
        }, 'fault.rescore', decision.reason, { reversible: false })
      }

      // ── resolved → verified, or reopened ────────────────────────────────
      if (f.status === 'resolved') {
        if (resolutionConfirmed(evidence)) {
          await transition(guard, ctx, f, 'verified',
            `${evidence.resolvedCount} residents confirm it is genuinely fixed`,
            wouldAffect)
          verified++
        } else if (evidence.affectedCount >= 3 && evidence.affectedCount > evidence.resolvedCount) {
          // A provider claimed this fixed and residents say otherwise. Reopen,
          // and record it: false_closure_count is the most valuable number in
          // the table, because it is evidenced rather than alleged.
          await transition(guard, ctx, f, 'escalated',
            `reopened — ${evidence.affectedCount} residents report it is still broken ` +
            `after it was marked resolved`, wouldAffect)
          if (!ctx.dryRun) {
            await guard.update('res_faults', f.id, {
              false_closure_count: f.false_closure_count + 1,
              escalated_at: new Date().toISOString(),
            }, 'fault.false_closure',
               'resolution claim contradicted by residents on the ground',
               { reversible: false })
          }
          reopened++
        }
        continue
      }

      // ── escalate ────────────────────────────────────────────────────────
      if (decision.escalate && (f.status === 'reported' || f.status === 'corroborated')) {
        const provider = f.provider_id ?? await routeToProvider(ctx, f)
        await transition(guard, ctx, f, 'escalated', decision.reason, wouldAffect)

        if (!ctx.dryRun) {
          await guard.update('res_faults', f.id, {
            escalated_at: new Date().toISOString(),
            provider_id: provider,
          }, 'fault.escalate', decision.reason, { reversible: true })

          await notifyFault(guard, ctx, f, evidence.distinctReporters)
        }
        escalated++
        continue
      }

      // ── partial corroboration ───────────────────────────────────────────
      if (!decision.escalate && f.status === 'reported' && evidence.distinctReporters >= 2) {
        await transition(guard, ctx, f, 'corroborated', decision.reason, wouldAffect)
        continue
      }

      // ── lapse ───────────────────────────────────────────────────────────
      // A fault nobody has re-confirmed has almost certainly been fixed
      // quietly, and a map full of phantom outages teaches people to ignore it.
      const hoursSinceVouch = (now - new Date(f.last_vouch_at).getTime()) / 3_600_000
      if (confidence < 0.05 && hoursSinceVouch > 72 &&
          (f.status === 'reported' || f.status === 'corroborated')) {
        await transition(guard, ctx, f, 'lapsed',
          `no confirmation in ${Math.round(hoursSinceVouch)}h; confidence decayed to ${confidence}`,
          wouldAffect)
        lapsed++
      }
    }

    return {
      rowsScanned: rows.length,
      rowsAffected: guard.rowsAffected,
      wouldAffect: ctx.dryRun ? wouldAffect : undefined,
      detail: { escalated, lapsed, verified, reopened },
    }
  },
}

async function transition(
  guard: Guard, ctx: JobContext, f: FaultRow, to: string, reason: string,
  wouldAffect: Array<Record<string, unknown>>
): Promise<void> {
  if (ctx.dryRun) {
    wouldAffect.push({ id: f.id, kind: f.kind, from: f.status, to, reason })
    return
  }
  await guard.transition('res_faults', f.id, to, reason)
}

/**
 * Routes a fault to a provider covering its sector. Deliberately simple: match
 * on sector, prefer one already handling faults in this suburb.
 *
 * A null result is not a failure. Most sectors will have no registered
 * provider for a long time, and the fault stays escalated and publicly visible
 * regardless — the neighbourhood can see it, count it, and point at it. The
 * provider account is an upgrade, never a precondition.
 */
async function routeToProvider(ctx: JobContext, f: FaultRow): Promise<string | null> {
  const { data } = await ctx.db
    .from('res_infra_providers')
    .select('id, kind')
    .eq('kind', f.sector)
    .limit(1)
  return (data?.[0]?.id as string) ?? null
}

/** Tells the people who vouched that their fault has been sent onward. */
async function notifyFault(
  guard: Guard, ctx: JobContext, f: FaultRow, reporters: number
): Promise<void> {
  const { data } = await ctx.db
    .from('res_fault_vouches')
    .select('user_id')
    .eq('fault_id', f.id)
    .in('kind', ['affected', 'witnessed'])

  const vouchers = (data ?? []) as Array<{ user_id: string }>
  const label = f.kind.replace(/_/g, ' ')
  for (const v of vouchers) {
    await guard.notify(
      v.user_id,
      'res_status',
      'Your report was escalated',
      `${reporters} neighbours confirmed the ${label}${f.suburb ? ` in ${f.suburb}` : ''}. ` +
      `It has been sent to the provider.`,
      `fault:${f.id}:escalated:${v.user_id}`,   // once per person per fault, ever
      { fault_id: f.id, kind: f.kind }
    )
  }
}

async function loadPolicy(ctx: JobContext): Promise<EscalationPolicy> {
  const { data } = await ctx.db
    .from('res_policies')
    .select('params, enabled')
    .eq('key', 'faults.escalation')
    .maybeSingle()

  if (!data?.enabled || !data?.params) return DEFAULT_POLICY
  // Fall back per-field: a partial or malformed policy row must not silently
  // drop a threshold to undefined and escalate everything.
  return { ...DEFAULT_POLICY, ...(data.params as Partial<EscalationPolicy>) }
}

async function loadReputation(
  ctx: JobContext, userIds: string[]
): Promise<Map<string, number>> {
  if (userIds.length === 0) return new Map()
  const { data } = await ctx.db
    .from('res_reputation')
    .select('user_id, score')
    .in('user_id', userIds)
  const rows = (data ?? []) as Array<{ user_id: string; score: number }>
  return new Map(rows.map(r => [r.user_id, r.score]))
}

/** Referenced so the sector map stays in sync with the database check constraint. */
export const KNOWN_SECTORS = new Set(Object.values(SECTOR_OF))
