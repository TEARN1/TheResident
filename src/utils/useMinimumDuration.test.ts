import test from 'node:test'
import assert from 'node:assert'
import { remainingHoldMs, DEFAULT_MINIMUM_MS } from './useMinimumDuration'

// The bug this prevents: a loader that appears and vanishes inside 100ms,
// which on a fast connection is most loads, and reads as a glitch rather than
// as progress.
test('a loader that has only just appeared is held for the remainder', () => {
  assert.strictEqual(remainingHoldMs(1000, 1100, 400), 300)
})

test('a loader that has been up long enough is released immediately', () => {
  assert.strictEqual(remainingHoldMs(1000, 1400, 400), 0)
  assert.strictEqual(remainingHoldMs(1000, 9999, 400), 0)
})

test('a loader that was never shown is never held', () => {
  assert.strictEqual(remainingHoldMs(null, 5000, 400), 0)
})

test('the hold is never negative, so a late clock cannot schedule a past timeout', () => {
  assert.ok(remainingHoldMs(1000, 5000, 400) >= 0)
  // Clocks do go backwards — NTP corrections, a device waking from sleep.
  assert.ok(remainingHoldMs(5000, 1000, 400) >= 0)
})

test('the default minimum is long enough to read and short enough not to annoy', () => {
  assert.ok(DEFAULT_MINIMUM_MS >= 250 && DEFAULT_MINIMUM_MS <= 600,
    `${DEFAULT_MINIMUM_MS}ms is outside the range a loader reads well in`)
})
