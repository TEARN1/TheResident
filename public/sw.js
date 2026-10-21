// The Resident service worker: works on slow 2G/3G and offline, without
// ever showing an old version of a page.
//
// Pages (HTML) are network-first: the newest version every time you are
// online, the last saved copy (or offline.html) only when you are not. They
// used to be cache-first under a cache name that never changed, so an
// installed app kept showing an old home page for days after a release.
//
// Build files under /_next/static/ have the content hash in their names and
// never change, so those are cache-first. Other images, fonts and scripts are
// served from cache and refreshed in the background.
//
// Bump CACHE_NAME whenever this file's caching rules change: activate()
// deletes every other cache, which clears anything stale on people's phones.
const CACHE_NAME = 'resident-v3'
const PRECACHE = ['/offline.html', '/logo.png', '/manifest.json']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  )
})

function isCacheable(response) {
  return response && response.status === 200 && response.type === 'basic'
}

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET' || !request.url.startsWith('http')) return

  const url = new URL(request.url)
  // Never cache other sites (Supabase, maps) or anything personal.
  if (url.hostname !== self.location.hostname) return
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/auth/') || url.pathname.startsWith('/rest/')) return

  const isPage = request.mode === 'navigate' || (request.headers.get('accept') || '').includes('text/html')

  if (isPage) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (isCacheable(response)) {
            const copy = response.clone()
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy))
          }
          return response
        })
        .catch(() => caches.match(request).then((cached) => cached || caches.match('/offline.html')))
    )
    return
  }

  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      caches.match(request).then((cached) => cached || fetch(request).then((response) => {
        if (isCacheable(response)) {
          const copy = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy))
        }
        return response
      }))
    )
    return
  }

  const type = url.pathname.match(/\.(png|jpe?g|webp|gif|svg|ico|woff2?|css|js)$/i)
  if (!type) return

  event.respondWith(
    caches.match(request).then((cached) => {
      const refresh = fetch(request).then((response) => {
        if (isCacheable(response)) {
          const copy = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy))
        }
        return response
      }).catch(() => cached)
      return cached || refresh
    })
  )
})
