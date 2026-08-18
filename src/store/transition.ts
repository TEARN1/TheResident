// One door for status changes, from the client side.
//
// docs/SELF-MANAGING.md Layer 1 says every status change — human and machine —
// goes through res_transition(), so the rules live in one place and every move
// writes an audit row. Jobs already do this via the Guard. This is the client
// half.
//
// The fallback matters. The migrations that create res_transition_user are
// written but not yet applied, so calling the RPC unconditionally would break
// every status change in the app until they land. Instead this prefers the RPC
// and falls back to the direct update when the function does not exist yet,
// which means the same build works before and after the migration.
//
// REMOVE THE FALLBACK once the migrations are applied everywhere. Until then
// it is the difference between a safe deploy and a broken one.

import { supabase } from '../utils/supabase'

/** Postgres/PostgREST codes meaning "that function isn't there". */
const MISSING_FUNCTION = new Set(['PGRST202', '42883'])

export interface TransitionResult {
  ok: boolean
  /** True when the write went through res_transition (audited, rule-checked). */
  audited: boolean
  error: string | null
}

/**
 * Moves a row to a new status.
 *
 * @param entity   table name, e.g. 'res_room_requests'
 * @param id       row id
 * @param to       target status
 * @param reason   why — becomes res_audit_log.reason, so make it readable
 * @param fallback the direct patch to apply if res_transition_user is absent
 */
export async function transitionStatus(
  entity: string,
  id: string,
  to: string,
  reason: string,
  fallback: Record<string, unknown>
): Promise<TransitionResult> {
  if (!supabase) return { ok: false, audited: false, error: 'Not connected' }

  const { error } = await supabase.rpc('res_transition_user', {
    p_entity: entity,
    p_id: id,
    p_to: to,
    p_reason: reason,
  })

  if (!error) return { ok: true, audited: true, error: null }

  // The function isn't deployed yet — use the old path so the app keeps
  // working, and say so in the console rather than failing silently.
  if (MISSING_FUNCTION.has(error.code ?? '')) {
    console.warn(
      `[transition] res_transition_user not deployed; writing ${entity}.status directly. ` +
      `Apply supabase/migrations to get rule checking and an audit trail.`)

    const { error: fallbackError } = await supabase.from(entity).update(fallback).eq('id', id)
    return fallbackError
      ? { ok: false, audited: false, error: fallbackError.message }
      : { ok: true, audited: false, error: null }
  }

  // A real refusal — an illegal move, or a guard saying no. Surface it: this is
  // the rule working, not a bug to paper over.
  return { ok: false, audited: true, error: error.message }
}
