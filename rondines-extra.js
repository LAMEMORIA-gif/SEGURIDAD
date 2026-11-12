// Rondines: mapa de rutas (GPS), galería de fotos de puntos y gráficas adicionales
const RX_PAL = ['#ffb45e', '#4cd07a', '#f2c744', '#ff7a70', '#a9ccff', '#d68cff', '#5fe0d6', '#ff8fb8', '#b6e35a', '#e0a070'];
const rxKey = t => String(t || 'Sin área').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim().toUpperCase();
const rxBonito = t => { const c = CAMPOS_LM.nombres.concat(['Otros', 'Sin campo']).find(x => rxKey(x) === rxKey(t)); if (c) return c; const s = rxKey(t); return s.charAt(0) + s.slice(1).toLowerCase(); };
function rxKm(ruta) {
  const p = (ruta || []).filter(x => x.lat != null && x.lng != null); let d = 0;
  for (let i = 1; i < p.length; i++) {
    const R = 6371, rad = Math.PI / 180, dl = (p[i].lat - p[i - 1].lat) * rad, dg = (p[i].lng - p[i - 1].lng) * rad;
    const a = Math.sin(dl / 2) ** 2 + Math.cos(p[i - 1].lat * rad) * Math.cos(p[i].lat * rad) * Math.sin(dg / 2) ** 2;
    const seg = 2 * R * Math.asin(Math.sqrt(a)); if (seg < 2) d += seg; // ignora saltos GPS absurdos
  }
  return d;
}
const rxDur = r => r.fin && r.inicio ? (r.fin - r.inicio) / 60000 : null;
const rxLunes = ts => { const d = new Date(ts); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return isoDia(d.getTime()); };
const rxProm = a => a.length ? sum(a) / a.length : 0;
const rxMax = ss => Math.max(4, ...ss.flatMap(x => x.valores));
const rxR1 = v => Math.round(v * 10) / 10;

// ---------- ventanita al pasar el cursor por un punto del mapa (nombre + miniatura) ----------
const rxTipReg = [];
(function () {
  let tip = null;
  const crear = () => { tip = document.createElement('div'); tip.style.cssText = 'position:fixed;z-index:100000;pointer-events:none;background:#0c2070;color:#fff;border:1px solid #4f8fd6;border-radius:8px;padding:8px 10px;font-size:12.5px;max-width:230px;box-shadow:0 6px 18px rgba(0,0,0,.45);display:none'; document.body.appendChild(tip); };
  const mover = e => { const w = tip.offsetWidth, h = tip.offsetHeight; let x = e.clientX + 14, y = e.clientY + 14; if (x + w > innerWidth - 6) x = e.clientX - w - 14; if (y + h > innerHeight - 6) y = e.clientY - h - 14; tip.style.left = Math.max(4, x) + 'px'; tip.style.top = Math.max(4, y) + 'px'; };
  document.addEventListener('mouseover', e => {
    const c = e.target.closest && e.target.closest('.rx-pt'); if (!c) return; const d = rxTipReg[+c.dataset.tip]; if (!d) return; if (!tip) crear();
    tip.innerHTML = (d.foto ? `<img src="${d.foto}" style="display:block;width:100%;max-height:130px;object-fit:cover;border-radius:6px;margin-bottom:6px" alt="">` : '') + `<b>${esc(d.n)}</b><br><span style="opacity:.85">${esc(d.t)}</span>` + (d.ts ? `<br><span style="opacity:.7">${fmtFH(d.ts)}</span>` : '');
    tip.style.display = 'block'; mover(e);
  });
  document.addEventListener('mousemove', e => { if (tip && tip.style.display === 'block') mover(e); });
  document.addEventListener('mouseout', e => { const c = e.target.closest && e.target.closest('.rx-pt'); if (c && tip) tip.style.display = 'none'; });
  document.addEventListener('click', e => { const c = e.target.closest && e.target.closest('.rx-pt'); if (c) { const d = rxTipReg[+c.dataset.tip]; if (d && d.foto) rxLightbox(d.foto); } });
})();

// ---------- mapa de rutas (plano de coordenadas, funciona sin internet) ----------
function rxMapaSVG(rs, opc) {
  opc = opc || {};
  const W = opc.W || 760, H = opc.H || 420, pad = 28;
  const pts = rs.flatMap(r => (r.ruta || []).filter(p => p.lat != null && p.lng != null));
  if (pts.length < 2) return '<div class="vacio">No hay puntos GPS suficientes para dibujar la ruta.</div>';
  const lats = pts.map(p => p.lat), lngs = pts.map(p => p.lng);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats), minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
  const k = Math.cos((minLat + maxLat) / 2 * Math.PI / 180);
  let sx = Math.max(0.00005, (maxLng - minLng) * k), sy = Math.max(0.00005, maxLat - minLat);
  const esc_ = Math.min((W - pad * 2) / sx, (H - pad * 2) / sy);
  const offX = (W - sx * esc_) / 2, offY = (H - sy * esc_) / 2;
  const X = p => offX + (p.lng - minLng) * k * esc_, Y = p => H - offY - (p.lat - minLat) * esc_;
  const areas = []; rs.forEach(r => { const a = normCampo(r.area); if (!areas.includes(a)) areas.push(a); });
  const col = a => RX_PAL[areas.indexOf(a) % RX_PAL.length];
  let g = `<rect x="0" y="0" width="${W}" height="${H}" rx="8" fill="#0c2070"/>`;
  for (let i = 1; i < 6; i++) g += `<line x1="${i * W / 6}" x2="${i * W / 6}" y1="0" y2="${H}" class="gl" opacity=".35"/>`;
  for (let i = 1; i < 4; i++) g += `<line y1="${i * H / 4}" y2="${i * H / 4}" x1="0" x2="${W}" class="gl" opacity=".35"/>`;
  rs.forEach(r => {
    const p = (r.ruta || []).filter(x => x.lat != null && x.lng != null); if (p.length < 2) return;
    const paso = Math.ceil(p.length / 600), q = p.filter((_, i) => i % paso === 0 || i === p.length - 1);
    g += `<polyline points="${q.map(z => X(z).toFixed(1) + ',' + Y(z).toFixed(1)).join(' ')}" fill="none" stroke="${col(normCampo(r.area))}" stroke-width="2" stroke-opacity=".75" stroke-linejoin="round"><title>${esc(r.guardia)} · ${esc(r.area)} · ${fmtFH(r.inicio)}</title></polyline>`;
  });
  const dot = (p, c, rad, t, info) => {
    const id = info ? rxTipReg.push(info) - 1 : -1;
    return `<circle cx="${X(p).toFixed(1)}" cy="${Y(p).toFixed(1)}" r="${rad}" fill="${c}" stroke="#000" stroke-opacity=".5"${id >= 0 ? ` class="rx-pt" data-tip="${id}" style="cursor:pointer"` : ''}>${id >= 0 ? '' : `<title>${esc(t)}</title>`}</circle>`;
  };
  const nombrar = { checkpoint: 'Punto de control', parada: 'Parada libre', novedad: 'Novedad' };
  rs.forEach(r => {
    const filas = rxFilas(r), usadas = new Set();
    // une cada punto GPS marcado con el registro (nombre, foto, hora) que se guardó en esa misma posición
    const buscar = p => { const i = filas.findIndex((f, j) => !usadas.has(j) && f.k === p.tipo && f.lat === p.lat && f.lng === p.lng); if (i >= 0) { usadas.add(i); return filas[i]; } return null; };
    (r.ruta || []).filter(p => p.lat != null && p.lng != null).forEach(p => {
      const col_ = p.tipo === 'checkpoint' ? '#4cd07a' : p.tipo === 'parada' ? '#f2c744' : p.tipo === 'novedad' ? '#e0459b' : null; if (!col_) return;
      const f = buscar(p), base = nombrar[p.tipo];
      g += dot(p, col_, p.tipo === 'novedad' ? 5 : 4, base, { n: f ? f.n : base, t: f ? f.t : base, ts: f ? f.ts : p.ts, foto: f ? f.foto : '', g: r.guardia, a: r.area });
    });
    if (opc.extremos) {
      const p = (r.ruta || []).filter(x => x.lat != null && x.lng != null);
      if (p.length) { g += dot(p[0], '#ffb45e', 6, 'Inicio'); g += dot(p[p.length - 1], '#d6382e', 6, 'Fin'); }
    }
  });
  let ley = '<div class="leyenda">' + (opc.extremos ? '<span><i style="background:#ffb45e"></i>Inicio</span><span><i style="background:#d6382e"></i>Fin</span>' : areas.map(a => `<span><i style="background:${col(a)}"></i>${esc(rxBonito(a))}</span>`).join(''));
  ley += '<span><i style="background:#4cd07a;border-radius:50%"></i>Punto de control</span><span><i style="background:#f2c744;border-radius:50%"></i>Parada libre</span><span><i style="background:#e0459b;border-radius:50%"></i>Novedad</span></div>';
  return `<svg viewBox="0 0 ${W} ${H}" class="mapa" role="img">${g}</svg>${ley}`;
}

// ---------- fotos ----------
function rxFilas(r) {
  const f = [];
  (r.checkpoints || []).forEach(c => f.push({ k: 'checkpoint', lat: c.lat, lng: c.lng, n: c.nombre, t: c.marcado ? 'Punto de control · ' + (c.viaQR ? 'QR' : 'manual') : 'NO visitado', ts: c.ts, foto: c.foto, nota: c.nota, mal: !c.marcado }));
  (r.paradasLibres || []).forEach(p => f.push({ k: 'parada', lat: p.lat, lng: p.lng, n: p.descripcion || 'Parada libre', t: 'Parada libre', ts: p.ts, foto: p.foto, nota: p.nota }));
  (r.novedades || []).forEach(n => f.push({ k: 'novedad', lat: n.lat, lng: n.lng, n: n.descripcion || 'Novedad', t: '🔍 ' + (n.tipoNovedad || 'Novedad') + (n.resuelta ? ' · resuelta' : ' · ⏳ pendiente'), ts: n.tsDetectada || n.ts, foto: n.foto, nota: n.nota, mal: !n.resuelta }));
  return f;
}
const rxThumb = f => `<div class="thumb"><div class="thumb-img">${f.foto ? `<img src="${f.foto}" class="rx-foto" alt="">` : `<span>${f.ts ? '📍' : '⬜'}</span>`}</div><div class="thumb-l ${f.mal ? 'mal' : ''}"><b>${esc(f.n)}</b><br>${esc(f.t)}<br>${f.ts ? fmtFH(f.ts) : 'sin marcar'}</div></div>`;
function rxLightbox(src) {
  const d = document.createElement('div'); d.className = 'overlay'; d.innerHTML = `<img src="${src}" style="max-width:96vw;max-height:92vh;border-radius:8px">`;
  d.onclick = () => d.remove(); document.body.appendChild(d);
}

function abrirRondin(r) {
  const dist = rxKm(r.ruta), dur = rxDur(r), cps = r.checkpoints || [], mar = cps.filter(c => c.marcado).length, nov = (r.novedades || []).length;
  const filas = rxFilas(r), conFoto = filas.filter(f => f.foto).length;
  const html = `<p>${esc(r.area)} · ${esc(r.turno || '')} · ${fmtFH(r.inicio)} a ${r.fin ? fmtFH(r.fin) : 'sin finalizar'}</p>
    <div class="kpis">${kpi(dur != null ? Math.round(dur) + ' min' : '—', 'Duración')}${kpi(rxR1(dist) + ' km', 'Distancia')}${kpi(mar + '/' + cps.length, 'Puntos de control', semaforo(cumplimientoRondin(r), 90, 75))}${kpi(nov, 'Novedades', nov ? 'mal' : 'ok')}</div>
    <h4>Ruta recorrida (GPS)</h4>${rxMapaSVG([r], { W: 760, H: 340, extremos: true })}
    <h4>Imágenes y puntos recorridos (${conFoto} fotos)</h4><div class="thumbs">${filas.map(rxThumb).join('') || '<div class="vacio">Sin puntos registrados</div>'}</div>`;
  const d = dialogo('Rondín de ' + r.guardia, html);
  d.querySelector('.modal').classList.add('ancho'); d.querySelector('[data-x]').textContent = 'Cerrar';
  d.addEventListener('click', e => { if (e.target.classList.contains('rx-foto')) rxLightbox(e.target.src); });
}

// ---------- gráficas ----------
function rxGraficas(rs) {
  if (!rs.length) return '';
  const porG = {}; rs.forEach(r => { (porG[r.guardia] = porG[r.guardia] || []).push(r); });
  const km = {}, mn = {}, nvG = {};
  Object.keys(porG).forEach(g => { km[g] = rxR1(sum(porG[g], r => rxKm(r.ruta))); const d = porG[g].map(rxDur).filter(x => x != null); mn[g] = d.length ? Math.round(rxProm(d)) : 0; nvG[g] = sum(porG[g], r => (r.novedades || []).length); });
  // por mes: cumplimiento y cobertura (puntos distintos marcados / puntos distintos conocidos del campo)
  const meses = {}, conocidos = {};
  DATA.rondines.forEach(r => (r.checkpoints || []).forEach(c => { (conocidos[normCampo(r.area)] = conocidos[normCampo(r.area)] || new Set()).add(rxKey(c.nombre)); }));
  rs.forEach(r => { const m = isoDia(r.inicio).slice(0, 7); (meses[m] = meses[m] || []).push(r); });
  const mk = Object.keys(meses).sort();
  const cumM = mk.map(m => Math.round(rxProm(meses[m].map(cumplimientoRondin))));
  const cobM = mk.map(m => {
    const hechos = {}; meses[m].forEach(r => (r.checkpoints || []).filter(c => c.marcado).forEach(c => { (hechos[normCampo(r.area)] = hechos[normCampo(r.area)] || new Set()).add(rxKey(c.nombre)); }));
    const tot = sum(Object.keys(hechos), a => conocidos[a] ? conocidos[a].size : 0), ok = sum(Object.keys(hechos), a => hechos[a].size);
    return tot ? Math.round(ok / tot * 100) : 0;
  });
  // por semana
  const sem = {}; rs.forEach(r => { const w = rxLunes(r.inicio); (sem[w] = sem[w] || []).push(r); });
  const sk = Object.keys(sem).sort(), et = sk.map(w => w.slice(8) + '/' + w.slice(5, 7));
  const campos = [...new Set(rs.map(r => normCampo(r.area)))].slice(0, 8);
  const serCampo = campos.map((c, i) => ({ nombre: c, color: RX_PAL[i % RX_PAL.length], valores: sk.map(w => sem[w].filter(r => normCampo(r.area) === c).length) }));
  const serAN = [{ nombre: 'Áreas recorridas', color: COL.azul, valores: sk.map(w => new Set(sem[w].map(r => normCampo(r.area))).size) }, { nombre: 'Novedades', color: COL.rojo, valores: sk.map(w => sum(sem[w], r => (r.novedades || []).length)) }];
  // cobertura por turno
  const porT = {}; rs.forEach(r => { (porT[r.turno || 'Sin turno'] = porT[r.turno || 'Sin turno'] || []).push(cumplimientoRondin(r)); });
  const cobT = {}; Object.keys(porT).forEach(t => cobT[t] = Math.round(rxProm(porT[t])));
  // novedades
  const nvs = rs.flatMap(r => r.novedades || []);
  const tipos = groupCount(nvs, n => n.tipoNovedad);
  const resp = {}; nvs.filter(n => n.resuelta && n.tsResuelta && n.tsDetectada).forEach(n => { const t = n.tipoNovedad || 'Sin especificar'; (resp[t] = resp[t] || []).push((n.tsResuelta - n.tsDetectada) / 60000); });
  const respP = {}; Object.keys(resp).forEach(t => respP[t] = rxR1(rxProm(resp[t])));
  const pend = nvs.filter(n => !n.resuelta).length;
  let h = '<div class="grid2">' + card('Distancia recorrida por guardia (km)', barras(km, { color: COL.azul, fmt: v => v + ' km' })) + card('Duración promedio por guardia (min)', barras(mn, { color: COL.naranja, fmt: v => v + ' min' })) + '</div>';
  h += '<div class="grid2">' + card('Comparativo mensual: cumplimiento y cobertura (%)', lineas([{ nombre: 'Cumplimiento de puntos', color: COL.verde, valores: cumM }, { nombre: 'Cobertura de puntos del campo', color: COL.naranja, valores: cobM }], mk, { max: 100 }) + '<p class="nota">Cobertura = puntos de control distintos visitados en el mes ÷ puntos distintos registrados históricamente por campo.</p>') +
    card('Comparativo semanal de rondines por campo', lineas(serCampo, et, { max: rxMax(serCampo) })) + '</div>';
  h += '<div class="grid2">' + card('Áreas recorridas y novedades por semana', lineas(serAN, et, { max: rxMax(serAN) })) + card('Cobertura por turno (%)', barras(cobT, { color: COL.verde, fmt: v => v + '%' })) + '</div>';
  h += '<div class="grid2">' + card('Novedades por guardia', barras(nvG, { color: COL.rojo })) + card('Tipos de novedad', barras(tipos, { color: COL.amarillo })) + '</div>';
  h += card('Tiempo de respuesta a novedades (min promedio)' + (pend ? ' · ' + pend + ' pendientes' : ''), Object.keys(respP).length ? barras(respP, { color: COL.azul, fmt: v => v + ' min' }) : '<div class="vacio">Sin novedades resueltas con tiempos registrados</div>');
  return h;
}

function rxCardMapa(rs) {
  const g = {}; rs.forEach(r => { if ((r.ruta || []).some(p => p.lat != null)) (g[normCampo(r.area)] = g[normCampo(r.area)] || []).push(r); });
  const ks = Object.keys(g); if (!ks.length) return card('Mapa de rutas recorridas (GPS)', '<div class="vacio">Sin datos GPS en este periodo</div>');
  return '<h3 class="sec">Mapa de rutas recorridas (GPS)</h3><div class="grid2">' + ks.map(k => card(rxBonito(k) + ' · ' + g[k].length + ' rondín(es)', rxMapaSVG(g[k], { W: 560, H: 380 }))).join('') + '</div>';
}
function rxCardGaleria(rs) {
  const fs = rs.flatMap(r => rxFilas(r).filter(f => f.foto).map(f => Object.assign({ g: r.guardia }, f))).sort((a, b) => (b.ts || 0) - (a.ts || 0));
  if (!fs.length) return card('Galería de puntos de control', '<div class="vacio">Los rondines de este periodo no traen fotografías.</div>');
  return `<details class="mas card"><summary><b>Galería de puntos de control</b> · ${fs.length} fotos (muestra las 12 más recientes)</summary><div class="thumbs">${fs.slice(0, 12).map(rxThumb).join('')}</div></details>`;
}
function bindRondinesExtra(el) { el.addEventListener('click', e => { if (e.target.classList && e.target.classList.contains('rx-foto')) rxLightbox(e.target.src); }); }
