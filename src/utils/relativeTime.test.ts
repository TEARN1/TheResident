import test from 'node:test'
import assert from 'node:assert'
import { relativeTime } from './relativeTime'

const NOW = Date.parse('2026-09-13T12:00:00Z')
const ago = (ms: number) => new Date(NOW - ms).toISOString()

test('the minute boundary reads correctly on both sides', () => {
  assert.strictEqual(relativeTime(ago(59_000), NOW), 'just now')
  assert.strictEqual(relativeTime(ago(60_000), NOW), '1 minute ago')
  assert.strictEqual(relativeTime(ago(120_000), NOW), '2 minutes ago')
})

test('hours and days are singular at one', () => {
  assert.strictEqual(relativeTime(ago(3_600_000), NOW), '1 hour ago')
  assert.strictEqual(relativeTime(ago(2 * 3_600_000), NOW), '2 hours ago')
  assert.strictEqual(relativeTime(ago(24 * 3_600_000), NOW), '1 day ago')
})

test('past a week it gives a date, because "37 days ago" is not useful', () => {
  const out = relativeTime(ago(37 * 24 * 3_600_000), NOW)
  assert.ok(!out.includes('ago'), out)
  assert.ok(out.length > 0)
})

// Two devices disagreeing about the clock is normal. "in 4 seconds" on a
// notification you were just sent reads as a bug.
test('a timestamp slightly in the future is just now, not "in 4 seconds"', () => {
  assert.strictEqual(relativeTime(new Date(NOW + 4_000).toISOString(), NOW), 'just now')
  assert.strictEqual(relativeTime(new Date(NOW + 30_000).toISOString(), NOW), 'just now')
})

test('a genuinely future time is described as future, not as the past', () => {
  const out = relativeTime(new Date(NOW + 3 * 24 * 3_600_000).toISOString(), NOW)
  assert.match(out, /^in 3 days$/)
})

test('nothing and nonsense produce nothing, never "Invalid Date"', () => {
  assert.strictEqual(relativeTime(null, NOW), '')
  assert.strictEqual(relativeTime(undefined, NOW), '')
  assert.strictEqual(relativeTime('not a date', NOW), '')
})
