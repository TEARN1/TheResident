import test from 'node:test'
import assert from 'node:assert'
import { compareSchema, isUnexplainedDrift, summariseDrift } from './drift'
import type { SchemaSnapshot, TableFacts, FunctionFacts } from './drift'

const table = (over: Partial<TableFacts> = {}): TableFacts => ({
  name: 'res_faults', columns: ['id', 'status', 'confidence'],
  rlsEnabled: true, policyCount: 2, ...over,
})

const fn = (over: Partial<FunctionFacts> = {}): FunctionFacts => ({
  name: 'res_transition', searchPathPinned: true, anonExecutable: false, ...over,
})

const snap = (over: Partial<SchemaSnapshot> = {}): SchemaSnapshot => ({
  tables: [table()], functions: [fn()], ...over,
})

// ── The rule that keeps this check readable ────────────────────────────────
// The sibling app's drift check has been red every run for eleven days. Once a
// check is always failing, nobody reads it, and the day it means something is
// the day it gets ignored. These tests pin the behaviour that avoids that.

test('an unchanged schema produces nothing at all', () => {
  assert.deepStrictEqual(compareSchema(snap(), snap()), [])
  assert.strictEqual(summariseDrift([]), null)
})

test('a normal migration is not an incident', () => {
  // Additive change is what applying a migration looks like before the
  // snapshot is re-accepted. Treating it as drift is how a check becomes
  // wallpaper.
  const live = snap({
    tables: [table({ columns: ['id', 'status', 'confidence', 'priority'] }),
             table({ name: 'res_sponsorships' })],
    functions: [fn(), fn({ name: 'res_sell_sponsorship' })],
  })
  const findings = compareSchema(snap(), live)

  assert.ok(findings.length > 0, 'the change is still reported')
  assert.ok(findings.every(f => f.severity === 4), 'but nothing is serious')
  assert.strictEqual(isUnexplainedDrift(findings), false)
  assert.match(summariseDrift(findings)!, /normal after a migration/)
})

// ── Security boundaries: severity 1 ────────────────────────────────────────

test('RLS being switched off is the most serious thing this can find', () => {
  const findings = compareSchema(snap(), snap({ tables: [table({ rlsEnabled: false })] }))
  assert.strictEqual(findings[0].kind, 'rls_disabled')
  assert.strictEqual(findings[0].severity, 1)
  assert.ok(isUnexplainedDrift(findings))
})

test('a function opened to anon is severity 1 — this one actually happened', () => {
  // res_report_status was granted to PUBLIC while SECURITY DEFINER, and only a
  // weekly advisor email caught it. This check would have caught it in an hour.
  const live = snap({ functions: [fn({ name: 'res_report_status', anonExecutable: true })] })
  const found = compareSchema(snap(), live).find(f => f.kind === 'function_anon_executable')

  assert.ok(found)
  assert.strictEqual(found!.severity, 1)
  assert.match(found!.message, /CONTRACT.md §5/)
})

test('RLS being off on a table that never had it on is not reported as newly broken', () => {
  const accepted = snap({ tables: [table({ rlsEnabled: false })] })
  const findings = compareSchema(accepted, snap({ tables: [table({ rlsEnabled: false })] }))
  assert.deepStrictEqual(findings, [])
})

// ── Things automation depends on: severity 2 ───────────────────────────────

test('a vanished column is serious, because jobs will silently do the wrong thing', () => {
  const live = snap({ tables: [table({ columns: ['id', 'status'] })] })
  const found = compareSchema(snap(), live)[0]
  assert.strictEqual(found.kind, 'columns_missing')
  assert.strictEqual(found.severity, 2)
  assert.match(found.message, /confidence/)
})

test('a vanished table and a vanished function are both caught', () => {
  const findings = compareSchema(snap(), { tables: [], functions: [] })
  const kinds = findings.map(f => f.kind)
  assert.ok(kinds.includes('table_missing'))
  assert.ok(kinds.includes('function_missing'))
  assert.ok(findings.every(f => f.severity <= 2))
})

// ── Contract hygiene: severity 3 ───────────────────────────────────────────

test('losing every policy on a table is reported', () => {
  const live = snap({ tables: [table({ policyCount: 0 })] })
  const found = compareSchema(snap(), live).find(f => f.kind === 'policies_removed')
  assert.ok(found)
  assert.strictEqual(found!.severity, 3)
})

test('an unpinned search_path is reported — it is a hijack route, not a style issue', () => {
  const live = snap({ functions: [fn({ searchPathPinned: false })] })
  const found = compareSchema(snap(), live).find(f => f.kind === 'function_search_path_unpinned')
  assert.ok(found)
  assert.strictEqual(found!.severity, 3)
  assert.ok(isUnexplainedDrift([found!]))
})

// ── Reporting ──────────────────────────────────────────────────────────────

test('findings are ordered worst first', () => {
  const live = snap({
    tables: [table({ rlsEnabled: false, columns: ['id'] }), table({ name: 'res_new' })],
    functions: [fn({ searchPathPinned: false })],
  })
  const findings = compareSchema(snap(), live)
  for (let i = 1; i < findings.length; i++) {
    assert.ok(findings[i - 1].severity <= findings[i].severity)
  }
  assert.strictEqual(findings[0].severity, 1)
})

test('the summary names the worst problem rather than counting problems', () => {
  // "Schema drift detected" is not actionable. A name is.
  const live = snap({ tables: [table({ rlsEnabled: false, columns: ['id'] })] })
  const summary = summariseDrift(compareSchema(snap(), live))!
  assert.match(summary, /RLS has been turned OFF on res_faults/)
  assert.match(summary, /and 1 other drift finding/)
})

test('a single serious finding reads as one sentence, with no trailing count', () => {
  const live = snap({ tables: [table({ policyCount: 0 })] })
  const summary = summariseDrift(compareSchema(snap(), live))!
  assert.ok(!summary.includes('other drift finding'))
})
