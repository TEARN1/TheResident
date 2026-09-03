/**
 * Web Push (RFC 8291 / RFC 8188 aes128gcm) and VAPID (RFC 8292), implemented
 * directly against WebCrypto.
 *
 * WHY NOT A LIBRARY. This runs in an edge function holding the key that lets
 * anything speak in this app's name on a resident's lock screen. The usual
 * `web-push` package is Node-shaped and pulls a dependency tree into that
 * position for the sake of about a hundred lines of standard, unchanging
 * crypto. WebCrypto has every primitive needed, and the RFC ships a worked
 * example with real inputs and outputs — so this file is verified against the
 * spec's own vector in webPush.test.ts rather than trusted.
 *
 * Runs unmodified in Deno (the edge function) and Node 20+ (the test), because
 * it touches nothing but globalThis.crypto and Uint8Array.
 */

const enc = new TextEncoder()

export function b64urlToBytes(s: string): Uint8Array {
  const pad = s.replace(/-/g, '+').replace(/_/g, '/')
  const padded = pad + '='.repeat((4 - (pad.length % 4)) % 4)
  const bin = atob(padded)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

export function bytesToB64url(b: Uint8Array): string {
  let bin = ''
  for (const byte of b) bin += String.fromCharCode(byte)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((n, p) => n + p.length, 0)
  const out = new Uint8Array(total)
  let at = 0
  for (const p of parts) { out.set(p, at); at += p.length }
  return out
}

/** HKDF as RFC 8291 uses it: one-block expand, so the counter is always 0x01. */
async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, length: number): Promise<Uint8Array> {
  const saltKey = await crypto.subtle.importKey('raw', salt, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const prk = new Uint8Array(await crypto.subtle.sign('HMAC', saltKey, ikm))
  const prkKey = await crypto.subtle.importKey('raw', prk, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const out = new Uint8Array(await crypto.subtle.sign('HMAC', prkKey, concat(info, new Uint8Array([1]))))
  return out.slice(0, length)
}

export interface PushSubscriptionKeys {
  /** The subscriber's public key, base64url — `p256dh` in the database. */
  p256dh: string
  /** The subscriber's auth secret, base64url — `auth` in the database. */
  auth: string
}

/**
 * Encrypt a payload for one subscriber. The body returned is the complete
 * aes128gcm-encoded request body: salt, record size, key id length, the
 * ephemeral public key, then the ciphertext.
 *
 * `salt` and `ephemeral` are injectable ONLY so the RFC's test vector can be
 * reproduced. Production always generates both randomly — a reused salt or
 * ephemeral key would leak plaintext across messages.
 */
export async function encryptPayload(
  payload: string,
  keys: PushSubscriptionKeys,
  fixed?: { salt: Uint8Array; ephemeralPrivateJwk: JsonWebKey }
): Promise<Uint8Array> {
  const uaPublic = b64urlToBytes(keys.p256dh)
  const authSecret = b64urlToBytes(keys.auth)

  const ephemeral = fixed
    ? {
        privateKey: await crypto.subtle.importKey(
          'jwk', fixed.ephemeralPrivateJwk, { name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']
        ),
        publicKey: await crypto.subtle.importKey(
          'jwk',
          { kty: 'EC', crv: 'P-256', x: fixed.ephemeralPrivateJwk.x, y: fixed.ephemeralPrivateJwk.y },
          { name: 'ECDH', namedCurve: 'P-256' }, true, []
        )
      }
    : await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])

  const asPublic = new Uint8Array(await crypto.subtle.exportKey('raw', ephemeral.publicKey))

  const uaKey = await crypto.subtle.importKey(
    'raw', uaPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, []
  )
  const shared = new Uint8Array(
    await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, ephemeral.privateKey, 256)
  )

  // RFC 8291 §3.4: the auth secret salts the shared secret, and the info
  // string binds the derived key to both parties' public keys — which is what
  // stops a captured message being replayed at a different subscriber.
  const keyInfo = concat(enc.encode('WebPush: info'), new Uint8Array([0]), uaPublic, asPublic)
  const ikm = await hkdf(authSecret, shared, keyInfo, 32)

  const salt = fixed ? fixed.salt : crypto.getRandomValues(new Uint8Array(16))
  const cek = await hkdf(salt, ikm, enc.encode('Content-Encoding: aes128gcm\0'), 16)
  const nonce = await hkdf(salt, ikm, enc.encode('Content-Encoding: nonce\0'), 12)

  // 0x02 is the last-record padding delimiter. One record only: push payloads
  // are capped well below the 4096-byte record size.
  const plaintext = concat(enc.encode(payload), new Uint8Array([2]))
  const aesKey = await crypto.subtle.importKey('raw', cek, { name: 'AES-GCM' }, false, ['encrypt'])
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce, tagLength: 128 }, aesKey, plaintext)
  )

  const header = new Uint8Array(21)
  header.set(salt, 0)
  new DataView(header.buffer).setUint32(16, 4096)
  header[20] = asPublic.length
  return concat(header, asPublic, ciphertext)
}

/**
 * A VAPID JWT proving the sender is who the subscription was created for.
 * `aud` is the push service's origin, never the endpoint path — a token
 * scoped to a full endpoint would be a token scoped to one person.
 */
export async function buildVapidJwt(
  endpoint: string,
  subject: string,
  privateKeyB64url: string,
  publicKeyB64url: string,
  expirySeconds = 12 * 60 * 60
): Promise<string> {
  const audience = new URL(endpoint).origin
  const header = bytesToB64url(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })))
  const body = bytesToB64url(enc.encode(JSON.stringify({
    aud: audience,
    exp: Math.floor(Date.now() / 1000) + expirySeconds,
    sub: subject
  })))
  const signingInput = `${header}.${body}`

  const raw = b64urlToBytes(publicKeyB64url)
  const key = await crypto.subtle.importKey(
    'jwk',
    {
      kty: 'EC', crv: 'P-256', d: privateKeyB64url,
      x: bytesToB64url(raw.slice(1, 33)),
      y: bytesToB64url(raw.slice(33, 65)),
      ext: true
    },
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  )
  const sig = new Uint8Array(
    await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, enc.encode(signingInput))
  )
  return `${signingInput}.${bytesToB64url(sig)}`
}
