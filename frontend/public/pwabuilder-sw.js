// keneyakafisa Service Worker - v2 with cache versioning
const CACHE_VERSION = 'v2';
const CACHE_NAME = `keneyakafisa-${CACHE_VERSION}`;

// Page de secours hors-ligne
const offlineFallbackPage = '/index.html';

// Skip waiting immediately when a new SW is found
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Install: cache the offline fallback
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.add(offlineFallbackPage))
      .then(() => self.skipWaiting())
  );
});

// Activate: delete ALL old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch: network-first strategy (always try network, fallback to cache only when offline)
self.addEventListener('fetch', (event) => {
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Update cache with fresh response
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(offlineFallbackPage, responseClone);
          });
          return response;
        })
        .catch(async () => {
          // Only use cache when truly offline
          const cache = await caches.open(CACHE_NAME);
          const cachedResp = await cache.match(offlineFallbackPage);
          return cachedResp;
        })
    );
  }
});
