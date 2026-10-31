import { test } from 'node:test'
import assert from 'node:assert'
import { oauthFailureReason, isOAuthFailure, OAUTH_FAILURE_MESSAGES, getOAuthFailureMessage } from './oauth'

test('a cancelled Facebook login is reported as cancelled', () => {
  assert.strictEqual(oauthFailureReason('access_denied', 'Permissions error'), 'cancelled')
  assert.strictEqual(oauthFailureReason(null, 'User cancelled the login'), 'cancelled')
})

test('a Facebook account without an email is reported as no_email', () => {
  assert.strictEqual(oauthFailureReason('server_error', 'Error getting user email from external provider'), 'no_email')
})

test('anything else is a plain failure', () => {
  assert.strictEqual(oauthFailureReason('server_error', 'Unable to exchange external code'), 'failed')
  assert.strictEqual(oauthFailureReason(null, null), 'failed')
})

test('only known reasons are accepted from the URL', () => {
  assert.ok(isOAuthFailure('no_email'))
  assert.ok(!isOAuthFailure('oauth_callback_failed'))
  assert.ok(!isOAuthFailure('<script>'))
  for (const r of ['cancelled', 'no_email', 'failed'] as const) assert.ok(OAUTH_FAILURE_MESSAGES[r].length > 10)
})

test('getOAuthFailureMessage provides provider-aware messaging', () => {
  assert.strictEqual(getOAuthFailureMessage('cancelled', 'google'), 'Google login was cancelled. You can try again, or use your email.')
  assert.strictEqual(getOAuthFailureMessage('cancelled', 'facebook'), 'Facebook login was cancelled. You can try again, or use your email.')
  assert.strictEqual(getOAuthFailureMessage('no_email', 'google'), "Your Google account didn't share an email address, which we need for your account. Sign up with your email instead.")
  assert.strictEqual(getOAuthFailureMessage('failed', null), "Social login didn't finish. Please try again, or use your email.")
})
