const CACHE = 'diet-copilot-v0.5-shell';
const CORE = ['./', './index.html', './styles-01.css','./styles-02.css','./styles-03.css','./styles-04.css', './app-01.js', './app-02.js', './app-03.js', './app-04.js', './app-05.js', './app-06.js', './app-07.js', './app-08.js', './app-09.js', './app-10.js', './app-11.js', './app-12.js', './app-13.js', './app-14.js', './app-15.js', './app-16.js', './app-17.js', './app-18.js', './app-19.js', './app-20.js', './app-21.js', './manifest.webmanifest', './icon.svg', './icon-192.png', './icon-512.png'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE && k.startsWith('diet-copilot-')).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;
  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request).then(response => {
      const copy = response.clone(); caches.open(CACHE).then(cache => cache.put('./index.html', copy)); return response;
    }).catch(() => caches.match('./index.html')));
    return;
  }
  event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request).then(response => {
    if (response && (response.ok || response.type === 'opaque')) {
      const copy = response.clone(); caches.open(CACHE).then(cache => cache.put(event.request, copy));
    }
    return response;
  })));
});
