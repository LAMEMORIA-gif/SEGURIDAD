/* Seguridad La Memoria — núcleo: base de datos, usuarios, filtros, importación, navegación */
'use strict';

// ---------- utilidades ----------
const $ = (s, el) => (el || document).querySelector(s);
const $$ = (s, el) => Array.from((el || document).querySelectorAll(s));
const esc = t => String(t == null ? '' : t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = p => (p || 'id') + '_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
const norm = t => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const pad = n => String(n).padStart(2, '0');
const isoDia = ts => { const d = new Date(ts); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
const fmtFecha = ts => { if (!ts) return '—'; const d = new Date(ts); return pad(d.getDate()) + '/' + pad(d.getMonth() + 1) + '/' + d.getFullYear(); };
const fmtHora = ts => { if (!ts) return '—'; const d = new Date(ts); return pad(d.getHours()) + ':' + pad(d.getMinutes()); };
const fmtFH = ts => ts ? fmtFecha(ts) + ' ' + fmtHora(ts) : '—';
const diaIni = (ts) => { const d = new Date(ts); d.setHours(0, 0, 0, 0); return d.getTime(); };
const diaFin = (ts) => { const d = new Date(ts); d.setHours(23, 59, 59, 999); return d.getTime(); };
const fromISO = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d).getTime(); };
const pct = (a, b) => b ? Math.round(a * 1000 / b) / 10 : 0;
const sum = (arr, f) => arr.reduce((s, x) => s + (f ? f(x) : x), 0);
const groupCount = (arr, f) => { const m = {}; arr.forEach(x => { const k = f(x) || 'Sin especificar'; m[k] = (m[k] || 0) + 1; }); return m; };
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

function toast(msg, tipo) {
  const t = document.createElement('div');
  t.className = 'toast ' + (tipo || 'ok'); t.textContent = msg;
  $('#toasts').appendChild(t); setTimeout(() => t.remove(), 4500);
}
function descargar(nombre, contenido, mime) {
  const blob = new Blob([contenido], { type: mime || 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = nombre;
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}

// ---------- configuración por defecto (editable en Configuración) ----------
const CAMPOS_DEF = [
  { nombre: 'Palomas', alias: ['palomas', 'almacen general'] },
  { nombre: 'El Milagro Uno', alias: ['milagro uno', 'milagro 1', 'milagro i'] },
  { nombre: 'El Milagro Dos', alias: ['milagro dos', 'milagro 2', 'milagro ii'] },
  { nombre: 'El Milagro Tres', alias: ['milagro tres', 'milagro 3', 'milagro iii'] },
  { nombre: 'Santa Fe', alias: ['santa fe'] },
  { nombre: 'Empaque', alias: ['empaque'] }
];
const DEPTOS_DEF = ['Almacén General', 'Empaque', 'Labores', 'Mantenimiento', 'Plagas', 'Previsión Social', 'RH', 'Producción', 'Riego', 'Nóminas', 'Inocuidad'];
const CATALOGO_DEF = [
  { nombre: 'Suicidio', peso: 5 }, { nombre: 'Riñas', peso: 4 }, { nombre: 'IntroAlcohol', peso: 3 },
  { nombre: 'ViolenFam', peso: 4 }, { nombre: 'Robo', peso: 4 }, { nombre: 'Intrusión', peso: 4 },
  { nombre: 'Accidente', peso: 3 }, { nombre: 'Daño a propiedad', peso: 2 }, { nombre: 'Falta al reglamento', peso: 2 },
  { nombre: 'Otro', peso: 1 }
];
const PLANTILLA_DEF = [
  { punto: 'Campo Palomas', campo: 'Palomas', dia: 2, noche: 2 }, { punto: 'Galeras Palomas', campo: 'Palomas', dia: 2, noche: 2 },
  { punto: 'El Milagro Tres', campo: 'El Milagro Tres', dia: 1, noche: 1 }, { punto: 'El Milagro Dos', campo: 'El Milagro Dos', dia: 1, noche: 1 },
  { punto: 'El Milagro Uno', campo: 'El Milagro Uno', dia: 3, noche: 3 }, { punto: 'Santa Fe', campo: 'Santa Fe', dia: 3, noche: 2 },
  { punto: 'Empaque', campo: 'Empaque', dia: 5, noche: 4 }, { punto: 'Galeras Empaque', campo: 'Empaque', dia: 1, noche: 1 }
];

// ---------- base de datos (IndexedDB) ----------
const STORES = ['rondines', 'accesos', 'incidencias', 'rol', 'evaluaciones', 'operativo', 'rh', 'config'];
const DATA = {}; STORES.forEach(s => DATA[s] = []);
let _db = null;
function dbOpen() {
  return new Promise((res, rej) => {
    const rq = indexedDB.open('seguridad_unificado_db', 1);
    rq.onupgradeneeded = () => { STORES.forEach(s => { if (!rq.result.objectStoreNames.contains(s)) rq.result.createObjectStore(s, { keyPath: 'id' }); }); };
    rq.onsuccess = () => { _db = rq.result; res(); };
    rq.onerror = () => rej(rq.error);
  });
}
function dbTx(store, mode) { return _db.transaction(store, mode).objectStore(store); }
function dbLoadAll() {
  return Promise.all(STORES.map(s => new Promise((res, rej) => {
    const rq = dbTx(s, 'readonly').getAll(); rq.onsuccess = () => { DATA[s] = rq.result; res(); }; rq.onerror = () => rej(rq.error);
  })));
}
function dbPut(store, obj) {
  if (!obj.id) obj.id = uid(store);
  return new Promise((res, rej) => {
    const rq = dbTx(store, 'readwrite').put(obj);
    rq.onsuccess = () => { const i = DATA[store].findIndex(x => x.id === obj.id); if (i >= 0) DATA[store][i] = obj; else DATA[store].push(obj); res(obj); };
    rq.onerror = () => rej(rq.error);
  });
}
function dbPutMany(store, objs) {
  return new Promise((res, rej) => {
    const tx = _db.transaction(store, 'readwrite'); const os = tx.objectStore(store);
    objs.forEach(o => { if (!o.id) o.id = uid(store); os.put(o); });
    tx.oncomplete = async () => { const rq = dbTx(store, 'readonly').getAll(); rq.onsuccess = () => { DATA[store] = rq.result; res(); }; };
    tx.onerror = () => rej(tx.error);
  });
}
function dbDel(store, id) {
  return new Promise((res, rej) => {
    const rq = dbTx(store, 'readwrite').delete(id);
    rq.onsuccess = () => { DATA[store] = DATA[store].filter(x => x.id !== id); res(); }; rq.onerror = () => rej(rq.error);
  });
}
function dbClear(store) { return new Promise((res, rej) => { const rq = dbTx(store, 'readwrite').clear(); rq.onsuccess = () => { DATA[store] = []; res(); }; rq.onerror = () => rej(rq.error); }); }

// configuración guardada como un registro en el store 'config'
function cfgGet(clave, def) { const r = DATA.config.find(x => x.id === clave); return r ? r.valor : def; }
function cfgSet(clave, valor) { return dbPut('config', { id: clave, valor }); }
const getCampos = () => cfgGet('campos', CAMPOS_DEF);
const getDeptos = () => cfgGet('deptos', DEPTOS_DEF);
const getCatalogo = () => cfgGet('catalogo', CATALOGO_DEF);
const getPlantilla = () => cfgGet('plantilla', PLANTILLA_DEF);
const nombresCampos = () => getCampos().map(c => c.nombre);

// unifica cualquier nombre de ubicación ("Campo Palomas RLM", "Milagro 1"...) al campo oficial
function normCampo(txt) {
  const n = ' ' + norm(txt) + ' ';
  if (n.trim() === '') return 'Sin campo';
  for (const c of getCampos()) {
    if (n.includes(' ' + norm(c.nombre) + ' ')) return c.nombre;
    for (const a of c.alias) if (n.includes(' ' + norm(a) + ' ')) return c.nombre;
  }
  return 'Otros';
}

// ---------- usuarios y sesión ----------
const ROLES = { gerente: 'Gerente (solo lectura)', supervisor: 'Supervisor (captura e importa)', admin: 'Administrador (todo)' };
let SESION = null;
async function hashPin(pin, sal) {
  const txt = 'lm|' + sal + '|' + pin;
  try {
    if (window.crypto && crypto.subtle) {
      const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(txt));
      return Array.from(new Uint8Array(b)).map(x => x.toString(16).padStart(2, '0')).join('');
    }
  } catch (e) { /* cae al respaldo */ }
  let h = 5381; for (let i = 0; i < txt.length; i++) h = ((h << 5) + h + txt.charCodeAt(i)) | 0; return 'f' + (h >>> 0).toString(16);
}
const getUsuarios = () => cfgGet('usuarios', []);
async function crearUsuario(nombre, pin, rol) {
  const sal = Math.random().toString(36).slice(2, 10);
  const us = getUsuarios().slice();
  us.push({ id: uid('u'), nombre: nombre.trim(), rol, sal, hash: await hashPin(pin, sal) });
  await cfgSet('usuarios', us);
}
async function intentarLogin(nombre, pin) {
  const u = getUsuarios().find(x => norm(x.nombre) === norm(nombre));
  if (!u) return false;
  if (await hashPin(pin, u.sal) !== u.hash) return false;
  SESION = { id: u.id, nombre: u.nombre, rol: u.rol }; return true;
}
const puedeEditar = () => SESION && (SESION.rol === 'admin' || SESION.rol === 'supervisor');
const esAdmin = () => SESION && SESION.rol === 'admin';

// ---------- filtro global de periodo y campo ----------
const F = { periodo: '7d', desde: '', hasta: '', campo: '' };
function rangoPeriodo() {
  const hoy = Date.now(); let d, h = diaFin(hoy);
  switch (F.periodo) {
    case 'hoy': d = diaIni(hoy); break;
    case '7d': d = diaIni(hoy - 6 * 864e5); break;
    case '30d': d = diaIni(hoy - 29 * 864e5); break;
    case 'mes': { const x = new Date(); d = new Date(x.getFullYear(), x.getMonth(), 1).getTime(); break; }
    case 'mesant': { const x = new Date(); d = new Date(x.getFullYear(), x.getMonth() - 1, 1).getTime(); h = new Date(x.getFullYear(), x.getMonth(), 0, 23, 59, 59, 999).getTime(); break; }
    case 'custom': d = F.desde ? fromISO(F.desde) : 0; h = F.hasta ? diaFin(fromISO(F.hasta)) : h; break;
    default: d = 0;
  }
  return [d, h];
}
function etiquetaPeriodo() { const [d, h] = rangoPeriodo(); return d ? fmtFecha(d) + ' al ' + fmtFecha(h) : 'Todo el historial'; }
const enPeriodo = ts => { const [d, h] = rangoPeriodo(); return ts >= d && ts <= h; };
const enCampo = c => !F.campo || normCampo(c) === F.campo;

// vistas de los datos ya filtradas por periodo y campo
const V = {
  rondines: () => DATA.rondines.filter(r => enPeriodo(r.inicio) && enCampo(r.area)),
  accesos: () => DATA.accesos.filter(a => enPeriodo(a.horaIngreso) && enCampo(a.campo)),
  incidencias: () => DATA.incidencias.filter(i => enPeriodo(i.fecha) && enCampo(i.campo)),
  rh: () => DATA.rh.filter(x => enPeriodo(x.fecha) && enCampo(x.campo)),
  operativo: () => DATA.operativo.filter(x => enPeriodo(x.fecha) && enCampo(x.campo))
};

// ---------- cálculos compartidos ----------
function cumplimientoRondin(r) {
  const cps = r.checkpoints || []; if (!cps.length) return 0;
  return pct(cps.filter(c => c.marcado).length, cps.length);
}
function tiempoDentroH(a) { return ((a.horaSalida || Date.now()) - a.horaIngreso) / 36e5; }
function accesoExcedido(a) {
  if (a.horaSalida) return false;
  const limite = (a.motivoVisita && /transporte de personal/i.test(a.motivoVisita)) ? 14 : 4;
  return tiempoDentroH(a) > limite;
}
function restringido(a) {
  const lista = cfgGet('restringidos', []).map(norm);
  return lista.length && (lista.includes(norm(a.nombre)) || (a.placas && lista.includes(norm(a.placas))));
}
// combinaciones campo+turno con precedente (≥2) que llevan 7 días sin rondín
function rondinesFaltantes() {
  const todos = DATA.rondines; if (!todos.length) return [];
  const maxTs = Math.max(...todos.map(r => r.inicio || 0));
  const desde = diaIni(maxTs - 6 * 864e5);
  const hist = {}, rec = {};
  todos.forEach(r => { const k = normCampo(r.area) + '|' + (r.turno || 'Sin turno'); hist[k] = (hist[k] || 0) + 1; if (r.inicio >= desde) rec[k] = 1; });
  return Object.keys(hist).filter(k => hist[k] >= 2 && !rec[k]).map(k => { const [campo, turno] = k.split('|'); return { campo, turno, historico: hist[k] }; });
}

// ---------- gráficas sencillas (sin librerías, funcionan sin internet) ----------
function barras(datos, opc) {
  opc = opc || {};
  const ent = Object.entries(datos).sort((a, b) => b[1] - a[1]).slice(0, opc.max || 12);
  if (!ent.length) return '<div class="vacio">Sin datos en este periodo</div>';
  const mx = Math.max(...ent.map(e => e[1])) || 1;
  return '<div class="barras">' + ent.map(([k, v]) => `<div class="barra"><span class="b-et" title="${esc(k)}">${esc(k)}</span><span class="b-pista"><span class="b-rel" style="width:${Math.max(2, v / mx * 100)}%;${opc.color ? 'background:' + opc.color : ''}"></span></span><span class="b-val">${opc.fmt ? opc.fmt(v) : v}</span></div>`).join('') + '</div>';
}
function lineas(series, etiquetas, opc) {
  opc = opc || {}; const W = 560, H = 190, L = 34, R = 10, T = 12, B = 26;
  if (!etiquetas.length) return '<div class="vacio">Sin datos</div>';
  const mx = opc.max || Math.max(1, ...series.flatMap(s => s.valores));
  const x = i => L + (etiquetas.length === 1 ? (W - L - R) / 2 : i * (W - L - R) / (etiquetas.length - 1));
  const y = v => T + (H - T - B) * (1 - v / mx);
  let g = '';
  for (let i = 0; i <= 4; i++) { const v = mx * i / 4; g += `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" class="gl"/><text x="${L - 4}" y="${y(v) + 3}" text-anchor="end" class="gt">${Math.round(v)}</text>`; }
  const paso = Math.ceil(etiquetas.length / 8);
  etiquetas.forEach((e, i) => { if (i % paso === 0) g += `<text x="${x(i)}" y="${H - 8}" text-anchor="${i === 0 ? 'start' : i >= etiquetas.length - paso ? 'end' : 'middle'}" class="gt">${esc(e)}</text>`; });
  series.forEach((s, k) => {
    const pts = s.valores.map((v, i) => x(i) + ',' + y(v)).join(' ');
    g += `<polyline points="${pts}" fill="none" stroke="${s.color}" stroke-width="2.2"/>` + s.valores.map((v, i) => `<circle cx="${x(i)}" cy="${y(v)}" r="3" fill="${s.color}"><title>${esc(s.nombre)}: ${v} (${esc(etiquetas[i])})</title></circle>`).join('');
  });
  const leyenda = series.length > 1 ? '<div class="leyenda">' + series.map(s => `<span><i style="background:${s.color}"></i>${esc(s.nombre)}</span>`).join('') + '</div>' : '';
  return `<svg viewBox="0 0 ${W} ${H}" class="linea" role="img">${g}</svg>${leyenda}`;
}
function kpi(valor, etiqueta, nivel, sub) {
  return `<div class="kpi ${nivel || ''}"><div class="k-v">${valor}</div><div class="k-e">${esc(etiqueta)}</div>${sub ? `<div class="k-s">${sub}</div>` : ''}</div>`;
}
const semaforo = (v, verde, amar) => v >= verde ? 'ok' : v >= amar ? 'warn' : 'mal';

// ---------- importación de archivos JSON de las apps y paneles ----------
async function importarArchivos(files) {
  const cuenta = { rhMov: 0, desempeno: 0, rhPlantilla: 0, operativo: 0, rondines: 0, accesos: 0, incidencias: 0, otros: 0, error: 0, duplicados: 0 };
  const lotes = { rondines: [], accesos: [], incidencias: [], operativo: [] };
  const vistos = { operativo: new Set(), rondines: new Set(DATA.rondines.map(x => x.id)), accesos: new Set(DATA.accesos.map(x => x.id)), incidencias: new Set(DATA.incidencias.map(x => x.id)) };
  const clasifica = o => {
    if (!o || typeof o !== 'object') return null;
    if (LEGADO.esIncLegado(o)) return 'incidencias_legado';
    if (LEGADO.esOpLegado(o)) return 'operativo_legado';
    if (Array.isArray(o.checkpoints) && o.guardia) return 'rondines';
    if (o.horaIngreso && (o.nombre || o.tipoPersona)) return 'accesos';
    if (o.problema && o.fecha) return 'incidencias';
    return null;
  };
  for (const f of files) {
    try {
      const data = JSON.parse(await f.text());
      if (data && data._unificado && data.datos) { await restaurarRespaldo(data, false); cuenta.otros++; continue; }
      if (data && Array.isArray(data.incidencias_agregadas)) {
        const nuevas = LEGADO.convArchivoIncidencias(data, DATA.incidencias);
        nuevas.forEach(o => { if (!vistos.incidencias.has(o.id)) cuenta.incidencias++; vistos.incidencias.add(o.id); lotes.incidencias.push(o); });
        continue;
      }
      if (data && (Array.isArray(data.capturas_nuevas) || Array.isArray(data.llamadas_atencion) || Array.isArray(data.plantilla_eventos))) {
        const ed = data.ediciones || {}, lotesDesemp = [];
        (data.capturas_nuevas || []).forEach(r => lotesDesemp.push(LEGADO.convEval(r, ed['own:' + r._ownId])));
        (data.llamadas_atencion || []).forEach(l => lotesDesemp.push(LEGADO.convLlamada(l)));
        const rhNuevos = (data.plantilla_eventos || []).map(e => e && e.empleado ? LEGADO.convEventoRH(e) : LEGADO.convEventoPlantilla(e)).filter(Boolean);
        if (lotesDesemp.length) await dbPutMany('evaluaciones', lotesDesemp);
        if (rhNuevos.length) await dbPutMany('rh', rhNuevos);
        cuenta.desempeno += lotesDesemp.length; cuenta.rhPlantilla += rhNuevos.length; continue;
      }
      const lista = Array.isArray(data) ? data : [data];
      if (lista.length && lista.every(o => LEGADO.esFaltaRH(o) || LEGADO.esVacRH(o))) {
        const claves = new Set(DATA.rh.map(LEGADO.claveRH).filter(Boolean)), nuevosRH = [];
        lista.forEach(o => {
          const r = LEGADO.esVacRH(o) ? LEGADO.convVacRH(o) : LEGADO.convFaltaRH(o), k = LEGADO.claveRH(r);
          if (claves.has(k)) { cuenta.duplicados++; return; }
          claves.add(k); nuevosRH.push(r); cuenta.rhMov++;
        });
        if (nuevosRH.length) await dbPutMany('rh', nuevosRH);
        continue;
      }
      lista.forEach(o => {
        let t = clasifica(o); if (!t) { cuenta.error++; return; }
        if (t === 'incidencias_legado') { o = LEGADO.convInc(o); t = 'incidencias'; }
        else if (t === 'operativo_legado') { o = LEGADO.convOp(o); t = 'operativo'; }
        if (!o.id) o.id = uid(t);
        if (t === 'incidencias' && typeof o.fecha === 'string') { const p = Date.parse(o.fecha); if (isNaN(p)) { cuenta.error++; return; } o.fecha = p; }
        if (t === 'incidencias' && !o.campo) o.campo = 'Otros';
        if (vistos[t].has(o.id)) { if (o.origen === 'legado') lotes[t].push(o); else cuenta.duplicados++; return; }
        vistos[t].add(o.id); lotes[t].push(o); cuenta[t]++;
      });
    } catch (e) { cuenta.error++; }
  }
  for (const t of Object.keys(lotes)) if (lotes[t].length) await dbPutMany(t, lotes[t]);
  return cuenta;
}
function resumenImport(c) {
  const p = [];
  if (c.rondines) p.push(c.rondines + ' rondín(es)'); if (c.accesos) p.push(c.accesos + ' acceso(s)');
  if (c.incidencias) p.push(c.incidencias + ' incidencia(s)'); if (c.desempeno) p.push(c.desempeno + ' registro(s) de desempeño'); if (c.rhMov) p.push(c.rhMov + ' movimiento(s) de RH'); if (c.rhPlantilla) p.push(c.rhPlantilla + ' alta(s)/baja(s) de plantilla'); if (c.operativo > 0) p.push(c.operativo + ' captura(s) operativa(s)'); if (c.otros) p.push(c.otros + ' respaldo(s) completo(s)');
  let t = p.length ? 'Importado: ' + p.join(', ') + '.' : 'No se importó nada nuevo.';
  if (c.duplicados) t += ' ' + c.duplicados + ' ya existían.';
  if (c.error) t += ' ' + c.error + ' archivo(s)/registro(s) no reconocido(s).';
  return t;
}

// ---------- respaldo completo ----------
function crearRespaldo() {
  const datos = {}; STORES.forEach(s => datos[s] = DATA[s]);
  return { _unificado: 1, version: 1, fecha: Date.now(), datos };
}
async function restaurarRespaldo(resp, reemplazar) {
  for (const s of STORES) {
    if (!resp.datos[s]) continue;
    if (reemplazar) await dbClear(s);
    const existentes = new Set(DATA[s].map(x => x.id));
    await dbPutMany(s, reemplazar ? resp.datos[s] : resp.datos[s].filter(x => !existentes.has(x.id) && x.id !== 'usuarios'));
  }
}

// ---------- navegación ----------
const VIEWS = []; // {id, titulo, icono, grupo, roles, render}
function registrarVista(v) { VIEWS.push(v); }
let VISTA_ACTUAL = 'resumen';
function irA(id) { VISTA_ACTUAL = id; location.hash = id; renderApp(); }
function renderNav() {
  const grupos = {};
  VIEWS.forEach(v => { (grupos[v.grupo] = grupos[v.grupo] || []).push(v); });
  $('#nav').innerHTML = Object.entries(grupos).map(([g, vs]) => `<div class="nav-grupo">${esc(g)}</div>` + vs.filter(v => !v.soloAdmin || esAdmin()).map(v => `<button class="nav-b ${v.id === VISTA_ACTUAL ? 'act' : ''}" data-v="${v.id}"><span>${v.icono}</span>${esc(v.titulo)}</button>`).join('')).join('');
  $$('#nav .nav-b').forEach(b => b.onclick = () => { irA(b.dataset.v); document.body.classList.remove('menu-abierto'); });
}
function barraFiltros() {
  const per = [['hoy', 'Hoy'], ['7d', 'Últimos 7 días'], ['30d', 'Últimos 30 días'], ['mes', 'Este mes'], ['mesant', 'Mes anterior'], ['todo', 'Todo'], ['custom', 'Personalizado']];
  $('#filtros').innerHTML = `<label>Periodo <select id="fPer">${per.map(p => `<option value="${p[0]}" ${F.periodo === p[0] ? 'selected' : ''}>${p[1]}</option>`).join('')}</select></label>
    <span id="fCustom" style="display:${F.periodo === 'custom' ? 'inline-flex' : 'none'};gap:6px"><input type="date" id="fDesde" value="${F.desde}"><input type="date" id="fHasta" value="${F.hasta}"></span>
    <label>Campo <select id="fCampo"><option value="">Todos</option>${nombresCampos().concat(['Otros']).map(c => `<option ${F.campo === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></label>
    <span class="per-et">${esc(etiquetaPeriodo())}</span>`;
  $('#fPer').onchange = e => { F.periodo = e.target.value; renderApp(); };
  $('#fDesde').onchange = e => { F.desde = e.target.value; renderApp(); };
  $('#fHasta').onchange = e => { F.hasta = e.target.value; renderApp(); };
  $('#fCampo').onchange = e => { F.campo = e.target.value; renderApp(); };
}
function renderApp() {
  const v = VIEWS.find(x => x.id === VISTA_ACTUAL) || VIEWS[0];
  renderNav(); barraFiltros();
  $('#vistaTitulo').textContent = v.titulo;
  $('#filtros').style.display = v.sinFiltros ? 'none' : '';
  const cont = $('#vista'); cont.innerHTML = '';
  try { v.render(cont); } catch (e) { cont.innerHTML = '<div class="card mal">Error al mostrar esta sección: ' + esc(e.message) + '</div>'; console.error(e); }
}

// ---------- ventana de diálogo sencilla ----------
function dialogo(titulo, html, onOk, okTxt) {
  const d = document.createElement('div'); d.className = 'overlay';
  d.innerHTML = `<div class="modal"><h3>${esc(titulo)}</h3><div class="modal-c">${html}</div><div class="modal-p"><button class="btn sec" data-x>Cancelar</button>${onOk ? `<button class="btn" data-ok>${esc(okTxt || 'Guardar')}</button>` : ''}</div></div>`;
  document.body.appendChild(d);
  d.querySelector('[data-x]').onclick = () => d.remove();
  if (onOk) d.querySelector('[data-ok]').onclick = async () => { if ((await onOk(d)) !== false) d.remove(); };
  const p = d.querySelector('input,select,textarea'); if (p) p.focus();
  return d;
}

// ---------- arranque / pantalla de acceso ----------
async function arrancar() {
  await dbOpen(); await dbLoadAll();
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => { });
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist();
  mostrarLogin();
}
function mostrarLogin() {
  SESION = null; $('#app').style.display = 'none'; const L = $('#login'); L.style.display = 'flex';
  const hay = getUsuarios().length > 0;
  L.innerHTML = `<div class="login-card"><img src="icon-192.png" alt="" width="64" height="64"><h1>Seguridad La Memoria</h1>
    <p class="sub">${hay ? 'Acceso para gerente, supervisor y administrador' : 'Primer uso: cree el usuario administrador'}</p>
    <input id="lUser" placeholder="Usuario" autocomplete="username" ${hay ? '' : 'value="Administrador"'}>
    <input id="lPin" type="password" inputmode="numeric" placeholder="PIN (4 a 8 dígitos)" autocomplete="current-password" maxlength="8">
    ${hay ? '' : '<input id="lPin2" type="password" inputmode="numeric" placeholder="Repetir PIN" maxlength="8">'}
    <button class="btn grande" id="lGo">${hay ? 'Entrar' : 'Crear administrador y entrar'}</button><div id="lMsg" class="msg"></div></div>`;
  const go = async () => {
    const u = $('#lUser').value, p = $('#lPin').value, m = $('#lMsg');
    if (!/^\d{4,8}$/.test(p)) { m.textContent = 'El PIN debe tener de 4 a 8 dígitos.'; return; }
    if (!hay) {
      if (p !== $('#lPin2').value) { m.textContent = 'Los PIN no coinciden.'; return; }
      if (!u.trim()) { m.textContent = 'Escriba un nombre de usuario.'; return; }
      await crearUsuario(u, p, 'admin');
    }
    if (await intentarLogin(u, p)) { L.style.display = 'none'; entrarApp(); } else { m.textContent = 'Usuario o PIN incorrectos.'; }
  };
  $('#lGo').onclick = go; L.querySelectorAll('input').forEach(i => i.onkeydown = e => { if (e.key === 'Enter') go(); });
}
function entrarApp() {
  $('#app').style.display = ''; $('#quien').textContent = SESION.nombre + ' · ' + ROLES[SESION.rol].split(' (')[0];
  const h = location.hash.replace('#', ''); if (VIEWS.find(v => v.id === h)) VISTA_ACTUAL = h; else VISTA_ACTUAL = 'resumen';
  renderApp();
}
