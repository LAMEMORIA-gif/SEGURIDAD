// Service Worker de Seguridad La Memoria: abre sin internet; network-first para que se actualice solo.
const CACHE_NAME = 'seguridad-lm-v19';
const ASSETS = ['./','./index.html','./app.css','./legado.js','./core.js','./vistas.js','./apoyo.js','./rondines-extra.js','./riesgo-panel.js','./inocuidad-ui.js','./inocuidad/re-pl-164.js','./inocuidad/pdf-lib.min.js','./inocuidad/jszip.min.js','./inocuidad/logo.png','./inocuidad/RE-PL-164.pdf','./rol.js','./riesgo.js','./manifest.json','./icon-192.png','./icon-512.png','./apple-touch-icon.png'];
self.addEventListener('install', e => { self.skipWaiting(); e.waitUntil(caches.open(CACHE_NAME).then(c => Promise.all(ASSETS.map(u => c.add(u).catch(()=>{}))))); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(fetch(e.request, { cache: 'no-store' }).then(r => { const cp = r.clone(); caches.open(CACHE_NAME).then(c => c.put(e.request, cp)); return r; }).catch(() => caches.match(e.request)));
});
