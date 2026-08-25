import test from 'node:test'
import assert from 'node:assert'
import { resilientCall, isRetryableError } from './resilientCall'

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
