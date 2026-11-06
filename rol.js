/* Seguridad La Memoria — rol mensual de guardias (periodos del 16 al 15) */
'use strict';

const getGuardias = () => cfgGet('guardias', []);
const DIAS_LARGO = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const ORDEN_DESC = [1, 2, 3, 4, 5, 6, 0]; // reparto automático de descansos
const REF_PERIODO = new Date(2026, 10, 16).getTime(); // primer cambio: 16 de noviembre de 2026

function periodoDe(ts) { // devuelve {inicio, fin, idx} del periodo 16→15 que contiene ts
  const d = new Date(ts); let y = d.getFullYear(), m = d.getMonth(); if (d.getDate() < 16) m--;
  const ini = new Date(y, m, 16).getTime(), fin = new Date(y, m + 1, 15, 23, 59, 59).getTime();
  const ref = new Date(REF_PERIODO); const idx = (new Date(ini).getFullYear() - ref.getFullYear()) * 12 + (new Date(ini).getMonth() - ref.getMonth());
  return { inicio: ini, fin, idx, clave: isoDia(ini) };
}
const periodoIdx = i => { const ref = new Date(REF_PERIODO); return periodoDe(new Date(ref.getFullYear(), ref.getMonth() + i, 16).getTime()); };
const etiquetaPeriodoRol = p => '16 ' + MESES[new Date(p.inicio).getMonth()] + ' ' + new Date(p.inicio).getFullYear() + ' al 15 ' + MESES[new Date(p.fin).getMonth()] + ' ' + new Date(p.fin).getFullYear();

function generarRol(p) {
  const guardias = getGuardias(), plantilla = getPlantilla();
  // plazas (slots): matutino primero y luego nocturno, para que un corrimiento de M posiciones cambie de turno a todos
  let M = [], N = [];
  plantilla.forEach(pl => { for (let i = 0; i < pl.dia; i++) M.push({ punto: pl.punto, turno: 'Matutino' }); for (let i = 0; i < pl.noche; i++) N.push({ punto: pl.punto, turno: 'Nocturno' }); });
  const quita = (lista, punto) => { const i = lista.findIndex(s => s.punto === punto); if (i >= 0) lista.splice(i, 1); };
  const fijos = guardias.filter(g => g.punto), rot = guardias.filter(g => !g.punto);
  const asign = [];
  fijos.forEach(g => { if (g.turno === 'Nocturno') quita(N, g.punto); else quita(M, g.punto); asign.push({ nombre: g.nombre, punto: g.punto, turno: g.turno || 'Matutino', fijo: true, descanso: g.descanso == null || g.descanso === '' ? null : +g.descanso }); });
  const slots = M.concat(N), m = M.length, T = Math.max(slots.length, rot.length);
  const pp = ((p.idx % T) + T) % T;
  rot.forEach((g, i) => {
    const idx = (((i + pp * m + Math.floor(p.idx / 2) * 3) % T) + T) % T;
    const s = slots[idx] || { punto: 'Cobertura (sin plaza fija)', turno: i % 2 ? 'Nocturno' : 'Matutino' };
    asign.push({ nombre: g.nombre, punto: s.punto, turno: s.turno, fijo: false, descanso: g.descanso == null || g.descanso === '' ? null : +g.descanso });
  });
  // descansos automáticos: se reparten entre los días de la semana dentro de cada punto y turno
  const orden = asign.filter(a => a.descanso == null).sort((x, y) => x.punto.localeCompare(y.punto) || x.turno.localeCompare(y.turno));
  orden.forEach((a, k) => { a.descanso = ORDEN_DESC[((k + p.idx) % 7 + 7) % 7]; });
  const vacantes = slots.length - Math.min(rot.length, slots.length);
  return { id: 'rol_' + p.clave, inicio: p.inicio, fin: p.fin, asignaciones: asign, generado: Date.now(), vacantes, sobrantes: Math.max(0, rot.length - slots.length) };
}

registrarVista({
  id: 'rol', titulo: 'Rol mensual de guardias', icono: '📅', grupo: 'Personal', sinFiltros: true, render(el) {
    const hoyP = periodoDe(Date.now());
    const base = Math.min(hoyP.idx, 0);
    const opciones = []; for (let i = base - 1; i <= Math.max(hoyP.idx, 0) + 3; i++) opciones.push(periodoIdx(i));
    const claveSel = el.dataset.per || (hoyP.idx >= 0 ? hoyP.clave : periodoIdx(0).clave);
    const p = opciones.find(o => o.clave === claveSel) || periodoIdx(0);
    const rol = DATA.rol.find(r => r.id === 'rol_' + p.clave);
    const gs = getGuardias();
    let h = `<div class="barra-acc"><label>Periodo <select id="rolPer">${opciones.map(o => `<option value="${o.clave}" ${o.clave === p.clave ? 'selected' : ''}>${esc(etiquetaPeriodoRol(o))}</option>`).join('')}</select></label>
      ${puedeEditar() ? `<button class="btn" id="rolGen" ${gs.length ? '' : 'disabled'}>${rol ? '↻ Recalcular rol' : '⚙ Calcular rol automático'}</button>` : ''}${rol ? '<button class="btn sec" id="rolPrint">Imprimir / PDF</button>' : ''}</div>`;
    if (!gs.length) h += '<div class="card warn">Aún no hay guardias registrados. Capture la lista abajo (en “Guardias del rol”) y luego calcule el rol.</div>';
    if (rol) {
      const a = rol.asignaciones;
      if (rol.vacantes) h += `<div class="card warn">Hay ${rol.vacantes} plaza(s) sin cubrir: faltan guardias respecto a la plantilla.</div>`;
      if (rol.sobrantes) h += `<div class="card warn">Hay ${rol.sobrantes} guardia(s) sin plaza fija; quedan como “Cobertura”.</div>`;
      // matriz por día
      const dias = []; for (let t = diaIni(rol.inicio); t <= rol.fin; t += 864e5) dias.push(new Date(t + 12 * 36e5));
      const sorted = a.slice().sort((x, y) => x.punto.localeCompare(y.punto) || x.turno.localeCompare(y.turno) || x.nombre.localeCompare(y.nombre));
      h += card('Rol del periodo · ' + etiquetaPeriodoRol(p), `<div class="tabla-w"><table class="tabla rol"><thead><tr><th>Punto</th><th>Turno</th><th>Guardia</th>${dias.map(d => `<th class="dia ${d.getDay() === 0 ? 'dom' : ''}">${d.getDate()}<br>${DIAS[d.getDay()][0]}</th>`).join('')}</tr></thead><tbody>${sorted.map(x => `<tr><td>${esc(x.punto)}</td><td>${x.turno === 'Matutino' ? 'Mat.' : 'Noc.'}</td><td class="nm ${puedeEditar() ? 'click' : ''}" data-n="${esc(x.nombre)}">${esc(x.nombre)}${x.fijo ? ' 📌' : ''}</td>${dias.map(d => d.getDay() === x.descanso ? '<td class="c-d">D</td>' : `<td class="c-${x.turno === 'Matutino' ? 'm' : 'n'}">${x.turno === 'Matutino' ? 'M' : 'N'}</td>`).join('')}</tr>`).join('')}</tbody></table></div><div class="nota">M = matutino · N = nocturno · D = descanso · 📌 = guardia fija. Clic en un nombre para ajustar su asignación.</div>`);
      // cobertura por punto/turno y día de la semana
      const grupos = {}; a.forEach(x => { const k = x.punto + ' · ' + x.turno; (grupos[k] = grupos[k] || []).push(x); });
      h += card('Cobertura por punto (guardias presentes lun-dom)', tabla([{ t: 'Punto y turno', f: r => r[0] }, { t: 'Asignados', f: r => r[1].length }].concat([1, 2, 3, 4, 5, 6, 0].map(d => ({ t: DIAS[d], h: 1, f: r => { const n = r[1].filter(x => x.descanso !== d).length; return pill(n, n < r[1].length ? 'warn' : 'ok'); } }))), Object.entries(grupos)));
    } else h += '<div class="card">Este periodo todavía no tiene rol calculado.</div>';
    // plantilla y guardias
    if (puedeEditar()) {
      h += '<div class="grid2">' + card('Guardias del rol', `<p class="nota">Una por línea: <code>Nombre | punto fijo | turno fijo | descanso</code>. Deje punto/turno vacíos si rota. Ej: <code>Isidro Elizalde | Almacén General | Matutino |</code> o <code>Erika Herrera | Empaque | Matutino | viernes</code>.</p><textarea id="rolGs" rows="12">${esc(gs.map(g => [g.nombre, g.punto || '', g.turno || '', g.descanso == null || g.descanso === '' ? '' : DIAS_LARGO[g.descanso]].join(' | ')).join('\n'))}</textarea><div class="barra-acc"><button class="btn" id="gsGuardar">Guardar guardias</button><button class="btn sec" id="gsImp">Agregar nombres de rondines</button></div>`) +
        card('Plantilla por punto', `<p class="nota">Formato: <code>Punto | Campo | guardias día | guardias noche</code>.</p><textarea id="rolPl" rows="12">${esc(getPlantilla().map(x => [x.punto, x.campo, x.dia, x.noche].join(' | ')).join('\n'))}</textarea><div class="barra-acc"><button class="btn" id="plGuardar">Guardar plantilla</button></div>`) + '</div>';
    }
    el.innerHTML = h;
    $('#rolPer', el).onchange = e => { el.dataset.per = e.target.value; renderApp(); const c = $('#vista'); c.dataset.per = e.target.value; VIEWS.find(v => v.id === 'rol').render(c); };
    const gen = $('#rolGen', el); if (gen) gen.onclick = async () => { if (rol && !confirm('Se reemplazará el rol de este periodo, incluidos ajustes manuales. ¿Continuar?')) return; await dbPut('rol', generarRol(p)); toast('Rol calculado'); const c = $('#vista'); c.dataset.per = p.clave; VIEWS.find(v => v.id === 'rol').render(c); };
    const pr = $('#rolPrint', el); if (pr) pr.onclick = () => { document.body.classList.add('imprimiendo-rol'); window.print(); setTimeout(() => document.body.classList.remove('imprimiendo-rol'), 500); };
    if (puedeEditar()) {
      const rec = () => { const c = $('#vista'); c.dataset.per = p.clave; VIEWS.find(v => v.id === 'rol').render(c); };
      $('#gsGuardar', el).onclick = async () => {
        const arr = $('#rolGs', el).value.split('\n').map(s => s.trim()).filter(Boolean).map(l => { const [n, pt, tu, de] = l.split('|').map(s => (s || '').trim()); const di = DIAS_LARGO.findIndex(d => norm(d) === norm(de)); return { nombre: n, punto: pt || '', turno: tu ? (/noc/i.test(tu) ? 'Nocturno' : 'Matutino') : '', descanso: di >= 0 ? di : null }; });
        await cfgSet('guardias', arr); toast(arr.length + ' guardia(s) guardados'); rec();
      };
      $('#gsImp', el).onclick = async () => {
        const ya = new Set(getGuardias().map(g => norm(g.nombre))); const nuevos = Array.from(new Set(DATA.rondines.map(r => (r.guardia || '').trim()).filter(Boolean))).filter(n => !ya.has(norm(n)));
        if (!nuevos.length) { toast('No hay nombres nuevos en los rondines'); return; }
        await cfgSet('guardias', getGuardias().concat(nuevos.map(n => ({ nombre: n, punto: '', turno: '', descanso: null })))); toast(nuevos.length + ' nombre(s) agregados; revíselos'); rec();
      };
      $('#plGuardar', el).onclick = async () => {
        const arr = $('#rolPl', el).value.split('\n').map(s => s.trim()).filter(Boolean).map(l => { const [pt, c, d, n] = l.split('|').map(s => (s || '').trim()); return { punto: pt, campo: c || pt, dia: parseInt(d) || 0, noche: parseInt(n) || 0 }; });
        await cfgSet('plantilla', arr); toast('Plantilla guardada'); rec();
      };
      $$('td.nm', el).forEach(td => td.onclick = () => {
        if (!rol) return; const x = rol.asignaciones.find(z => z.nombre === td.dataset.n); if (!x) return;
        const puntos = Array.from(new Set(getPlantilla().map(z => z.punto).concat([x.punto])));
        dialogo('Ajustar a ' + x.nombre, `<label>Punto<select id="aP">${puntos.map(z => `<option ${z === x.punto ? 'selected' : ''}>${esc(z)}</option>`).join('')}</select></label><label>Turno<select id="aT"><option ${x.turno === 'Matutino' ? 'selected' : ''}>Matutino</option><option ${x.turno === 'Nocturno' ? 'selected' : ''}>Nocturno</option></select></label><label>Día de descanso<select id="aD">${DIAS_LARGO.map((d, i) => `<option value="${i}" ${i === x.descanso ? 'selected' : ''}>${d}</option>`).join('')}</select></label>`,
          async d => { x.punto = $('#aP', d).value; x.turno = $('#aT', d).value; x.descanso = +$('#aD', d).value; await dbPut('rol', rol); toast('Asignación ajustada'); rec(); });
      });
    }
  }
});
