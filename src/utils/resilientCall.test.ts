import test from 'node:test'
import assert from 'node:assert'
import { resilientCall, isRetryableError, withTimeout } from './resilientCall'

test('a flaky call fails once then succeeds on the automatic retry', async () => {
  let attempts = 0
  const result = await resilientCall(async () => {
    attempts++
    if (attempts === 1) throw new Error('network blip')
    return 'ok'
  }, { backoffMs: [1] })
  assert.strictEqual(result, 'ok')
  assert.strictEqual(attempts, 2)
})

test('a call that fails every attempt exhausts retries and throws the last error', async () => {
  let attempts = 0
  await assert.rejects(
    () => resilientCall(async () => {
      attempts++
      throw new Error('still down')
    }, { backoffMs: [1, 1] }),
    /still down/
  )
  assert.strictEqual(attempts, 3)
})

test('a permission failure is never retried — retrying cannot fix "not allowed"', async () => {
  let attempts = 0
  await assert.rejects(
    () => resilientCall(async () => {
      attempts++
      throw new Error('new row violates row-level security policy')
    }, { backoffMs: [1, 1] }),
    /row-level security/
  )
  assert.strictEqual(attempts, 1)
})

test('isRetryableError treats network-shaped errors as retryable', () => {
  assert.strictEqual(isRetryableError(new Error('fetch failed')), true)
  assert.strictEqual(isRetryableError(new Error('permission denied for table res_listings')), false)
  assert.strictEqual(isRetryableError({ code: '42501', message: 'insufficient_privilege' }), false)
})

test('withTimeout resolves a promise that settles in time', async () => {
  const v = await withTimeout(Promise.resolve('ok'), 1000)
  assert.strictEqual(v, 'ok')
})

test('withTimeout rejects a promise that never settles', async () => {
  // This is the actual bug: /dashboard/messages awaited a request that never
  // settled, so setLoading(false) was never reached and the spinner stayed
  // on screen indefinitely.
  const neverSettles = new Promise(() => {})
  await assert.rejects(
    () => withTimeout(neverSettles, 20, 'conversations'),
    /took too long/
  )
})

test('withTimeout names the thing that timed out', async () => {
  await assert.rejects(
    () => withTimeout(new Promise(() => {}), 20, 'conversations'),
    /conversations/
  )
})

test('withTimeout passes a real rejection straight through', async () => {
  // A genuine error must not be replaced by a timeout message.
  await assert.rejects(
    () => withTimeout(Promise.reject(new Error('permission denied')), 1000),
    /permission denied/
  )
})

test('withTimeout does not leave a timer running after it resolves', async () => {
  // A leaked timer keeps the event loop alive; node:test would hang.
  await withTimeout(Promise.resolve(1), 60_000)
})
