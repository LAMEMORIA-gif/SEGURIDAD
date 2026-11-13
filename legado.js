/* Conversión de los formatos de los dashboards anteriores (incidencias y control operativo) al formato del software unificado.
   Sin dependencias del navegador: se usa tanto en la app como en Node. */
'use strict';
(function (g) {
  const n = t => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  function campoLegado(txt) {
    const o = g.CAMPOS_LM && g.CAMPOS_LM.oficial(txt);
    return o || String(txt || '').trim() || 'Otros';
  }
  const DEPTOS = ['Almacén General', 'Empaque', 'Labores', 'Mantenimiento', 'Plagas', 'Previsión Social', 'RH', 'Producción', 'Riego', 'Nóminas', 'Inocuidad', 'Seguridad'];
  function deptoLegado(t) { const x = n(t); return DEPTOS.find(d => n(d) === x) || String(t || '').trim(); }
  function diaTs(s) { const [y, m, d] = String(s).slice(0, 10).split('-').map(Number); return new Date(y, m - 1, d, 12).getTime(); }
  // Hora de llegada capturada con AM/PM equivocado: si la respuesta sale de 12 h o más y al sumarle 12 h queda en 3 h o menos, se corrige
  // (reporte 18:35 / llegada 06:45 → llegada 18:45).
  function corregirLlegada(rep, lleg) {
    const a = String(rep || '').split(':').map(Number), b = String(lleg || '').split(':').map(Number);
    if (a.length < 2 || b.length < 2 || a.concat(b).some(isNaN)) return lleg;
    let d = b[0] * 60 + b[1] - (a[0] * 60 + a[1]); if (d < 0) d += 1440;
    if (d < 720 || d - 720 > 180) return lleg;
    const m = (b[0] * 60 + b[1] + 720) % 1440; return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
  }
  function esIncLegado(o) { return !!(o && typeof o === 'object' && o.num != null && o.cat && o.fecha && o.campo); }
  function convInc(o, edit) {
    const x = Object.assign({}, o, edit || {});
    const cat = x.cat === 'Riña' ? 'Riñas' : x.cat;
    return {
      id: 'inc_' + (x._ownId || x.num), num: x.num, fecha: diaTs(x.fecha), campo: campoLegado(x.campo), depto: deptoLegado(x.depto), problema: cat,
      peso: x.peso != null ? x.peso : 1, descripcion: x.desc || '', accion: x.sol || '', estatus: x.estatus || '', m: x.m != null ? x.m : undefined, a: x.a != null ? x.a : undefined, punto: x.subcat || x.campoOriginal || '',
      fAviso: x.f_aviso || '', fSol: x.f_sol || '', horaRep: x.horaRep || x.hora_reporte || '', horaLleg: corregirLlegada(x.horaRep || x.hora_reporte || '', x.horaLleg || x.hora_llegada || ''), ficha: x.ficha || '', fotos: x.fotos && x.fotos.length ? x.fotos : undefined, apoyoManual: x.apoyoManual || undefined, por: x.guardia || undefined, origen: 'legado'
    };
  }
  function lunesISO(anio, sem) { // lunes de la semana ISO, a las 12:00 hora local
    const j4 = new Date(anio, 0, 4, 12); const dow = (j4.getDay() + 6) % 7; const lun1 = new Date(anio, 0, 4 - dow, 12);
    return new Date(lun1.getFullYear(), lun1.getMonth(), lun1.getDate() + (sem - 1) * 7, 12).getTime();
  }
  // El dashboard anterior de Control operativo numera distinto: semana 1 = primer lunes del año (no la semana ISO).
  function lunesLegado(anio, sem) {
    const d1 = new Date(anio, 0, 1, 12).getDay(), off = d1 === 0 ? 1 : (d1 === 1 ? 0 : 8 - d1);
    return new Date(anio, 0, 1 + off + (sem - 1) * 7, 12).getTime();
  }
  // Los resúmenes de la app OPERATIVO del guardia (marca _exp) sí usan semana ISO; los del dashboard anterior no.
  // resumen de la app del guardia (aunque sea una versión anterior sin folio): lleva _exp, o diasCapturados, o un _ownId "own_<año>_<semana>_<campo>"
  const esOpGuardia = o => !!(o && (o._exp || o.diasCapturados != null || /^own_\d{4}_\d+_/.test(String(o._ownId || ''))));
  const fechaSemOp = o => {
    if (esOpGuardia(o)) return lunesISO(o.anio, o.sem);
    const m = o && /^(\d{4})-(\d{2})-(\d{2})/.exec(String(o.fechaInicio || '')); // si la captura trae su fecha de inicio y es lunes, esa manda
    if (m) { const t = new Date(+m[1], +m[2] - 1, +m[3], 12); if (t.getDay() === 1) return t.getTime(); }
    return lunesLegado(o.anio, o.sem);
  };
  function esOpLegado(o) { return !!(o && typeof o === 'object' && o.ubicacion && o.sem != null && o.anio != null && ('rondProg' in o || 'regProg' in o)); }
  function convOp(o) {
    return {
      id: 'op_' + o.anio + '_' + o.sem + '_' + n(o.ubicacion).replace(/ /g, '_') + (o._ownId ? '_' + String(o._ownId).slice(-6) : ''), fecha: fechaSemOp(o), campo: campoLegado(o.ubicacion), punto: o.ubicacion,
      rondinesProg: o.rondProg, rondinesReal: o.rondReal, accesosReg: o.acasReal, inocuidad: +o.bitTotales ? Math.round((+o.bitTotales - (+o.bitMaltratadas || 0)) / +o.bitTotales * 100) : '', obs: o.accionRecomendada || '', raw: o, origen: 'legado'
    };
  }
  // archivo exportado "incidencias_agregadas": {incidencias_agregadas:[...], ediciones:{'orig:N':{...},'own:id':{...}}}
  function convArchivoIncidencias(d, existentes) {
    const out = []; const ed = d.ediciones || {};
    (d.incidencias_agregadas || []).forEach(o => out.push(convInc(o, ed['own:' + o._ownId])));
    Object.keys(ed).filter(k => k.startsWith('orig:')).forEach(k => {
      const num = k.slice(5); const base = (existentes || []).find(i => String(i.num) === num);
      if (base) out.push(Object.assign({}, base, convInc({ num: base.num, cat: base.problema, fecha: isoDia0(base.fecha), campo: base.campo, depto: base.depto, desc: base.descripcion, sol: base.accion, estatus: base.estatus, peso: base.peso, subcat: base.punto, horaRep: base.horaRep, horaLleg: base.horaLleg, f_aviso: base.fAviso, f_sol: base.fSol }, ed[k])));
    });
    return out;
  }
  function isoDia0(ts) { const d = new Date(ts); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }

  const NUM_EV = ['asistencia', 'retardos', 'inasistencias', 'permisos', 'incapacidades', 'uniforme', 'imagen'];
  function convEval(r, edit) {
    const x = Object.assign({}, r, edit || {}); const anio = x.anio || 2026, o = {
      id: 'ev_' + (x._ownId || ('n' + x.num + '_' + anio)), tipo: 'semanal', guardia: String(x.guardia || '').trim(), ubicacion: x.ubicacion || '', anio, sem: x.sem, fecha: lunesISO(anio, x.sem),
      _evalAsistencia: x._evalAsistencia, _evalControlAcceso: x._evalControlAcceso, _evalEquipo: x._evalEquipo, _evalLlamados: x._evalLlamados, origen: 'legado'
    };
    NUM_EV.forEach(f => o[f] = Number(x[f]) || 0); return o;
  }
  function convLlamada(l) {
    const t = diaTs(l.fecha); const y = new Date(t).getFullYear();
    return { id: l.id || ('llam_' + t + '_' + String(l.guardia).length), tipo: 'llamada', guardia: String(l.guardia || '').trim(), fecha: t, anio: y, sem: l.sem, severidad: l.severidad || 'Leve', motivo: l.motivo || '', obs: l.obs || '', origen: 'legado' };
  }
  function convEventoPlantilla(e) {
    if (e.tipo !== 'alta' && e.tipo !== 'baja') return null;
    return { id: 'rh_pl_' + e.ts, tipo: e.tipo === 'alta' ? 'Alta' : 'Baja', persona: String(e.guardia || '').trim(), campo: e.ubicacion ? campoLegado(e.ubicacion) : '', depto: 'SEGURIDAD', fecha: e.fecha ? diaTs(e.fecha) : e.ts, notas: [e.motivo, e.obs].filter(Boolean).join(' · '), origen: 'legado' };
  }
  // --- RH_Control_Personal: exportaciones de inasistencias, vacaciones y plantilla (altas/bajas) ---
  const esFaltaRH = o => !!(o && o.nombre && o.fecha && o.motivo && o.departamento !== undefined && !o.fechaInicio);
  const esVacRH = o => !!(o && o.nombre && o.fechaInicio && o.fechaFin);
  const claveRH = r => r.tipo === 'Vacaciones' ? ['V', n(r.persona), diaTs(new Date(r.fecha).toISOString().slice(0, 10)), r.fechaFin ? diaTs(new Date(r.fechaFin).toISOString().slice(0, 10)) : ''].join('|') : r.tipo === 'Inasistencia' ? ['F', n(r.persona), new Date(r.fecha).toISOString().slice(0, 10), n(String(r.notas || '').split(' · ')[0])].join('|') : null;
  function convFaltaRH(o) {
    return { id: 'rh_f_' + n(o.nombre).replace(/ /g, '') + '_' + o.fecha + '_' + n(o.motivo).replace(/ /g, ''), tipo: 'Inasistencia', persona: o.nombre, campo: '', depto: o.departamento || 'SEGURIDAD', fecha: diaTs(o.fecha), notas: (o.motivo || '') + (o.causa ? ' · ' + o.causa : ''), origen: 'legado' };
  }
  function convVacRH(o) {
    return { id: 'rh_v_' + n(o.nombre).replace(/ /g, '') + '_' + o.fechaInicio + '_' + o.fechaFin, tipo: 'Vacaciones', persona: o.nombre, campo: '', depto: o.departamento || 'SEGURIDAD', fecha: diaTs(o.fechaInicio), fechaFin: diaTs(o.fechaFin), notas: '', origen: 'legado' };
  }
  function convEventoRH(e) {
    if (e.tipo !== 'alta' && e.tipo !== 'baja') return null;
    return { id: 'rh_pl_' + e.ts, tipo: e.tipo === 'alta' ? 'Alta' : 'Baja', persona: String(e.empleado || '').trim(), campo: '', depto: e.departamento || 'SEGURIDAD', funcion: e.funcion || undefined, genero: e.genero || undefined, fecha: e.fecha ? diaTs(e.fecha) : e.ts, notas: [e.motivo, e.obs].filter(Boolean).join(' · '), origen: 'legado' };
  }
  g.LEGADO = { esFaltaRH, esVacRH, claveRH, convFaltaRH, convVacRH, convEventoRH, convEval, convLlamada, convEventoPlantilla, campoLegado, deptoLegado, esIncLegado, convInc, esOpLegado, convOp, convArchivoIncidencias, lunesISO, lunesLegado, fechaSemOp, esOpGuardia, corregirLlegada };
})(typeof window !== 'undefined' ? window : globalThis);
