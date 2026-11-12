// Service Worker de Seguridad La Memoria: abre sin internet; network-first para que se actualice solo.
const CACHE_NAME = 'seguridad-lm-v33';
const ASSETS = ['./','./index.html','./app.css','./legado.js','./core.js','./vistas.js','./qrcode.js','./qr-acceso.js','./qr-invitaciones.js','./apoyo.js','./rondines-extra.js','./riesgo-panel.js','./inocuidad-ui.js','./inocuidad/re-pl-164.js','./inocuidad/pdf-lib.min.js','./inocuidad/jszip.min.js','./inocuidad/logo.png','./inocuidad/RE-PL-164.pdf','./rol.js','./riesgo.js','./manifest.json','./icon-192.png','./icon-512.png','./apple-touch-icon.png'];
self.addEventListener('install', e => { self.skipWaiting(); e.waitUntil(caches.open(CACHE_NAME).then(c => Promise.all(ASSETS.map(u => c.add(u).catch(()=>{}))))); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
// Apertura rápida aunque la señal sea débil: si la red no responde en 3 segundos se abre la copia guardada
// (y la red la actualiza por detrás). Antes, con poca señal, la app se quedaba congelada en el ícono.
const TIEMPO_RED = 3000;
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  const red = fetch(req, { cache: 'no-store' }).then(r => {
    if (r && r.ok && r.type === 'basic') { const cp = r.clone(); caches.open(CACHE_NAME).then(c => c.put(req, cp)).catch(() => {}); }
    return r;
  });
  e.waitUntil(red.then(() => {}, () => {}));
  e.respondWith((async () => {
    const c = await caches.open(CACHE_NAME);
    const guardado = (await c.match(req)) || (await c.match(req, { ignoreSearch: true })) ||
      (req.mode === 'navigate' ? ((await c.match('./index.html')) || (await c.match('./'))) : undefined);
    if (!guardado) return red.catch(() => Response.error());
    const r = await Promise.race([red.catch(() => null), new Promise(res => setTimeout(() => res(null), TIEMPO_RED))]);
    return (r && r.ok) ? r : guardado;
  })());
});
