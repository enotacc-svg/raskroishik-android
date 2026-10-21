const CACHE = 'raskroishik-2.4.1';
const FILES = ['./', './index.html', './styles.css', './core.js', './app.js',
'./manifest.webmanifest', './icons/icon-192.png', './icons/brand-avatar.png'];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  if(event.request.method!=='GET')return;
  event.respondWith(caches.match(event.request).then(r=>r||fetch(event.request)));
});
