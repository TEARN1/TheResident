import test from 'node:test'
import assert from 'node:assert'
import { toOverview, nightlyRunIsStale } from './opsConsole'

test('an empty or missing overview renders as empty, not as a crash', () => {
  const o = toOverview(null)
  assert.deepStrictEqual(o, { jobs: [], findings: [], metrics: [], lastNightlyRun: null })
})

test('job rows map snake_case to the console shape', () => {
  const o = toOverview({
    jobs: [{ key: 'res_expire_stale_listings', description: 'd', schedule: 'nightly', autonomy: 2,
             enabled: false, max_affected: 500, disabled_reason: 'over its cap', last_run: null,
             last_ok: null, last_affected: null, last_error: null, failures_48h: 3 }]
  })
  assert.strictEqual(o.jobs[0].maxAffected, 500)
  assert.strictEqual(o.jobs[0].enabled, false)
  assert.strictEqual(o.jobs[0].failures48h, 3)
  assert.strictEqual(o.jobs[0].disabledReason, 'over its cap')
})

test('a nightly run that never happened is stale', () => {
  assert.strictEqual(nightlyRunIsStale(null), true)
})

test('last night is fresh; two nights ago is stale', () => {
  const now = Date.parse('2026-09-28T12:00:00Z')
  assert.strictEqual(nightlyRunIsStale('2026-09-28T00:20:00Z', now), false)
  assert.strictEqual(nightlyRunIsStale('2026-09-27T00:20:00Z', now), true)
})
