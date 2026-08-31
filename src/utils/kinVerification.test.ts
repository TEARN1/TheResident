import { test } from 'node:test'
import assert from 'node:assert/strict'
import { verifyKinLinkUrl, kinLinkStatusLabel } from './kinVerification'

test('verifyKinLinkUrl builds a shareable path from the token', () => {
  assert.equal(verifyKinLinkUrl('abc-123', 'https://theresident.app'), 'https://theresident.app/verify-kin/abc-123')
})

test('kinLinkStatusLabel reads the way a resident would say it', () => {
  assert.equal(kinLinkStatusLabel('pending'), 'Waiting for a response')
  assert.equal(kinLinkStatusLabel('confirmed'), 'Confirmed')
  assert.equal(kinLinkStatusLabel('denied'), 'Denied')
})
