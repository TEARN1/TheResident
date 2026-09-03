import { test } from 'node:test'
import assert from 'node:assert/strict'
import { urlBase64ToUint8Array, arrayBufferToBase64Url, describePushState, VAPID_PUBLIC_KEY } from './webPush'

test('the VAPID public key decodes to an uncompressed P-256 point', () => {
  const bytes = urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
  // 0x04 marks an uncompressed point, then 32 bytes of x and 32 of y. A key
  // that fails this is silently rejected by pushManager.subscribe with an
  // unhelpful error, so it is worth asserting rather than discovering on a
  // real device.
  assert.equal(bytes.length, 65)
  assert.equal(bytes[0], 4)
})

test('urlBase64ToUint8Array handles the padding browsers omit', () => {
  assert.deepEqual(Array.from(urlBase64ToUint8Array('AQAB')), [1, 0, 1])
  assert.deepEqual(Array.from(urlBase64ToUint8Array('-_8')), [251, 255])
})

test('arrayBufferToBase64Url produces url-safe, unpadded output', () => {
  const buf = new Uint8Array([251, 255, 128]).buffer
  const out = arrayBufferToBase64Url(buf)
  assert.doesNotMatch(out, /[+/=]/)
  assert.deepEqual(Array.from(urlBase64ToUint8Array(out)), [251, 255, 128])
  assert.equal(arrayBufferToBase64Url(null), '')
})

test('a blocked permission is explained as unfixable from inside the page', () => {
  // "Try again" would be a lie: once denied, the page cannot re-prompt.
  const denied = describePushState('denied')
  assert.match(denied, /browser settings/)
  assert.match(denied, /cannot re-ask/)
  assert.doesNotMatch(denied, /try again/i)
})

test('the off state says what the resident actually loses', () => {
  assert.match(describePushState('available'), /only appear when you open the app/)
  assert.match(describePushState('subscribed'), /even when the app is closed/)
  assert.match(describePushState('unsupported'), /cannot deliver/)
})
