import test from 'node:test'
import assert from 'node:assert'
import { readFileSync } from 'node:fs'
import { canVibrate, prefersReducedMotion, haptic } from './haptics'

// These run in node, where there is no navigator and no matchMedia. That is
// the point: the most common real-world case for this module is a device that
// cannot vibrate — every iPhone, for a start — and it must be a silent no-op
// there rather than throwing into whatever handler called it.
test('a device with no vibration support is handled, not crashed into', () => {
  assert.strictEqual(canVibrate(), false)
  assert.doesNotThrow(() => haptic('commit'))
})

test('no window means no media query, and no crash', () => {
  assert.strictEqual(prefersReducedMotion(), false)
})

test('a throwing vibrate is swallowed', () => {
  // navigator is a getter-only property on globalThis in Node, so it is
  // defined over rather than assigned — the assignment form throws before the
  // test can even run, which is how this was first written.
  const had = Object.getOwnPropertyDescriptor(globalThis, 'navigator')
  Object.defineProperty(globalThis, 'navigator', {
    value: { vibrate: () => { throw new Error('not allowed') } },
    configurable: true
  })
  try {
    assert.strictEqual(canVibrate(), true, 'the stub is not being seen at all')
    assert.doesNotThrow(() => haptic('tap'))
  } finally {
    if (had) Object.defineProperty(globalThis, 'navigator', had)
    else delete (globalThis as { navigator?: unknown }).navigator
  }
})

// The rule that keeps this from becoming a nuisance: haptics reinforce
// feedback, they never carry it alone.
test('reduced motion suppresses vibration', () => {
  const src = readFileSync(new URL('./haptics.ts', import.meta.url), 'utf8')
  assert.ok(src.includes('prefersReducedMotion()'),
    'haptics no longer honour prefers-reduced-motion')
  const body = src.slice(src.indexOf('export function haptic'))
  assert.ok(/if \(!canVibrate\(\) \|\| prefersReducedMotion\(\)\) return/.test(body),
    'the reduced-motion guard is no longer the first thing haptic() checks')
})
