const CACHE = 'diet-copilot-dashboard-v5.3.1-auth-hotfix';
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
  './dashboard-01.js?v=5.2',
  './dashboard-02.js?v=5.2',
  './dashboard-p2.js?v=5.2',
  './dashboard-p2-session.js?v=5.2',
  './dashboard-p3.js?v=5.2',
  './dashboard-03.js?v=5.2',
  './dashboard-auth-persist.js?v=5.2.3',
  './dashboard-auth.js?v=5.2',
  './dashboard-p4.js?v=5.2',
  './dashboard-p5.js?v=5.2',
  './dashboard-p6.js?v=5.2',
  './dashboard-v5.js?v=5.2',
  './dashboard-v5-1.js?v=5.2',
  './dashboard-v5-2.js?v=5.2',
  './dashboard-v5-3.js?v=5.3',
  './dashboard-04.js?v=5.2',
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
      // The previous release reused the old dashboard-auth.js?v=5.2 URL after
      // changing its contents. Existing PWAs could therefore stay on the old
      // email/password-only login UI indefinitely. Reload controlled windows
      // once when this worker takes over so the repaired auth UI is immediate.
      .then(() => self.clients.matchAll({ type: 'window', includeUncontrolled: true }))
      .then(clients => Promise.all(clients.map(client => {
        if (typeof client.navigate !== 'function') return null;
        return client.navigate(client.url).catch(() => null);
      })))
  );
});

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

  // Authentication code must prefer the network. These files control which
  // identity provider is shown and how sessions are restored; stale copies can
  // lock the user out even while the deployment itself is correct.
  if (url.pathname.endsWith('/dashboard-auth.js') ||
      url.pathname.endsWith('/dashboard-auth-persist.js')) {
    event.respondWith(
      fetch(request)
        .then(response => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then(cache => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => caches.match(request))
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
