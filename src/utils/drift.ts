// Detecting when the live database stops matching the migrations.
//
// Layer 5 of docs/SELF-MANAGING.md. Automation acts on assumptions about the
// schema — that a column exists, that RLS is on, that a function is not
// callable by anon. When production drifts from those assumptions, jobs do not
// crash politely; they quietly do the wrong thing to real rows.
//
// The design constraint comes from watching the sibling app: its drift check
// has been failing every run for eleven days across every branch. A check that
// is always red is not a check, it is a wallpaper pattern — everyone has
// stopped reading it, so the day it means something nobody will notice.
//
// Two decisions follow from that:
//
//   1. Compare against an ACCEPTED SNAPSHOT, not an ideal. Applying a
//      migration updates the snapshot, so legitimate change is silent and only
//      unexplained change speaks. A check that fires on every normal migration
//      trains you to ignore it within a week.
//
//   2. Say exactly WHAT changed. "Schema drift detected" is not actionable.
//      "res_faults.confidence disappeared" is.
//
// Pure — the SQL side gathers facts, this decides what they mean.

export interface TableFacts {
  name: string
  columns: string[]
  rlsEnabled: boolean
  policyCount: number
}

export interface FunctionFacts {
  name: string
  /** Whether search_path is pinned (CONTRACT.md §5). */
  searchPathPinned: boolean
  /** Whether anon or PUBLIC can execute it. */
  anonExecutable: boolean
}

export interface SchemaSnapshot {
  tables: TableFacts[]
  functions: FunctionFacts[]
}

export type DriftSeverity = 1 | 2 | 3 | 4

export interface DriftFinding {
  kind: string
  severity: DriftSeverity
  subject: string
  message: string
}

const byName = <T extends { name: string }>(items: T[]): Map<string, T> =>
  new Map(items.map(i => [i.name, i]))

/**
 * Compares the live schema against the accepted snapshot.
 *
 * Severity reflects what automation would DO with the difference, not how
 * surprising it is:
 *
 *   1  a security boundary moved — RLS off, or a function opened to anon
 *   2  something automation depends on vanished — a table or column removed
 *   3  a table lost all its policies, or a function lost its pinned search_path
 *   4  additive change — new tables or columns, which is what a migration
 *      looks like before the snapshot is re-accepted
 */
export function compareSchema(
  accepted: SchemaSnapshot, live: SchemaSnapshot
): DriftFinding[] {
  const findings: DriftFinding[] = []

  const acceptedTables = byName(accepted.tables)
  const liveTables = byName(live.tables)

  for (const [name, was] of acceptedTables) {
    const now = liveTables.get(name)

    if (!now) {
      findings.push({
        kind: 'table_missing', severity: 2, subject: name,
        message: `table ${name} is gone — any job that reads it will fail or, worse, silently find nothing`,
      })
      continue
    }

    // Security first: these are the differences that change who can read data.
    if (was.rlsEnabled && !now.rlsEnabled) {
      findings.push({
        kind: 'rls_disabled', severity: 1, subject: name,
        message: `RLS has been turned OFF on ${name} — it was on when this schema was accepted`,
      })
    }

    if (was.policyCount > 0 && now.policyCount === 0) {
      findings.push({
        kind: 'policies_removed', severity: 3, subject: name,
        message: `${name} had ${was.policyCount} RLS policies and now has none`,
      })
    }

    const missing = was.columns.filter(c => !now.columns.includes(c))
    if (missing.length > 0) {
      findings.push({
        kind: 'columns_missing', severity: 2, subject: name,
        message: `${name} lost column(s): ${missing.join(', ')}`,
      })
    }

    const added = now.columns.filter(c => !was.columns.includes(c))
    if (added.length > 0) {
      findings.push({
        kind: 'columns_added', severity: 4, subject: name,
        message: `${name} gained column(s): ${added.join(', ')}`,
      })
    }
  }

  for (const name of liveTables.keys()) {
    if (!acceptedTables.has(name)) {
      findings.push({
        kind: 'table_added', severity: 4, subject: name,
        message: `new table ${name} — expected after a migration; re-accept the snapshot to silence this`,
      })
    }
  }

  const acceptedFns = byName(accepted.functions)
  const liveFns = byName(live.functions)

  for (const [name, now] of liveFns) {
    const was = acceptedFns.get(name)

    // This is the one that actually happened: res_report_status was granted to
    // PUBLIC while SECURITY DEFINER, and only a weekly advisor email caught it.
    if (now.anonExecutable) {
      findings.push({
        kind: 'function_anon_executable', severity: 1, subject: name,
        message: `${name}() is executable by anon or PUBLIC — CONTRACT.md §5 requires it revoked`,
      })
    }

    if (!now.searchPathPinned) {
      findings.push({
        kind: 'function_search_path_unpinned', severity: 3, subject: name,
        message: `${name}() does not pin search_path, so it can be hijacked by a schema earlier in the path`,
      })
    }

    if (!was) {
      findings.push({
        kind: 'function_added', severity: 4, subject: name,
        message: `new function ${name}() — expected after a migration`,
      })
    }
  }

  for (const name of acceptedFns.keys()) {
    if (!liveFns.has(name)) {
      findings.push({
        kind: 'function_missing', severity: 2, subject: name,
        message: `function ${name}() is gone — callers will fail at runtime, not at deploy`,
      })
    }
  }

  return findings.sort((a, b) => a.severity - b.severity || a.subject.localeCompare(b.subject))
}

/**
 * Whether findings represent real drift, or just a migration that has been
 * applied and not yet re-accepted.
 *
 * Purely-additive change is what a normal migration looks like, and treating
 * it as an incident is exactly how a check becomes wallpaper.
 */
export function isUnexplainedDrift(findings: DriftFinding[]): boolean {
  return findings.some(f => f.severity <= 3)
}

/** One line for the digest, or null when there is genuinely nothing to say. */
export function summariseDrift(findings: DriftFinding[]): string | null {
  if (findings.length === 0) return null

  const serious = findings.filter(f => f.severity <= 3)
  if (serious.length === 0) {
    return `${findings.length} additive schema change(s) pending acceptance — normal after a migration`
  }

  const worst = serious[0]
  const rest = serious.length - 1
  return rest === 0
    ? worst.message
    : `${worst.message} (and ${rest} other drift finding${rest === 1 ? '' : 's'})`
}
