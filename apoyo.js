/* Seguridad La Memoria — apoyo e intervención de la policía municipal y la guardia civil estatal.
   Se detecta en la descripción y la acción de cada incidencia (misma regla del análisis de riesgo anterior)
   y se puede corregir a mano al registrar la incidencia. No incluye nombres ni fichas de las personas. */
'use strict';
const MUN_RE = /polic[ií]a municipal|la municipal|municipales|c[aá]rcel municipal|barandilla|separos/, GCV_RE = /guardia civil/;
const APOYO_MANUAL = { 47: { ap: 'G', res: 'Presencia o apoyo en el lugar' }, 73: { ap: 'M', res: 'Acompañó a la ambulancia municipal' }, 173: { ap: 'G', res: 'Presencia o apoyo en el lugar' } };
const AUT_ETQ = { M: 'Policía municipal', G: 'Guardia civil estatal', MG: 'Municipal y guardia civil' };
function apoyoDe(i) {
  if (i.apoyoManual) return i.apoyoManual === 'N' ? null : { ap: i.apoyoManual, res: 'Registrado manualmente' };
  if (i.num != null && APOYO_MANUAL[i.num]) return APOYO_MANUAL[i.num];
  const t = ((i.descripcion || '') + ' ' + (i.accion || '')).toLowerCase().replace(/ambulancia municipal/g, '');
  if (/agredido[^.]{0,40}elementos de polic/.test(t)) return null;
  const m = MUN_RE.test(t), g = GCV_RE.test(t); if (!m && !g) return null;
  const res = /detener (una )?(camioneta|unidad|veh)/.test(t) ? 'Apoyo para detener un vehículo' : /c[aá]rcel|separos|barandilla/.test(t) ? 'Trasladado a cárcel o barandilla municipal' : /disp\w*si?c?i[oó]n|detenid/.test(t) ? 'Puesto a disposición de la autoridad' : /traslad\w*[^.]{0,40}cd del ma[ií]z/.test(t) ? 'Trasladado a Cd. del Maíz' : 'Presencia o apoyo en el lugar';
  return { ap: (m ? 'M' : '') + (g ? 'G' : ''), res };
}
function resumenApoyo(inc) {
  const lista = [], mes = {}, campo = {};
  inc.forEach(i => {
    const a = apoyoDe(i), d = new Date(i.fecha), k = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
    const m = mes[k] = mes[k] || { mes: k, incidencias: 0, apoyos: 0, municipal: 0, guardia: 0 };
    const c = campo[i.campo || 'Sin especificar'] = campo[i.campo || 'Sin especificar'] || { campo: i.campo || 'Sin especificar', incidencias: 0, apoyos: 0, municipal: 0, guardia: 0 };
    m.incidencias++; c.incidencias++;
    if (a) {
      lista.push({ inc: i, ap: a.ap, res: a.res });
      [m, c].forEach(x => { x.apoyos++; if (a.ap.includes('M')) x.municipal++; if (a.ap.includes('G')) x.guardia++; });
    }
  });
  lista.sort((a, b) => b.inc.fecha - a.inc.fecha);
  const t = { total: lista.length, municipal: lista.filter(x => x.ap.includes('M')).length, guardia: lista.filter(x => x.ap.includes('G')).length, incidencias: inc.length };
  t.pct = pct(t.total, t.incidencias);
  const fin = x => Object.assign(x, { pct: pct(x.apoyos, x.incidencias) });
  return { ...t, lista, porMes: Object.values(mes).map(fin).sort((a, b) => b.mes < a.mes ? -1 : 1), porCampo: Object.values(campo).map(fin).sort((a, b) => b.apoyos - a.apoyos) };
}
const claseApoyo = p => p >= 15 ? 'mal' : p >= 10 ? 'warn' : 'ok';
function kpisApoyo(inc) {
  const r = resumenApoyo(inc);
  return kpi(r.total, 'Intervenciones de autoridad', claseApoyo(r.pct), r.pct + ' % de las incidencias') + kpi(r.municipal, 'Con policía municipal', '') + kpi(r.guardia, 'Con guardia civil estatal', '');
}
function textoApoyo(r) {
  return `${r.total} de ${r.incidencias} incidencias (${r.pct} %) requirieron apoyo de la autoridad: ${r.municipal} con policía municipal y ${r.guardia} con guardia civil estatal.`;
}
function cardApoyoResumen(inc, conBoton) {
  const r = resumenApoyo(inc);
  const porC = {}; r.porCampo.filter(x => x.apoyos).forEach(x => porC[x.campo] = x.apoyos);
  return card('Apoyo de policía municipal y guardia civil estatal', `<p class="nota">${esc(textoApoyo(r))}</p>` +
    (r.total ? barras(porC, { color: COL.azul }) : '<div class="vacio ok">Sin intervenciones de la autoridad en este periodo</div>') +
    (conBoton ? '<div class="barra-acc"><button class="btn sec" data-ir="apoyo">Ver detalle de intervenciones</button></div>' : ''));
}
const filaApoyo = x => ({ fecha: x.inc.fecha, campo: x.inc.campo, problema: x.inc.problema, autoridad: AUT_ETQ[x.ap] || x.ap, resultado: x.res, estatus: x.inc.estatus || '—' });
function tablaRegistroApoyo(r) {
  return tabla([{ t: 'Fecha', f: x => fmtFecha(x.fecha) }, { t: 'Campo', f: x => x.campo }, { t: 'Incidencia', f: x => x.problema }, { t: 'Autoridad', f: x => x.autoridad }, { t: 'Resultado', f: x => x.resultado }, { t: 'Estatus', f: x => x.estatus }], r.lista.map(filaApoyo), { max: 300 });
}
document.addEventListener('click', e => { const b = e.target.closest && e.target.closest('[data-ir]'); if (b) irA(b.dataset.ir); });

registrarVista({
  id: 'apoyo', titulo: 'Apoyo policial', icono: '🚓', grupo: 'Seguridad', render(el) {
    const inc = V.incidencias(), r = resumenApoyo(inc);
    let h = '<div class="kpis">' + kpi(r.total, 'Intervenciones', claseApoyo(r.pct), r.pct + ' % de las incidencias') + kpi(r.municipal, 'Policía municipal') + kpi(r.guardia, 'Guardia civil estatal') + kpi(r.incidencias, 'Incidencias del periodo') + '</div>';
    h += `<div class="barra-acc"><button class="btn" id="apCsv">Descargar registro (CSV)</button></div>`;
    h += card('Intervenciones con policía municipal y guardia civil estatal', `<p class="nota">${esc(textoApoyo(r))} Se detectan en la descripción y la acción de cada incidencia; al registrar una incidencia se puede indicar a mano. No incluye nombres ni fichas de las personas.${r.pct >= 10 ? ' <b>Atención: 10 % o más de las incidencias requirió a la autoridad.</b>' : ''}</p>`);
    h += '<div class="grid2">' + card('Por mes', tabla([{ t: 'Mes', f: x => x.mes }, { t: 'Incidencias', f: x => x.incidencias }, { t: 'Con apoyo', f: x => x.apoyos }, { t: 'Municipal', f: x => x.municipal }, { t: 'Guardia civil', f: x => x.guardia }, { t: '% incid.', f: x => x.pct + ' %' }], r.porMes)) +
      card('Por campo', tabla([{ t: 'Campo', f: x => x.campo }, { t: 'Incidencias', f: x => x.incidencias }, { t: 'Con apoyo', f: x => x.apoyos }, { t: 'Municipal', f: x => x.municipal }, { t: 'Guardia civil', f: x => x.guardia }, { t: '% incid.', f: x => x.pct + ' %' }], r.porCampo)) + '</div>';
    h += card('Registro de intervenciones (más reciente primero)', tablaRegistroApoyo(r));
    el.innerHTML = h;
    $('#apCsv', el).onclick = () => {
      const q = v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
      const filas = [['Fecha', 'Campo', 'Incidencia', 'Autoridad', 'Resultado', 'Estatus']].concat(r.lista.map(filaApoyo).map(x => [fmtFecha(x.fecha), x.campo, x.problema, x.autoridad, x.resultado, x.estatus]));
      descargar('apoyo_policial_' + isoDia(Date.now()) + '.csv', '﻿' + filas.map(f => f.map(q).join(',')).join('\r\n'), 'text/csv;charset=utf-8');
    };
  }
});
