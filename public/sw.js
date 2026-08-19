// The Resident — Low-Bandwidth 2G/3G PWA Service Worker (Cache-First & Offline Resilience)
const CACHE_NAME = 'resident-v1'

// Map tiles live in their OWN cache, so trimming them can never evict the app
// shell — the thing that has to survive is the app opening at all.
const TILE_CACHE = 'resident-tiles-v1'

// The only cross-origin hosts this worker will cache. Everything else stays
// uncached, which is what keeps authenticated Supabase responses out of a
// shared browser cache. Map tiles are public imagery with no user data in
// them, and during load shedding they are the difference between a usable map
// and a grey rectangle.
const TILE_HOSTS = ['basemaps.cartocdn.com']

// Roughly 20-25MB at typical raster tile sizes. Enough for a suburb at the
// zoom levels people actually use, small enough not to crowd a cheap phone.
const TILE_CACHE_MAX = 700

const isTileRequest = (url) =>
  TILE_HOSTS.some((host) => url.hostname === host || url.hostname.endsWith('.' + host))

/**
 * Keeps the tile cache under its cap.
 *
 * The Cache API has no eviction of its own, so without this an evening of
 * panning fills the device's storage quota and the browser starts evicting
 * things we actually need — including the app shell.
 *
 * Insertion order is the eviction order. That is not true LRU, but tiles are
 * cheap to re-fetch and a exact recency list would cost more to maintain than
 * it saves.
 */
async function trimTileCache() {
  const cache = await caches.open(TILE_CACHE)
  const keys = await cache.keys()
  if (keys.length <= TILE_CACHE_MAX) return
  const excess = keys.length - TILE_CACHE_MAX
  for (let i = 0; i < excess; i++) {
    await cache.delete(keys[i])
  }
}
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
        keys
          // The tile cache survives a version bump on purpose: throwing away a
          // suburb's worth of tiles because the app shell changed would leave
          // someone with a blank map at the worst possible moment.
          .filter((key) => key !== CACHE_NAME && key !== TILE_CACHE)
          .map((key) => caches.delete(key))
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

  // Map tiles: cache-first, and the ONLY cross-origin exception. They are
  // public map imagery — no credentials, no user data — so they carry none of
  // the risk the rule below exists to prevent. Cache-first rather than
  // stale-while-revalidate because a tile for a given z/x/y does not change,
  // and re-fetching it would spend a resident's data for an identical image.
  if (isTileRequest(url)) {
    event.respondWith(
      caches.open(TILE_CACHE).then((cache) =>
        cache.match(event.request).then((hit) => {
          if (hit) return hit
          return fetch(event.request).then((response) => {
            if (response && response.status === 200) {
              cache.put(event.request, response.clone()).then(trimTileCache)
            }
            return response
          }).catch(() =>
            // Offline with no cached tile: let Leaflet show its blank tile
            // rather than an error. The pins still render on top of it, so a
            // resident can still see where the water point is.
            new Response('', { status: 504, statusText: 'tile unavailable offline' })
          )
        })
      )
    )
    return
  }

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

