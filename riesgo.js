/* Seguridad La Memoria — análisis de riesgo (índice 0-100 por campo) */
'use strict';

const PESOS_RIESGO = { inc: 40, ron: 25, acc: 20, rh: 15 };
const nivelRiesgo = p => p >= 75 ? ['Crítico', 'crit'] : p >= 50 ? ['Alto', 'mal'] : p >= 25 ? ['Medio', 'warn'] : ['Bajo', 'ok'];

// Calcula el índice para cada campo en el rango [d, h] (ignora el filtro de campo para poder comparar)
function calcRiesgoPorCampo(rango) {
  const [d, h] = rango || rangoPeriodo();
  const dias = d ? Math.max(1, Math.round((h - d) / 864e5)) : Math.max(7, Math.round((Date.now() - Math.min(Date.now(), ...DATA.incidencias.map(i => i.fecha), ...DATA.rondines.map(r => r.inicio))) / 864e5));
  const sem = Math.max(1, dias / 7);
  const en = ts => ts >= (d || 0) && ts <= h;
  const campos = nombresCampos().slice(); ['Otros'].forEach(c => { if (DATA.rondines.some(r => normCampo(r.area) === c) || DATA.accesos.some(a => normCampo(a.campo) === c) || DATA.incidencias.some(i => i.campo === c)) campos.push(c); });
  const hayRondines = DATA.rondines.length > 0, hayAccesos = DATA.accesos.length > 0, hayRH = DATA.rh.length > 0;
  const falt = rondinesFaltantes();
  return campos.map(campo => {
    const rs = DATA.rondines.filter(r => en(r.inicio) && normCampo(r.area) === campo);
    const histRondines = DATA.rondines.some(r => normCampo(r.area) === campo);
    const ac = DATA.accesos.filter(a => en(a.horaIngreso) && normCampo(a.campo) === campo);
    const inc = DATA.incidencias.filter(i => en(i.fecha) && i.campo === campo);
    const rh = DATA.rh.filter(x => en(x.fecha) && x.campo === campo && x.tipo === 'Inasistencia');
    const ptsInc = sum(inc, pesoDe), graves = inc.filter(i => pesoDe(i) >= 4).length;
    const comp = {}; const det = {};
    comp.inc = Math.min(100, (ptsInc / sem) / 10 * 100);
    const huecos = falt.filter(f => f.campo === campo);
    const cumpl = rs.length ? Math.round(sum(rs, cumplimientoRondin) / rs.length * 10) / 10 : null;
    if (hayRondines && histRondines) comp.ron = rs.length ? Math.min(100, (100 - cumpl) + huecos.length * 25) : 100;
    const exced = ac.filter(a => a.horaSalida ? (tiempoDentroH(a) > 4 && !/transporte de personal/i.test(a.motivoVisita || '') && tiempoDentroH(a) > 14) : accesoExcedido(a)).length;
    const restr = ac.filter(restringido).length;
    if (hayAccesos && ac.length) comp.acc = Math.min(100, pct(exced, ac.length) * 2 + restr * 30);
    if (hayRH) comp.rh = Math.min(100, (rh.length / sem) / 5 * 100);
    let tot = 0, pes = 0; Object.keys(comp).forEach(k => { tot += comp[k] * PESOS_RIESGO[k]; pes += PESOS_RIESGO[k]; });
    const puntos = pes ? Math.round(tot / pes) : 0; const [nivel, clase] = nivelRiesgo(puntos);
    const probs = groupCount(inc, i => i.problema); const top = Object.entries(probs).sort((a, b) => b[1] - a[1])[0];
    const deps = groupCount(inc, i => i.depto); const topD = Object.entries(deps).sort((a, b) => b[1] - a[1])[0];
    return { campo, puntos, nivel, clase, comp, rondines: rs.length, cumpl, accesos: ac.length, incidencias: inc.length, inasist: rh.length, exced, restr, huecos, graves, ptsInc, top, topD, incList: inc };
  });
}
function riesgoGlobal(rs) {
  const act = rs.filter(r => r.rondines + r.accesos + r.incidencias + r.inasist > 0);
  if (!act.length) return { puntos: 0, nivel: 'Sin datos', nivelClase: '' };
  const prom = sum(act, r => r.puntos) / act.length, mx = Math.max(...act.map(r => r.puntos));
  const p = Math.round(.6 * prom + .4 * mx); const [n, c] = nivelRiesgo(p);
  return { puntos: p, nivel: n, nivelClase: c === 'crit' ? 'mal' : c };
}
function sugerencias(r) {
  const s = [];
  r.huecos.forEach(f => s.push(`Rondines no realizados en el turno ${f.turno}: asignar responsable de verificar el inicio del rondín y revisar con el supervisor por qué no se registra (sin evidencia ante robo o reclamo de seguro).`));
  if (r.cumpl != null && r.cumpl < 80) s.push(`Cumplimiento de puntos de control de ${r.cumpl}%: revisar los códigos QR dañados o ausentes y reforzar la capacitación de los guardias que no completan el recorrido.`);
  if (r.rondines === 0 && r.comp.ron === 100) s.push('No se recibió ningún rondín en el periodo: confirmar si los guardias están enviando su información o si hay un problema de señal.');
  if (r.top && r.top[1] >= 2) s.push(`Incidencias recurrentes de “${r.top[0]}” (${r.top[1]}): ${r.topD ? 'trabajar con ' + r.topD[0] + ' ' : ''}una plática o acción preventiva específica y dar seguimiento semanal.`);
  if (r.graves > 0) s.push(`${r.graves} incidencia(s) grave(s) (peso 4-5): dar seguimiento caso por caso con RH y Previsión Social y documentar las acciones.`);
  if (r.exced > 0) s.push(`${r.exced} visita(s) con permanencia excedida: reforzar en caseta el registro de salida y la verificación de tiempos.`);
  if (r.restr > 0) s.push(`${r.restr} ingreso(s) de personas/vehículos de la lista restringida: informar a gerencia y reforzar el filtro de acceso.`);
  if (r.comp.rh != null && r.comp.rh >= 50) s.push('Ausentismo alto: revisar cobertura del rol de guardias y los puntos que quedan con menos elementos.');
  if (!s.length) s.push('Sin hallazgos relevantes: mantener la supervisión actual.');
  return s;
}
const ETQ_COMP = { inc: 'Incidencias', ron: 'Rondines', acc: 'Accesos', rh: 'Personal' };

registrarVista({
  id: 'riesgo', titulo: 'Análisis de riesgo', icono: '🛡️', grupo: 'General', render(el) {
    const o = rpCompute(), k = o.kpi, sec = rpTabsHTML(o), ev = o.eval;
    let hh = `<div class="barra-acc"><button class="btn" id="rPrint">Imprimir / guardar PDF</button><button class="btn sec" id="rHtml">Descargar informe HTML</button></div><div id="informe">`;
    hh += `<div class="informe-t"><h2>Análisis de riesgo · Rancho Agrícola La Memoria</h2><p>Incidencias del ${esc(rpDl(k.inc_desde))} al ${esc(rpDl(k.inc_hasta))} · control operativo del ${esc(rpDl(k.op_desde))} al ${esc(rpDl(k.op_hasta))} · Periodo: ${esc(etiquetaPeriodo())}${F.campo ? ' · Campo: ' + esc(F.campo) : ''}</p></div>`;
    hh += `<p class="take">Previsión Social concentra <b>${rpPc(k.ps_pct)}</b> de las incidencias; <b>${rpPc(k.malla_pct)}</b> involucran la malla perimetral y <b>${rpPc(k.alc_pct)}</b> alcohol.</p>`;
    hh += `<p class="take"><b>${o.resumenMA.criticas}</b> alertas críticas y <b>${o.resumenMA.atencion}</b> de atención; <b>${o.resumenMA.cumplen}</b> de <b>${o.resumenMA.total}</b> metas cumplidas. Detalle en la pestaña Metas y alertas.</p>`;
    hh += '<div class="kpis">' + kpi(k.incidencias, 'Incidencias registradas') + kpi(rpPc(k.indice), 'Índice de riesgo (puntos ÷ máximo posible)', k.indice == null ? '' : k.indice >= 70 ? 'mal' : k.indice >= 35 ? 'warn' : 'ok') + kpi(rpPc(k.pct_cierre), 'Casos cerrados') + kpi(rpPc(k.ps_pts_pct), 'Del riesgo está en Previsión Social') +
      kpi(rpPc(k.rond_cumpl), 'Rondines realizados vs. programados') + kpi(rpFn(k.decomisos), 'Artículos decomisados en accesos') + kpi(rpPc(k.apoyo_pct), 'Incidencias con apoyo de policía municipal o guardia civil') + '</div>';
    hh += `<section class="card"><h3>Evaluación general de la seguridad: <span class="${ev.cls}">${esc(ev.nivel)}</span></h3><p class="take">${esc(ev.s)}</p><div class="grid2"><div><h4>Lo que va bien</h4><ul>${ev.ok.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div><div><h4>Lo que preocupa</h4><ul>${ev.bad.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div></div><h4>Recomendación para mejorar</h4><p>Para bajar el riesgo, atender primero estas tres acciones del plan de mejoras (el detalle completo está en esa pestaña):</p><ol>${ev.rec.map(r => `<li>${esc(r.ambito)}: ${esc(r.accion)}</li>`).join('')}</ol></section>`;
    hh += '<div class="tabs" role="tablist">' + rpTabs.map(([id, t]) => `<button role="tab" data-t="${id}" aria-selected="${id === RP_TAB}">${t}</button>`).join('') + '</div>';
    // índice ponderado por campo (rondines, accesos y personal) — se muestra en "Campos y áreas"
    const rs = calcRiesgoPorCampo(), [d, h] = rangoPeriodo(), prev = d ? calcRiesgoPorCampo([d - (h - d + 1), d - 1]) : null, glob = riesgoGlobal(rs), globPrev = prev ? riesgoGlobal(prev) : null, vis = rs.filter(r => !F.campo || r.campo === F.campo);
    const delta = (r) => { if (!prev) return ''; const p = prev.find(x => x.campo === r.campo); if (!p) return ''; const dd = r.puntos - p.puntos; return dd === 0 ? '＝' : dd > 0 ? '▲ +' + dd : '▼ ' + dd; };
    const pond = card('Índice ponderado por campo (incidencias, rondines, accesos y personal)', `<p class="nota">Índice general ${glob.puntos} · ${esc(glob.nivel)}${globPrev ? ' · antes: ' + globPrev.puntos : ''}</p>` + tabla([
      { t: 'Campo', f: r => r.campo }, { t: 'Riesgo', h: 1, f: r => pill(r.puntos + ' · ' + r.nivel, r.clase) }, { t: 'Cambio', f: delta },
      ...Object.keys(ETQ_COMP).map(kk => ({ t: ETQ_COMP[kk], h: 1, f: r => r.comp[kk] == null ? '<span class="nota">sin datos</span>' : pill(Math.round(r.comp[kk]), nivelRiesgo(r.comp[kk])[1]) })),
      { t: 'Principal problema', f: r => r.top ? r.top[0] + ' (' + r.top[1] + ')' : '—' }
    ], vis) + `<div class="nota">Método: índice 0-100 = promedio ponderado de Incidencias (40%, severidad por semana; 10 puntos/semana = 100), Rondines (25%, faltante de cumplimiento + huecos), Accesos (20%, visitas con tiempo excedido y lista restringida) y Personal (15%, inasistencias por semana). Los componentes sin datos se excluyen y los pesos se reajustan. Niveles: Bajo &lt;25, Medio 25-49, Alto 50-74, Crítico ≥75.</div>`) +
      card('Propuestas de mejora por campo (rondines, accesos y personal)', vis.filter(r => r.puntos > 0 || r.incidencias || r.rondines).sort((a, b) => b.puntos - a.puntos).map(r => `<div class="prop"><h4>${esc(r.campo)} ${pill(r.puntos + ' · ' + r.nivel, r.clase)}</h4><ul>${sugerencias(r).map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>`).join('') || '<div class="vacio">Sin datos suficientes en este periodo</div>');
    sec.t4 = sec.t4.replace('<div id="rpPond"></div>', pond);
    hh += rpTabs.map(([id]) => `<div class="rp-sec" id="${id}" ${id === RP_TAB ? '' : 'hidden'}>${sec[id]}</div>`).join('');
    hh += '</div>';
    el.innerHTML = hh;
    $$('.tabs [data-t]', el).forEach(b => b.onclick = () => { RP_TAB = b.dataset.t; $$('.tabs [data-t]', el).forEach(x => x.setAttribute('aria-selected', x === b)); $$('.rp-sec', el).forEach(x => x.hidden = x.id !== RP_TAB); });
    const bc = $('#rpApCsv', el); if (bc) bc.onclick = () => { const q = v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"'; const fl = [['Fecha', 'Campo', 'Incidencia', 'Autoridad', 'Resultado', 'Estatus']].concat(o.apoyo.lista.map(filaApoyo).map(x => [fmtFecha(x.fecha), x.campo, x.problema, x.autoridad, x.resultado, x.estatus])); descargar('apoyo_policial_' + isoDia(Date.now()) + '.csv', '﻿' + fl.map(f => f.map(q).join(',')).join('\r\n'), 'text/csv;charset=utf-8'); };
    $('#rPrint', el).onclick = () => window.print();
    $('#rHtml', el).onclick = async () => {
      let css = ''; try { css = await (await fetch('app.css')).text(); } catch (e) { }
      descargar('Analisis_de_Riesgo_' + isoDia(Date.now()) + '.html', `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><title>Análisis de riesgo</title><style>${css}body{display:block;background:#fff;color:#111}</style></head><body class="informe-solo"><div style="max-width:1000px;margin:0 auto;padding:20px">${$('#informe').innerHTML}</div></body></html>`, 'text/html');
    };
  }
});
