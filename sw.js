const CACHE = 'diet-copilot-dashboard-v3.1.1';
const CORE = [
  './',
  './index.html',
  './dashboard-01.css?v=3.1.1',
  './dashboard-02.css?v=3.1.1',
  './dashboard-03.css?v=3.1.1',
  './dashboard-config.js?v=3.1.1',
  './dashboard-01.js?v=3.1.1',
  './dashboard-02.js?v=3.1.1',
  './dashboard-03.js?v=3.1.1',
  './dashboard-04.js?v=3.1.1',
  './manifest.webmanifest',
  './icon.svg',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(CORE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(key => key !== CACHE && key.startsWith('diet-copilot'))
          .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Only same-origin app files are eligible for caching. Authenticated
  // Supabase/API/CDN requests must always reach the network.
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(response => {
          const copy = response.clone();
          caches.open(CACHE).then(cache => cache.put('./index.html', copy));
          return response;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;
      return fetch(request).then(response => {
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(CACHE).then(cache => cache.put(request, copy));
        }
        return response;
      });
    })
  );
});
