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

