/* Seguridad La Memoria — geocercas por campo para los rondines (se guardan en la configuración del ERP y entran al respaldo) */
'use strict';
const GEO_UMBRAL = 0.8; // proporción de puntos GPS que deben caer dentro del radio para considerar el rondín "dentro"
const geoTodas = () => cfgGet('geocercas', {}) || {};
const geoDe = area => { const g = geoTodas()[normCampo(area)]; return g && g.lat != null && g.lng != null && g.radioM > 0 ? g : null; };
function geoMetros(a, b) {
  const R = 6371000, rad = Math.PI / 180, dl = (b.lat - a.lat) * rad, dg = (b.lng - a.lng) * rad;
  const x = Math.sin(dl / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dg / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}
function geoPct(r) {
  const g = geoDe(r.area), p = (r.ruta || []).filter(x => x.lat != null && x.lng != null);
  if (!g || !p.length) return null;
  return p.filter(x => geoMetros(g, x) <= g.radioM).length / p.length;
}
function geoEstado(r) { const v = geoPct(r); return v == null ? 'SIN_DEFINIR' : v >= GEO_UMBRAL ? 'DENTRO' : 'FUERA'; }
const geoPill = r => { const e = geoEstado(r), v = geoPct(r); return e === 'SIN_DEFINIR' ? '<span class="nota">sin geocerca</span>' : pill((e === 'DENTRO' ? '✓ Dentro' : '⚠ Fuera') + ' · ' + Math.round(v * 100) + '%', e === 'DENTRO' ? 'ok' : 'mal'); };
// Centro y radio sugeridos con los puntos GPS de los rondines ya registrados del campo
function geoSugerir(campo) {
  const p = DATA.rondines.filter(r => normCampo(r.area) === campo).flatMap(r => (r.ruta || []).filter(x => x.lat != null && x.lng != null));
  if (p.length < 5) return null;
  const med = a => { a = a.slice().sort((x, y) => x - y); return a[Math.floor(a.length / 2)]; };
  const c = { lat: med(p.map(x => x.lat)), lng: med(p.map(x => x.lng)) };
  const d = p.map(x => geoMetros(c, x)).sort((x, y) => x - y), p90 = d[Math.floor(d.length * 0.9)];
  return { lat: +c.lat.toFixed(6), lng: +c.lng.toFixed(6), radioM: Math.max(100, Math.ceil((p90 + 30) / 10) * 10), n: p.length };
}
function geoImportarPanel() { // geocercas ya capturadas en el panel de RONDINES (mismo sitio web, mismo almacenamiento del navegador)
  let o = {}; try { o = JSON.parse(localStorage.getItem('rondines_geocercas_v1') || '{}'); } catch (e) { }
  const out = {}; Object.keys(o).forEach(k => { const g = o[k]; if (g && g.lat != null && g.lng != null) out[normCampo(k)] = { lat: +g.lat, lng: +g.lng, radioM: +g.radioM || 150 }; });
  return out;
}
function cardGeocercas() {
  const T = geoTodas(), ed = puedeEditar(), rs = DATA.rondines, campos = CAMPOS_LM.nombres;
  const fila = c => {
    const g = T[c] || {}, rc = rs.filter(r => normCampo(r.area) === c), conG = g.lat != null ? rc.filter(r => geoEstado(r) !== 'SIN_DEFINIR') : [], dentro = conG.filter(r => geoEstado(r) === 'DENTRO').length;
    const inp = (k, ph, st) => `<input type="number" step="${st}" data-g="${k}" placeholder="${ph}" value="${g[k] != null ? g[k] : ''}" ${ed ? '' : 'disabled'} style="width:${k === 'radioM' ? 80 : 120}px">`;
    return `<tr data-c="${esc(c)}"><td><b>${esc(c)}</b></td><td>${inp('lat', '22.156800', '0.000001')}</td><td>${inp('lng', '-100.984200', '0.000001')}</td><td>${inp('radioM', '150', '10')}</td>
      <td>${g.lat != null ? (conG.length ? pill(Math.round(dentro / conG.length * 100) + '% dentro', dentro / conG.length >= 0.9 ? 'ok' : 'warn') + ' <span class="nota">' + dentro + ' de ' + conG.length + '</span>' : '<span class="nota">sin rondines</span>') : '<span class="nota">sin definir</span>'}</td>
      <td>${ed ? `<button class="btn sec" data-gs="${esc(c)}" title="Calcular con los rondines registrados">Sugerir</button> <button class="btn sec" data-gu="${esc(c)}" title="Usar la ubicación de este dispositivo">Mi ubicación</button> <button class="btn sec" data-gq="${esc(c)}">Quitar</button>` : ''}</td></tr>`;
  };
  const n = campos.filter(c => T[c] && T[c].lat != null).length;
  return card('📍 Geocercas por campo (' + n + ' de ' + campos.length + ' definidas)',
    '<p class="nota">Cada rondín se compara con la geocerca de su campo: se considera dentro si al menos el ' + Math.round(GEO_UMBRAL * 100) + ' % de sus puntos GPS cae dentro del radio. Para fijar el centro, párese en el centro del campo y use "Mi ubicación", capture las coordenadas a mano o use "Sugerir" para calcularlo con los rondines ya registrados.</p>' +
    '<div class="tabla-w"><table class="tabla"><thead><tr><th>Campo</th><th>Latitud</th><th>Longitud</th><th>Radio (m)</th><th>Rondines</th><th></th></tr></thead><tbody>' + campos.map(fila).join('') + '</tbody></table></div>' +
    (ed ? '<div class="barra-acc"><button class="btn" id="geoGuardar">Guardar geocercas</button><button class="btn sec" id="geoSugerirTodas">Sugerir las vacías con los rondines</button><button class="btn sec" id="geoImportar">Importar del panel de RONDINES</button></div><div id="geoMsg" class="nota"></div>' : '<p class="nota">Solo administrador o supervisor puede modificar las geocercas.</p>'));
}
function bindGeocercas(el) {
  const box = $('#geoGuardar', el); if (!box) return;
  const msg = t => { const m = $('#geoMsg', el); if (m) m.textContent = t; };
  const fila = c => $$('tr[data-c]', el).find(t => t.dataset.c === c);
  const poner = (c, g) => { const t = fila(c); if (!t) return; t.querySelector('[data-g=lat]').value = g.lat; t.querySelector('[data-g=lng]').value = g.lng; t.querySelector('[data-g=radioM]').value = g.radioM || 150; };
  const leer = () => { const o = {}; $$('tr[data-c]', el).forEach(t => { const lat = parseFloat(t.querySelector('[data-g=lat]').value), lng = parseFloat(t.querySelector('[data-g=lng]').value), radioM = parseFloat(t.querySelector('[data-g=radioM]').value) || 150; if (isFinite(lat) && isFinite(lng)) o[t.dataset.c] = { lat, lng, radioM }; }); return o; };
  box.onclick = async () => {
    const o = leer(), mal = Object.keys(o).find(c => Math.abs(o[c].lat) > 90 || Math.abs(o[c].lng) > 180 || o[c].radioM < 10);
    if (mal) return msg('Revise ' + mal + ': latitud entre -90 y 90, longitud entre -180 y 180 y radio de al menos 10 m.');
    await cfgSet('geocercas', o); toast('Geocercas guardadas'); renderApp();
  };
  $$('[data-gs]', el).forEach(b => b.onclick = () => { const g = geoSugerir(b.dataset.gs); if (!g) return msg('No hay suficientes puntos GPS de rondines en ' + b.dataset.gs + ' para sugerir.'); poner(b.dataset.gs, g); msg(b.dataset.gs + ': sugerida con ' + g.n + ' puntos GPS. Revise y pulse Guardar.'); });
  $$('[data-gq]', el).forEach(b => b.onclick = () => { const t = fila(b.dataset.gq); ['lat', 'lng', 'radioM'].forEach(k => t.querySelector('[data-g=' + k + ']').value = ''); msg('Pulse Guardar para quitar la geocerca de ' + b.dataset.gq + '.'); });
  $$('[data-gu]', el).forEach(b => b.onclick = () => {
    if (!navigator.geolocation) return msg('Este dispositivo no permite obtener la ubicación.');
    msg('Obteniendo ubicación…');
    navigator.geolocation.getCurrentPosition(p => { const t = fila(b.dataset.gu); poner(b.dataset.gu, { lat: +p.coords.latitude.toFixed(6), lng: +p.coords.longitude.toFixed(6), radioM: +t.querySelector('[data-g=radioM]').value || 150 }); msg(b.dataset.gu + ': ubicación actual (±' + Math.round(p.coords.accuracy) + ' m). Pulse Guardar.'); }, () => msg('No se pudo obtener la ubicación. Permita el acceso o capture las coordenadas a mano.'), { enableHighAccuracy: true, timeout: 15000 });
  });
  $('#geoSugerirTodas', el).onclick = () => { let n = 0; CAMPOS_LM.nombres.forEach(c => { const t = fila(c); if (t && !t.querySelector('[data-g=lat]').value) { const g = geoSugerir(c); if (g) { poner(c, g); n++; } } }); msg(n + ' geocerca(s) sugerida(s). Revise y pulse Guardar.'); };
  $('#geoImportar', el).onclick = () => { const o = geoImportarPanel(), ks = Object.keys(o); if (!ks.length) return msg('No se encontraron geocercas del panel de RONDINES en este navegador.'); ks.forEach(c => poner(c, o[c])); msg(ks.length + ' geocerca(s) importada(s) del panel de RONDINES. Revise y pulse Guardar.'); };
}
function geoKpi(rs) {
  const c = rs.filter(r => geoEstado(r) !== 'SIN_DEFINIR'); if (!c.length) return kpi('—', 'Dentro de geocerca', '', 'sin geocercas definidas');
  const d = c.filter(r => geoEstado(r) === 'DENTRO').length, p = Math.round(d / c.length * 1000) / 10;
  return kpi(p + '%', 'Rondines dentro de geocerca', semaforo(p, 90, 75), d + ' de ' + c.length);
}
