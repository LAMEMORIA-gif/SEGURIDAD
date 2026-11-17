/* Seguridad La Memoria — mejoras al análisis de riesgo:
   1) tendencia semanal por campo, 2) mapa de calor campo × problema, 3) seguimiento de acciones, 4) comparativo entre periodos. */
'use strict';

const RM_DIA = 864e5;
const rmLunes = ts => { const d = new Date(ts); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d.getTime(); };
const rmClase = p => { const c = nivelRiesgo(p)[1]; return c === 'crit' ? 'mal' : c; };
const rmColor = { ok: '#4cd07a', warn: '#f2c744', mal: '#ff7a70' };

// ---------- 1) Tendencia semanal por campo (últimas 8 semanas) ----------
function rmTendenciaDatos(nSem) {
  const l0 = rmLunes(Date.now()), semanas = []; // solo semanas completas (la semana en curso no se incluye)
  for (let i = nSem; i >= 1; i--) { const d = l0 - i * 7 * RM_DIA; semanas.push([d, d + 7 * RM_DIA - 1]); }
  const porSem = semanas.map(rg => calcRiesgoPorCampo(rg));
  return { semanas, porSem };
}
function rmSpark(vals) {
  const W = 120, H = 34, n = vals.length, v = vals.map(x => x == null ? null : x);
  const pts = v.map((x, i) => x == null ? null : [Math.round(4 + i * (W - 8) / Math.max(1, n - 1)), Math.round(H - 4 - (x / 100) * (H - 8))]);
  let seg = '', cur = [];
  pts.forEach(p => { if (p) cur.push(p.join(',')); else { if (cur.length > 1) seg += `<polyline points="${cur.join(' ')}" fill="none" stroke="#a9ccff" stroke-width="2"/>`; cur = []; } });
  if (cur.length > 1) seg += `<polyline points="${cur.join(' ')}" fill="none" stroke="#a9ccff" stroke-width="2"/>`;
  const dots = pts.map((p, i) => p ? `<circle cx="${p[0]}" cy="${p[1]}" r="${i === n - 1 ? 3.5 : 2}" fill="${rmColor[rmClase(v[i])]}"/>` : '').join('');
  return `<svg class="rm-spark" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img">${seg}${dots}</svg>`;
}
function rmTendenciaHTML() {
  const N = 8, { semanas, porSem } = rmTendenciaDatos(N);
  const campos = nombresCampos().filter(c => !F.campo || c === F.campo);
  const filas = [];
  campos.forEach(campo => {
    const serie = porSem.map(rs => { const r = rs.find(x => x.campo === campo); return (r && Object.keys(r.comp || {}).length) ? r.puntos : null; });
    const con = serie.filter(x => x != null); if (!con.length) return;
    const ult = serie[N - 1] != null ? serie[N - 1] : con[con.length - 1];
    const ref = con.slice(0, -1).slice(-4); const prom4 = ref.length ? ref.reduce((a, b) => a + b, 0) / ref.length : null;
    const dif = prom4 == null ? null : Math.round(ult - prom4);
    const ult3 = con.slice(-3), subeSost = ult3.length === 3 && ult3[0] < ult3[1] && ult3[1] < ult3[2] && ult3[2] - ult3[0] >= 5, bajaSost = ult3.length === 3 && ult3[0] > ult3[1] && ult3[1] > ult3[2] && ult3[0] - ult3[2] >= 5;
    const tend = subeSost ? ['↗ Sube 3 semanas seguidas', 'mal'] : bajaSost ? ['↘ Baja 3 semanas seguidas', 'ok'] : dif == null ? ['Pocos datos', ''] : dif >= 8 ? ['↗ Por arriba de su promedio', 'warn'] : dif <= -8 ? ['↘ Por debajo de su promedio', 'ok'] : ['→ Estable', ''];
    filas.push({ campo, serie, ult, dif, tend, n: con.length });
  });
  filas.sort((a, b) => b.ult - a.ult);
  const et = semanas.map(([d]) => fmtFecha(d).slice(0, 5));
  const cuerpo = filas.length ? tabla([
    { t: 'Campo', f: r => r.campo },
    { t: 'Últimas ' + N + ' semanas', h: 1, f: r => rmSpark(r.serie) },
    { t: 'Riesgo actual', h: 1, f: r => pill(r.ult + ' · ' + nivelRiesgo(r.ult)[0], rmClase(r.ult)) },
    { t: 'vs. promedio 4 sem. previas', f: r => r.dif == null ? '—' : (r.dif > 0 ? '+' : '') + r.dif },
    { t: 'Tendencia', h: 1, f: r => `<span class="${r.tend[1] === 'mal' ? 'bad' : ''}">${esc(r.tend[0])}</span>` }
  ], filas, { wrap: 1 }) : '<div class="vacio">Aún no hay semanas con datos para mostrar tendencia.</div>';
  return card('Tendencia del riesgo por campo', `<p class="nota">Índice 0-100 de cada semana (lunes a domingo), de la semana del ${esc(et[0])} a la del ${esc(et[N - 1])}; solo semanas completas (la semana en curso no se incluye). Los puntos son verde (bajo), amarillo (medio) y rojo (alto o crítico). Esta sección no depende del filtro de Periodo; sí respeta el filtro de Campo.</p>` + cuerpo);
}

// ---------- 2) Mapa de calor campo × problema ----------
function rmMapaCalorHTML(modo) {
  modo = modo || 'casos';
  const inc = DATA.incidencias.filter(i => enPeriodo(i.fecha));
  const campos = nombresCampos().filter(c => !F.campo || c === F.campo);
  const camposExtra = Array.from(new Set(inc.map(i => i.campo))).filter(c => c && !campos.includes(c) && (!F.campo || c === F.campo));
  const filasC = campos.concat(camposExtra);
  const val = i => modo === 'puntos' ? pesoDe(i) : 1;
  const tot = {}; inc.forEach(i => { const k = i.problema || 'Sin especificar'; tot[k] = (tot[k] || 0) + val(i); });
  const cols = Object.keys(tot).sort((a, b) => tot[b] - tot[a]).slice(0, 12);
  const m = {}; inc.forEach(i => { const k = i.problema || 'Sin especificar'; if (!cols.includes(k)) return; const c = i.campo; (m[c] = m[c] || {})[k] = (m[c][k] || 0) + val(i); });
  const filas = filasC.filter(c => m[c]);
  const max = Math.max(1, ...filas.flatMap(c => cols.map(k => m[c][k] || 0)));
  const sel = `<label class="rm-sel">Mostrar <select id="rmHeatModo"><option value="casos" ${modo === 'casos' ? 'selected' : ''}>Número de casos</option><option value="puntos" ${modo === 'puntos' ? 'selected' : ''}>Puntos de riesgo (peso × casos)</option></select></label>`;
  if (!filas.length) return sel + '<div class="vacio">Sin incidencias en este periodo</div>';
  const celda = v => { if (!v) return '<td class="rm-c0">·</td>'; const a = Math.min(1, v / max); return `<td class="rm-c" style="background:rgba(255,${Math.round(190 - 110 * a)},${Math.round(90 - 40 * a)},${(0.18 + 0.72 * a).toFixed(2)})">${v}</td>`; };
  const fmt = v => modo === 'puntos' ? Math.round(v * 10) / 10 : v;
  return sel + `<div class="tabla-w sinmax"><table class="tabla rm-heat"><thead><tr><th>Campo</th>${cols.map(k => `<th class="rm-th" title="${esc(k)}"><span>${esc(k)}</span></th>`).join('')}<th>Total</th></tr></thead><tbody>` +
    filas.map(c => `<tr><td><b>${esc(c)}</b></td>${cols.map(k => celda(fmt(m[c][k] || 0))).join('')}<td><b>${fmt(sum(cols, k => m[c][k] || 0))}</b></td></tr>`).join('') +
    `<tr class="rm-tot"><td><b>Total</b></td>${cols.map(k => `<td><b>${fmt(sum(filas, c => m[c][k] || 0))}</b></td>`).join('')}<td><b>${fmt(sum(filas, c => sum(cols, k => m[c][k] || 0)))}</b></td></tr></tbody></table></div>`;
}
function rmMapaCalorCard() {
  return card('Mapa de calor: campo × tipo de problema', `<p class="nota">Cuanto más intenso el color, más concentración. Usa el filtro de Periodo y Campo de arriba; muestra los 12 problemas más frecuentes.</p><div id="rmHeat">${rmMapaCalorHTML('casos')}</div>`);
}

// ---------- 3) Seguimiento de acciones ----------
const RM_ESTATUS = ['Pendiente', 'En proceso', 'Hecha', 'Cancelada'];
const rmAcciones = () => cfgGet('acciones_riesgo', []);
const rmVencida = a => a.estatus !== 'Hecha' && a.estatus !== 'Cancelada' && a.fechaCompromiso && fromISO(a.fechaCompromiso) < diaIni(Date.now());
function rmAccionesHTML(o) {
  const ac = rmAcciones().slice().sort((a, b) => (+(a.estatus === 'Hecha' || a.estatus === 'Cancelada') - +(b.estatus === 'Hecha' || b.estatus === 'Cancelada')) || String(a.fechaCompromiso || '9999').localeCompare(String(b.fechaCompromiso || '9999')));
  const abiertas = ac.filter(a => a.estatus !== 'Hecha' && a.estatus !== 'Cancelada'), venc = ac.filter(rmVencida), hechas = ac.filter(a => a.estatus === 'Hecha');
  const validas = ac.filter(a => a.estatus !== 'Cancelada');
  const pillE = a => rmVencida(a) ? pill('Vencida', 'mal') : pill(a.estatus, a.estatus === 'Hecha' ? 'ok' : a.estatus === 'En proceso' ? 'warn' : '');
  const barra = puedeEditar() ? `<div class="barra-acc"><button class="btn" id="rmNueva">+ Nueva acción</button><button class="btn sec" id="rmDelPlan">Tomar del plan propuesto</button></div>` : soloLectura();
  const resumen = `<div class="kpis">${kpi(abiertas.length, 'Acciones abiertas', abiertas.length ? 'warn' : 'ok')}${kpi(venc.length, 'Vencidas', venc.length ? 'mal' : 'ok')}${kpi(validas.length ? pct(hechas.length, validas.length) + '%' : '—', 'Cumplidas', '', hechas.length + ' de ' + validas.length)}</div>`;
  const tb = ac.length ? tabla([
    { t: 'Estatus', h: 1, f: pillE }, { t: 'Dónde', f: a => a.campo || '—' }, { t: 'Acción', f: a => a.accion }, { t: 'Responsable', f: a => a.responsable || '—' },
    { t: 'Fecha compromiso', f: a => a.fechaCompromiso ? fmtFecha(fromISO(a.fechaCompromiso)) : '—' }, { t: 'Avance / nota', f: a => a.nota || '' },
    { t: '', h: 1, f: a => puedeEditar() ? `<button class="mini" data-rm-ed="${esc(a.id)}">Editar</button>` : '' }
  ], ac, { wrap: 1 }) : '<div class="vacio">Aún no hay acciones. Agrega una o toma las del plan propuesto para darles responsable y fecha.</div>';
  return barra + resumen + tb;
}
function rmAccionesCard() { return card('Seguimiento de acciones', '<p class="nota">Compromisos de la junta: responsable, fecha y estatus. Se guardan en este equipo y se revisan en la siguiente junta; las vencidas se marcan en rojo.</p><div id="rmAcc"></div>'); }
function rmEditarAccion(a, o, despues) {
  const nuevo = !a.id; a = Object.assign({ campo: '', accion: '', responsable: '', fechaCompromiso: '', estatus: 'Pendiente', nota: '' }, a);
  const campos = ['Todos los campos'].concat(nombresCampos());
  dialogo(nuevo ? 'Nueva acción' : 'Editar acción', `<label>Dónde<select id="rmC">${campos.map(c => `<option ${c === (a.campo || 'Todos los campos') ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></label>
    <label>Acción<textarea id="rmA" rows="3">${esc(a.accion)}</textarea></label><label>Responsable<input id="rmR" value="${esc(a.responsable)}"></label>
    <label>Fecha compromiso<input type="date" id="rmF" value="${esc(a.fechaCompromiso)}"></label>
    <label>Estatus<select id="rmE">${RM_ESTATUS.map(e => `<option ${e === a.estatus ? 'selected' : ''}>${e}</option>`).join('')}</select></label>
    <label>Avance / nota<textarea id="rmN" rows="2">${esc(a.nota)}</textarea></label>${nuevo ? '' : '<button class="btn sec" id="rmDel" style="margin-top:8px">Eliminar esta acción</button>'}`,
    async d => {
      const accion = $('#rmA', d).value.trim(); if (!accion) { toast('Escriba la acción', 'mal'); return false; }
      const e = { id: a.id || uid('acc'), creada: a.creada || Date.now(), campo: $('#rmC', d).value, accion, responsable: $('#rmR', d).value.trim(), fechaCompromiso: $('#rmF', d).value, estatus: $('#rmE', d).value, nota: $('#rmN', d).value.trim() };
      if (e.estatus === 'Hecha' && !a.cerrada) e.cerrada = Date.now(); else if (a.cerrada && e.estatus === 'Hecha') e.cerrada = a.cerrada;
      const l = rmAcciones().filter(x => x.id !== e.id); l.push(e); await cfgSet('acciones_riesgo', l); despues();
    });
  const del = $('#rmDel'); if (del) del.onclick = async () => { if (!confirm('¿Eliminar esta acción?')) return; await cfgSet('acciones_riesgo', rmAcciones().filter(x => x.id !== a.id)); document.querySelector('.overlay') && document.querySelector('.overlay').remove(); despues(); };
}
function rmPintarAcciones(el, o) {
  const cont = $('#rmAcc', el); if (!cont) return; cont.innerHTML = rmAccionesHTML(o);
  const redo = () => rmPintarAcciones(el, o);
  const n = $('#rmNueva', cont); if (n) n.onclick = () => rmEditarAccion({}, o, redo);
  $$('[data-rm-ed]', cont).forEach(b => b.onclick = () => rmEditarAccion(rmAcciones().find(x => x.id === b.dataset.rmEd) || {}, o, redo));
  const p = $('#rmDelPlan', cont); if (p) p.onclick = () => {
    const yaTexto = new Set(rmAcciones().map(x => x.accion));
    const lista = (o.recom || []).filter(r => !yaTexto.has(r.accion));
    if (!lista.length) { toast('Todas las acciones del plan ya están en el seguimiento', 'ok'); return; }
    dialogo('Tomar acciones del plan propuesto', '<p class="nota">Marque las que desea dar seguimiento; podrá editar responsable y fecha después.</p>' + lista.map((r, i) => `<label style="display:flex;gap:8px;align-items:flex-start;margin:6px 0"><input type="checkbox" data-rp="${i}"> <span><b>${esc(r.ambito)}</b> · ${esc(r.accion)}<br><span class="nota">${esc(r.responsable || '')}</span></span></label>`).join(''),
      async d => {
        const sel = lista.filter((r, i) => d.querySelector(`[data-rp="${i}"]`).checked); if (!sel.length) { toast('Marque al menos una', 'mal'); return false; }
        const l = rmAcciones().slice(); sel.forEach(r => l.push({ id: uid('acc'), creada: Date.now(), campo: r.ambito || '', accion: r.accion, responsable: r.responsable || '', fechaCompromiso: '', estatus: 'Pendiente', nota: '' }));
        await cfgSet('acciones_riesgo', l); redo();
      }, 'Agregar');
  };
}

// ---------- 4) Comparativo entre periodos ----------
let RM_CMP = { preset: 'mes', aD: '', aH: '', bD: '', bH: '' };
function rmRangosCmp() {
  const hoy = Date.now(), x = new Date(hoy), a = x.getFullYear(), m = x.getMonth(), dm = x.getDate();
  const finMes = (anio, mes, dia) => new Date(anio, mes, Math.min(dia, new Date(anio, mes + 1, 0).getDate()), 23, 59, 59, 999).getTime();
  switch (RM_CMP.preset) {
    case '7d': return { A: [diaIni(hoy - 6 * RM_DIA), diaFin(hoy)], B: [diaIni(hoy - 13 * RM_DIA), diaFin(hoy - 7 * RM_DIA)] };
    case '30d': return { A: [diaIni(hoy - 29 * RM_DIA), diaFin(hoy)], B: [diaIni(hoy - 59 * RM_DIA), diaFin(hoy - 30 * RM_DIA)] };
    case 'mesaa': return { A: [new Date(a, m, 1).getTime(), diaFin(hoy)], B: [new Date(a - 1, m, 1).getTime(), finMes(a - 1, m, dm)] };
    case 'anio': return { A: [new Date(a, 0, 1).getTime(), diaFin(hoy)], B: [new Date(a - 1, 0, 1).getTime(), finMes(a - 1, m, dm)] };
    case 'custom': { const f = (s, e) => [s ? fromISO(s) : 0, e ? diaFin(fromISO(e)) : diaFin(hoy)]; return { A: f(RM_CMP.aD, RM_CMP.aH), B: f(RM_CMP.bD, RM_CMP.bH) }; }
    default: return { A: [new Date(a, m, 1).getTime(), diaFin(hoy)], B: [new Date(a, m - 1, 1).getTime(), finMes(a, m - 1, dm)] };
  }
}
function rmMetricas([d, h]) {
  const en = ts => ts >= d && ts <= h, ec = c => !F.campo || c === F.campo;
  const inc = DATA.incidencias.filter(i => en(i.fecha) && ec(i.campo));
  const rs = DATA.rondines.filter(r => en(r.inicio) && ec(normCampo(r.area)));
  const ac = DATA.accesos.filter(a => en(a.horaIngreso) && ec(normCampo(a.campo)));
  const rh = DATA.rh.filter(x => en(x.fecha) && x.tipo === 'Inasistencia' && ec(normCampo(x.campo)));
  const op = DATA.operativo.filter(x => x.fecha >= d - 6 * RM_DIA && x.fecha <= h && ec(normCampo(x.campo)));
  const pts = op.map(puntajeOperativo).filter(v => v != null);
  const rp = sum(op, x => +x.rondinesProg || 0), rr = sum(op, x => +x.rondinesReal || 0);
  const rsAll = calcRiesgoPorCampo([d, h]);
  const dec = sum(op, x => { const v = x.raw || {}; return (+v.golosinas || 0) + (+v.cigarros || 0) + (+v.articulos || 0) + (+v.drogas || 0) + (+v.envasesVidrio || 0); });
  return {
    inc: inc.length, pts: sum(inc, pesoDe), graves: inc.filter(i => pesoDe(i) >= 4).length,
    abiertas: inc.filter(i => !/conclu|cerrad|resuelt/i.test(i.estatus || '')).length,
    rond: rs.length, cumplRond: rs.length ? Math.round(sum(rs, cumplimientoRondin) / rs.length * 10) / 10 : null,
    acc: ac.length, excedidas: ac.filter(a => a.horaSalida ? tiempoDentroH(a) > 4 && !/transporte de personal/i.test(a.motivoVisita || '') && tiempoDentroH(a) > 14 : accesoExcedido(a)).length,
    opCap: op.length, opRiesgo: pts.length ? Math.round(sum(pts, v => v) / pts.length * 10) / 10 : null, opRond: rp ? Math.round(rr / rp * 1000) / 10 : null, dec,
    inasist: rh.length, indice: rsAll.some(r => Object.keys(r.comp || {}).length) ? riesgoGlobal(rsAll).puntos : null, porCampo: rsAll
  };
}
function rmCmpHTML() {
  const { A, B } = rmRangosCmp(), mA = rmMetricas(A), mB = rmMetricas(B);
  const rg = r => (r[0] ? fmtFecha(r[0]) : 'inicio') + ' al ' + fmtFecha(r[1]);
  // peor = 'sube' si un aumento es malo, 'baja' si una baja es mala, '' si es solo informativo
  const M = [
    ['Índice general de riesgo (0-100)', 'indice', 'sube', ''], ['Incidencias registradas', 'inc', 'sube', ''], ['Puntos de riesgo (peso × casos)', 'pts', 'sube', ''], ['Incidencias graves (peso ≥ 4)', 'graves', 'sube', ''],
    ['Incidencias aún abiertas', 'abiertas', 'sube', ''], ['Rondines realizados', 'rond', '', ''], ['Cumplimiento de rondines (checkpoints)', 'cumplRond', 'baja', '%'], ['Accesos registrados', 'acc', '', ''],
    ['Visitas con tiempo excedido', 'excedidas', 'sube', ''], ['Control operativo: capturas semanales', 'opCap', '', ''], ['Control operativo: riesgo promedio (0-100)', 'opRiesgo', 'sube', ''],
    ['Control operativo: rondines realizados vs programados', 'opRond', 'baja', '%'], ['Decomisos (golosinas, cigarros, artículos, drogas, vidrio)', 'dec', '', ''], ['Inasistencias (RH)', 'inasist', 'sube', '']
  ];
  const f = (v, u) => v == null ? '—' : (typeof v === 'number' ? v.toLocaleString('es-MX') : v) + u;
  const fila = ([t, k, peor, u]) => {
    const a = mA[k], b = mB[k]; let dif = '—', cls = '';
    if (a != null && b != null) { const d = Math.round((a - b) * 10) / 10; dif = (d > 0 ? '+' : '') + d.toLocaleString('es-MX') + (u === '%' ? ' pts' : '') + (b ? ' (' + (d > 0 ? '+' : '') + Math.round(d / Math.abs(b) * 100) + '%)' : ''); if (d !== 0 && peor) cls = (peor === 'sube') === (d > 0) ? 'mal' : 'ok'; }
    return `<tr><td>${esc(t)}</td><td>${f(a, u)}</td><td>${f(b, u)}</td><td>${cls ? `<span class="pill ${cls}">${esc(dif)}</span>` : esc(dif)}</td></tr>`;
  };
  const campos = nombresCampos().filter(c => !F.campo || c === F.campo);
  const pc = campos.map(c => { const a = mA.porCampo.find(r => r.campo === c), b = mB.porCampo.find(r => r.campo === c); const va = a && Object.keys(a.comp || {}).length ? a.puntos : null, vb = b && Object.keys(b.comp || {}).length ? b.puntos : null; return { c, va, vb }; }).filter(r => r.va != null || r.vb != null);
  const tc = pc.length ? tabla([{ t: 'Campo', f: r => r.c }, { t: 'Periodo A', h: 1, f: r => r.va == null ? '—' : pill(r.va + ' · ' + nivelRiesgo(r.va)[0], rmClase(r.va)) }, { t: 'Periodo B', h: 1, f: r => r.vb == null ? '—' : pill(r.vb + ' · ' + nivelRiesgo(r.vb)[0], rmClase(r.vb)) },
    { t: 'Cambio', h: 1, f: r => { if (r.va == null || r.vb == null) return '—'; const d = r.va - r.vb; return d === 0 ? '＝' : `<span class="pill ${d > 0 ? 'mal' : 'ok'}">${d > 0 ? '▲ +' : '▼ '}${d}</span>`; } }], pc, { wrap: 1 }) : '';
  return `<p class="nota"><b>Periodo A</b> (actual): ${esc(rg(A))} · <b>Periodo B</b> (referencia): ${esc(rg(B))}. En rojo lo que empeoró y en verde lo que mejoró.${F.campo ? ' Solo campo: ' + esc(F.campo) + '.' : ''}</p>` +
    `<div class="tabla-w sinmax"><table class="tabla"><thead><tr><th>Indicador</th><th>Periodo A</th><th>Periodo B</th><th>Cambio</th></tr></thead><tbody>${M.map(fila).join('')}</tbody></table></div>` + (tc ? '<h4 style="margin:14px 0 6px">Índice de riesgo por campo</h4>' + tc : '');
}
function rmComparativoCard() {
  const op = [['mes', 'Este mes vs. mes anterior (mismos días)'], ['7d', 'Últimos 7 días vs. 7 días previos'], ['30d', 'Últimos 30 días vs. 30 días previos'], ['mesaa', 'Este mes vs. mismo mes del año pasado'], ['anio', 'Este año vs. año anterior (mismo tramo)'], ['custom', 'Elegir fechas…']];
  const c = RM_CMP, vis = c.preset === 'custom';
  return card('Comparativo entre periodos', `<div class="barra-acc" style="flex-wrap:wrap;gap:10px;align-items:center"><label class="rm-sel">Comparar <select id="rmPre">${op.map(([v, t]) => `<option value="${v}" ${c.preset === v ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
    <span id="rmCus" style="display:${vis ? 'inline-flex' : 'none'};gap:6px;align-items:center;flex-wrap:wrap">A: <input type="date" id="rmAD" value="${esc(c.aD)}"> a <input type="date" id="rmAH" value="${esc(c.aH)}"> · B: <input type="date" id="rmBD" value="${esc(c.bD)}"> a <input type="date" id="rmBH" value="${esc(c.bH)}"></span></div><div id="rmCmp">${rmCmpHTML()}</div>`);
}

// ---------- conexión con la pantalla ----------
function rmBind(el, o) {
  const bindHeat = () => { const s = $('#rmHeatModo', el); if (s) s.onchange = () => { $('#rmHeat', el).innerHTML = rmMapaCalorHTML(s.value); bindHeat(); }; };
  bindHeat();
  rmPintarAcciones(el, o);
  const pre = $('#rmPre', el); if (pre) {
    const redo = () => { $('#rmCmp', el).innerHTML = rmCmpHTML(); };
    pre.onchange = () => { RM_CMP.preset = pre.value; $('#rmCus', el).style.display = pre.value === 'custom' ? 'inline-flex' : 'none'; redo(); };
    [['rmAD', 'aD'], ['rmAH', 'aH'], ['rmBD', 'bD'], ['rmBH', 'bH']].forEach(([id, k]) => { const i = $('#' + id, el); if (i) i.onchange = () => { RM_CMP[k] = i.value; redo(); }; });
  }
}
// pestaña nueva "Comparativo" (se agrega a las que ya existen)
if (typeof rpTabs !== 'undefined' && !rpTabs.some(t => t[0] === 't10')) rpTabs.splice(rpTabs.findIndex(t => t[0] === 't4') + 1, 0, ['t10', 'Comparativo']);
