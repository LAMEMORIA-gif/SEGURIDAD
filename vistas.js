/* Seguridad La Memoria — vistas: resumen, rondines, accesos, incidencias, RH, desempeño, control operativo, datos, configuración */
'use strict';

const COL = { azul: '#a9ccff', naranja: '#f0a35e', verde: '#34a853', rojo: '#e5534b', amarillo: '#d9a520', gris: '#c3d3f5' };
function tabla(cols, rows, opc) {
  opc = opc || {}; const max = opc.max || MAX_FILAS;
  if (!rows.length) return '<div class="vacio">Sin registros en este periodo</div>';
  const shown = rows.slice(0, max);
  return `<div class="tabla-w${opc.wrap ? ' sinmax' : ''}"><table class="tabla${opc.wrap ? ' wrap' : ''}"><thead><tr>${cols.map(c => `<th>${esc(c.t)}</th>`).join('')}</tr></thead><tbody>${shown.map((r, i) => `<tr ${opc.click ? `data-i="${i}" class="click"` : ''}>${cols.map(c => { const lg = /^(Descripci|Notas|Observ|Motivo)/.test(c.t) && !c.h; const t = c.h ? c.f(r) : esc(c.f(r)); return lg ? `<td class="largo" title="Clic para ver completo">${t}</td>` : `<td>${t}</td>`; }).join('')}</tr>`).join('')}</tbody></table></div>${rows.length > max ? `<div class="nota">Mostrando ${max} de ${rows.length} registros. ${opc.max ? 'Use los filtros para acotar.' : `<button class="mini" data-mas-filas="300">Mostrar 300 más</button> <button class="mini" data-mas-filas="todo">Mostrar todos</button> · o acote con los filtros (mes, campo, búsqueda).`}</div>` : ''}`;
}
const pill = (txt, nivel) => `<span class="pill ${nivel}">${esc(txt)}</span>`;
const card = (titulo, cuerpo, extra) => `<section class="card ${extra || ''}"><h3>${esc(titulo)}</h3>${cuerpo}</section>`;
function nombresGuardias() {
  const s = new Set((typeof getGuardias === 'function' ? getGuardias() : []).map(g => g.nombre));
  DATA.rondines.forEach(r => r.guardia && s.add(r.guardia.trim()));
  DATA.accesos.forEach(a => a.guardiaConfirma && s.add(a.guardiaConfirma.trim()));
  return Array.from(s).filter(Boolean).sort((a, b) => a.localeCompare(b));
}
const pesoDe = i => (i.peso != null ? i.peso : ((getCatalogo().find(c => norm(c.nombre) === norm(i.problema)) || {}).peso || 1));
const soloLectura = () => puedeEditar() ? '' : '<div class="nota">Su perfil es de solo lectura.</div>';

const fotoID = a => a.fotoID ? `<img class="ine" src="${a.fotoID}" data-acc="${esc(a.id)}" loading="lazy" alt="ID" title="Clic para ampliar">` : '—';
document.addEventListener('click', e => {
  const im = e.target.closest && e.target.closest('img.ine'); if (!im) return;
  const a = DATA.accesos.find(x => x.id === im.dataset.acc); if (!a) return;
  const f = (t, x) => x || x === 0 ? `<tr><td>${t}</td><td>${esc(x)}</td></tr>` : '';
  dialogo('Identificación · ' + (a.nombre || 'Visitante'), `<img src="${a.fotoID}" style="max-width:100%;max-height:60vh;border-radius:8px;display:block;margin:0 auto 10px"><table class="tabla"><tbody>${f('Tipo de ID', a.tipoID)}${f('Ingreso', fmtFH(a.horaIngreso))}${f('Salida', a.horaSalida ? fmtFH(a.horaSalida) : '—')}${f('Campo', normCampo(a.campo))}${f('Tipo de persona', a.tipoPersona)}${f('Empresa', a.empresaProcedencia)}${f('Motivo', a.motivoVisita)}${f('Visita a', a.areaVisita)}${f('Placas', a.placas)}${f('N.º económico', a.numEconomico)}${f('Gafete', a.gafeteNum)}${f('Acompañantes', a.numAcompanantes)}${f('Nota', a.nota)}${f('Confirmó', a.guardiaConfirma)}</tbody></table>`);
  const x = document.querySelector('.overlay:last-of-type [data-x]'); if (x) x.textContent = 'Cerrar';
});

// ============ RESUMEN GERENCIAL ============
registrarVista({
  id: 'resumen', titulo: 'Resumen gerencial', icono: '📊', grupo: 'General', render(el) {
    const rs = V.rondines(), ac = V.accesos(), inc = V.incidencias(), rh = V.rh(), [opD, opH] = rangoPeriodo(), opv = DATA.operativo.filter(x => x.fecha >= (opD || 0) - 6 * 864e5 && x.fecha <= opH && enCampo(x.campo)); // misma ventana que el índice: incluye la semana que empezó antes del periodo
    const opPts = opv.map(puntajeOperativo).filter(v => v != null), opProm = opPts.length ? Math.round(sum(opPts, v => v) / opPts.length) : null;
    const cumpl = rs.length ? Math.round(sum(rs, cumplimientoRondin) / rs.length * 10) / 10 : 0;
    const falt = rondinesFaltantes().filter(f => !F.campo || f.campo === F.campo);
    const dentro = DATA.accesos.filter(a => !a.horaSalida && enCampo(a.campo));
    const exced = dentro.filter(accesoExcedido);
    const restr = ac.filter(restringido);
    const graves = inc.filter(i => pesoDe(i) >= 4);
    const riesgos = calcRiesgoPorCampo();
    const glob = riesgoGlobal(riesgos);
    let h = '<div class="kpis">' +
      kpi(glob.puntos, 'Índice de riesgo (0-100)', glob.nivelClase, glob.nivel) +
      kpi(rs.length ? cumpl + '%' : '—', 'Cumplimiento de rondines', rs.length ? semaforo(cumpl, 90, 75) : '', rs.length + ' rondines') +
      kpi(falt.length, 'Rondines no realizados (huecos)', falt.length ? 'mal' : 'ok') +
      kpi(ac.length, 'Accesos registrados', '', dentro.length + ' dentro ahora') +
      kpi(exced.length, 'Visitas con tiempo excedido', exced.length ? 'mal' : 'ok') +
      kpi(inc.length, 'Incidencias', graves.length ? 'warn' : '', graves.length + ' graves (peso ≥4)') +
      kpi(opProm == null ? '—' : opProm, 'Riesgo de control operativo (0-100)', opProm == null ? '' : nivelRiesgo(opProm)[1] === 'crit' ? 'mal' : nivelRiesgo(opProm)[1], opv.length + ' capturas semanales') +
      kpi(rh.filter(x => x.tipo === 'Inasistencia').length, 'Inasistencias (RH)', '') + kpisApoyo(inc) + '</div>';
    // alertas
    const al = [];
    falt.forEach(f => al.push(['mal', `Sin rondín en 7 días: ${f.campo} · turno ${f.turno} (tenía ${f.historico} rondines previos). Sin evidencia ante robo o reclamo de seguro.`]));
    exced.slice(0, 8).forEach(a => al.push(['warn', `${a.nombre || 'Visitante'} lleva ${tiempoDentroH(a).toFixed(1)} h dentro en ${normCampo(a.campo)} sin registrar salida.`]));
    restr.slice(0, 5).forEach(a => al.push(['mal', `Ingreso de persona/vehículo en lista restringida: ${a.nombre} (${fmtFH(a.horaIngreso)}).`]));
    graves.slice(0, 6).forEach(i => al.push(['mal', `Incidencia grave: ${i.problema} · ${i.campo} / ${i.depto || '—'} (${fmtFecha(i.fecha)}).`]));
    { const ra = resumenApoyo(inc); if (ra.pct >= 10) al.push(['warn', `Intervención de la autoridad: ${textoApoyo(ra)}`]); }
    riesgos.filter(r => r.nivel === 'Alto' || r.nivel === 'Crítico').forEach(r => al.push([r.nivel === 'Crítico' ? 'mal' : 'warn', `Riesgo ${r.nivel.toLowerCase()} en ${r.campo} (${r.puntos}/100).`]));
    const env = estadoEnvios(), soR = semanasOperativo(12);
    env.filter(a => !a.info && a.hay && a.k !== 'operativo').forEach(a => { const tarde = a.campos.filter(x => x.d == null || x.d > a.lim[1]); if (tarde.length) al.push(['warn', `${a.n.replace(/^\S+ /, '')}: sin datos recientes de ${tarde.map(x => x.campo + (x.d == null ? ' (nunca)' : ' (' + hace(x.d) + ')')).join(', ')}. Pida el archivo al guardia.`]); });
    { const fl = soR.faltan.filter(f => f.tipo === 'falta' && (!F.campo || f.campo === F.campo)); if (fl.length) { const pc = {}; fl.forEach(f => (pc[f.campo] = pc[f.campo] || []).push(semEmp(f.t))); al.push(['mal', 'Control operativo pendiente: ' + Object.entries(pc).map(([c, l]) => c + ' (sem ' + l.join(', ') + ')').join('; ') + '.']); } }
    h += card('Alertas que requieren atención', al.length ? '<ul class="alertas">' + al.map(a => `<li class="${a[0]}">${esc(a[1])}</li>`).join('') + '</ul>' : '<div class="vacio ok">Sin alertas en este periodo ✔</div>');
    // tabla por campo
    const filas = riesgos.filter(r => !F.campo || r.campo === F.campo);
    h += card('Situación por campo', tabla([
      { t: 'Campo', f: r => r.campo }, { t: 'Rondines', f: r => r.rondines }, { t: 'Cumpl. %', f: r => r.rondines ? r.cumpl + '%' : '—' },
      { t: 'Accesos', f: r => r.accesos }, { t: 'Incidencias', f: r => r.incidencias }, { t: 'Operativo', h: 1, f: r => r.comp.op == null ? '—' : pill(Math.round(r.comp.op), nivelRiesgo(r.comp.op)[1]) }, { t: 'Inasist.', f: r => r.inasist },
      { t: 'Riesgo', h: 1, f: r => pill(r.puntos + ' · ' + r.nivel, r.clase) }
    ], filas));
    h += '<div class="grid2">' + card('Incidencias por campo', barras(groupCount(inc, i => i.campo), { color: COL.naranja })) +
      card('Accesos por campo', barras(groupCount(ac, a => normCampo(a.campo)), { color: COL.azul })) + '</div>';
    h += cardApoyoResumen(inc, true);
    h += card('Envíos de las apps de guardia', htmlEnvios(env));
    h += card('Control operativo: semanas capturadas por campo', htmlSemanasOperativo(soR));
    el.innerHTML = h;
  }
});

// ============ RONDINES ============
registrarVista({
  id: 'rondines', titulo: 'Rondines', icono: '🚶', grupo: 'Seguridad', render(el) {
    const rs = V.rondines().sort((a, b) => b.inicio - a.inicio);
    const cumpl = rs.length ? Math.round(sum(rs, cumplimientoRondin) / rs.length * 10) / 10 : 0;
    const dur = rs.filter(r => r.fin).map(r => (r.fin - r.inicio) / 60000);
    const novs = sum(rs, r => (r.novedades || []).length);
    const falt = rondinesFaltantes().filter(f => !F.campo || f.campo === F.campo);
    let h = '<div class="kpis">' + kpi(rs.length, 'Rondines realizados') + kpi(rs.length ? cumpl + '%' : '—', 'Cumplimiento de puntos', rs.length ? semaforo(cumpl, 90, 75) : '') +
      kpi(dur.length ? Math.round(sum(dur) / dur.length) + ' min' : '—', 'Duración promedio') + kpi(novs, 'Novedades reportadas') + kpi(falt.length, 'Huecos sin rondín (7 días)', falt.length ? 'mal' : 'ok') + '</div>';
    if (falt.length) h += card('Rondines no realizados', '<ul class="alertas">' + falt.map(f => `<li class="mal">${esc(f.campo)} · turno ${esc(f.turno)} — sin rondines en los últimos 7 días con datos (precedente: ${f.historico}).</li>`).join('') + '</ul>');
    // cumplimiento por día
    const dias = {}; rs.forEach(r => { const k = isoDia(r.inicio); (dias[k] = dias[k] || []).push(cumplimientoRondin(r)); });
    const ks = Object.keys(dias).sort();
    h += '<div class="grid2">' + card('Cumplimiento por día (%)', lineas([{ nombre: 'Cumplimiento', color: COL.azul, valores: ks.map(k => Math.round(sum(dias[k]) / dias[k].length)) }], ks.map(k => k.slice(8) + '/' + k.slice(5, 7)), { max: 100 })) +
      card('Rondines por campo', barras(groupCount(rs, r => normCampo(r.area)), { color: COL.azul })) + '</div>';
    const porG = {}; rs.forEach(r => { (porG[r.guardia] = porG[r.guardia] || []).push(cumplimientoRondin(r)); });
    const gc = {}; Object.keys(porG).forEach(g => gc[g] = Math.round(sum(porG[g]) / porG[g].length));
    h += '<div class="grid2">' + card('Cumplimiento por guardia (%)', barras(gc, { color: COL.verde, fmt: v => v + '%' })) + card('Rondines por turno', barras(groupCount(rs, r => r.turno), { color: COL.naranja })) + '</div>';
    h += rxCardMapa(rs) + rxCardGaleria(rs) + rxGraficas(rs);
    h += card('Detalle de rondines', tabla([
      { t: 'Fecha', f: r => fmtFH(r.inicio) }, { t: 'Guardia', f: r => r.guardia }, { t: 'Campo', f: r => normCampo(r.area) }, { t: 'Área', f: r => r.area }, { t: 'Turno', f: r => r.turno || '—' },
      { t: 'Duración', f: r => r.fin ? Math.round((r.fin - r.inicio) / 60000) + ' min' : 'sin cerrar' },
      { t: 'Puntos', f: r => (r.checkpoints || []).filter(c => c.marcado).length + '/' + (r.checkpoints || []).length },
      { t: 'Cumpl.', h: 1, f: r => { const c = cumplimientoRondin(r); return pill(c + '%', semaforo(c, 90, 75)); } }, { t: 'Novedades', f: r => (r.novedades || []).length }
    ], rs, { click: 1 }));
    el.innerHTML = h; bindRondinesExtra(el);
    $$('tr.click', el).forEach(tr => tr.onclick = () => abrirRondin(rs[+tr.dataset.i]));
  }
});

// ============ CONTROL DE ACCESO ============
registrarVista({
  id: 'accesos', titulo: 'Control de acceso', icono: '🚪', grupo: 'Seguridad', render(el) {
    const ac = V.accesos().sort((a, b) => b.horaIngreso - a.horaIngreso);
    const dentro = DATA.accesos.filter(a => !a.horaSalida && enCampo(a.campo));
    const exced = dentro.filter(accesoExcedido), restr = ac.filter(restringido);
    const dur = ac.filter(a => a.horaSalida).map(a => tiempoDentroH(a) * 60);
    let h = '<div class="kpis">' + kpi(ac.length, 'Accesos en el periodo') + kpi(dentro.length, 'Dentro ahora') + kpi(exced.length, 'Tiempo excedido', exced.length ? 'mal' : 'ok') +
      kpi(restr.length, 'Lista restringida', restr.length ? 'mal' : 'ok') + kpi(dur.length ? Math.round(sum(dur) / dur.length) + ' min' : '—', 'Permanencia promedio') +
      kpi(pct(ac.filter(a => a.fotoID).length, ac.length) + ' %', 'Con foto de identificación', ac.length && pct(ac.filter(a => a.fotoID).length, ac.length) < 90 ? 'warn' : '', ac.filter(a => a.fotoID).length + ' de ' + ac.length) +
      kpi(ac.filter(a => a.qrVerificado).length, 'Ingresos con QR', '', pct(ac.filter(a => a.qrVerificado).length, ac.length) + ' % del periodo') + '</div>';
    h += (typeof cardInvitacionesQR === 'function' ? cardInvitacionesQR() : qrCargarScripts());
    h += cardInocuidad();
    if (dentro.length) h += card('Actualmente dentro (sin salida)', tabla([{ t: 'Ingreso', f: a => fmtFH(a.horaIngreso) }, { t: 'Nombre', f: a => a.nombre }, { t: 'ID', h: 1, f: fotoID }, { t: 'Campo', f: a => normCampo(a.campo) }, { t: 'Motivo', f: a => a.motivoVisita || '—' }, { t: 'Visita a', f: a => a.areaVisita || '—' }, { t: 'Lleva', h: 1, f: a => pill(tiempoDentroH(a).toFixed(1) + ' h', accesoExcedido(a) ? 'mal' : 'ok') }], dentro.sort((a, b) => a.horaIngreso - b.horaIngreso)));
    h += '<div class="grid2">' + card('Accesos por campo', barras(groupCount(ac, a => normCampo(a.campo)), { color: COL.azul })) + card('Motivos de visita', barras(groupCount(ac, a => a.motivoVisita), { color: COL.naranja })) +
      card('Tipo de visitante', barras(groupCount(ac, a => a.tipoPersona), { color: COL.verde })) + card('Área / persona visitada', barras(groupCount(ac, a => a.areaVisita), { color: COL.gris })) + '</div>';
    h += card('Bitácora de accesos', tabla([{ t: 'Ingreso', f: a => fmtFH(a.horaIngreso) }, { t: 'Salida', f: a => a.horaSalida ? fmtFH(a.horaSalida) : '—' }, { t: 'Nombre', f: a => a.nombre }, { t: 'ID', h: 1, f: fotoID }, { t: 'Tipo', f: a => a.tipoPersona || '—' }, { t: 'Empresa', f: a => a.empresaProcedencia || '—' }, { t: 'Placas', f: a => a.placas || '—' }, { t: 'Campo', f: a => normCampo(a.campo) }, { t: 'Motivo', f: a => a.motivoVisita || '—' }, { t: 'Confirmó', f: a => a.guardiaConfirma || '—' }], ac));
    el.innerHTML = h; bindInocuidad(el); if (typeof bindInvitacionesQR === 'function') bindInvitacionesQR(el);
  }
});

// ============ INCIDENCIAS ============
const setSel = (s, val) => { if (val == null || val === '') return; if (![...s.options].some(o => o.value === String(val))) { const o = document.createElement('option'); o.value = o.textContent = String(val); s.appendChild(o); } s.value = String(val); };
const SUBCAT_PS = ['Galeras Palomas', 'Galeras Empaque'];
const esPS = i => /previsi/i.test(i.depto || '');
const subcatPS = i => esPS(i) ? (SUBCAT_PS.find(s => norm(s) === norm(i.punto || i.subcat)) || 'Sin subcategoría') : '';
// fotos del formulario de incidencias (se reducen para no saturar el almacenamiento)
let FOTOS_ED = [];
function reducirFotoInc(file) {
  return new Promise((ok, ko) => { const u = URL.createObjectURL(file), im = new Image(); im.onload = () => { const e = Math.min(1, 1280 / Math.max(im.width, im.height)), c = document.createElement('canvas'); c.width = Math.round(im.width * e); c.height = Math.round(im.height * e); c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); URL.revokeObjectURL(u); ok(c.toDataURL('image/jpeg', 0.72)); }; im.onerror = () => { URL.revokeObjectURL(u); ko(new Error('img')); }; im.src = u; });
}
registrarVista({
  id: 'incidencias', titulo: 'Incidencias', icono: '⚠️', grupo: 'Seguridad', render(el) {
    const inc = V.incidencias().sort((a, b) => b.fecha - a.fecha);
    const graves = inc.filter(i => pesoDe(i) >= 4);
    let h = '<div class="kpis">' + kpi(inc.length, 'Incidencias') + kpi(graves.length, 'Graves (peso ≥4)', graves.length ? 'mal' : 'ok') + kpi(sum(inc, pesoDe), 'Puntos de severidad') + kpi(Object.keys(groupCount(inc, i => i.depto)).length, 'Departamentos con incidencias') + kpi(pct(inc.filter(i => (i.fotos || []).some(f => f.tipo === 'ficha')).length, inc.length) + ' %', 'Con foto de la ficha de trabajo', '', inc.filter(i => (i.fotos || []).length).length + ' con fotos') + kpisApoyo(inc) + '</div>';
    if (puedeEditar()) h += `<div class="barra-acc"><button class="btn" id="nuevaInc">+ Registrar incidencia</button></div>`; else h += soloLectura();
    h += '<div class="grid2">' + card('Por campo', barras(groupCount(inc, i => i.campo), { color: COL.naranja })) + card('Por catálogo de problema', barras(groupCount(inc, i => i.problema), { color: COL.rojo })) +
      card('Por departamento', barras(groupCount(inc, i => i.depto), { color: COL.azul })) + card('Severidad por campo (puntos)', barras(inc.reduce((m, i) => { m[i.campo] = (m[i.campo] || 0) + pesoDe(i); return m; }, {}), { color: COL.rojo })) + '</div>';
    const ps = inc.filter(esPS);
    if (ps.length) h += card('Previsión Social por subcategoría', barras(groupCount(ps, subcatPS), { color: COL.verde }) + '<div class="nota">Total Previsión Social: ' + ps.length + ' incidencia(s).</div>');
    h += cardApoyoResumen(inc, true);
    h += card('Registro de incidencias', tabla([{ t: 'Fecha', f: i => fmtFecha(i.fecha) }, { t: 'Campo', f: i => i.campo }, { t: 'Departamento', f: i => i.depto || '—' }, { t: 'Subcategoría', f: i => subcatPS(i) || '—' }, { t: 'Problema', f: i => i.problema }, { t: 'Peso', h: 1, f: i => pill(pesoDe(i), pesoDe(i) >= 4 ? 'mal' : pesoDe(i) >= 3 ? 'warn' : 'ok') }, { t: 'Autoridad', f: i => { const x = apoyoDe(i); return x ? AUT_ETQ[x.ap] : '—'; } }, { t: 'Ficha', f: i => esc(i.ficha || '—') }, { t: 'Descripción', f: i => i.descripcion || '' }, { t: 'Fotos', h: 1, f: i => { const l = i.fotos || []; if (!l.length) return '—'; const orden = l.filter(f => f.tipo === 'ficha').concat(l.filter(f => f.tipo !== 'ficha')); return orden.slice(0, 2).map(f => `<img class="incfoto" src="${f.data}" data-fotos="${i.id}" loading="lazy" alt="${f.tipo === 'ficha' ? 'Ficha' : 'Evidencia'}" title="Clic para ver las fotos">`).join('') + (l.length > 2 ? ` <button class="mini" data-fotos="${i.id}">+${l.length - 2}</button>` : ''); } }, { t: '', h: 1, f: i => puedeEditar() ? `<button class="mini" data-edit="${i.id}">Editar</button> <button class="mini" data-del="${i.id}">Eliminar</button>` : '' }], inc));
    el.innerHTML = h;
    $$('[data-del]', el).forEach(b => b.onclick = async () => { if (confirm('¿Eliminar esta incidencia?')) { await dbDel('incidencias', b.dataset.del); renderApp(); } });
    $$('[data-fotos]', el).forEach(b => b.onclick = () => {
      const i = DATA.incidencias.find(x => x.id === b.dataset.fotos); if (!i) return;
      const grupo = (t, et) => { const l = (i.fotos || []).filter(f => f.tipo === t); return l.length ? `<h4>${et}</h4><div class="thumbs">${l.map(f => `<div><div class="thumb-img"><img class="rx-foto" src="${f.data}"></div></div>`).join('')}</div>` : ''; };
      const d = dialogo('Fotos de la incidencia · ' + i.campo + ' · ' + fmtFecha(i.fecha), (i.ficha ? `<p>Ficha del involucrado: <b>${esc(i.ficha)}</b></p>` : '') + grupo('ficha', 'Ficha de trabajo') + grupo('evidencia', 'Evidencia'));
      d.firstElementChild.classList.add('ancho'); d.addEventListener('click', e => { if (e.target.classList.contains('rx-foto')) rxLightbox(e.target.src); });
    });
    const abrirInc = reg => {
      const ed = !!reg, dlg = dialogo(ed ? 'Editar incidencia' : 'Registrar incidencia', `
      <label>Fecha<input type="date" id="iF" value="${isoDia(Date.now())}"></label>
      <label>Campo<select id="iC">${nombresCampos().map(c => `<option>${esc(c)}</option>`).join('')}</select></label>
      <label>Departamento<select id="iD">${getDeptos().map(c => `<option>${esc(c)}</option>`).join('')}</select></label>
      <label id="iSubL" style="display:none">Subcategoría de Previsión Social<select id="iSub"><option value="">Sin subcategoría</option>${SUBCAT_PS.map(s => `<option>${s}</option>`).join('')}</select></label>
      <label>Catálogo de problema<select id="iP">${getCatalogo().map(c => `<option value="${esc(c.nombre)}">${esc(c.nombre)} (peso ${c.peso})</option>`).join('')}</select></label>
      <label>Descripción<textarea id="iDesc" rows="3"></textarea></label><label>Acción tomada<textarea id="iAcc" rows="2"></textarea></label>
      <label>Ficha(s) del involucrado<input id="iFicha" placeholder="Ej. 1297-1"></label>
      <div><b style="font-size:13px">Fotos de la ficha de trabajo y evidencia</b><div class="inc-fotos-ed" id="iFotos"></div>
      <div class="inc-fotos-btns"><label class="btn sec mini">📷 Ficha (cámara)<input type="file" accept="image/*" capture="environment" data-tf="ficha"></label><label class="btn sec mini">🖼️ Ficha (galería/archivo)<input type="file" accept="image/*" multiple data-tf="ficha"></label><label class="btn sec mini">📷 Evidencia (cámara)<input type="file" accept="image/*" capture="environment" data-tf="evidencia"></label><label class="btn sec mini">🖼️ Evidencia (galería/archivo)<input type="file" accept="image/*" multiple data-tf="evidencia"></label></div></div>
      <label>Apoyo de la autoridad<select id="iAp"><option value="">Detectar automáticamente</option><option value="N">Sin apoyo de la autoridad</option><option value="M">Policía municipal</option><option value="G">Guardia civil estatal</option><option value="MG">Policía municipal y guardia civil</option></select></label>`,
      async d => {
        const p = $('#iP', d).value, dep = $('#iD', d).value;
        const datos = { punto: esPS({ depto: dep }) ? $('#iSub', d).value : '', fecha: fromISO($('#iF', d).value) + 12 * 36e5, campo: $('#iC', d).value, depto: dep, problema: p, peso: (getCatalogo().find(c => c.nombre === p) || {}).peso || (ed ? reg.peso : 1) || 1, descripcion: $('#iDesc', d).value.trim(), accion: $('#iAcc', d).value.trim(), apoyoManual: $('#iAp', d).value, ficha: $('#iFicha', d).value.trim(), fotos: FOTOS_ED.length ? FOTOS_ED.slice() : undefined };
        await dbPut('incidencias', ed ? { ...reg, ...datos, editadoPor: SESION.nombre, editadoEn: Date.now() } : { ...datos, por: SESION.nombre });
        toast(ed ? 'Incidencia actualizada' : 'Incidencia registrada'); renderApp();
      }, ed ? 'Guardar cambios' : undefined);
      FOTOS_ED = ed && reg.fotos ? reg.fotos.slice() : [];
      const pintaF = () => { $('#iFotos', dlg).innerHTML = FOTOS_ED.map((f, k) => `<div><img src="${f.data}" title="${f.tipo === 'ficha' ? 'Ficha de trabajo' : 'Evidencia'}"><button type="button" data-qf="${k}">×</button></div>`).join('') || '<span class="nota">Sin fotos</span>'; };
      $('#iFotos', dlg).onclick = e => { const k = e.target.dataset.qf; if (k != null) { FOTOS_ED.splice(+k, 1); pintaF(); } };
      $$('[data-tf]', dlg).forEach(inp => inp.onchange = async () => { for (const f of inp.files) { try { FOTOS_ED.push({ tipo: inp.dataset.tf, data: await reducirFotoInc(f) }); } catch (e) { toast('No se pudo leer una foto'); } } inp.value = ''; pintaF(); });
      if (ed) $('#iFicha', dlg).value = reg.ficha || '';
      pintaF();
      const mostrar = () => { $('#iSubL', dlg).style.display = esPS({ depto: $('#iD', dlg).value }) ? '' : 'none'; };
      $('#iD', dlg).onchange = mostrar;
      if (ed) { $('#iF', dlg).value = isoDia(reg.fecha); setSel($('#iC', dlg), reg.campo); setSel($('#iD', dlg), reg.depto); setSel($('#iP', dlg), reg.problema); $('#iSub', dlg).value = reg.punto && SUBCAT_PS.includes(reg.punto) ? reg.punto : (SUBCAT_PS.find(s => norm(s) === norm(reg.punto)) || ''); $('#iDesc', dlg).value = reg.descripcion || ''; $('#iAcc', dlg).value = reg.accion || ''; $('#iAp', dlg).value = reg.apoyoManual || ''; }
      mostrar();
    };
    const nb = $('#nuevaInc', el); if (nb) nb.onclick = () => abrirInc();
    $$('[data-edit]', el).forEach(b => b.onclick = () => abrirInc(DATA.incidencias.find(x => x.id === b.dataset.edit)));
  }
});

// ============ RH ============
const TIPOS_RH = ['Inasistencia', 'Permiso', 'Vacaciones', 'Incapacidad', 'Alta', 'Baja'];
const ETQ_RH = { Inasistencia: 'Inasistencias', Permiso: 'Permisos', Vacaciones: 'Vacaciones', Incapacidad: 'Incapacidades', Alta: 'Altas', Baja: 'Bajas' };
const diasRH = x => x.fechaFin && x.fechaFin >= x.fecha ? Math.round((diaIni(x.fechaFin) - diaIni(x.fecha)) / 864e5) + 1 : 1;
registrarVista({
  id: 'rh', titulo: 'RH · control de personal', icono: '👥', grupo: 'Personal', render(el) {
    const rh = V.rh().sort((a, b) => b.fecha - a.fecha);
    const por = t => rh.filter(x => x.tipo === t);
    let h = '<div class="kpis">' + TIPOS_RH.map(t => kpi(por(t).length, ETQ_RH[t], t === 'Baja' && por(t).length ? 'warn' : '', ['Vacaciones', 'Inasistencia', 'Permiso', 'Incapacidad'].includes(t) ? sum(por(t), diasRH) + ' día(s)' : '')).join('') + '</div>';
    h += puedeEditar() ? '<div class="barra-acc"><button class="btn" id="nuevoRH">+ Registrar movimiento</button></div>' : soloLectura();
    h += '<div class="grid2">' + card('Movimientos por tipo', barras(groupCount(rh, x => x.tipo), { color: COL.azul })) + card('Inasistencias por departamento', barras(groupCount(por('Inasistencia'), x => x.depto), { color: COL.rojo })) + '</div>';
    const pl = construirPlantilla();
    h += `<section class="card"><h3>Empleados <input id="qEmp" class="buscar" placeholder="Buscar empleado..."> <span class="nota" id="cEmp"></span></h3>${pl.length && !cfgGet('plantilla_base_rh', []).length ? '<p class="nota bad">Solo se muestran los empleados con alta o baja registrada. Para ver toda la plantilla, vaya a <b>Importar y respaldo</b> y elija el archivo RH_Control_Personal.html.</p>' : ''}${pl.length ? '<div id="tEmp"></div>' : '<div class="vacio">Aún no hay plantilla cargada. En <b>Importar y respaldo</b> elija el archivo RH_Control_Personal.html para leer la plantilla de empleados.</div>'}</section>`;
    h += card('Registro', tabla([{ t: 'Fecha', f: x => fmtFecha(x.fecha) }, { t: 'Tipo', f: x => x.tipo }, { t: 'Persona', f: x => x.persona }, { t: 'Campo', f: x => x.campo || '—' }, { t: 'Depto.', f: x => x.depto || '—' }, { t: 'Días', f: x => ['Alta', 'Baja'].includes(x.tipo) ? '—' : diasRH(x) }, { t: 'Notas', f: x => x.notas || '' }, { t: '', h: 1, f: x => puedeEditar() ? `<button class="mini" data-edit="${x.id}">Editar</button> <button class="mini" data-del="${x.id}">Eliminar</button>` : '' }], rh));
    el.innerHTML = h;
    const pintaEmp = () => {
      const q = ($('#qEmp', el) ? $('#qEmp', el).value : '').toLowerCase().trim(), l = pl.filter(e => !q || e.empleado.toLowerCase().includes(q));
      if (!$('#tEmp', el)) return; $('#cEmp', el).textContent = l.length + ' empleado' + (l.length === 1 ? '' : 's');
      $('#tEmp', el).innerHTML = tabla([{ t: 'Empleado', f: e => e.empleado }, { t: 'Función', f: e => e.funcion || '—' }, { t: 'Departamento', f: e => e.departamento || '—' }, { t: 'Género', f: e => e.genero || '—' }, { t: 'Fecha ingreso', f: e => e.fechaIngreso ? fmtFecha(e.fechaIngreso) : '—' }, { t: 'Antigüedad', f: e => e.antTexto },
        { t: 'Vac. por antigüedad', f: e => e.vacAnt }, { t: 'Vac. tomadas', f: e => e.vacTom }, { t: 'Vac. restantes', h: 1, f: e => `<span class="${e.vacRest < 0 ? 'bad' : ''}">${e.vacRest}</span>` }, { t: 'Faltas', h: 1, f: e => `<span class="${e.faltas >= 5 ? 'bad' : ''}">${e.faltas}</span>` }, { t: 'Estado', h: 1, f: e => pill(e.estado, e.estado === 'ACTIVO' ? 'ok' : '') }], l, { max: 500 });
    };
    if ($('#qEmp', el)) { $('#qEmp', el).oninput = pintaEmp; pintaEmp(); }
    $$('[data-del]', el).forEach(b => b.onclick = async () => { if (confirm('¿Eliminar este movimiento?')) { await dbDel('rh', b.dataset.del); renderApp(); } });
    const abrirRH = reg => {
      const ed = !!reg, dlg = dialogo(ed ? 'Editar movimiento de personal' : 'Movimiento de personal', `
      <label>Tipo<select id="rT">${TIPOS_RH.map(t => `<option>${t}</option>`).join('')}</select></label>
      <label>Persona<input id="rP" list="dlG" placeholder="Nombre completo"><datalist id="dlG">${nombresGuardias().map(g => `<option value="${esc(g)}">`).join('')}</datalist></label>
      <label>Campo<select id="rC">${nombresCampos().map(c => `<option>${esc(c)}</option>`).join('')}</select></label>
      <label>Departamento<select id="rD">${getDeptos().map(c => `<option ${norm(c) === 'seguridad' ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></label>
      <div id="rAlta" style="display:none"><label>Función (solo altas)<input id="rFu" placeholder="Ej. OPERATIVO"></label><label>Género<select id="rGe"><option value="">—</option><option>Masculino</option><option>Femenino</option></select></label></div><label>Fecha (inicio)<input type="date" id="rF" value="${isoDia(Date.now())}"></label><label>Fecha fin (opcional, para permisos/vacaciones)<input type="date" id="rFF"></label><label>Notas<textarea id="rN" rows="2"></textarea></label>`,
      async d => {
        const p = $('#rP', d).value.trim(); if (!p) { toast('Escriba el nombre de la persona', 'mal'); return false; }
        const ff = $('#rFF', d).value ? fromISO($('#rFF', d).value) + 12 * 36e5 : null;
        const datos = { funcion: $('#rFu', d).value.trim() || undefined, genero: $('#rGe', d).value || undefined, tipo: $('#rT', d).value, persona: nombreCanonico(p), campo: $('#rC', d).value, depto: norm($('#rD', d).value) === 'seguridad' ? 'SEGURIDAD' : $('#rD', d).value, fecha: fromISO($('#rF', d).value) + 12 * 36e5, fechaFin: ff, notas: $('#rN', d).value.trim() };
        if (DATA.rh.some(x => x.id !== (reg && reg.id) && claveMov(x) === claveMov(datos))) { toast('Ya existe ese mismo movimiento (misma persona, tipo y fecha). No se duplicó.', 'mal'); return false; }
        await dbPut('rh', ed ? { ...reg, ...datos, editadoPor: SESION.nombre, editadoEn: Date.now() } : { ...datos, por: SESION.nombre });
        toast(ed ? 'Movimiento actualizado' : 'Movimiento registrado'); renderApp();
      }, ed ? 'Guardar cambios' : undefined);
      const m = () => { $('#rAlta', dlg).style.display = $('#rT', dlg).value === 'Alta' ? '' : 'none'; };
      $('#rT', dlg).onchange = m;
      if (ed) { setSel($('#rT', dlg), reg.tipo); $('#rP', dlg).value = reg.persona || ''; setSel($('#rC', dlg), reg.campo); setSel($('#rD', dlg), reg.depto); $('#rF', dlg).value = isoDia(reg.fecha); $('#rFF', dlg).value = reg.fechaFin ? isoDia(reg.fechaFin) : ''; $('#rN', dlg).value = reg.notas || ''; $('#rFu', dlg).value = reg.funcion || ''; setSel($('#rGe', dlg), reg.genero); }
      m();
    };
    const nb = $('#nuevoRH', el); if (nb) nb.onclick = () => abrirRH();
    $$('[data-edit]', el).forEach(b => b.onclick = () => abrirRH(DATA.rh.find(x => x.id === b.dataset.edit)));
  }
});

// ============ DESEMPEÑO DE GUARDIAS (evaluación semanal, igual que el dashboard anterior) ============
const CAMPOS_NUM_EV = ['asistencia', 'retardos', 'inasistencias', 'permisos', 'incapacidades', 'uniforme', 'imagen'];
const SEV_IMPACTO = { Leve: 1, Moderada: 2, Grave: 3 };
const clampEv = v => Math.min(5, Math.max(1, v));
const semISO = ts => { const d = new Date(ts); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7)); const j = new Date(d.getFullYear(), 0, 4, 12); return { anio: d.getFullYear(), sem: 1 + Math.round(((d - j) / 864e5 - 3 + ((j.getDay() + 6) % 7)) / 7) }; };
const nivelEv = c => c >= 4 ? 'BAJO' : c >= 3 ? 'MEDIO' : c >= 2 ? 'ALTO' : 'CRÍTICO';
const claseNivel = n => n === 'BAJO' ? 'ok' : n === 'MEDIO' ? 'warn' : n === 'ALTO' ? 'mal' : 'crit';
const manual = v => v !== undefined && v !== null && v !== '';
function calcSemanal(r) {
  const n = {}; CAMPOS_NUM_EV.forEach(f => n[f] = Number(r[f]) || 0);
  const pctAsis = n.asistencia ? Math.max(0, (n.asistencia - n.retardos - n.inasistencias) / n.asistencia) : 0;
  const imp = DATA.evaluaciones.filter(l => l.tipo === 'llamada' && norm(l.guardia) === norm(r.guardia) && l.sem === r.sem && (l.anio || r.anio) === r.anio).reduce((s, l) => s + (SEV_IMPACTO[l.severidad] || 1), 0);
  const e = {
    'Asistencia': manual(r._evalAsistencia) ? +r._evalAsistencia : clampEv(Math.round(1 + pctAsis * 4)),
    'Control de acceso': manual(r._evalControlAcceso) ? +r._evalControlAcceso : 3,
    'Trabajo en equipo': manual(r._evalEquipo) ? +r._evalEquipo : 3,
    'Llamados de atención': manual(r._evalLlamados) ? +r._evalLlamados : clampEv(5 - imp)
  };
  const vals = Object.values(e); const calif = Math.round(vals.reduce((a, b) => a + b, 0) / 4 * 10) / 10;
  const debil = Object.entries(e).sort((a, b) => a[1] - b[1])[0][0];
  return { e, calif, nivel: nivelEv(calif), debil };
}
registrarVista({
  id: 'desempeno', titulo: 'Desempeño de guardias', icono: '⭐', grupo: 'Personal', render(el) {
    const recs = DATA.evaluaciones.filter(r => r.tipo === 'semanal' && enPeriodo(r.fecha) && enCampo(r.ubicacion)).map(r => Object.assign({}, r, { c: calcSemanal(r) }));
    const llam = DATA.evaluaciones.filter(l => l.tipo === 'llamada' && enPeriodo(l.fecha) && (!F.campo || recs.some(r => norm(r.guardia) === norm(l.guardia)))).sort((a, b) => b.fecha - a.fecha);
    const porG = {}; recs.forEach(r => { const k = norm(r.guardia); (porG[k] = porG[k] || { nombre: r.guardia, ubic: r.ubicacion, regs: [] }).regs.push(r); });
    const gs = Object.values(porG).map(g => {
      const cal = Math.round(sum(g.regs, r => r.c.calif) / g.regs.length * 10) / 10;
      const cats = {}; g.regs.forEach(r => Object.entries(r.c.e).forEach(([k, v]) => { (cats[k] = cats[k] || []).push(v); }));
      const debil = Object.entries(cats).map(([k, v]) => [k, sum(v) / v.length]).sort((a, b) => a[1] - b[1])[0][0];
      const nll = llam.filter(l => norm(l.guardia) === norm(g.nombre)).length;
      return { nombre: g.nombre, ubic: g.regs.slice().sort((a, b) => b.fecha - a.fecha)[0].ubicacion, sems: g.regs.length, cal, nivel: nivelEv(cal), debil, nll };
    }).sort((a, b) => b.cal - a.cal);
    const prom = gs.length ? Math.round(sum(gs, g => g.cal) / gs.length * 100) / 100 : 0;
    const crit = gs.filter(g => g.cal < 3);
    let h = '<div class="kpis">' + kpi(gs.length, 'Guardias evaluados', '', recs.length + ' evaluaciones semanales') + kpi(gs.length ? prom : '—', 'Calificación promedio (1-5)', gs.length ? semaforo(prom, 4, 3) : '') +
      kpi(crit.length, 'Nivel alto o crítico (<3.0)', crit.length ? 'mal' : 'ok') + kpi(llam.length, 'Llamadas de atención', llam.length ? 'warn' : '') + '</div>';
    h += puedeEditar() ? '<div class="barra-acc"><button class="btn" id="nuevaEv">+ Captura semanal</button><button class="btn sec" id="nuevaLl">🚩 Llamada de atención</button></div>' : soloLectura();
    if (!recs.length) h += '<div class="card warn">No hay evaluaciones en este periodo. Cambie el filtro de Periodo a <b>Todo</b> o importe el archivo evaluacion_guardias_*.json.</div>';
    h += '<div class="nota">Calificación 1-5 = promedio de Asistencia (del % de asistencia capturado), Control de acceso y Trabajo en equipo (manuales, 3 si no se califican) y Llamados de atención (5 menos Leve 1 / Moderada 2 / Grave 3). Nivel: Bajo ≥4, Medio ≥3, Alto ≥2, Crítico &lt;2.</div>';
    if (crit.length) h += card('Guardias que requieren atención', '<ul class="alertas">' + crit.map(g => `<li class="${g.cal < 2 ? 'mal' : 'warn'}"><b>${esc(g.nombre)}</b> (${esc(g.ubic)}) · ${g.cal} · ${g.nivel} — Reforzar ${esc(g.debil)}${g.nll ? '; ' + g.nll + ' llamada(s) de atención' : ''}.</li>`).join('') + '</ul>');
    const sem = {}; recs.forEach(r => { const k = r.fecha; (sem[k] = sem[k] || []).push(r.c.calif); }); const ks = Object.keys(sem).map(Number).sort((a, b) => a - b);
    const porCampo = {}; recs.forEach(r => { const k = normCampo(r.ubicacion); (porCampo[k] = porCampo[k] || []).push(r.c.calif); });
    h += '<div class="grid2">' + card('Calificación promedio por semana', lineas([{ nombre: 'Promedio', color: COL.azul, valores: ks.map(k => Math.round(sum(sem[k]) / sem[k].length * 10) / 10) }], ks.map(k => fmtFecha(k).slice(0, 5)), { max: 5 })) +
      card('Calificación por campo', barras(Object.fromEntries(Object.entries(porCampo).map(([k, v]) => [k, Math.round(sum(v) / v.length * 10) / 10])), { color: COL.verde })) + '</div>';
    h += card('Ranking de guardias', tabla([{ t: 'Guardia', f: g => g.nombre }, { t: 'Ubicación', f: g => g.ubic }, { t: 'Semanas', f: g => g.sems }, { t: 'Calificación', h: 1, f: g => pill(g.cal.toFixed(1), claseNivel(g.nivel)) }, { t: 'Nivel', f: g => g.nivel }, { t: 'Área débil', f: g => g.debil }, { t: '🚩', f: g => g.nll || '' }], gs, { max: 200 }));
    h += card('Llamadas de atención', tabla([{ t: 'Fecha', f: l => fmtFecha(l.fecha) }, { t: 'Guardia', f: l => l.guardia }, { t: 'Severidad', h: 1, f: l => pill(l.severidad, l.severidad === 'Grave' ? 'mal' : l.severidad === 'Moderada' ? 'warn' : 'ok') }, { t: 'Motivo', f: l => l.motivo || '' }, { t: '', h: 1, f: l => puedeEditar() ? `<button class="mini" data-del="${l.id}">Eliminar</button>` : '' }], llam));
    el.innerHTML = h;
    $$('[data-del]', el).forEach(b => b.onclick = async () => { if (confirm('¿Eliminar esta llamada de atención?')) { await dbDel('evaluaciones', b.dataset.del); renderApp(); } });
    const dl = `<datalist id="dlGu">${nombresGuardias().map(g => `<option value="${esc(g)}">`).join('')}</datalist>`;
    const nb = $('#nuevaEv', el);
    if (nb) nb.onclick = () => {
      const s5 = (id, vacio) => `<select id="${id}">${vacio ? '<option value="">' + vacio + '</option>' : ''}${[5, 4, 3, 2, 1].map(v => `<option>${v}</option>`).join('')}</select>`;
      const w = semISO(Date.now() - 7 * 864e5);
      dialogo('Captura semanal de un guardia', `${dl}<label>Guardia<input id="eG" list="dlGu"></label><label>Ubicación<select id="eU">${nombresCampos().map(c => `<option>${esc(c)}</option>`).join('')}</select></label>
        <label>Año<input type="number" id="eAn" value="${w.anio}"></label><label>Semana (1-53)<input type="number" id="eSe" min="1" max="53" value="${w.sem}"></label>
        <label>Días programados (asistencia)<input type="number" id="eAs" min="0" value="7"></label><label>Retardos<input type="number" id="eRe" min="0" value="0"></label><label>Inasistencias<input type="number" id="eIn" min="0" value="0"></label>
        <label>Permisos<input type="number" id="ePe" min="0" value="0"></label><label>Incapacidades<input type="number" id="eIc" min="0" value="0"></label><label>Días con uniforme completo<input type="number" id="eUn" min="0" value="7"></label><label>Días con buena imagen<input type="number" id="eIm" min="0" value="7"></label>
        <label>Control de acceso (1-5, obligatorio)${s5('eCA')}</label><label>Trabajo en equipo (1-5, opcional)${s5('eEq', 'Neutral (3)')}</label>`,
        async d => {
          const g = nombreCanonico($('#eG', d).value.trim()); if (!g) { toast('Escriba el nombre del guardia', 'mal'); return false; }
          const anio = +$('#eAn', d).value, sem = +$('#eSe', d).value;
          const ex = DATA.evaluaciones.find(x => x.tipo === 'semanal' && norm(x.guardia) === norm(g) && x.sem === sem && x.anio === anio);
          await dbPut('evaluaciones', { id: ex ? ex.id : undefined, tipo: 'semanal', guardia: g, ubicacion: $('#eU', d).value, anio, sem, fecha: LEGADO.lunesISO(anio, sem), asistencia: +$('#eAs', d).value, retardos: +$('#eRe', d).value, inasistencias: +$('#eIn', d).value, permisos: +$('#ePe', d).value, incapacidades: +$('#eIc', d).value, uniforme: +$('#eUn', d).value, imagen: +$('#eIm', d).value, _evalControlAcceso: $('#eCA', d).value, _evalEquipo: $('#eEq', d).value });
          toast('Evaluación guardada'); renderApp();
        });
    };
    const nl = $('#nuevaLl', el);
    if (nl) nl.onclick = () => dialogo('Llamada de atención', `${dl}<label>Guardia<input id="lG" list="dlGu"></label><label>Fecha<input type="date" id="lF" value="${isoDia(Date.now())}"></label><label>Severidad<select id="lS"><option>Leve</option><option>Moderada</option><option>Grave</option></select></label><label>Motivo<input id="lM" placeholder="Ej. abandono de puesto, uso de celular en servicio"></label>`,
      async d => {
        const g = $('#lG', d).value.trim(), m = $('#lM', d).value.trim(); if (!g || !m) { toast('Escriba guardia y motivo', 'mal'); return false; }
        const ts = fromISO($('#lF', d).value) + 12 * 36e5, w = semISO(ts);
        const ll = { guardia: nombreCanonico(g), fecha: ts, motivo: m };
        if (DATA.evaluaciones.some(x => x.tipo === 'llamada' && claveLlam(x) === claveLlam(ll))) { toast('Esa llamada de atención ya está registrada. No se duplicó.', 'mal'); return false; }
        await dbPut('evaluaciones', { tipo: 'llamada', guardia: ll.guardia, fecha: ts, anio: w.anio, sem: w.sem, severidad: $('#lS', d).value, motivo: m });
        toast('Llamada registrada'); renderApp();
      });
  }
});

// ============ CONTROL OPERATIVO DE CAMPO ============
const lunesDe = ts => { const d = new Date(ts); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d.getTime(); };
const OP_GRUPOS = [
  ['Control de accesos', [['regProg', 'Rev. físicas regionales programadas'], ['regReal', 'Rev. físicas regionales realizadas'], ['acasProg', 'Rev. físicas acasillados programadas'], ['acasReal', 'Rev. físicas acasillados realizadas'], ['visProg', 'Rev. físicas visitantes programadas'], ['visReal', 'Rev. físicas visitantes realizadas'], ['provProg', 'Rev. físicas proveedores programadas'], ['provReal', 'Rev. físicas proveedores realizadas'], ['saludosEsp', 'Saludos esperados'], ['saludosReal', 'Saludos realizados'], ['vehProg', 'Rev. vehiculares programadas'], ['vehReal', 'Rev. vehiculares realizadas'], ['puertasAbiertas', 'Puertas abiertas detectadas'], ['accesosSinRev', 'Accesos sin revisión'], ['protocolosInc', 'Protocolos incorrectos'], ['accesosAbiertos', 'Accesos abiertos'], ['trailers', 'Tráilers con fruta'], ['sellosRev', 'Sellos revisados'], ['cajasSinSello', 'Cajas sin sellos de seguridad'], ['roboComb', 'Robos de combustible'], ['roboFruta', 'Robos de fruta'], ['roboMat', 'Robos de materiales'], ['golosinas', 'Golosinas diversas (decomiso)'], ['cigarros', 'Cigarros (decomiso)'], ['articulos', 'Artículos personales (decomiso)'], ['drogas', 'Drogas (decomiso)'], ['sinFicha', 'No cuentan con ficha'], ['envasesVidrio', 'Envases de vidrio (decomiso)']]],
  ['Rondines', [['rondProg', 'Rondines programados'], ['rondReal', 'Rondines realizados'], ['evidencia', 'Evidencia fotográfica'], ['novDet', 'Novedades detectadas'], ['novCorr', 'Novedades corregidas'], ['acoso', 'Acoso sexual (reportes)'], ['faltasResp', 'Faltas de respeto a ingenieros'], ['discusion', 'Discusión entre personas'], ['excesoVel', 'Exceso de velocidad'], ['maltratoJorn', 'Mal trato a jornaleros']]],
  ['Inocuidad', [['bitTotales', 'Bitácoras totales'], ['bitMaltratadas', 'Bitácoras maltratadas'], ['bitBuenEstado', 'Bitácoras en buen estado']]]];
// Desglose de la captura del guardia: pares programadas/realizadas se muestran juntos con su % de cumplimiento
const OP_ETQ = Object.fromEntries(OP_GRUPOS.flatMap(g => g[1]));
const OP_PARES = [['regProg', 'regReal', 'Rev. físicas regionales'], ['acasProg', 'acasReal', 'Rev. físicas acasillados'], ['visProg', 'visReal', 'Rev. físicas visitantes'], ['provProg', 'provReal', 'Rev. físicas proveedores'], ['saludosEsp', 'saludosReal', 'Saludos'], ['vehProg', 'vehReal', 'Rev. vehiculares'], ['trailers', 'sellosRev', 'Sellos revisados en tráilers con fruta'], ['rondProg', 'rondReal', 'Rondines'], ['rondReal', 'evidencia', 'Rondines con evidencia fotográfica'], ['novDet', 'novCorr', 'Novedades corregidas'], ['bitTotales', 'bitBuenEstado', 'Bitácoras en buen estado']];
const OP_FILAS = [
  ['Control de accesos', ['P:regProg', 'P:acasProg', 'P:visProg', 'P:provProg', 'P:saludosEsp', 'P:vehProg', 'puertasAbiertas', 'accesosSinRev', 'protocolosInc', 'accesosAbiertos', 'P:trailers', 'cajasSinSello']],
  ['Robos', ['roboComb', 'roboFruta', 'roboMat']],
  ['Decomisos y fichas', ['golosinas', 'cigarros', 'articulos', 'drogas', 'envasesVidrio', 'sinFicha']],
  ['Rondines', ['P:rondProg', 'P:rondReal', 'P:novDet', 'acoso', 'faltasResp', 'discusion', 'excesoVel', 'maltratoJorn']],
  ['Inocuidad', ['P:bitTotales', 'bitMaltratadas']]];
const opRaw = x => { const r = Object.assign({}, x.raw || {}); if (!x.raw) { r.rondProg = +x.rondinesProg || 0; r.rondReal = +x.rondinesReal || 0; r.acasReal = +x.accesosReg || 0; } return r; };
function opCelda(v, fila) {
  if (fila.startsWith('P:')) { const [p, r] = OP_PARES.find(q => q[0] === fila.slice(2)); const P = v[p] || 0, R = v[r] || 0; if (!P && !R) return '<span class="nota">—</span>'; const c = P ? Math.round(Math.min(R / P, 9.99) * 100) : null; return R + ' / ' + P + (c == null ? '' : ' ' + pill(c + '%', semaforo(c, 90, 75))); }
  const n = v[fila] || 0; return n ? '<b>' + n + '</b>' : '<span class="nota">0</span>';
}
// ---------- control de envíos de las apps de guardia ----------
const ultImports = () => { try { return JSON.parse(localStorage.getItem('ult_import') || '{}'); } catch (e) { return {}; } };
const diasDesde = ts => Math.max(0, Math.floor((diaIni(Date.now()) - diaIni(ts)) / 864e5));
const hace = d => d === 0 ? 'hoy' : d === 1 ? 'ayer' : 'hace ' + d + ' días';
const APPS_GUARDIA = [
  { k: 'rondines', n: '🚶 Rondines', datos: () => DATA.rondines.map(r => [normCampo(r.area), r.inicio]), lim: [2, 4] },
  { k: 'accesos', n: '🚪 Control de acceso', datos: () => DATA.accesos.map(a => [normCampo(a.campo), a.horaIngreso]), lim: [2, 4] },
  { k: 'incidencias', n: '⚠️ Incidencias', datos: () => DATA.incidencias.map(i => [i.campo, i.fecha]), lim: [7, 14], info: 1 },
  { k: 'operativo', n: '🌾 Control operativo', datos: () => DATA.operativo.map(o => [o.campo, o.fecha + 6 * 864e5]), lim: [8, 15] }];
function estadoEnvios() {
  const campos = nombresCampos(), u = ultImports();
  return APPS_GUARDIA.map(a => { const ult = {}; a.datos().forEach(([c, t]) => { if (t && (!ult[c] || t > ult[c])) ult[c] = t; });
    return { ...a, imp: u[a.k], hay: Object.keys(ult).length > 0, campos: campos.map(c => ({ campo: c, t: ult[c], d: ult[c] ? diasDesde(Math.min(ult[c], Date.now())) : null })) }; });
}
// Ubicaciones sin control de acceso: no llevan control operativo (no se revisan, ni se capturan, ni cuentan como pendientes)
const OP_SIN_CONTROL = ['Galeras Palomas', 'Galeras Empaque', 'Almacén General', 'Almacén El Milagro Uno'];
const camposOperativo = () => nombresCampos().filter(c => !OP_SIN_CONTROL.includes(c));
// Días capturados de un resumen semanal: solo la app del guardia informa cuántos días llevó; los de los dashboards anteriores
// (y las capturas hechas en el ERP) vienen completos, aunque no traigan ese dato.
const diasOperativo = r => { const dc = r && r.raw ? r.raw.diasCapturados : null; return dc != null && dc !== '' && isFinite(+dc) && +dc > 0 ? Math.min(+dc, 7) : 7; };
// Semanas de control operativo: desde la primera semana registrada (máx. 12 semanas atrás) hasta la semana pasada
function semanasOperativo(maxSem) {
  const ops = DATA.operativo.filter(x => !OP_SIN_CONTROL.includes(normCampo(x.campo)));
  if (!ops.length) return { sems: [], filas: [], faltan: [], sueltas: [] };
  const lunHoy = lunesDe(Date.now()), primera = lunesDe(Math.min(...ops.map(x => x.fecha))), sems = [];
  for (let i = maxSem || 12; i >= 1; i--) { const t = lunesDe(lunHoy - i * 7 * 864e5); if (t >= primera - 864e5) sems.push(t); }
  const campos = camposOperativo(), usados = new Set();
  // una captura pertenece a la semana (lunes a domingo) en que cae su fecha; el campo se compara ya unificado al catálogo oficial
  const enSemana = (x, t) => x.fecha >= t - 3.5 * 864e5 && x.fecha < t + 3.5 * 864e5;
  const filas = campos.map(c => ({ campo: c, celdas: sems.map(t => {
    const rs = ops.filter(x => normCampo(x.campo) === c && enSemana(x, t)); rs.forEach(x => usados.add(x.id));
    // si hay varias de la misma semana se toma la más completa (más días), y de empate la más reciente
    const r = rs.sort((a, b) => diasOperativo(b) - diasOperativo(a) || (b.importadoEn || 0) - (a.importadoEn || 0))[0];
    return { t, r, dias: r ? diasOperativo(r) : 0 }; }) }));
  // capturas cuyo campo no se reconoce, para revisarlas
  const sueltas = ops.filter(x => !campos.includes(normCampo(x.campo)));
  const faltan = []; filas.forEach(f => f.celdas.forEach(x => { if (!x.r) faltan.push({ campo: f.campo, t: x.t, tipo: 'falta' }); else if (x.dias && x.dias < 7) faltan.push({ campo: f.campo, t: x.t, tipo: 'incompleta', dias: x.dias }); }));
  return { sems, filas, faltan, sueltas };
}
// Numeración de semanas de la empresa (semana 1 = primer lunes del año; 9 al 15 de noviembre de 2026 = semana 45), la misma de las apps de guardia
const semEmp = t => { const d = new Date(t); d.setHours(12, 0, 0, 0); const y = d.getFullYear(), d1 = new Date(y, 0, 1, 12).getDay(), off = d1 === 0 ? 1 : (d1 === 1 ? 0 : 8 - d1), pm = new Date(y, 0, 1 + off, 12); return Math.min(52, Math.max(1, Math.floor(Math.round((d - pm) / 864e5) / 7) + 1)); };
const etqSem = t => 'Sem ' + semEmp(t) + ' (' + fmtFecha(t).slice(0, 5) + ')';
function htmlSemanasOperativo(so) {
  if (!so.sems.length) return '<p class="nota">Aún no hay capturas de control operativo.</p>';
  const cel = x => !x.r ? '<span class="pill mal">❌ Falta</span>' : x.dias < 7 ? '<span class="pill warn">🟡 ' + x.dias + '/7 días</span>' : '<span class="pill ok">✅</span>';
  const porCampo = {}; so.faltan.forEach(f => (porCampo[f.campo] = porCampo[f.campo] || []).push(f));
  const resumen = Object.keys(porCampo).length ? '<ul class="alertas">' + Object.entries(porCampo).map(([c, l]) => { const fl = l.filter(x => x.tipo === 'falta'), inc = l.filter(x => x.tipo === 'incompleta');
      return '<li class="' + (fl.length ? 'mal' : 'warn') + '"><b>' + esc(c) + ':</b> ' + [fl.length ? 'faltan ' + fl.map(x => 'sem ' + semEmp(x.t)).join(', ') : '', inc.length ? 'incompletas ' + inc.map(x => 'sem ' + semEmp(x.t) + ' (' + x.dias + '/7)').join(', ') : ''].filter(Boolean).join(' · ') + '</li>'; }).join('') + '</ul>'
    : '<div class="vacio ok">Todas las semanas de todos los campos están capturadas ✔</div>';
  return resumen + '<div class="tabla-w sinmax"><table class="tabla op-desg"><thead><tr><th>Campo</th>' + so.sems.map(t => '<th>' + etqSem(t) + '</th>').join('') + '</tr></thead><tbody>' +
    so.filas.map(f => '<tr><td>' + esc(f.campo) + '</td>' + f.celdas.map(x => '<td>' + cel(x) + '</td>').join('') + '</tr>').join('') + '</tbody></table></div>' +
    '<p class="nota">Se revisan las semanas ya cerradas (lunes a domingo), desde la primera captura registrada. La semana en curso no se cuenta como faltante. 🟡 = el guardia envió el resumen con menos de 7 días capturados. Galeras Palomas, Galeras Empaque, Almacén General y Almacén El Milagro Uno no llevan control operativo (no tienen control de acceso).</p>' +
    (so.sueltas && so.sueltas.length ? '<details class="nota"><summary><b>' + so.sueltas.length + ' captura(s) no caen en la cuadrícula</b> (campo no reconocido)</summary><ul>' + so.sueltas.slice(0, 40).map(x => '<li>' + esc(x.campo) + ' · semana del ' + fmtFecha(x.fecha) + (x.raw && x.raw.sem ? ' (sem ' + x.raw.sem + '/' + x.raw.anio + ')' : '') + '</li>').join('') + '</ul></details>' : '');
}
function htmlEnvios(env) {
  const cel = (a, x) => { if (a.k === 'operativo' && OP_SIN_CONTROL.includes(x.campo)) return '<span class="nota">no aplica</span>'; if (x.d == null) return a.info ? '<span class="nota">sin registros</span>' : '<span class="pill mal">nunca</span>'; const cl = x.d <= a.lim[0] ? 'ok' : x.d <= a.lim[1] ? 'warn' : 'mal'; return '<span class="pill ' + (a.info && cl === 'mal' ? 'warn' : cl) + '">' + hace(x.d) + '</span>'; };
  const campos = nombresCampos();
  return '<div class="tabla-w sinmax"><table class="tabla op-desg"><thead><tr><th>App del guardia</th><th>Última importación</th>' + campos.map(c => '<th>' + esc(c) + '</th>').join('') + '</tr></thead><tbody>' +
    env.map(a => '<tr><td>' + a.n + '</td><td>' + (a.imp ? fmtFecha(a.imp) + ' · ' + hace(diasDesde(a.imp)) : '<span class="nota">—</span>') + '</td>' + a.campos.map(x => '<td>' + cel(a, x) + '</td>').join('') + '</tr>').join('') + '</tbody></table></div>' +
    '<p class="nota">Cada casilla indica el registro más reciente que ha llegado de ese campo. Rojo: rondines o accesos con más de 4 días sin datos, o control operativo con más de 2 semanas. En incidencias, que no haya registros puede ser normal (no hubo incidentes).</p>';
}
function opDesgloseHTML(regs, porCampo) {
  const cols = porCampo ? Array.from(new Set(regs.map(x => x.campo))).sort() : [];
  const sumar = l => { const v = {}; l.forEach(x => { const r = opRaw(x); Object.keys(OP_ETQ).forEach(k => v[k] = (v[k] || 0) + (+r[k] || 0)); }); return v; };
  const tot = sumar(regs), pc = Object.fromEntries(cols.map(c => [c, sumar(regs.filter(x => x.campo === c))]));
  const nombre = f => f.startsWith('P:') ? OP_PARES.find(q => q[0] === f.slice(2))[2] + ' <span class="nota">(real / prog.)</span>' : esc(OP_ETQ[f]);
  return '<div class="tabla-w sinmax"><table class="tabla op-desg"><thead><tr><th>Indicador</th>' + cols.map(c => '<th>' + esc(c) + '</th>').join('') + '<th>' + (cols.length ? 'Total' : 'Valor') + '</th></tr></thead><tbody>' +
    OP_FILAS.map(g => '<tr class="op-grupo"><td colspan="' + (cols.length + 2) + '">' + esc(g[0]) + '</td></tr>' + g[1].map(f => '<tr><td>' + nombre(f) + '</td>' + cols.map(c => '<td>' + opCelda(pc[c], f) + '</td>').join('') + '<td>' + opCelda(tot, f) + '</td></tr>').join('')).join('') + '</tbody></table></div>';
}
registrarVista({
  id: 'operativo', titulo: 'Control operativo de campo', icono: '🌾', grupo: 'Seguridad', render(el) {
    const op = V.operativo().sort((a, b) => b.fecha - a.fecha);
    const rp = sum(op, x => +x.rondinesProg || 0), rr = sum(op, x => +x.rondinesReal || 0);
    const inoc = op.filter(x => x.inocuidad !== '' && x.inocuidad != null);
    const inocP = inoc.length ? Math.round(sum(inoc, x => +x.inocuidad) / inoc.length * 10) / 10 : 0;
    let h = '<div class="kpis">' + kpi(op.length, 'Capturas semanales') + kpi(rp ? pct(rr, rp) + '%' : '—', 'Rondines realizados vs programados', rp ? semaforo(pct(rr, rp), 90, 75) : '') + kpi(sum(op, x => +x.accesosReg || 0), 'Accesos registrados') + kpi(inoc.length ? inocP + '%' : '—', 'Cumplimiento de inocuidad', inoc.length ? semaforo(inocP, 90, 75) : '') + '</div>';
    { const T = {}; op.forEach(x => { const r = opRaw(x); Object.keys(OP_ETQ).forEach(k => T[k] = (T[k] || 0) + (+r[k] || 0)); });
      const pts = op.map(puntajeOperativo).filter(v => v != null), rP = pts.length ? Math.round(sum(pts) / pts.length) : null;
      const revP = T.regProg + T.acasProg + T.visProg + T.provProg + T.vehProg, revR = T.regReal + T.acasReal + T.visReal + T.provReal + T.vehReal;
      const rob = T.roboComb + T.roboFruta + T.roboMat, dec = T.golosinas + T.cigarros + T.articulos + T.drogas + T.envasesVidrio;
      h += '<div class="kpis">' + kpi(rP == null ? '—' : rP, 'Riesgo operativo promedio (0-100)', rP == null ? '' : nivelRiesgo(rP)[1] === 'crit' ? 'mal' : nivelRiesgo(rP)[1]) + kpi(revP ? pct(revR, revP) + '%' : '—', 'Revisiones físicas y vehiculares realizadas', revP ? semaforo(pct(revR, revP), 90, 75) : '', revR + ' de ' + revP) +
        kpi(T.trailers ? pct(T.sellosRev, T.trailers) + '%' : '—', 'Sellos revisados en tráilers', T.trailers ? semaforo(pct(T.sellosRev, T.trailers), 95, 85) : '', T.sellosRev + ' de ' + T.trailers) + kpi(rob, 'Robos (combustible, fruta, materiales)', rob ? 'mal' : 'ok') + kpi(dec, 'Decomisos', '', T.sinFicha + ' sin ficha · ' + T.puertasAbiertas + ' puertas abiertas') + '</div>'; }
    h += puedeEditar() ? '<div class="barra-acc"><button class="btn" id="nuevoOp">+ Captura semanal</button></div>' : soloLectura();
    const sem = {}; op.forEach(x => { const k = isoDia(x.fecha); sem[k] = sem[k] || { p: 0, r: 0 }; sem[k].p += +x.rondinesProg || 0; sem[k].r += +x.rondinesReal || 0; });
    const ks = Object.keys(sem).sort();
    const _ic = {}; inoc.forEach(x => { (_ic[x.campo] = _ic[x.campo] || []).push(+x.inocuidad); });
    const inocPorCampo = Object.fromEntries(Object.entries(_ic).map(([k, v]) => [k, Math.round(sum(v) / v.length)]));
    h += '<div class="grid2">' + card('Cumplimiento de rondines por semana (%)', lineas([{ nombre: '% realizados', color: COL.azul, valores: ks.map(k => sem[k].p ? Math.round(sem[k].r / sem[k].p * 100) : 0) }], ks.map(k => k.slice(8) + '/' + k.slice(5, 7)), { max: 100 })) +
      card('Inocuidad por campo (%)', barras(inocPorCampo, { color: COL.verde, fmt: v => v + '%' })) + '</div>';
    h += card('Semanas pendientes de control operativo por campo', htmlSemanasOperativo(semanasOperativo(20)));
    h += card('Desglose de la captura del guardia (suma del periodo por campo)', op.length ? opDesgloseHTML(op, true) : '<p class="nota">Sin capturas en este periodo. Importe el resumen semanal de la app de Control operativo del guardia en Datos → Importar.</p>');
    h += card('Capturas', tabla([{ t: 'Semana del', f: x => fmtFecha(x.fecha) }, { t: 'Campo', f: x => x.campo }, { t: 'Rondines prog.', f: x => x.rondinesProg }, { t: 'Rondines real.', f: x => x.rondinesReal }, { t: 'Cumpl.', h: 1, f: x => +x.rondinesProg ? pill(pct(+x.rondinesReal, +x.rondinesProg) + '%', semaforo(pct(+x.rondinesReal, +x.rondinesProg), 90, 75)) : '—' }, { t: 'Accesos', f: x => x.accesosReg }, { t: 'Inocuidad %', f: x => x.inocuidad === '' ? '—' : x.inocuidad }, { t: 'Observaciones', f: x => x.obs || '' }, { t: 'Riesgo', h: 1, f: x => { const v = puntajeOperativo(x); return v == null ? '—' : pill(Math.round(v) + ' · ' + nivelRiesgo(v)[0], nivelRiesgo(v)[1]); } }, { t: 'Origen / actualización', f: x => x.raw && x.raw._own ? '📱 App guardia' + (x.guardia || x.raw.guardia ? ' · ' + (x.guardia || x.raw.guardia) : '') + (x.raw.diasCapturados ? ' · ' + x.raw.diasCapturados + '/7 días' : '') + (x.importadoEn ? ' · importado ' + fmtFecha(x.importadoEn) + ' ' + new Date(x.importadoEn).toTimeString().slice(0, 5) : '') + (x.archivo ? ' · ' + x.archivo : '') : x.origen === 'manual' ? '✍️ ERP' + (x.editadoPor || x.por ? ' · ' + (x.editadoPor || x.por) : '') : 'Archivo anterior' }, { t: '', h: 1, f: x => `<button class="mini" data-ver="${x.id}">Ver detalle</button> ` + (puedeEditar() ? `<button class="mini" data-edit="${x.id}">Editar</button> <button class="mini" data-del="${x.id}">Eliminar</button>` : '') }], op));
    let logOp = []; try { logOp = JSON.parse(localStorage.getItem('op_import_log') || '[]'); } catch (e) { }
    h += card('Archivos de la app del guardia importados (' + logOp.length + ')', logOp.length ? tabla([{ t: 'Importado', f: x => fmtFecha(x.fecha) + ' ' + new Date(x.fecha).toTimeString().slice(0, 5) }, { t: 'Archivo', f: x => x.archivo }, { t: 'Semanas', f: x => (x.semanas || []).join(', ') || '—' }, { t: 'Resultado', h: 1, f: x => [x.nuevos ? pill(x.nuevos + ' nueva(s)', 'ok') : '', x.actualizados ? pill(x.actualizados + ' actualizada(s)', 'ok') : '', x.omitidos ? pill(x.omitidos + ' más antigua(s), no se aplicó', 'mal') : ''].join(' ') }], logOp.slice(0, 30)) : '<p class="nota">Aquí aparecerá cada archivo de resumen semanal que importe desde Datos → Importar. Cada envío del guardia actualiza la semana de su campo.</p>');
    el.innerHTML = h;
    $$('[data-del]', el).forEach(b => b.onclick = async () => { if (confirm('¿Eliminar esta captura?')) { await dbDel('operativo', b.dataset.del); renderApp(); } });
    const nb = $('#nuevoOp', el);
    const abrirOp = reg => {
      const ed = !!reg, r = (reg && reg.raw) || {};
      if (reg && !reg.raw) { r.rondProg = reg.rondinesProg; r.rondReal = reg.rondinesReal; r.acasReal = reg.accesosReg; }
      const ini0 = reg ? reg.fecha : lunesDe(Date.now() - 7 * 864e5), s0 = semISO(ini0);
      const campos = camposOperativo(); if (reg && reg.campo && !campos.includes(reg.campo)) campos.push(reg.campo);
      const grupos = OP_GRUPOS.map(g => `<h4>${g[0]}</h4><div class="opgrid">${g[1].map(f => `<label>${f[1]} *<input type="number" min="0" step="1" data-k="${f[0]}" value="${r[f[0]] != null && r[f[0]] !== '' ? +r[f[0]] : 0}"></label>`).join('')}</div>`).join('');
      const d = dialogo(ed ? 'Editar captura semanal de campo' : 'Agregar captura semanal de campo', `<h4>Identificación de la semana</h4>
        <div class="opgrid"><label style="grid-column:span 2">Campo / ubicación *<select id="oC">${campos.map(c => `<option${reg && reg.campo === c ? ' selected' : ''}>${esc(c)}</option>`).join('')}</select></label>
        <label>Año *<input type="number" id="oA" min="2020" max="2100" value="${r.anio || s0.anio}"></label><label>Semana (1-53) *<input type="number" id="oS" min="1" max="53" value="${r.sem || s0.sem}"></label>
        <label>Fecha inicio<input type="date" id="oF" value="${isoDia(ini0)}"></label><label>Fecha fin<input type="date" id="oFF" value="${isoDia(ini0 + 6 * 864e5)}" disabled></label></div>
        <div class="barra-acc"><button class="btn sec" id="oAuto" type="button">Autollenar rondines y accesos con datos de la app</button></div>
        ${grupos}<label>Observaciones / acción recomendada<textarea id="oO" rows="2">${esc(reg && reg.obs || '')}</textarea></label>`,
        async d => {
          const anio = +$('#oA', d).value, sem = +$('#oS', d).value, campo = $('#oC', d).value;
          if (!campo || !anio || !sem || sem < 1 || sem > 53) { toast('Indique campo, año y semana (1-53)'); return false; }
          const ini = LEGADO.lunesISO(anio, sem), raw = { ubicacion: campo, anio, sem };
          $$('[data-k]', d).forEach(i => raw[i.dataset.k] = Math.max(0, +i.value || 0));
          const ex = DATA.operativo.find(x => x.fecha === ini && x.campo === campo && (!reg || x.id !== reg.id));
          if (ex && !confirm('Ya existe una captura de ' + campo + ' para la semana ' + sem + '. ¿Reemplazarla con esta?')) return false;
          const base = reg || ex || {};
          const inoc = raw.bitTotales ? Math.round((raw.bitTotales - raw.bitMaltratadas) / raw.bitTotales * 100) : '';
          await dbPut('operativo', { ...base, id: base.id, fecha: ini, campo, punto: campo, rondinesProg: raw.rondProg, rondinesReal: raw.rondReal, accesosReg: raw.acasReal, inocuidad: inoc, obs: $('#oO', d).value.trim(), raw, origen: 'manual', ...(ed || ex ? { editadoPor: SESION.nombre, editadoEn: Date.now() } : { por: SESION.nombre }) });
          if (ex && reg && ex.id !== reg.id) await dbDel('operativo', ex.id);
          toast('Captura guardada'); renderApp();
        }, 'Guardar captura');
      d.firstElementChild.classList.add('ancho');
      const deSem = () => { const a = +$('#oA', d).value, w = +$('#oS', d).value; if (a && w) { const t = LEGADO.lunesISO(a, w); $('#oF', d).value = isoDia(t); $('#oFF', d).value = isoDia(t + 6 * 864e5); } };
      const deFecha = () => { const v = $('#oF', d).value; if (!v) return; const t = lunesDe(fromISO(v)), q = semISO(t); $('#oA', d).value = q.anio; $('#oS', d).value = q.sem; $('#oFF', d).value = isoDia(t + 6 * 864e5); };
      $('#oA', d).oninput = deSem; $('#oS', d).oninput = deSem; $('#oF', d).onchange = deFecha;
      $('#oAuto', d).onclick = () => {
        const ini = LEGADO.lunesISO(+$('#oA', d).value, +$('#oS', d).value), fin = ini + 7 * 864e5 - 1, c = $('#oC', d).value;
        $('[data-k=rondReal]', d).value = DATA.rondines.filter(r => r.inicio >= diaIni(ini) && r.inicio <= fin && normCampo(r.area) === c).length;
        $('[data-k=acasReal]', d).value = DATA.accesos.filter(a => a.horaIngreso >= diaIni(ini) && a.horaIngreso <= fin && normCampo(a.campo) === c).length;
        toast('Rondines realizados y accesos llenados; capture el resto');
      };
    };
    if (nb) nb.onclick = () => abrirOp(null);
    $$('[data-edit]', el).forEach(b => b.onclick = () => abrirOp(DATA.operativo.find(x => x.id === b.dataset.edit)));
    $$('[data-ver]', el).forEach(b => b.onclick = () => { const x = DATA.operativo.find(o => o.id === b.dataset.ver); if (!x) return; const v = puntajeOperativo(x), r = x.raw || {};
      const d = dialogo('Captura de ' + x.campo + ' · semana del ' + fmtFecha(x.fecha), '<p>' + (v == null ? '' : 'Riesgo operativo: ' + pill(Math.round(v) + ' · ' + nivelRiesgo(v)[0], nivelRiesgo(v)[1]) + ' ') + (r._own ? '📱 Capturado por ' + esc(x.guardia || r.guardia || 'el guardia') + (r.diasCapturados ? ' · ' + r.diasCapturados + ' de 7 días' : '') : '') + '</p>' + (r.areaEnfoque ? '<p><b>Área de enfoque:</b> ' + esc(r.areaEnfoque) + '</p>' : '') + (x.obs ? '<p><b>Acción recomendada:</b> ' + esc(x.obs) + '</p>' : '') + (r.observaciones ? '<p><b>Observaciones del guardia:</b> ' + esc(r.observaciones) + '</p>' : '') + opDesgloseHTML([x], false), () => true, 'Cerrar');
      d.firstElementChild.classList.add('ancho'); });
  }
});

// ============ DATOS: IMPORTAR / RESPALDO ============
registrarVista({
  id: 'datos', titulo: 'Importar y respaldo', icono: '📥', grupo: 'Sistema', sinFiltros: true, render(el) {
    const ult = cfgGet('ultimaImport', null);
    let h = card('Importar datos de las apps de los guardias', `<div class="drop" id="drop"><p><b>Arrastre aquí los archivos JSON</b> o <button class="btn" id="elegir">Elegir archivos</button></p>
      <p class="nota">Acepta rondines individuales, respaldos de los paneles (rondines y accesos), los archivos exportados por las apps de guardia de Incidencias y de Control operativo, y respaldos completos de este software. Los que ya estaban cargados se omiten. Para cargar la plantilla de empleados (función, género, fecha de ingreso) elija el archivo RH_Control_Personal.html: solo se lee en este navegador, no se sube a ningún lado.</p><input type="file" id="fArch" multiple accept=".json,.html,.htm,application/json,text/html" hidden></div><div id="impMsg" class="msg"></div>` + (ult ? `<div class="nota">Última importación: ${fmtFH(ult)}</div>` : ''));
    const cont = (n, t) => `<tr><td>${t}</td><td>${DATA[n].length}</td></tr>`;
    h += '<div class="grid2">' + card('Datos guardados en este equipo', `<table class="tabla"><tbody>${cont('rondines', 'Rondines')}${cont('accesos', 'Accesos')}${cont('incidencias', 'Incidencias')}${cont('rh', 'Movimientos de RH')}${cont('evaluaciones', 'Evaluaciones')}${cont('operativo', 'Capturas operativas')}</tbody></table>`) +
      card('Respaldo', `<p>Descargue un respaldo completo con regularidad (USB, correo o nube): los datos viven solo en el navegador de este equipo.</p><button class="btn" id="resp">Descargar respaldo completo (JSON)</button>
      ${esAdmin() ? '<hr><p>Restaurar un respaldo completo (reemplaza todo lo actual):</p><button class="btn sec" id="rest">Restaurar respaldo…</button><input type="file" id="fRest" accept=".json" hidden>' : ''}`) + '</div>';
    h += card('Exportar a Excel (CSV)', '<div class="barra-acc"><button class="btn sec" data-csv="rondines">Rondines</button><button class="btn sec" data-csv="accesos">Accesos</button><button class="btn sec" data-csv="incidencias">Incidencias</button><button class="btn sec" data-csv="rh">RH</button></div>');
    el.innerHTML = h;
    const procesa = async files => {
      if (!puedeEditar()) { toast('Su perfil es de solo lectura', 'mal'); return; }
      const c = await importarArchivos(files); await cfgSet('ultimaImport', Date.now());
      $('#impMsg', el).textContent = resumenImport(c); toast(resumenImport(c), c.error && !(c.rondines + c.accesos + c.incidencias) ? 'mal' : 'ok'); renderApp(); $('#impMsg').textContent = resumenImport(c);
    };
    $('#elegir', el).onclick = () => $('#fArch', el).click(); $('#fArch', el).onchange = e => procesa(e.target.files);
    const dz = $('#drop', el); dz.ondragover = e => { e.preventDefault(); dz.classList.add('sobre'); }; dz.ondragleave = () => dz.classList.remove('sobre'); dz.ondrop = e => { e.preventDefault(); dz.classList.remove('sobre'); procesa(e.dataTransfer.files); };
    $('#resp', el).onclick = () => { descargar('respaldo_seguridad_' + isoDia(Date.now()) + '.json', JSON.stringify(crearRespaldo())); };
    if (esAdmin()) {
      $('#rest', el).onclick = () => $('#fRest', el).click();
      $('#fRest', el).onchange = async e => { try { const r = JSON.parse(await e.target.files[0].text()); if (!r._unificado) throw 0; if (!confirm('Esto reemplaza TODOS los datos actuales por los del respaldo. ¿Continuar?')) return; await restaurarRespaldo(r, true); toast('Respaldo restaurado'); renderApp(); } catch (x) { toast('El archivo no es un respaldo válido', 'mal'); } };
    }
    $$('[data-csv]', el).forEach(b => b.onclick = () => exportarCSV(b.dataset.csv));
  }
});
function exportarCSV(t) {
  const defs = {
    rondines: [['Fecha', r => fmtFH(r.inicio)], ['Guardia', r => r.guardia], ['Campo', r => normCampo(r.area)], ['Área', r => r.area], ['Turno', r => r.turno], ['Duración min', r => r.fin ? Math.round((r.fin - r.inicio) / 60000) : ''], ['Cumplimiento %', r => cumplimientoRondin(r)], ['Novedades', r => (r.novedades || []).length]],
    accesos: [['Ingreso', a => fmtFH(a.horaIngreso)], ['Salida', a => a.horaSalida ? fmtFH(a.horaSalida) : ''], ['Nombre', a => a.nombre], ['Tipo', a => a.tipoPersona], ['Empresa', a => a.empresaProcedencia], ['Placas', a => a.placas], ['Campo', a => normCampo(a.campo)], ['Motivo', a => a.motivoVisita], ['Visita a', a => a.areaVisita], ['Confirmó', a => a.guardiaConfirma]],
    incidencias: [['Fecha', i => fmtFecha(i.fecha)], ['Campo', i => i.campo], ['Departamento', i => i.depto], ['Problema', i => i.problema], ['Peso', i => pesoDe(i)], ['Descripción', i => i.descripcion], ['Acción', i => i.accion]],
    rh: [['Fecha', x => fmtFecha(x.fecha)], ['Tipo', x => x.tipo], ['Persona', x => x.persona], ['Campo', x => x.campo], ['Departamento', x => x.depto], ['Días', x => diasRH(x)], ['Notas', x => x.notas]]
  }[t];
  const q = v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
  const csv = '﻿' + [defs.map(d => q(d[0])).join(',')].concat(DATA[t].map(r => defs.map(d => q(d[1](r))).join(','))).join('\r\n');
  descargar(t + '_' + isoDia(Date.now()) + '.csv', csv, 'text/csv;charset=utf-8');
}

// ============ CONFIGURACIÓN (solo administrador) ============
registrarVista({
  id: 'config', titulo: 'Configuración', icono: '⚙️', grupo: 'Sistema', sinFiltros: true, soloAdmin: true, render(el) {
    const us = getUsuarios();
    let h = card('Usuarios y PIN', tabla([{ t: 'Usuario', f: u => u.nombre }, { t: 'Rol', f: u => ROLES[u.rol] }, { t: '', h: 1, f: u => `<button class="mini" data-pin="${u.id}">Cambiar PIN</button> ${u.id !== SESION.id ? `<button class="mini" data-udel="${u.id}">Eliminar</button>` : ''}` }], us) +
      '<div class="barra-acc"><button class="btn" id="nuevoU">+ Nuevo usuario</button></div><div class="nota">Los guardias no tienen acceso a este software: siguen usando sus apps de rondines y control de acceso.</div>');
    h += '<div class="grid2">' + card('Campos y alias', `<p class="nota">Un campo por línea: <code>Nombre | alias1, alias2</code>. Los alias unifican cómo escriben el nombre los guardias (se ignoran mayúsculas y acentos; <code>galeras+palomas</code> exige ambas palabras; el orden importa: lo más específico primero).</p><textarea id="cfCampos" rows="8">${esc(getCampos().map(c => c.nombre + ' | ' + c.alias.join(', ')).join('\n'))}</textarea>`) +
      card('Departamentos', `<p class="nota">Uno por línea.</p><textarea id="cfDeptos" rows="8">${esc(getDeptos().join('\n'))}</textarea>`) +
      card('Catálogo de problemas y peso (1-5)', `<p class="nota">Formato: <code>Nombre | peso</code>.</p><textarea id="cfCat" rows="8">${esc(getCatalogo().map(c => c.nombre + ' | ' + c.peso).join('\n'))}</textarea>`) +
      card('Lista de acceso restringido', `<p class="nota">Nombres o placas, uno por línea. Se marcan en Control de acceso.</p><textarea id="cfRes" rows="8">${esc(cfgGet('restringidos', []).join('\n'))}</textarea>`) + '</div>';
    h += '<div class="barra-acc"><button class="btn" id="cfGuardar">Guardar configuración</button></div>';
    if (esAdmin()) h += card('Borrar datos', '<div class="barra-acc">' + ['rondines', 'accesos', 'incidencias', 'rh', 'evaluaciones', 'operativo', 'rol'].map(s => `<button class="btn peligro" data-clr="${s}">Borrar ${s}</button>`).join('') + '</div><div class="nota">Descargue un respaldo antes de borrar.</div>');
    el.innerHTML = h;
    $('#nuevoU', el).onclick = () => dialogo('Nuevo usuario', `<label>Nombre de usuario<input id="uN"></label><label>PIN (4 a 8 dígitos)<input id="uP" type="password" inputmode="numeric" maxlength="8"></label><label>Rol<select id="uR">${Object.entries(ROLES).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></label>`,
      async d => { const n = $('#uN', d).value, p = $('#uP', d).value; if (!n.trim() || !/^\d{4,8}$/.test(p)) { toast('Nombre y PIN de 4 a 8 dígitos', 'mal'); return false; } if (getUsuarios().some(u => norm(u.nombre) === norm(n))) { toast('Ese usuario ya existe', 'mal'); return false; } await crearUsuario(n, p, $('#uR', d).value); renderApp(); });
    $$('[data-pin]', el).forEach(b => b.onclick = () => dialogo('Cambiar PIN', '<label>Nuevo PIN<input id="nP" type="password" inputmode="numeric" maxlength="8"></label>', async d => { const p = $('#nP', d).value; if (!/^\d{4,8}$/.test(p)) { toast('PIN de 4 a 8 dígitos', 'mal'); return false; } const arr = getUsuarios().map(u => u.id === b.dataset.pin ? Object.assign({}, u, { hash: null, sal: Math.random().toString(36).slice(2, 10) }) : u); for (const u of arr) if (u.hash === null) u.hash = await hashPin(p, u.sal); await cfgSet('usuarios', arr); toast('PIN actualizado'); }));
    $$('[data-udel]', el).forEach(b => b.onclick = async () => { if (confirm('¿Eliminar este usuario?')) { await cfgSet('usuarios', getUsuarios().filter(u => u.id !== b.dataset.udel)); renderApp(); } });
    $$('[data-clr]', el).forEach(b => b.onclick = async () => { if (confirm('¿Borrar TODOS los datos de ' + b.dataset.clr + '? No se puede deshacer.')) { await dbClear(b.dataset.clr); toast('Datos borrados'); renderApp(); } });
    $('#cfGuardar', el).onclick = async () => {
      const lineas = id => $('#' + id, el).value.split('\n').map(s => s.trim()).filter(Boolean);
      const campos = lineas('cfCampos').map(l => { const [n, a] = l.split('|'); return { nombre: n.trim(), p: (CAMPOS_LM.lista.find(x => x.nombre === n.trim()) || {}).p, alias: (a || '').split(',').map(s => s.trim()).filter(Boolean) }; });
      const cat = lineas('cfCat').map(l => { const [n, p] = l.split('|'); return { nombre: n.trim(), peso: Math.min(5, Math.max(1, parseInt(p) || 1)) }; });
      if (!campos.length) { toast('Debe haber al menos un campo', 'mal'); return; }
      await cfgSet('campos', campos); await cfgSet('deptos', lineas('cfDeptos')); await cfgSet('catalogo', cat); await cfgSet('restringidos', lineas('cfRes'));
      toast('Configuración guardada'); renderApp();
    };
  }
});

document.addEventListener('click', e => { const td = e.target.closest && e.target.closest('td.largo'); if (td) td.classList.toggle('abierto'); });

// Si el navegador conserva un index.html antiguo (sin los scripts de QR), los carga aquí y vuelve a pintar.
function qrCargarScripts() {
  if (!window._qrCargando) {
    window._qrCargando = true;
    const lista = ['qrcode.js', 'qr-acceso.js', 'qr-invitaciones.js'];
    const sig = () => {
      const f = lista.shift();
      if (!f) { const s = document.getElementById('fPer'); if (s) s.dispatchEvent(new Event('change', { bubbles: true })); return; }
      const sc = document.createElement('script'); sc.src = f + '?v=33'; sc.onload = sig; sc.onerror = sig; document.head.appendChild(sc);
    };
    sig();
  }
  return '';
}
