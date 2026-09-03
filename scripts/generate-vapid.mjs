// Generates a VAPID keypair for Web Push. Run only when setting up a new
// project or rotating a compromised key — rotating invalidates every existing
// subscription, so residents would have to opt in again.
//
//   node scripts/generate-vapid.mjs
//
// The public key goes in src/utils/webPush.ts and the edge function; the
// private key goes in Supabase's edge function secrets and nowhere else.
import { webcrypto as c } from 'node:crypto'

const pair = await c.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])
const publicRaw = Buffer.from(await c.subtle.exportKey('raw', pair.publicKey))
const jwk = await c.subtle.exportKey('jwk', pair.privateKey)

const b64url = b => b.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

console.log('VAPID public key (safe to commit):')
console.log('  ' + b64url(publicRaw))
console.log()
console.log('VAPID private key (secret — Supabase edge function secrets only):')
console.log('  ' + jwk.d)
