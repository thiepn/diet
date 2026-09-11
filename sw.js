const CACHE = 'diet-copilot-dashboard-v3';
const CORE = ['./','./index.html','./dashboard-config.js','./dashboard-01.css','./dashboard-02.css','./dashboard-03.css','./dashboard-01.js','./dashboard-02.js','./dashboard-03.js','./dashboard-04.js','./manifest.webmanifest','./icon.svg','./icon-192.png','./icon-512.png'];
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting())));
self.addEventListener('activate', event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE && k.startsWith('diet-copilot')).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (!['http:','https:'].includes(url.protocol)) return;
  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request).then(r => { const copy = r.clone(); caches.open(CACHE).then(c => c.put('./index.html', copy)); return r; }).catch(() => caches.match('./index.html')));
    return;
  }
  event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request).then(r => { if (r && (r.ok || r.type === 'opaque')) { const copy = r.clone(); caches.open(CACHE).then(c => c.put(event.request, copy)); } return r; })));
});
