/* Seguridad La Memoria — vistas: resumen, rondines, accesos, incidencias, RH, desempeño, control operativo, datos, configuración */
'use strict';

const COL = { azul: '#a9ccff', naranja: '#f0a35e', verde: '#34a853', rojo: '#e5534b', amarillo: '#d9a520', gris: '#c3d3f5' };
function tabla(cols, rows, opc) {
  opc = opc || {}; const max = opc.max || 150;
  if (!rows.length) return '<div class="vacio">Sin registros en este periodo</div>';
  const shown = rows.slice(0, max);
  return `<div class="tabla-w"><table class="tabla"><thead><tr>${cols.map(c => `<th>${esc(c.t)}</th>`).join('')}</tr></thead><tbody>${shown.map((r, i) => `<tr ${opc.click ? `data-i="${i}" class="click"` : ''}>${cols.map(c => { const lg = /^(Descripci|Notas|Observ|Motivo)/.test(c.t) && !c.h; const t = c.h ? c.f(r) : esc(c.f(r)); return lg ? `<td class="largo" title="Clic para ver completo">${t}</td>` : `<td>${t}</td>`; }).join('')}</tr>`).join('')}</tbody></table></div>${rows.length > max ? `<div class="nota">Mostrando ${max} de ${rows.length} registros. Use los filtros para acotar.</div>` : ''}`;
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
    const rs = V.rondines(), ac = V.accesos(), inc = V.incidencias(), rh = V.rh();
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
      kpi(rh.filter(x => x.tipo === 'Inasistencia').length, 'Inasistencias (RH)', '') + kpisApoyo(inc) + '</div>';
    // alertas
    const al = [];
    falt.forEach(f => al.push(['mal', `Sin rondín en 7 días: ${f.campo} · turno ${f.turno} (tenía ${f.historico} rondines previos). Sin evidencia ante robo o reclamo de seguro.`]));
    exced.slice(0, 8).forEach(a => al.push(['warn', `${a.nombre || 'Visitante'} lleva ${tiempoDentroH(a).toFixed(1)} h dentro en ${normCampo(a.campo)} sin registrar salida.`]));
    restr.slice(0, 5).forEach(a => al.push(['mal', `Ingreso de persona/vehículo en lista restringida: ${a.nombre} (${fmtFH(a.horaIngreso)}).`]));
    graves.slice(0, 6).forEach(i => al.push(['mal', `Incidencia grave: ${i.problema} · ${i.campo} / ${i.depto || '—'} (${fmtFecha(i.fecha)}).`]));
    { const ra = resumenApoyo(inc); if (ra.pct >= 10) al.push(['warn', `Intervención de la autoridad: ${textoApoyo(ra)}`]); }
    riesgos.filter(r => r.nivel === 'Alto' || r.nivel === 'Crítico').forEach(r => al.push([r.nivel === 'Crítico' ? 'mal' : 'warn', `Riesgo ${r.nivel.toLowerCase()} en ${r.campo} (${r.puntos}/100).`]));
    h += card('Alertas que requieren atención', al.length ? '<ul class="alertas">' + al.map(a => `<li class="${a[0]}">${esc(a[1])}</li>`).join('') + '</ul>' : '<div class="vacio ok">Sin alertas en este periodo ✔</div>');
    // tabla por campo
    const filas = riesgos.filter(r => !F.campo || r.campo === F.campo);
    h += card('Situación por campo', tabla([
      { t: 'Campo', f: r => r.campo }, { t: 'Rondines', f: r => r.rondines }, { t: 'Cumpl. %', f: r => r.rondines ? r.cumpl + '%' : '—' },
      { t: 'Accesos', f: r => r.accesos }, { t: 'Incidencias', f: r => r.incidencias }, { t: 'Inasist.', f: r => r.inasist },
      { t: 'Riesgo', h: 1, f: r => pill(r.puntos + ' · ' + r.nivel, r.clase) }
    ], filas));
    h += '<div class="grid2">' + card('Incidencias por campo', barras(groupCount(inc, i => i.campo), { color: COL.naranja })) +
      card('Accesos por campo', barras(groupCount(ac, a => normCampo(a.campo)), { color: COL.azul })) + '</div>';
    h += cardApoyoResumen(inc, true);
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
    h += cardInocuidad();
    if (dentro.length) h += card('Actualmente dentro (sin salida)', tabla([{ t: 'Ingreso', f: a => fmtFH(a.horaIngreso) }, { t: 'Nombre', f: a => a.nombre }, { t: 'ID', h: 1, f: fotoID }, { t: 'Campo', f: a => normCampo(a.campo) }, { t: 'Motivo', f: a => a.motivoVisita || '—' }, { t: 'Visita a', f: a => a.areaVisita || '—' }, { t: 'Lleva', h: 1, f: a => pill(tiempoDentroH(a).toFixed(1) + ' h', accesoExcedido(a) ? 'mal' : 'ok') }], dentro.sort((a, b) => a.horaIngreso - b.horaIngreso)));
    h += '<div class="grid2">' + card('Accesos por campo', barras(groupCount(ac, a => normCampo(a.campo)), { color: COL.azul })) + card('Motivos de visita', barras(groupCount(ac, a => a.motivoVisita), { color: COL.naranja })) +
      card('Tipo de visitante', barras(groupCount(ac, a => a.tipoPersona), { color: COL.verde })) + card('Área / persona visitada', barras(groupCount(ac, a => a.areaVisita), { color: COL.gris })) + '</div>';
    h += card('Bitácora de accesos', tabla([{ t: 'Ingreso', f: a => fmtFH(a.horaIngreso) }, { t: 'Salida', f: a => a.horaSalida ? fmtFH(a.horaSalida) : '—' }, { t: 'Nombre', f: a => a.nombre }, { t: 'ID', h: 1, f: fotoID }, { t: 'Tipo', f: a => a.tipoPersona || '—' }, { t: 'Empresa', f: a => a.empresaProcedencia || '—' }, { t: 'Placas', f: a => a.placas || '—' }, { t: 'Campo', f: a => normCampo(a.campo) }, { t: 'Motivo', f: a => a.motivoVisita || '—' }, { t: 'Confirmó', f: a => a.guardiaConfirma || '—' }], ac));
    el.innerHTML = h; bindInocuidad(el);
  }
});

// ============ INCIDENCIAS ============
registrarVista({
  id: 'incidencias', titulo: 'Incidencias', icono: '⚠️', grupo: 'Seguridad', render(el) {
    const inc = V.incidencias().sort((a, b) => b.fecha - a.fecha);
    const graves = inc.filter(i => pesoDe(i) >= 4);
    let h = '<div class="kpis">' + kpi(inc.length, 'Incidencias') + kpi(graves.length, 'Graves (peso ≥4)', graves.length ? 'mal' : 'ok') + kpi(sum(inc, pesoDe), 'Puntos de severidad') + kpi(Object.keys(groupCount(inc, i => i.depto)).length, 'Departamentos con incidencias') + kpisApoyo(inc) + '</div>';
    if (puedeEditar()) h += `<div class="barra-acc"><button class="btn" id="nuevaInc">+ Registrar incidencia</button></div>`; else h += soloLectura();
    h += '<div class="grid2">' + card('Por campo', barras(groupCount(inc, i => i.campo), { color: COL.naranja })) + card('Por catálogo de problema', barras(groupCount(inc, i => i.problema), { color: COL.rojo })) +
      card('Por departamento', barras(groupCount(inc, i => i.depto), { color: COL.azul })) + card('Severidad por campo (puntos)', barras(inc.reduce((m, i) => { m[i.campo] = (m[i.campo] || 0) + pesoDe(i); return m; }, {}), { color: COL.rojo })) + '</div>';
    h += cardApoyoResumen(inc, true);
    h += card('Registro de incidencias', tabla([{ t: 'Fecha', f: i => fmtFecha(i.fecha) }, { t: 'Campo', f: i => i.campo }, { t: 'Departamento', f: i => i.depto || '—' }, { t: 'Problema', f: i => i.problema }, { t: 'Peso', h: 1, f: i => pill(pesoDe(i), pesoDe(i) >= 4 ? 'mal' : pesoDe(i) >= 3 ? 'warn' : 'ok') }, { t: 'Autoridad', f: i => { const x = apoyoDe(i); return x ? AUT_ETQ[x.ap] : '—'; } }, { t: 'Descripción', f: i => i.descripcion || '' }, { t: '', h: 1, f: i => puedeEditar() ? `<button class="mini" data-del="${i.id}">Eliminar</button>` : '' }], inc));
    el.innerHTML = h;
    $$('[data-del]', el).forEach(b => b.onclick = async () => { if (confirm('¿Eliminar esta incidencia?')) { await dbDel('incidencias', b.dataset.del); renderApp(); } });
    const nb = $('#nuevaInc', el);
    if (nb) nb.onclick = () => dialogo('Registrar incidencia', `
      <label>Fecha<input type="date" id="iF" value="${isoDia(Date.now())}"></label>
      <label>Campo<select id="iC">${nombresCampos().map(c => `<option>${esc(c)}</option>`).join('')}</select></label>
      <label>Departamento<select id="iD">${getDeptos().map(c => `<option>${esc(c)}</option>`).join('')}</select></label>
      <label>Catálogo de problema<select id="iP">${getCatalogo().map(c => `<option value="${esc(c.nombre)}">${esc(c.nombre)} (peso ${c.peso})</option>`).join('')}</select></label>
      <label>Descripción<textarea id="iDesc" rows="3"></textarea></label><label>Acción tomada<textarea id="iAcc" rows="2"></textarea></label>
      <label>Apoyo de la autoridad<select id="iAp"><option value="">Detectar automáticamente</option><option value="N">Sin apoyo de la autoridad</option><option value="M">Policía municipal</option><option value="G">Guardia civil estatal</option><option value="MG">Policía municipal y guardia civil</option></select></label>`,
      async d => {
        const p = $('#iP', d).value;
        await dbPut('incidencias', { fecha: fromISO($('#iF', d).value) + 12 * 36e5, campo: $('#iC', d).value, depto: $('#iD', d).value, problema: p, peso: (getCatalogo().find(c => c.nombre === p) || {}).peso || 1, descripcion: $('#iDesc', d).value.trim(), accion: $('#iAcc', d).value.trim(), apoyoManual: $('#iAp', d).value, por: SESION.nombre });
        toast('Incidencia registrada'); renderApp();
      });
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
    h += card('Registro', tabla([{ t: 'Fecha', f: x => fmtFecha(x.fecha) }, { t: 'Tipo', f: x => x.tipo }, { t: 'Persona', f: x => x.persona }, { t: 'Campo', f: x => x.campo || '—' }, { t: 'Depto.', f: x => x.depto || '—' }, { t: 'Días', f: x => ['Alta', 'Baja'].includes(x.tipo) ? '—' : diasRH(x) }, { t: 'Notas', f: x => x.notas || '' }, { t: '', h: 1, f: x => puedeEditar() ? `<button class="mini" data-del="${x.id}">Eliminar</button>` : '' }], rh));
    el.innerHTML = h;
    $$('[data-del]', el).forEach(b => b.onclick = async () => { if (confirm('¿Eliminar este movimiento?')) { await dbDel('rh', b.dataset.del); renderApp(); } });
    const nb = $('#nuevoRH', el);
    if (nb) nb.onclick = () => dialogo('Movimiento de personal', `
      <label>Tipo<select id="rT">${TIPOS_RH.map(t => `<option>${t}</option>`).join('')}</select></label>
      <label>Persona<input id="rP" list="dlG" placeholder="Nombre completo"><datalist id="dlG">${nombresGuardias().map(g => `<option value="${esc(g)}">`).join('')}</datalist></label>
      <label>Campo<select id="rC">${nombresCampos().map(c => `<option>${esc(c)}</option>`).join('')}</select></label>
      <label>Departamento<select id="rD">${getDeptos().map(c => `<option>${esc(c)}</option>`).join('')}</select></label>
      <label>Fecha (inicio)<input type="date" id="rF" value="${isoDia(Date.now())}"></label><label>Fecha fin (opcional, para permisos/vacaciones)<input type="date" id="rFF"></label><label>Notas<textarea id="rN" rows="2"></textarea></label>`,
      async d => {
        const p = $('#rP', d).value.trim(); if (!p) { toast('Escriba el nombre de la persona', 'mal'); return false; }
        const reg = { tipo: $('#rT', d).value, persona: nombreCanonico(p), fecha: fromISO($('#rF', d).value) + 12 * 36e5, fechaFin: $('#rFF', d).value ? fromISO($('#rFF', d).value) + 12 * 36e5 : null };
        if (DATA.rh.some(x => claveMov(x) === claveMov(reg))) { toast('Ya existe ese mismo movimiento (misma persona, tipo y fecha). No se duplicó.', 'mal'); return false; }
        await dbPut('rh', { tipo: $('#rT', d).value, persona: reg.persona, campo: $('#rC', d).value, depto: $('#rD', d).value, fecha: fromISO($('#rF', d).value) + 12 * 36e5, fechaFin: $('#rFF', d).value ? fromISO($('#rFF', d).value) + 12 * 36e5 : null, notas: $('#rN', d).value.trim() });
        toast('Movimiento registrado'); renderApp();
      });
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
registrarVista({
  id: 'operativo', titulo: 'Control operativo de campo', icono: '🌾', grupo: 'Seguridad', render(el) {
    const op = V.operativo().sort((a, b) => b.fecha - a.fecha);
    const rp = sum(op, x => +x.rondinesProg || 0), rr = sum(op, x => +x.rondinesReal || 0);
    const inoc = op.filter(x => x.inocuidad !== '' && x.inocuidad != null);
    const inocP = inoc.length ? Math.round(sum(inoc, x => +x.inocuidad) / inoc.length * 10) / 10 : 0;
    let h = '<div class="kpis">' + kpi(op.length, 'Capturas semanales') + kpi(rp ? pct(rr, rp) + '%' : '—', 'Rondines realizados vs programados', rp ? semaforo(pct(rr, rp), 90, 75) : '') + kpi(sum(op, x => +x.accesosReg || 0), 'Accesos registrados') + kpi(inoc.length ? inocP + '%' : '—', 'Cumplimiento de inocuidad', inoc.length ? semaforo(inocP, 90, 75) : '') + '</div>';
    h += puedeEditar() ? '<div class="barra-acc"><button class="btn" id="nuevoOp">+ Captura semanal</button></div>' : soloLectura();
    const sem = {}; op.forEach(x => { const k = isoDia(x.fecha); sem[k] = sem[k] || { p: 0, r: 0 }; sem[k].p += +x.rondinesProg || 0; sem[k].r += +x.rondinesReal || 0; });
    const ks = Object.keys(sem).sort();
    const _ic = {}; inoc.forEach(x => { (_ic[x.campo] = _ic[x.campo] || []).push(+x.inocuidad); });
    const inocPorCampo = Object.fromEntries(Object.entries(_ic).map(([k, v]) => [k, Math.round(sum(v) / v.length)]));
    h += '<div class="grid2">' + card('Cumplimiento de rondines por semana (%)', lineas([{ nombre: '% realizados', color: COL.azul, valores: ks.map(k => sem[k].p ? Math.round(sem[k].r / sem[k].p * 100) : 0) }], ks.map(k => k.slice(8) + '/' + k.slice(5, 7)), { max: 100 })) +
      card('Inocuidad por campo (%)', barras(inocPorCampo, { color: COL.verde, fmt: v => v + '%' })) + '</div>';
    h += card('Capturas', tabla([{ t: 'Semana del', f: x => fmtFecha(x.fecha) }, { t: 'Campo', f: x => x.campo }, { t: 'Rondines prog.', f: x => x.rondinesProg }, { t: 'Rondines real.', f: x => x.rondinesReal }, { t: 'Cumpl.', h: 1, f: x => +x.rondinesProg ? pill(pct(+x.rondinesReal, +x.rondinesProg) + '%', semaforo(pct(+x.rondinesReal, +x.rondinesProg), 90, 75)) : '—' }, { t: 'Accesos', f: x => x.accesosReg }, { t: 'Inocuidad %', f: x => x.inocuidad === '' ? '—' : x.inocuidad }, { t: 'Observaciones', f: x => x.obs || '' }, { t: '', h: 1, f: x => puedeEditar() ? `<button class="mini" data-del="${x.id}">Eliminar</button>` : '' }], op));
    el.innerHTML = h;
    $$('[data-del]', el).forEach(b => b.onclick = async () => { if (confirm('¿Eliminar esta captura?')) { await dbDel('operativo', b.dataset.del); renderApp(); } });
    const nb = $('#nuevoOp', el);
    if (nb) nb.onclick = () => {
      const d = dialogo('Captura semanal de campo', `<label>Semana (elija cualquier día de la semana)<input type="date" id="oF" value="${isoDia(Date.now() - 7 * 864e5)}"></label>
        <label>Campo<select id="oC">${nombresCampos().map(c => `<option>${esc(c)}</option>`).join('')}</select></label>
        <button class="btn sec" id="oAuto" type="button">Autollenar con datos importados</button>
        <label>Rondines programados<input type="number" id="oRP" min="0"></label><label>Rondines realizados<input type="number" id="oRR" min="0"></label>
        <label>Accesos registrados<input type="number" id="oAR" min="0"></label><label>Cumplimiento de inocuidad % (opcional)<input type="number" id="oI" min="0" max="100"></label><label>Observaciones<textarea id="oO" rows="2"></textarea></label>`,
        async d => {
          const ini = lunesDe(fromISO($('#oF', d).value));
          const ex = DATA.operativo.find(x => x.fecha === ini && x.campo === $('#oC', d).value);
          await dbPut('operativo', { id: ex ? ex.id : undefined, fecha: ini, campo: $('#oC', d).value, rondinesProg: $('#oRP', d).value, rondinesReal: $('#oRR', d).value, accesosReg: $('#oAR', d).value, inocuidad: $('#oI', d).value, obs: $('#oO', d).value.trim() });
          toast('Captura guardada'); renderApp();
        });
      $('#oAuto', d).onclick = () => {
        const ini = lunesDe(fromISO($('#oF', d).value)), fin = ini + 7 * 864e5 - 1, c = $('#oC', d).value;
        $('#oRR', d).value = DATA.rondines.filter(r => r.inicio >= diaIni(ini) && r.inicio <= fin && normCampo(r.area) === c).length;
        $('#oAR', d).value = DATA.accesos.filter(a => a.horaIngreso >= diaIni(ini) && a.horaIngreso <= fin && normCampo(a.campo) === c).length;
        toast('Rondines realizados y accesos llenados; capture programados e inocuidad');
      };
    };
  }
});

// ============ DATOS: IMPORTAR / RESPALDO ============
registrarVista({
  id: 'datos', titulo: 'Importar y respaldo', icono: '📥', grupo: 'Sistema', sinFiltros: true, render(el) {
    const ult = cfgGet('ultimaImport', null);
    let h = card('Importar datos de las apps de los guardias', `<div class="drop" id="drop"><p><b>Arrastre aquí los archivos JSON</b> o <button class="btn" id="elegir">Elegir archivos</button></p>
      <p class="nota">Acepta rondines individuales, respaldos de los paneles (rondines y accesos), incidencias y respaldos completos de este software. Los que ya estaban cargados se omiten.</p><input type="file" id="fArch" multiple accept=".json,application/json" hidden></div><div id="impMsg" class="msg"></div>` + (ult ? `<div class="nota">Última importación: ${fmtFH(ult)}</div>` : ''));
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
    h += '<div class="grid2">' + card('Campos y alias', `<p class="nota">Un campo por línea: <code>Nombre | alias1, alias2</code>. Los alias unifican cómo escriben el nombre los guardias.</p><textarea id="cfCampos" rows="8">${esc(getCampos().map(c => c.nombre + ' | ' + c.alias.join(', ')).join('\n'))}</textarea>`) +
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
      const campos = lineas('cfCampos').map(l => { const [n, a] = l.split('|'); return { nombre: n.trim(), alias: (a || '').split(',').map(s => s.trim()).filter(Boolean) }; });
      const cat = lineas('cfCat').map(l => { const [n, p] = l.split('|'); return { nombre: n.trim(), peso: Math.min(5, Math.max(1, parseInt(p) || 1)) }; });
      if (!campos.length) { toast('Debe haber al menos un campo', 'mal'); return; }
      await cfgSet('campos', campos); await cfgSet('deptos', lineas('cfDeptos')); await cfgSet('catalogo', cat); await cfgSet('restringidos', lineas('cfRes'));
      toast('Configuración guardada'); renderApp();
    };
  }
});

document.addEventListener('click', e => { const td = e.target.closest && e.target.closest('td.largo'); if (td) td.classList.toggle('abierto'); });
