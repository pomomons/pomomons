/* PomoMons service worker.
 *
 * Goal: the app opens instantly and still works with no connection, without
 * ever trapping someone on a stale version.
 *
 *   - Bump CACHE_VERSION on every deploy that changes a precached file. The
 *     old caches are deleted on activate.
 *   - Navigations (the HTML page) are network-first, so an online visitor
 *     always gets the freshest index.html and only falls back to the cached
 *     copy when offline.
 *   - Other same-origin files (CSS/JS/sprites/backgrounds) are
 *     stale-while-revalidate: served from cache immediately, refreshed in the
 *     background for next time.
 *   - Google Fonts are cache-first (they never change under a given URL).
 *   - The signup endpoint (script.google.com) and GoatCounter are left alone
 *     entirely — they must always hit the network, and failing offline is
 *     already handled in the app.
 */

const CACHE_VERSION = 'v12';
const PRECACHE = `pomomons-precache-${CACHE_VERSION}`;
const RUNTIME  = `pomomons-runtime-${CACHE_VERSION}`;

// The app shell — enough to boot and run a full session offline. Individual
// mon sprites are intentionally left out (there are dozens); they get cached
// on first view by the stale-while-revalidate path below.
const PRECACHE_URLS = [
  './',
  'index.html',
  'manifest.webmanifest',
  'style.css',
  'style-v2.css',
  'style-v3.css',
  'monsters.js',
  'game.js',
  'collection.js',
  'backup.js',
  'audio.js',
  'app.js',
  'signup.js',
  'assets/backgrounds/forest.webp',
  'assets/backgrounds/forest-red.webp',
  'assets/sprites/Ground/Ground1.png',
  'assets/sprites/Tomato/Tomato.png',
  'assets/icons/icon-192.png',
  'assets/icons/icon-512.png',
  // Both faces are self-hosted now, so both belong in the shell.
  'assets/fonts/PressStart2P-latin.woff2',
  'assets/fonts/PressStart2P-SMBTLL-digits.woff2',
];


self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(PRECACHE);
    // add() one at a time rather than addAll(): a single missing file must not
    // abort the whole install.
    await Promise.allSettled(PRECACHE_URLS.map((url) => cache.add(url)));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keep = new Set([PRECACHE, RUNTIME]);
    const names = await caches.keys();
    await Promise.all(names.map((n) => (keep.has(n) ? null : caches.delete(n))));
    await self.clients.claim();
  })());
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Only ever touch GET. Let POSTs (the signup) and everything else pass.
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Cross-origin: nothing left to cache here. Both fonts are same-origin now,
  // and GoatCounter must always hit the network, so don't intercept at all.
  if (url.origin !== self.location.origin) return;

  // Same-origin navigation (the HTML document): network-first.
  if (request.mode === 'navigate') {
    event.respondWith(networkFirstPage(request));
    return;
  }

  // Same-origin static asset: stale-while-revalidate.
  event.respondWith(staleWhileRevalidate(request));
});

async function networkFirstPage(request) {
  const cache = await caches.open(PRECACHE);
  try {
    const fresh = await fetch(request);
    // Keep the cached shell current for offline use.
    cache.put('index.html', fresh.clone());
    return fresh;
  } catch (err) {
    return (
      (await cache.match('index.html')) ||
      (await cache.match('./')) ||
      Response.error()
    );
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(RUNTIME);
  const cached = await cache.match(request);

  const network = fetch(request)
    .then((resp) => {
      // Only cache real, complete responses (not opaque / 206 range / errors).
      if (resp && resp.ok && resp.status === 200) cache.put(request, resp.clone());
      return resp;
    })
    .catch(() => undefined);

  return cached || (await network) || fetch(request);
}
