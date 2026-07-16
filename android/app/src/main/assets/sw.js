const CACHE_NAME = 'tech-hub-v20';
const ASSETS = [
  './index.html',
  './styles.css',
  './app.js',
  './xlsx.full.min.js',
  './hero_image.png',
  './cable_before.png',
  './cable_after.png',
  './manifest.json',
  
  // Templates
  './templates/landing.html',
  './templates/login.html',
  './templates/sidebar.html',
  './templates/topbar.html',
  './templates/modals.html',
  
  // Page Templates
  './templates/pages/dashboard.html',
  './templates/pages/tickets.html',
  './templates/pages/amc.html',
  './templates/pages/pos.html',
  './templates/pages/accounting.html',
  './templates/pages/hr.html',
  './templates/pages/warranty.html',
  './templates/pages/distributors.html',
  './templates/pages/technicians.html',
  './templates/pages/tech_portal.html',
  './templates/pages/deployment.html',
  './templates/pages/reports.html',
  './templates/pages/settings.html',
  './templates/pages/inventory.html',
  './templates/pages/cashier_dashboard.html',
  './templates/pages/customer_portal.html',
  './templates/pages/currency_manager.html'
];

// Install Service Worker and cache resources
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Caching app assets');
      return cache.addAll(ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate Service Worker and clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[Service Worker] Deleting old cache:', key);
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Cache-first / Network-fallback Strategy
self.addEventListener('fetch', (event) => {
  // Only handle GET requests and local app assets
  if (event.request.method !== 'GET') return;
  
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request).then((networkResponse) => {
        // Cache newly fetched local assets dynamically
        if (networkResponse && networkResponse.status === 200 && event.request.url.startsWith(self.location.origin)) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      }).catch(() => {
        // Fallback for offline mode when request not in cache
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
      });
    })
  );
});
