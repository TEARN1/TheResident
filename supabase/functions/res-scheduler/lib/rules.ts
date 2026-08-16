// The Guard's rules, extracted as pure data and pure functions.
//
// Separated from guard.ts for one reason: guard.ts imports the Supabase client
// from esm.sh and only runs under Deno, which would put these rules beyond the
// reach of the repo's test suite. These are the checks that stand between
// automation and the things it must never touch, so they are the last code in
// the project that should be untested.
//
// No imports. Runs under Deno and tsx alike.

/**
 * Tables no job may write, whatever its declared allowlist says.
 *
 * `profiles` is owned by The Gruvs (CONTRACT.md §2/§3) — The Resident reads
 * eleven trust columns from it and writes none. `res_purchases` and
 * `res_subscriptions` belong to the Paystack webhook: automation expiring an
 * *entitlement* is fine, automation editing a *payment record* is not.
 * `res_audit_log` is append-only and goes through res_audit().
 */
export const FORBIDDEN_TABLES: readonly string[] = [
  'profiles',
  'auth.users',
  'users',
  'res_purchases',
  'res_subscriptions',
  'res_audit_log',
]

/**
 * Columns automation may never set, on any table.
 *
 * The money columns encode CONTRACT.md §6: for peer-to-peer the app is a
 * broker, never a wallet. A job may move a row from 'available' to 'claimed' —
 * a coordination signal — but never touch what something costs. A job able to
 * edit a price could quietly change what two neighbours believe they agreed.
 */
export const FORBIDDEN_COLUMNS: readonly string[] = [
  // Money (peer-to-peer) — CONTRACT.md §6
  'price', 'price_per_seat', 'price_per_day', 'deposit', 'price_estimate',
  'display_price', 'amount', 'amount_zar_cents', 'currency', 'rate_note',
  // Trust — CONTRACT.md §3, Gruvs-owned even where denormalised
  'vibe_score', 'social_integrity_score', 'is_verified', 'badges', 'xp',
  'reputation_score', 'resident_trust_tier',
  // Identity / provenance
  'id', 'user_id', 'owner_id', 'landlord_id', 'tenant_id', 'reporter_id',
  'created_at',
]

const TABLES = new Set(FORBIDDEN_TABLES)
const COLUMNS = new Set(FORBIDDEN_COLUMNS)

export class GuardViolation extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'GuardViolation'
  }
}

/** Throws unless this job may write this table. Fails closed. */
export function assertTableWritable(
  jobName: string, table: string, allowlist: readonly string[]
): void {
  if (TABLES.has(table)) {
    throw new GuardViolation(
      `job ${jobName} attempted to write forbidden table '${table}'`)
  }
  if (!allowlist.includes(table)) {
    throw new GuardViolation(
      `job ${jobName} attempted to write '${table}', which is not in its allowlist ` +
      `(${allowlist.join(', ') || 'empty'})`)
  }
}

/** Throws if a patch sets any column automation may not own. */
export function assertColumnsWritable(
  jobName: string, patch: Record<string, unknown>
): void {
  for (const col of Object.keys(patch)) {
    if (COLUMNS.has(col)) {
      throw new GuardViolation(
        `job ${jobName} attempted to set forbidden column '${col}'. ` +
        `Money, trust and identity columns are never automation's to change.`)
    }
  }
}

/** Throws if a job's declared allowlist is itself illegal. Checked at construction. */
export function assertAllowlistLegal(jobName: string, allowlist: readonly string[]): void {
  for (const t of allowlist) {
    if (TABLES.has(t)) {
      throw new GuardViolation(
        `job ${jobName} declares forbidden table '${t}' in its allowlist`)
    }
  }
}

/**
 * Throws if a write would exceed the run's blast radius.
 *
 * Aborts the whole run rather than committing a partial mass mutation: half an
 * applied bulk change is much harder to reason about and revert than one that
 * never began.
 */
export function assertWithinBudget(
  jobName: string, written: number, adding: number, maxRows: number
): void {
  if (written + adding > maxRows) {
    throw new GuardViolation(
      `job ${jobName} exceeded its blast radius ` +
      `(${written + adding} > ${maxRows} rows)`)
  }
}
