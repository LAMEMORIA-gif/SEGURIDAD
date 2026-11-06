// Service Worker de Seguridad La Memoria: abre sin internet; network-first para que se actualice solo.
const CACHE_NAME = 'seguridad-lm-v2';
const ASSETS = ['./','./index.html','./app.css','./legado.js','./core.js','./vistas.js','./rol.js','./riesgo.js','./manifest.json','./icon-192.png','./icon-512.png','./apple-touch-icon.png'];
self.addEventListener('install', e => { self.skipWaiting(); e.waitUntil(caches.open(CACHE_NAME).then(c => Promise.all(ASSETS.map(u => c.add(u).catch(()=>{}))))); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(fetch(e.request).then(r => { const cp = r.clone(); caches.open(CACHE_NAME).then(c => c.put(e.request, cp)); return r; }).catch(() => caches.match(e.request)));
});
