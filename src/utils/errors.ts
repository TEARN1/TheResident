// One place to unwrap a caught error into a real, user-safe message.
// Supabase's PostgrestError is a plain object, not an Error instance, so
// `String(err)` on one produces the useless literal "[object Object]" —
// this was previously re-solved ad hoc in VibeMap.tsx's submitClosureReport
// and done wrong (String(err)) in store/index.ts's sync failure handler.
// Extracted here so every catch site behaves the same way.

/** Pulls a readable message out of anything a catch block might receive. */
export function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message
  if (err && typeof err === 'object' && 'message' in err && typeof (err as { message: unknown }).message === 'string') {
    return (err as { message: string }).message
  }
  return String(err)
}

/**
 * Maps a raw DB/network error to a message safe to show a user — never a raw
 * Postgres error, RLS policy name, or table name, which is exactly the kind
 * of internal detail Batch 14 (security) flags as an info-disclosure risk.
 */
export function unwrapDbError(err: unknown): string {
  const raw = getErrorMessage(err).toLowerCase()

  if (raw.includes('row-level security') || raw.includes('permission denied') || raw.includes('rls')) {
    return "You don't have permission to do that."
  }
  if (raw.includes('duplicate key') || raw.includes('already exists')) {
    return 'That already exists.'
  }
  if (raw.includes('violates foreign key')) {
    return "That record couldn't be found — it may have been removed."
  }
  if (raw.includes('rate_limited') || raw.includes('rate limit')) {
    return 'Too many attempts — try again shortly.'
  }
  if (raw.includes('network') || raw.includes('fetch failed') || raw.includes('timeout') || raw.includes('offline')) {
    return 'Network issue — please try again.'
  }
  return 'Something went wrong. Please try again.'
}
