// Web Push subscription — the browser-side half of Phase E in
// docs/OFFICIAL-BROADCAST-STRATEGY.md.
//
// What this buys: a water shutdown or an evacuation notice reaches a phone
// with the app closed. Until now every notification, including 'critical',
// only appeared the next time someone opened the app — which for an emergency
// is close to not delivering it at all.
//
// Consent is explicit and revocable. Nothing here asks for permission on page
// load; the resident presses a button, and unsubscribing removes the row.
import { supabase } from './supabase'
import { resilientCall } from './resilientCall'

/** Not a secret — the public half is meant to be shipped to the client. */
export const VAPID_PUBLIC_KEY =
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ||
  'BMoPkJgUw8AUXmQzwW5fjKYHuGUv6P8P94BRyr1870KkgK_kIhiGlkfocyHAP-X6Wiwf_C_HVKxuiCDNspGHLGk'

export type PushState = 'unsupported' | 'denied' | 'subscribed' | 'available'

/**
 * PushManager.subscribe wants the key as bytes, not base64url. Kept here
 * rather than inlined so the one fiddly conversion in this file is testable.
 */
export function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padded = (base64 + '='.repeat((4 - (base64.length % 4)) % 4))
    .replace(/-/g, '+')
    .replace(/_/g, '/')
  const raw = atob(padded)
  const out = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

/** The subscription's keys arrive as ArrayBuffers; the database stores text. */
export function arrayBufferToBase64Url(buffer: ArrayBuffer | null): string {
  if (!buffer) return ''
  const bytes = new Uint8Array(buffer)
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/**
 * The sentence the settings toggle shows. Denied is called out separately
 * because it cannot be fixed from inside the page — the resident has to
 * change a browser setting, and saying "try again" would waste their time.
 */
export function describePushState(state: PushState): string {
  switch (state) {
    case 'unsupported':
      return 'This browser cannot deliver alerts when the app is closed.'
    case 'denied':
      return 'Notifications are blocked for this site. You will need to allow them in your browser settings — the app cannot re-ask.'
    case 'subscribed':
      return 'On — urgent notices will reach this device even when the app is closed.'
    case 'available':
      return 'Off — urgent notices will only appear when you open the app.'
  }
}

export function isPushSupported(): boolean {
  return typeof window !== 'undefined'
    && 'serviceWorker' in navigator
    && 'PushManager' in window
    && 'Notification' in window
}

export async function getPushState(): Promise<PushState> {
  if (!isPushSupported()) return 'unsupported'
  if (Notification.permission === 'denied') return 'denied'
  try {
    const reg = await navigator.serviceWorker.ready
    const existing = await reg.pushManager.getSubscription()
    return existing ? 'subscribed' : 'available'
  } catch {
    return 'available'
  }
}

// ── Network ────────────────────────────────────────────────────────────────

/**
 * Ask for permission, subscribe, and record the endpoint. Returns the state
 * afterwards so a caller does not have to re-query.
 *
 * Upserts on `endpoint`: the same browser re-subscribing must refresh the row
 * rather than accumulate duplicates that would each get their own copy of
 * every notice.
 */
export async function enablePush(userId: string): Promise<PushState> {
  if (!isPushSupported()) return 'unsupported'
  if (!supabase) throw new Error('Not connected')
  const client = supabase

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return permission === 'denied' ? 'denied' : 'available'

  const reg = await navigator.serviceWorker.ready
  const sub = await reg.pushManager.subscribe({
    // Required by every browser: a push that cannot be shown to the user is
    // not allowed, which suits us — we never want silent background pushes.
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource
  })

  const json = sub.toJSON() as { keys?: { p256dh?: string; auth?: string } }
  await resilientCall(async () => {
    const { error } = await client.from('web_push_subscriptions').upsert({
      user_id: userId,
      endpoint: sub.endpoint,
      p256dh: json.keys?.p256dh ?? arrayBufferToBase64Url(sub.getKey('p256dh')),
      auth: json.keys?.auth ?? arrayBufferToBase64Url(sub.getKey('auth')),
      user_agent: navigator.userAgent.slice(0, 300),
      last_seen_at: new Date().toISOString()
    }, { onConflict: 'endpoint' })
    if (error) throw error
  })

  return 'subscribed'
}

/**
 * Turn it off properly: unsubscribe at the browser AND delete the row. Leaving
 * the row would keep the push service being asked to deliver to an endpoint
 * the resident has withdrawn.
 */
export async function disablePush(): Promise<PushState> {
  if (!isPushSupported()) return 'unsupported'
  const reg = await navigator.serviceWorker.ready
  const sub = await reg.pushManager.getSubscription()
  if (!sub) return 'available'

  const endpoint = sub.endpoint
  await sub.unsubscribe()

  if (supabase) {
    const client = supabase
    await resilientCall(async () => {
      const { error } = await client.from('web_push_subscriptions').delete().eq('endpoint', endpoint)
      if (error) throw error
    })
  }
  return 'available'
}
