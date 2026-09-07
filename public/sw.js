// The Resident — Low-Bandwidth 2G/3G PWA Service Worker
//
// CACHE VERSIONING. The cache is named after the build that installed it.
// This used to be a hard-coded 'resident-v1' that was never bumped, which
// broke the activate() cleanup below in a way nobody would notice: "delete
// every cache whose name isn't the current one" deletes nothing when the
// name never changes. An installed PWA therefore kept serving the previous
// deploy's HTML and JS — the "it's on the web but not on my app" gap.
//
// /sw.js is a static file that can't know the build id, so it is passed in
// on registration as ?v=<build id> (see src/app/layout.tsx) and read back
// off this worker's own URL.
const BUILD = new URL(self.location).searchParams.get('v') || 'dev'
const CACHE_NAME = `resident-${BUILD}`

const STATIC_ASSETS = [
  '/',
  '/dashboard',
  '/manifest.json',
  '/logo.png'
]

// 1. Install: warm the offline shell, then take over immediately rather than
//    waiting for every old tab to close.
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      // Individually, so one 404 doesn't fail the whole install and leave
      // the worker stuck on the previous version forever.
      .then((cache) => Promise.all(
        STATIC_ASSETS.map((url) => cache.add(url).catch(() => {/* skip */}))
      ))
      .then(() => self.skipWaiting())
  )
})

// 2. Activate: drop every cache from a previous build, then claim open pages.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  )
})

// 3. Fetch.
//
// Two strategies, because the two kinds of request have opposite needs:
//
//   * HTML / navigations — NETWORK FIRST. A document is what points at the
//     current build's JS, so serving a stale one is what made the installed
//     app run a deploy behind. Falls back to cache the moment the network
//     fails, which is what keeps this usable on 2G/3G and offline.
//
//   * Everything else — CACHE FIRST. Next.js content-hashes its assets, so
//     a given URL's bytes never change; serving it from cache is free and
//     correct, and a new build asks for new URLs anyway.
//
// API calls are never cached at all, so authenticated data cannot end up in
// a shared browser cache.
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET' || !event.request.url.startsWith('http')) return

  const url = new URL(event.request.url)

  // Never cache API responses (Supabase REST, auth, realtime, any external API)
  if (url.hostname !== self.location.hostname) return
  if (url.pathname.startsWith('/api/')) return
  if (url.pathname.startsWith('/rest/')) return
  if (url.pathname.startsWith('/auth/')) return

  const isNavigation = event.request.mode === 'navigate' ||
    (event.request.headers.get('accept') || '').includes('text/html')

  if (isNavigation) {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
            const copy = networkResponse.clone()
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy))
          }
          return networkResponse
        })
        .catch(() =>
          // Offline: the cached document, or the dashboard shell as a floor.
          caches.match(event.request).then((hit) => hit || caches.match('/dashboard'))
        )
    )
    return
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) return cachedResponse

      return fetch(event.request).then((networkResponse) => {
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
          return networkResponse
        }

        const contentType = networkResponse.headers.get('content-type') || ''
        const isStaticAsset = contentType.includes('text/css') ||
                              contentType.includes('javascript') ||
                              contentType.includes('image/') ||
                              contentType.includes('font/')

        if (isStaticAsset) {
          const responseToCache = networkResponse.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseToCache))
        }

        return networkResponse
      }).catch(() => undefined)
    })
  )
})


// 4. Push events — Phase E of the official-broadcast work.
//    Reaching a phone with the app closed is the whole point: an evacuation
//    notice that only appears next time someone opens the app is not an
//    evacuation notice.
self.addEventListener('push', (event) => {
  if (!event.data) return

  let payload
  try {
    payload = event.data.json()
  } catch {
    payload = { title: 'The Resident', body: event.data.text() }
  }

  event.waitUntil(
    self.registration.showNotification(payload.title || 'The Resident', {
      body: payload.body || '',
      icon: '/logo.png',
      badge: '/logo.png',
      // tag collapses repeats of the same notice rather than stacking them;
      // renotify still buzzes so a genuine update is not silent.
      tag: payload.tag || undefined,
      renotify: !!payload.tag,
      // Emergencies stay on screen until the resident deals with them, the
      // same rule the in-app urgent banner already follows.
      requireInteraction: !!payload.requireInteraction,
      data: { url: payload.url || '/dashboard' }
    })
  )
})

// 5. Tapping a notification opens the thing it is about — focusing an
//    already-open tab rather than piling up new ones.
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = (event.notification.data && event.notification.data.url) || '/dashboard'

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      for (const client of windows) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(target)
          return client.focus()
        }
      }
      return self.clients.openWindow(target)
    })
  )
})
