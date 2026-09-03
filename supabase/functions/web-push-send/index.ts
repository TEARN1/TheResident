/**
 * web-push-send — delivers a notification to a resident's device even when the
 * app is closed. Phase E of docs/OFFICIAL-BROADCAST-STRATEGY.md.
 *
 * WHY THIS EXISTS SEPARATELY. The project already has a `push-notify` function,
 * but it is Expo-based (exp.host, reads profiles.push_token) and belongs to the
 * sibling mobile app — it is Gruvs-owned and is NOT modified here. The Resident
 * is a web PWA, so the correct mechanism is Web Push against
 * web_push_subscriptions, which nothing read until now.
 *
 * WHAT IT WILL NOT DO. It does not decide who should be notified. The audience
 * was already decided and delivered into the notifications rail by
 * res_send_area_broadcast; this only mirrors an existing notification out to a
 * device. It refuses any request that is not authenticated as the service role,
 * so it cannot be used to push arbitrary text at a resident.
 *
 * Requires two secrets set on the project:
 *   VAPID_PRIVATE_KEY   the d value of the P-256 keypair
 *   VAPID_SUBJECT       a mailto: or https: contact, required by RFC 8292
 * The public key is not secret and is also compiled into the client.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { encryptPayload, buildVapidJwt } from '../_shared/webPush.ts'

const VAPID_PUBLIC_KEY = 'BMoPkJgUw8AUXmQzwW5fjKYHuGUv6P8P94BRyr1870KkgK_kIhiGlkfocyHAP-X6Wiwf_C_HVKxuiCDNspGHLGk'

interface SendRequest {
  /** Who to reach. Their subscriptions are looked up here, never passed in. */
  userIds: string[]
  title: string
  body: string
  url?: string
  tag?: string
  requireInteraction?: boolean
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('method not allowed', { status: 405 })
  }

  // Service-role only. verify_jwt is off so the database can call this, which
  // means the check has to be here and has to be constant-time-ish: a
  // signed-in resident must not be able to push notifications at anyone.
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  const auth = req.headers.get('Authorization') ?? ''
  if (!serviceKey || auth !== `Bearer ${serviceKey}`) {
    return new Response('unauthorized', { status: 401 })
  }

  const privateKey = Deno.env.get('VAPID_PRIVATE_KEY')
  const subject = Deno.env.get('VAPID_SUBJECT')
  if (!privateKey || !subject) {
    // Stated plainly rather than failing as a mystery: without these the
    // feature is simply not configured yet.
    return new Response(
      JSON.stringify({ error: 'vapid_not_configured', detail: 'VAPID_PRIVATE_KEY and VAPID_SUBJECT must be set' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    )
  }

  let payload: SendRequest
  try {
    payload = await req.json()
  } catch {
    return new Response('bad request', { status: 400 })
  }
  if (!Array.isArray(payload.userIds) || payload.userIds.length === 0 || !payload.title) {
    return new Response('bad request', { status: 400 })
  }

  const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', serviceKey)
  const { data: subs, error } = await supabase
    .from('web_push_subscriptions')
    .select('id, user_id, endpoint, p256dh, auth')
    .in('user_id', payload.userIds)

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    })
  }

  const message = JSON.stringify({
    title: payload.title,
    body: payload.body,
    url: payload.url ?? '/dashboard',
    tag: payload.tag,
    requireInteraction: payload.requireInteraction ?? false
  })

  let sent = 0
  const expired: string[] = []

  await Promise.all((subs ?? []).map(async sub => {
    try {
      const body = await encryptPayload(message, { p256dh: sub.p256dh, auth: sub.auth })
      const jwt = await buildVapidJwt(sub.endpoint, subject, privateKey, VAPID_PUBLIC_KEY)
      const res = await fetch(sub.endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `vapid t=${jwt}, k=${VAPID_PUBLIC_KEY}`,
          'Content-Encoding': 'aes128gcm',
          'Content-Type': 'application/octet-stream',
          'TTL': '86400'
        },
        body
      })
      if (res.ok) {
        sent++
      } else if (res.status === 404 || res.status === 410) {
        // The push service says this subscription is dead — the browser was
        // uninstalled or the permission revoked. Keeping it would mean
        // retrying forever against an endpoint that will never answer.
        expired.push(sub.id)
      }
    } catch {
      // One unreachable push service must not stop the others. A dropped
      // notification is recoverable; a half-finished fan-out is not.
    }
  }))

  if (expired.length > 0) {
    await supabase.from('web_push_subscriptions').delete().in('id', expired)
  }

  return new Response(
    JSON.stringify({ sent, subscriptions: subs?.length ?? 0, pruned: expired.length }),
    { headers: { 'Content-Type': 'application/json' } }
  )
})
