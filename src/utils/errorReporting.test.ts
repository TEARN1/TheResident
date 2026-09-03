import { test } from 'node:test'
import assert from 'node:assert/strict'
import { redact, shouldReport, describeError } from './errorReporting'

test('a verification token never leaves the browser in a crash report', () => {
  // /verify-kin/<token> is a live no-login link. A crash report containing one
  // would be a crash report containing a working credential.
  const path = '/verify-kin/3f8a2b1c-9d4e-4a7b-8c1d-2e5f6a7b8c9d'
  const out = redact(path)
  assert.doesNotMatch(out, /3f8a2b1c/)
  assert.match(out, /<id>/)
})

test('long opaque path segments are treated as secrets even when unrecognised', () => {
  // The next route with a token in it will not be added to a list here, so
  // the rule is shape-based rather than route-based.
  const out = redact('/invite/AbCdEf0123456789AbCdEf0123456789')
  assert.doesNotMatch(out, /AbCdEf0123456789/)
  assert.match(out, /<token>/)
})

test('emails, JWTs and token query params are stripped', () => {
  assert.match(redact('failed for asemah@example.com'), /<email>/)
  assert.match(
    redact('Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.abc123'),
    /<jwt>/
  )
  const q = redact('/reset?access_token=sk_live_9f8e7d6c5b4a&next=/home')
  assert.doesNotMatch(q, /sk_live/)
  assert.match(q, /access_token=<redacted>/)
  // The parts that help debugging survive.
  assert.match(q, /\/reset/)
  assert.match(q, /next=\/home/)
})

test('ordinary error text is left readable', () => {
  const out = redact("Cannot read properties of undefined (reading 'suburb')")
  assert.equal(out, "Cannot read properties of undefined (reading 'suburb')")
})

test('a crash loop reports once, not on every render', () => {
  const now = 1_000_000
  assert.equal(shouldReport('render:boom', now), true)
  assert.equal(shouldReport('render:boom', now + 500), false)
  assert.equal(shouldReport('render:boom', now + 59_000), false)
  // Once the window passes it can report again, so a recurring bug is still
  // visible rather than silenced forever.
  assert.equal(shouldReport('render:boom', now + 61_000), true)
})

test('different failures are not collapsed into one', () => {
  const now = 2_000_000
  assert.equal(shouldReport('render:a', now), true)
  assert.equal(shouldReport('render:b', now), true)
})

test('describeError handles what is actually thrown in practice', () => {
  assert.equal(describeError(new TypeError('nope')), 'TypeError: nope')
  assert.equal(describeError('plain string'), 'plain string')
  assert.match(describeError({ code: 42 }), /42/)
  // Circular objects are thrown by some libraries; this must not throw.
  const circular: Record<string, unknown> = {}
  circular.self = circular
  assert.equal(describeError(circular), 'Unserialisable error')
})
