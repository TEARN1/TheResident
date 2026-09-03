// The Resident — Low-Bandwidth 2G/3G PWA Service Worker (Cache-First & Offline Resilience)
const CACHE_NAME = 'resident-v1'
const STATIC_ASSETS = [
  '/',
  '/dashboard',
  '/manifest.json',
  '/logo.png'
]

// 1. Install event: Cache core offline shell assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS)
    }).then(() => self.skipWaiting())
  )
})

// 2. Activate event: Clean up old cache versions
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    }).then(() => self.clients.claim())
  )
})

// 3. Fetch event: Stale-While-Revalidate for static assets only.
//    API calls (Supabase, third-party) are NEVER cached to prevent
//    leaking authenticated data into the shared browser cache.
self.addEventListener('fetch', (event) => {
  // Ignore non-GET or chrome-extension requests
  if (event.request.method !== 'GET' || !event.request.url.startsWith('http')) return

  const url = new URL(event.request.url)

  // NEVER cache API responses (Supabase REST, auth, realtime, or any external API)
  if (url.hostname !== self.location.hostname) return
  if (url.pathname.startsWith('/api/')) return
  if (url.pathname.startsWith('/rest/')) return
  if (url.pathname.startsWith('/auth/')) return

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Return cached version immediately while fetching update in background
        fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, networkResponse))
          }
        }).catch(() => {/* Offline fallback active */})

        return cachedResponse
      }

      // If not in cache, fetch from network and cache only static assets for offline access
      return fetch(event.request).then((networkResponse) => {
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
          return networkResponse
        }

        // Only cache navigations and static assets (HTML, CSS, JS, images)
        const contentType = networkResponse.headers.get('content-type') || ''
        const isStaticAsset = contentType.includes('text/html') ||
                              contentType.includes('text/css') ||
                              contentType.includes('javascript') ||
                              contentType.includes('image/') ||
                              contentType.includes('font/')

        if (isStaticAsset) {
          const responseToCache = networkResponse.clone()
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache)
          })
        }

        return networkResponse
      }).catch(() => {
        // Fallback for HTML page requests if completely offline
        if (event.request.headers.get('accept')?.includes('text/html')) {
          return caches.match('/dashboard')
        }
      })
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
