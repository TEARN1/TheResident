import { test } from 'node:test'
import assert from 'node:assert/strict'
import { encryptPayload, b64urlToBytes, bytesToB64url, buildVapidJwt } from './webPush'

// RFC 8291 §5 "Push Message Encryption Example". Every input and the exact
// expected output are published in the spec, so this proves the
// implementation interoperates with real push services rather than merely
// producing something that decrypts against itself.
const RFC = {
  plaintext: 'When I grow up, I want to be a watermelon',
  uaPublic: 'BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4',
  authSecret: 'BTBZMqHH6r4Tts7J_aSIgg',
  // The sender's ephemeral key and salt are fixed here so the output is
  // reproducible; production generates both randomly on every message.
  asPrivateD: 'yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw',
  asPublic: 'BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8',
  salt: 'DGv6ra1nlYgDCS1FRnbzlw',
  expectedBody: 'DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN'
}

test('encryptPayload reproduces the RFC 8291 test vector exactly', async () => {
  const asPub = b64urlToBytes(RFC.asPublic)
  const body = await encryptPayload(
    RFC.plaintext,
    { p256dh: RFC.uaPublic, auth: RFC.authSecret },
    {
      salt: b64urlToBytes(RFC.salt),
      ephemeralPrivateJwk: {
        kty: 'EC', crv: 'P-256', d: RFC.asPrivateD,
        x: bytesToB64url(asPub.slice(1, 33)),
        y: bytesToB64url(asPub.slice(33, 65)),
        ext: true
      }
    }
  )
  assert.equal(bytesToB64url(body), RFC.expectedBody)
})

test('a fresh salt and ephemeral key are used on every message', async () => {
  const keys = { p256dh: RFC.uaPublic, auth: RFC.authSecret }
  const a = await encryptPayload('same text', keys)
  const b = await encryptPayload('same text', keys)
  // Identical plaintext must not produce identical ciphertext — a reused salt
  // or ephemeral key is how push encryption leaks across messages.
  assert.notEqual(bytesToB64url(a), bytesToB64url(b))
  assert.equal(a[20], 65, 'the key id length byte must be the P-256 point length')
})

test('base64url round-trips without padding', () => {
  const bytes = new Uint8Array([0, 1, 250, 255, 128, 64])
  assert.deepEqual(b64urlToBytes(bytesToB64url(bytes)), bytes)
  assert.doesNotMatch(bytesToB64url(bytes), /[+/=]/)
})

test('the VAPID token is scoped to the push service, not to one subscriber', async () => {
  const jwt = await buildVapidJwt(
    'https://fcm.googleapis.com/fcm/send/abc123-a-specific-person',
    'mailto:ops@example.com',
    RFC.asPrivateD,
    RFC.asPublic
  )
  const [, payload] = jwt.split('.')
  const claims = JSON.parse(new TextDecoder().decode(b64urlToBytes(payload)))
  // A token carrying the endpoint path would be a token identifying one
  // resident; the audience is the origin alone.
  assert.equal(claims.aud, 'https://fcm.googleapis.com')
  assert.doesNotMatch(JSON.stringify(claims), /abc123/)
  assert.equal(claims.sub, 'mailto:ops@example.com')
  assert.ok(claims.exp > Math.floor(Date.now() / 1000))
})

test('the VAPID token expires within the 24h the spec allows', async () => {
  const jwt = await buildVapidJwt('https://push.example.net/x', 'mailto:a@b.c', RFC.asPrivateD, RFC.asPublic)
  const claims = JSON.parse(new TextDecoder().decode(b64urlToBytes(jwt.split('.')[1])))
  assert.ok(claims.exp - Math.floor(Date.now() / 1000) <= 24 * 60 * 60)
})
