// Service Worker de Seguridad La Memoria: abre sin internet; se actualiza solo por detrás.
const CACHE_NAME = 'seguridad-lm-v48';
const ASSETS = ['./','./index.html','./app.css','./campos-lm.js','./legado.js','./core.js','./vistas.js','./qrcode.js','./qr-acceso.js','./qr-invitaciones.js','./apoyo.js','./rondines-extra.js','./riesgo-panel.js','./inocuidad-ui.js','./inocuidad/re-pl-164.js','./inocuidad/pdf-lib.min.js','./inocuidad/jszip.min.js','./inocuidad/logo.png','./inocuidad/RE-PL-164.pdf','./rol.js','./riesgo.js','./manifest.json','./icon-192.png','./icon-512.png','./apple-touch-icon.png'];
self.addEventListener('install', e => { self.skipWaiting(); e.waitUntil(caches.open(CACHE_NAME).then(c => Promise.all(ASSETS.map(u => c.add(u).catch(()=>{}))))); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
// Apertura rápida: se abre al instante con la copia guardada y la red la actualiza por detrás
// (la versión nueva se usa en la siguiente apertura). Si no hay copia guardada, se pide a la red.
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith((async () => {
    const c = await caches.open(CACHE_NAME);
    const guardado = (await c.match(req)) || (await c.match(req, { ignoreSearch: true })) ||
      (req.mode === 'navigate' ? ((await c.match('./index.html')) || (await c.match('./'))) : undefined);
    const red = fetch(req, { cache: 'no-cache' }).then(r => {
      if (r && r.ok && r.type === 'basic') { const cp = r.clone(); c.put(req, cp).catch(() => {}); }
      return r;
    });
    if (guardado) { e.waitUntil(red.then(() => {}, () => {})); return guardado; }
    return red.catch(() => Response.error());
  })());
});
