/* Conversión de los formatos de los dashboards anteriores (incidencias y control operativo) al formato del software unificado.
   Sin dependencias del navegador: se usa tanto en la app como en Node. */
'use strict';
(function (g) {
  const n = t => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  function campoLegado(txt) {
    const s = ' ' + n(txt) + ' ';
    if (s.includes('milagro')) return /\b(tres|3|iii)\b/.test(s) ? 'El Milagro Tres' : /\b(dos|2|ii)\b/.test(s) ? 'El Milagro Dos' : 'El Milagro Uno';
    if (s.includes('santa fe')) return 'Santa Fe';
    if (s.includes('empaque')) return 'Empaque';
    if (s.includes('palomas') || s.includes('almacen general')) return 'Palomas';
    return String(txt || '').trim() || 'Otros';
  }
  const DEPTOS = ['Almacén General', 'Empaque', 'Labores', 'Mantenimiento', 'Plagas', 'Previsión Social', 'RH', 'Producción', 'Riego', 'Nóminas', 'Inocuidad'];
  function deptoLegado(t) { const x = n(t); return DEPTOS.find(d => n(d) === x) || String(t || '').trim(); }
  function diaTs(s) { const [y, m, d] = String(s).slice(0, 10).split('-').map(Number); return new Date(y, m - 1, d, 12).getTime(); }
  function esIncLegado(o) { return !!(o && typeof o === 'object' && o.num != null && o.cat && o.fecha && o.campo); }
  function convInc(o, edit) {
    const x = Object.assign({}, o, edit || {});
    const cat = x.cat === 'Riña' ? 'Riñas' : x.cat;
    return {
      id: 'inc_' + (x._ownId || x.num), num: x.num, fecha: diaTs(x.fecha), campo: campoLegado(x.campo), depto: deptoLegado(x.depto), problema: cat,
      peso: x.peso != null ? x.peso : 1, descripcion: x.desc || '', accion: x.sol || '', estatus: x.estatus || '', punto: x.subcat || x.campoOriginal || '',
      fAviso: x.f_aviso || '', fSol: x.f_sol || '', origen: 'legado'
    };
  }
  function lunesISO(anio, sem) { // lunes de la semana ISO, a las 12:00 hora local
    const j4 = new Date(anio, 0, 4, 12); const dow = (j4.getDay() + 6) % 7; const lun1 = new Date(anio, 0, 4 - dow, 12);
    return new Date(lun1.getFullYear(), lun1.getMonth(), lun1.getDate() + (sem - 1) * 7, 12).getTime();
  }
  function esOpLegado(o) { return !!(o && typeof o === 'object' && o.ubicacion && o.sem != null && o.anio != null && ('rondProg' in o || 'regProg' in o)); }
  function convOp(o) {
    return {
      id: 'op_' + o.anio + '_' + o.sem + '_' + n(o.ubicacion).replace(/ /g, '_'), fecha: lunesISO(o.anio, o.sem), campo: campoLegado(o.ubicacion), punto: o.ubicacion,
      rondinesProg: o.rondProg, rondinesReal: o.rondReal, accesosReg: o.acasReal, inocuidad: '', obs: o.accionRecomendada || '', raw: o, origen: 'legado'
    };
  }
  // archivo exportado "incidencias_agregadas": {incidencias_agregadas:[...], ediciones:{'orig:N':{...},'own:id':{...}}}
  function convArchivoIncidencias(d, existentes) {
    const out = []; const ed = d.ediciones || {};
    (d.incidencias_agregadas || []).forEach(o => out.push(convInc(o, ed['own:' + o._ownId])));
    Object.keys(ed).filter(k => k.startsWith('orig:')).forEach(k => {
      const num = k.slice(5); const base = (existentes || []).find(i => String(i.num) === num);
      if (base) out.push(Object.assign({}, base, convInc({ num: base.num, cat: base.problema, fecha: isoDia0(base.fecha), campo: base.campo, depto: base.depto, desc: base.descripcion, sol: base.accion, estatus: base.estatus, peso: base.peso, subcat: base.punto }, ed[k])));
    });
    return out;
  }
  function isoDia0(ts) { const d = new Date(ts); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  g.LEGADO = { campoLegado, deptoLegado, esIncLegado, convInc, esOpLegado, convOp, convArchivoIncidencias, lunesISO };
})(typeof window !== 'undefined' ? window : globalThis);
