const CACHE = 'diet-copilot-dashboard-v6.1.1-ui-hotfix';
const SUPABASE_SDK = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.116.0';
const CORE = [
  './',
  './index.html',
  './dashboard-01.css?v=5.2',
  './dashboard-02.css?v=5.2',
  './dashboard-03.css?v=5.2',
  './dashboard-p2.css?v=5.2',
  './dashboard-p3.css?v=5.2',
  './dashboard-p4.css?v=5.2',
  './dashboard-p5.css?v=5.2',
  './dashboard-p6.css?v=5.2',
  './dashboard-v5.css?v=5.2',
  './dashboard-v5-1.css?v=5.2',
  './dashboard-v5-2.css?v=5.2',
  './dashboard-v5-3.css?v=5.3',
  './dashboard-v6.css?v=6.0',
  './dashboard-v6-1-1.css?v=6.1.1',
  './dashboard-01.js?v=5.2',
  './dashboard-02.js?v=5.2',
  './dashboard-p2.js?v=5.2',
  './dashboard-p2-session.js?v=5.2',
  './dashboard-p3.js?v=5.2',
  './dashboard-03.js?v=5.2',
  './dashboard-auth-persist.js?v=5.3.1',
  './dashboard-auth.js?v=5.3.1',
  './dashboard-p4.js?v=5.2',
  './dashboard-p5.js?v=5.2',
  './dashboard-p6.js?v=5.2',
  './dashboard-v5.js?v=5.2',
  './dashboard-v5-1.js?v=5.2',
  './dashboard-v5-2.js?v=5.2',
  './dashboard-v5-3.js?v=5.3',
  './dashboard-auth-final.js?v=5.3.2',
  './dashboard-04.js?v=5.3.1',
  './dashboard-v6.js?v=6.0',
  './dashboard-v6-1.js?v=6.1',
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
      .then(() => self.clients.matchAll({ type: 'window', includeUncontrolled: true }))
      .then(clients => Promise.all(clients.map(client => {
        if (typeof client.navigate !== 'function') return null;
        return client.navigate(client.url).catch(() => null);
      })))
  );
});

function networkFirst(request, fallbackKey = request) {
  return fetch(request)
    .then(response => {
      if (response && response.ok) {
        const copy = response.clone();
        caches.open(CACHE).then(cache => cache.put(fallbackKey, copy));
      }
      return response;
    })
    .catch(() => caches.match(fallbackKey));
}

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  if (url.href === SUPABASE_SDK) {
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
    return;
  }

  // Supabase API/Auth/Realtime responses are never service-worker cached.
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request, './index.html'));
    return;
  }

  // JavaScript controls backend selection, auth and data synchronization.
  // Prefer the deployment over a stale PWA copy; fall back to cache offline.
  if (url.pathname.endsWith('.js') || url.pathname.endsWith('/manifest.webmanifest')) {
    event.respondWith(networkFirst(request));
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
