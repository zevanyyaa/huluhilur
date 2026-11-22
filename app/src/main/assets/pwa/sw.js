const CACHE_NAME = 'hulu-guard-pwa-v1';

const APP_SHELL_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './styles/app.css',
  './js/storage.js',
  './js/icons.js',
  './js/yolo.js',
  './js/app.js',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

const OPTIONAL_ASSETS = [
  './models/yolo11_huluguard.onnx'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      await cache.addAll(APP_SHELL_ASSETS);
      // Try caching optional ONNX model & CDN libraries if available
      for (const url of OPTIONAL_ASSETS) {
        try {
          const response = await fetch(url);
          if (response && response.ok) {
            await cache.put(url, response);
          }
        } catch (_) {
          // Model may be added later or stored in IndexedDB
        }
      }
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Cache-first strategy for app shell, icons, model, and runtime CDN assets (offline mountain support)
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(request)
        .then((networkResponse) => {
          if (
            networkResponse &&
            (networkResponse.status === 200 || networkResponse.type === 'opaque')
          ) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseClone).catch(() => {});
            });
          }
          return networkResponse;
        })
        .catch(() => {
          // Offline navigation fallback to app shell
          if (request.mode === 'navigate' || url.pathname.endsWith('.html')) {
            return caches.match('./index.html');
          }
          return new Response('', { status: 503, statusText: 'Offline' });
        });
    })
  );
});
