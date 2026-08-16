// The Guard — Layer 7 of docs/SELF-MANAGING.md.
//
// THIS IS SECURITY-CRITICAL CODE. Review it like src/utils/security.ts.
//
// Scheduled jobs run as service_role, which bypasses Row Level Security
// entirely. The moment the app automates a write, RLS stops being the thing
// that protects that path — every policy in the database becomes irrelevant to
// it. The Guard is what replaces RLS for automated writes. There is no second
// path: if a job writes without going through here, the protection does not
// exist for that write.
//
// It fails closed. Every check refuses on doubt rather than permitting.

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

import {
  assertTableWritable,
  assertColumnsWritable,
  assertAllowlistLegal,
  assertWithinBudget,
  GuardViolation,
} from './rules.ts'

export { GuardViolation }

export interface GuardConfig {
  jobName: string
  allowlist: string[]
  correlation: string
  maxRows: number
  dryRun: boolean
}

export class Guard {
  private rowsWritten = 0

  constructor(private db: SupabaseClient, private cfg: GuardConfig) {
    // A job whose allowlist names a forbidden table is a configuration error,
    // and it is caught at construction — before it can write anything at all.
    assertAllowlistLegal(cfg.jobName, cfg.allowlist)
  }

  get rowsAffected(): number {
    return this.rowsWritten
  }

  private assertTable(table: string): void {
    assertTableWritable(this.cfg.jobName, table, this.cfg.allowlist)
  }

  private assertColumns(patch: Record<string, unknown>): void {
    assertColumnsWritable(this.cfg.jobName, patch)
  }

  private assertBudget(n: number): void {
    assertWithinBudget(this.cfg.jobName, this.rowsWritten, n, this.cfg.maxRows)
  }

  /**
   * A status change. Routed through res_transition() so that legality, the
   * guard for the transition, and the audit row are all enforced inside one
   * database transaction — a write with no audit row is not possible.
   */
  async transition(
    table: string, id: string, to: string, reason: string
  ): Promise<boolean> {
    this.assertTable(table)
    this.assertBudget(1)

    if (this.cfg.dryRun) {
      this.rowsWritten += 1
      return true
    }

    const { data, error } = await this.db.rpc('res_transition', {
      p_entity: table,
      p_id: id,
      p_to: to,
      p_reason: reason,
      p_actor_kind: 'job',
      p_job: this.cfg.jobName,
      p_correlation: this.cfg.correlation,
      p_tier: 'auto',
    })

    if (error) throw new GuardViolation(`transition ${table}.${id} -> ${to}: ${error.message}`)
    this.rowsWritten += 1
    return (data as { changed?: boolean })?.changed ?? false
  }

  /**
   * A non-status field update (archiving, clearing a boost). Writes the row
   * and its audit entry; the audit write is not optional and not skippable.
   */
  async update(
    table: string, id: string, patch: Record<string, unknown>,
    action: string, reason: string, opts: { reversible?: boolean } = {}
  ): Promise<void> {
    this.assertTable(table)
    this.assertColumns(patch)
    this.assertBudget(1)

    if (this.cfg.dryRun) {
      this.rowsWritten += 1
      return
    }

    // Read the prior value so the audit entry can carry a real before-state —
    // without it, res_revert() has nothing to restore.
    const before = await this.db.from(table).select(Object.keys(patch).join(',')).eq('id', id).maybeSingle()

    const { error } = await this.db
      .from(table)
      .update({ ...patch, managed_by: this.cfg.jobName })
      .eq('id', id)

    if (error) throw new GuardViolation(`update ${table}.${id}: ${error.message}`)

    const { error: auditError } = await this.db.rpc('res_audit', {
      p_actor_kind: 'job',
      p_action: action,
      p_entity: table,
      p_entity_id: id,
      p_reason: reason,
      p_before: before.data ?? null,
      p_after: patch,
      p_job_name: this.cfg.jobName,
      p_correlation: this.cfg.correlation,
      p_tier: 'auto',
      p_reversible: opts.reversible ?? true,
      p_reverse_spec: before.data ?? null,
    })

    // A write we cannot account for is worse than a write that didn't happen.
    if (auditError) {
      throw new GuardViolation(
        `audit write failed for ${table}.${id} (${auditError.message}) — ` +
        `the row was modified but is now unaccounted for`)
    }

    this.rowsWritten += 1
  }

  /**
   * A notification, deduplicated by effect key. Without the key, a retried job
   * re-notifies everyone it already notified — the single fastest way to make
   * a self-managing app feel broken to its users.
   */
  async notify(
    recipientId: string, type: string, title: string, body: string,
    effectKey: string, data: Record<string, unknown> = {}
  ): Promise<boolean> {
    this.assertBudget(1)
    if (this.cfg.dryRun) return false

    const { error: keyError } = await this.db
      .from('res_effect_keys')
      .insert({ key: effectKey })

    // Conflict = already sent on an earlier run. Not an error; the point.
    if (keyError) {
      if (keyError.code === '23505') return false
      throw new GuardViolation(`effect key ${effectKey}: ${keyError.message}`)
    }

    const { error } = await this.db.from('notifications').insert({
      recipient_id: recipientId,
      type,
      title,
      body,
      data: { ...data, automated: true, job: this.cfg.jobName },
    })

    if (error) throw new GuardViolation(`notify ${recipientId}: ${error.message}`)
    return true
  }
}
