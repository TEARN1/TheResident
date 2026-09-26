import test from 'node:test'
import assert from 'node:assert'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

// FROM 30 OCTOBER, A NEW TABLE IS INVISIBLE UNTIL IT IS GRANTED.
//
// Supabase is changing what `create table` gives you. Today a new table in
// `public` inherits default privileges, so it is reachable over the API the
// moment it exists — several tables in this schema rely on exactly that and
// never say so. From 30 October 2026 new tables get nothing by default and
// need an explicit GRANT. Supabase's own notice is clear that tables created
// BEFORE that date keep working, and the live database agrees: 67 of the 69
// `res_` tables are readable by `authenticated` today, and the two that are
// not are locked down on purpose.
//
// So this is not a migration. Nothing existing breaks. What breaks is the
// next table someone adds, and it breaks in the worst way this project has:
// silently. RLS passes, the insert succeeds server-side, and the client sees
// an empty result with no error — the same shape as the 33 tables already
// sitting RLS-enabled-with-no-policy, except arriving on a date rather than
// by neglect.
//
// A comment would not survive that. This does.

const ROOT = join(import.meta.dirname, '..', '..')
const SQL = readdirSync(ROOT).filter(f => f.startsWith('theresident_') && f.endsWith('.sql'))

/**
 * Tables that are deliberately unreachable over the API, with the reason.
 * Both are written only by `security definer` functions, so granting them
 * would widen access rather than restore it. Verified against the live
 * database: these are precisely the two `res_` tables `authenticated` cannot
 * select from.
 */
const INTENTIONALLY_UNGRANTED: Record<string, string> = {
  res_client_errors: 'written by res_log_client_error(); readable only through client_error_status()',
  res_maintenance_runs: 'written by the maintenance job; read through maintenance_status()',
}

function sqlText(): string {
  return SQL.map(f => readFileSync(join(ROOT, f), 'utf8')).join('\n')
      .replace(/--[^\n]*/g, '')
}

test('every res_ table in the schema files is created somewhere', () => {
  // Guards the guard: if the create-table syntax ever changes shape, the
  // scan below would silently find nothing and pass for the wrong reason.
  const created = [...sqlText().matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?(res_\w+)/gi)]
  assert.ok(created.length >= 60,
    `only found ${created.length} res_ table definitions; the create-table scan has probably stopped matching`)
})

test('every new res_ table is granted, or listed as deliberately not', () => {
  const text = sqlText()
  const created = new Set([...text.matchAll(
    /create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?(res_\w+)/gi)].map(m => m[1].toLowerCase()))

  // A grant counts whether it names the table directly or arrives through an
  // `execute` string, which this schema uses for conditional grants.
  const granted = new Set([...text.matchAll(
    /grant\s+[^;]*?\bon\s+(?:table\s+)?(?:public\.)?(res_\w+)\s+to\b/gi)].map(m => m[1].toLowerCase()))

  const missing = [...created]
    .filter(t => !granted.has(t) && !(t in INTENTIONALLY_UNGRANTED))
    .sort()

  assert.deepEqual(missing, [],
    'From 30 October a table in `public` is unreachable over the API until it is granted. ' +
    'These are created with no grant and are not on the deliberate list, so they will read as empty ' +
    'with no error: ' + missing.join(', ') +
    '\nAdd `grant select, insert, update, delete on public.<table> to authenticated;` (narrow it to what ' +
    'the table actually needs), or add it to INTENTIONALLY_UNGRANTED with the reason.')
})

test('the deliberate exemptions each carry a reason', () => {
  for (const [table, reason] of Object.entries(INTENTIONALLY_UNGRANTED)) {
    assert.ok(reason.length > 20, `${table} is exempt with no real reason given`)
  }
})
