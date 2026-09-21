/* SAWABA offline service worker (hand-written, dependency-free).
 *
 * Strategy:
 *  - Precache the app shell (offline.html fallback + fonts + key images).
 *  - Navigations: network-first, fall back to cache, then offline.html.
 *  - Static assets (js/css/fonts/images): stale-while-revalidate.
 *  - /uploads/** images (barber/gallery/service photos): cache-first so
 *    they render offline after being seen once.
 *  - /api/**: NEVER cached here — structured API data goes through the
 *    IndexedDB layer in src/api/offlineCache.ts. Auth tokens never touch
 *    the service worker.
 */

const VERSION = 'v1'
const SHELL_CACHE = `sawaba-shell-${VERSION}`
const ASSET_CACHE = `sawaba-assets-${VERSION}`
const UPLOAD_CACHE = `sawaba-uploads-${VERSION}`

const SHELL_ASSETS = [
  '/offline.html',
  '/manifest.webmanifest',
  '/favicon.svg',
  '/fonts/inter-latin-wght-normal.woff2',
  '/fonts/playfair-display-latin-wght-normal.woff2',
  '/images/hero.jpg',
  '/images/cta.jpg',
  '/images/about-1.jpg',
  '/images/about-2.jpg',
  '/images/about-3.jpg',
  '/images/about-story.jpg',
  '/images/about-team.jpg',
  '/images/pagehero.jpg',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_ASSETS))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith('sawaba-') && key !== SHELL_CACHE && key !== ASSET_CACHE && key !== UPLOAD_CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  // API: never intercepted — the app handles offline via IndexedDB cache.
  if (url.pathname.startsWith('/api/')) return

  // Locally uploaded images: cache-first (offline persistence for photos).
  if (url.pathname.startsWith('/uploads/')) {
    event.respondWith(
      caches.open(UPLOAD_CACHE).then(async (cache) => {
        const hit = await cache.match(request)
        if (hit) return hit
        try {
          const response = await fetch(request)
          if (response.ok) cache.put(request, response.clone())
          return response
        } catch {
          return new Response('', { status: 504, statusText: 'Offline' })
        }
      }),
    )
    return
  }

  // SPA navigations: network-first → cache → offline fallback page.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone()
          caches.open(ASSET_CACHE).then((cache) => cache.put(request, copy))
          return response
        })
        .catch(async () => {
          const cached = await caches.match(request)
          return cached ?? (await caches.match('/offline.html')) ?? Response.error()
        }),
    )
    return
  }

  // Same-origin static assets: stale-while-revalidate.
  event.respondWith(
    caches.open(ASSET_CACHE).then(async (cache) => {
      const cached = await cache.match(request)
      const network = fetch(request)
        .then((response) => {
          if (response.ok) cache.put(request, response.clone())
          return response
        })
        .catch(() => cached ?? Response.error())
      return cached ?? network
    }),
  )
})
