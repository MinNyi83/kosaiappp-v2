const CACHE_NAME = 'kosai-tech-portal-v4';
const ASSETS_TO_CACHE = [
  './app.html',
  './app.js',
  './tailwind.css',
  './logo.png',
  './logo.svg',
  'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  // Skip cross-origin requests
  if (!event.request.url.startsWith(self.location.origin)) return;
  // Network-first for JS/HTML, cache-first for others
  const isCode = event.request.url.match(/\.(js|html)(\?|$)/);
  event.respondWith(
    isCode
      ? fetch(event.request)
          .then((response) => {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
            return response;
          })
          .catch(() => caches.match(event.request))
      : caches.match(event.request).then((response) => {
          return response || fetch(event.request);
        })
  );
});
