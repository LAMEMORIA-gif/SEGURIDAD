/* Seguridad La Memoria — Análisis de riesgo con pestañas (Resumen, Metas y alertas, Semanal, Mensual, Campos y áreas,
   Control operativo, Apoyo policial, Plan de mejoras, Notas de datos). Mismo método que el análisis anterior,
   pero calculado con los datos vivos del ERP y respetando el filtro de periodo y campo. */
'use strict';
const RP_CATN = { RoboComb: 'Robo de combustible', RoboFruta: 'Robo de fruta', AcoSex: 'Acoso sexual', ViolenFam: 'Violencia familiar', ConsumDrogasCuarto: 'Consumo de drogas', IntroAlcohol: 'Introducción de alcohol', FaltaRegla: 'Falta al reglamento', AlteraOrden: 'Alteración del orden', Vandalismo: 'Vandalismo', 'Discuy/o pleito entre personal': 'Discusión o pleito', RoboPrendas: 'Robo de prendas', sinselloscajas: 'Cajas sin sellos', ExcesoVeloc: 'Exceso de velocidad', 'Riñas': 'Riña', Suicidio: 'Intento de suicidio', 'venta y distribuccion de drogas': 'Venta de drogas', Crimen: 'Crimen', 'Auto Robo': 'Auto robo' };
const RP_CATP = { 'venta y distribuccion de drogas': 5, Crimen: 5, AcoSex: 5, Suicidio: 5, ViolenFam: 4, RoboComb: 4, RoboFruta: 4, ConsumDrogasCuarto: 4, 'Riñas': 4, IntroAlcohol: 3, Vandalismo: 3, 'Discuy/o pleito entre personal': 3, AlteraOrden: 3, sinselloscajas: 3, FaltaRegla: 2, RoboPrendas: 2, ExcesoVeloc: 2, 'Auto Robo': 2 };
const RP_GRAV = { 5: 'Crítico', 4: 'Alto', 3: 'Medio', 2: 'Bajo' };
const RP_MES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const RP_MALLA = /brinc|malla|rompio la malla/i, RP_ALC = /ebriedad|alcohol|cerveza|etilic|embriagantes/i;
const RP_OPF = ['regProg', 'regReal', 'visProg', 'visReal', 'provProg', 'provReal', 'saludosEsp', 'saludosReal', 'vehProg', 'vehReal', 'puertasAbiertas', 'accesosSinRev', 'rondProg', 'rondReal', 'evidencia', 'novDet', 'novCorr', 'golosinas', 'cigarros', 'articulos', 'drogas', 'sinFicha', 'envasesVidrio', 'excesoVel', 'bitTotales', 'bitMaltratadas', 'bitBuenEstado', 'trailers', 'cajasSinSello'];
const rpU = s => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10));
const rpIso = ms => new Date(ms).toISOString().slice(0, 10);
const rpMonday = s => rpIso(rpU(s) - ((new Date(rpU(s)).getUTCDay() + 6) % 7) * 864e5);
const rp1 = x => Math.round(x * 10) / 10;
const rpPct = (a, b) => b ? rp1(a / b * 100) : null;
const rpIdx = (p, n) => n ? rp1(p / (n * 5) * 100) : null;
const rpMl = m => m ? RP_MES[+m.slice(5, 7) - 1] + ' ' + m.slice(0, 4) : '—';
const rpDl = s => s ? (+s.slice(8, 10)) + ' ' + RP_MES[+s.slice(5, 7) - 1] : '—';
const rpFn = n => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
const rpPc = v => v == null ? '—' : rp1(v) + ' %';
const rpGrp = (rows, f) => { const m = {}; rows.forEach(r => { const k = f(r); (m[k] = m[k] || []).push(r); }); return m; };
const rpS = (a, f) => a.reduce((t, x) => t + f(x), 0);

function rpDatos() {
  const inc = V.incidencias().map(i => {
    let cat = i.problema; if (cat === 'Riña') cat = 'Riñas'; if (String(i.num) === '73') cat = 'Suicidio';
    const f = isoDia(i.fecha), d = i.descripcion || '', peso = RP_CATP[cat] != null ? RP_CATP[cat] : pesoDe(i);
    const fs = i.fSol && /^\d{4}-/.test(i.fSol) ? i.fSol : null;
    return { num: i.num, campo: i.campo, depto: /previsi/i.test(i.depto || '') ? 'Previsión Social' : (i.depto || 'Sin especificar'), cat, catn: RP_CATN[cat] || cat, peso, fecha: f, mes: f.slice(0, 7), inicio: rpMonday(f),
      estatus: i.estatus || '', cerrada: /conclu|cerrad|resuelt/i.test(i.estatus || ''), ap: (apoyoDe(i) || {}).ap || '', dias: fs ? Math.round((rpU(fs) - rpU(f)) / 864e5) : null, fSol: fs,
      m: i.m != null ? (i.m ? 1 : 0) : (RP_MALLA.test(d) ? 1 : 0), a: i.a != null ? (i.a ? 1 : 0) : (RP_ALC.test(d) ? 1 : 0) };
  });
  const op = V.operativo().map(x => {
    const r = x.raw || {}, o = { campo: x.campo, inicio: isoDia(x.fecha), mes: isoDia(x.fecha).slice(0, 7) };
    RP_OPF.forEach(k => o[k] = +r[k] || 0);
    if (!x.raw) { o.rondProg = +x.rondinesProg || 0; o.rondReal = +x.rondinesReal || 0; }
    o.prog = o.regProg + o.visProg + o.provProg + o.saludosEsp + o.vehProg; o.real = o.regReal + o.visReal + o.provReal + o.saludosReal + o.vehReal;
    o.dec = o.golosinas + o.cigarros + o.articulos + o.drogas + o.sinFicha + o.envasesVidrio; return o;
  }).sort((a, b) => a.inicio < b.inicio ? -1 : a.inicio > b.inicio ? 1 : (a.campo < b.campo ? -1 : 1));
  return { inc, op };
}

function rpCompute() {
  const { inc, op } = rpDatos(), out = {}, tot = inc.length, pts = rpS(inc, r => r.peso), cerr = rpS(inc, r => r.cerrada ? 1 : 0);
  const fechas = inc.map(r => r.fecha).sort(), incDesde = fechas[0] || '1970-01-01', incHasta = fechas[fechas.length - 1] || '1970-01-01';
  const base = nombresCampos(); const cset = new Set(F.campo ? [F.campo] : base); inc.forEach(r => cset.add(r.campo)); op.forEach(r => cset.add(r.campo));
  const campos = Array.from(cset).sort((a, b) => { const ia = base.indexOf(a), ib = base.indexOf(b); return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib); });
  const ps = inc.filter(r => r.depto === 'Previsión Social');
  const rondP = rpS(op, r => r.rondProg), rondR = rpS(op, r => r.rondReal), decT = rpS(op, r => r.dec);
  const mallaN = rpS(inc, r => r.m), alcN = rpS(inc, r => r.a);
  const opDesde = op.length ? op[0].inicio : '1970-01-01', opHasta = op.length ? rpIso(rpU(op[op.length - 1].inicio) + 6 * 864e5) : '1970-01-01';
  const kpi_ = { incidencias: tot, puntos: pts, indice: rpIdx(pts, tot), cerradas: cerr, pct_cierre: rpPct(cerr, tot), abiertas: tot - cerr, ps_n: ps.length, ps_pct: rpPct(ps.length, tot), ps_pts_pct: rpPct(rpS(ps, r => r.peso), pts), malla_n: mallaN, malla_pct: rpPct(mallaN, tot), alc_n: alcN, alc_pct: rpPct(alcN, tot), decomisos: decT, rond_cumpl: rpPct(rondR, rondP), inc_desde: incDesde, inc_hasta: incHasta, op_desde: opDesde, op_hasta: opHasta };
  const byMes = rpGrp(inc, r => r.mes), mesKeys = Object.keys(byMes).sort();
  out.inc_mes_tot = mesKeys.map(m => { const a = byMes[m], p = rpS(a, r => r.peso), c = rpS(a, r => r.cerrada ? 1 : 0); return { mes: m, n: a.length, puntos: p, indice: rpIdx(p, a.length), pct_cierre: rpPct(c, a.length), abiertas: a.length - c }; });
  const cc = {}; inc.forEach(r => cc[r.campo] = (cc[r.campo] || 0) + 1);
  const cInc = campos.filter(c => cc[c]).sort((a, b) => cc[b] - cc[a]);
  out.inc_mes = []; mesKeys.forEach(m => cInc.forEach(c => { const a = byMes[m].filter(r => r.campo === c); if (a.length) out.inc_mes.push({ mes: m, campo: c, n: a.length, puntos: rpS(a, r => r.peso) }); }));
  const byW = rpGrp(inc, r => r.inicio), ws = inc.map(r => r.inicio).sort(), weeks = []; if (ws.length) for (let t = rpU(ws[0]); t <= rpU(ws[ws.length - 1]); t += 7 * 864e5) weeks.push(rpIso(t));
  out.inc_sem = []; weeks.forEach(w => cInc.forEach(c => { const a = (byW[w] || []).filter(r => r.campo === c); out.inc_sem.push({ inicio: w, campo: c, n: a.length, puntos: rpS(a, r => r.peso) }); }));
  out.inc_sem_tot = weeks.map(w => { const a = byW[w] || [], p = rpS(a, r => r.peso), c = rpS(a, r => r.cerrada ? 1 : 0); return { inicio: w, n: a.length, puntos: p, indice: rpIdx(p, a.length), pct_cierre: rpPct(c, a.length), abiertas: a.length - c }; }).reverse();
  const byCat = rpGrp(inc, r => r.catn);
  const cats = Object.keys(byCat).map(k => { const a = byCat[k], c = rpS(a, r => r.cerrada ? 1 : 0); return { categoria: k, gravedad: RP_GRAV[a[0].peso] || 'Medio', peso: a[0].peso, n: a.length, puntos: rpS(a, r => r.peso), abiertas: a.length - c, pct_cierre: rpPct(c, a.length) }; }).sort((a, b) => b.puntos - a.puntos || b.n - a.n);
  let cum = 0; cats.forEach(c => { cum += c.puntos; c.acum_pct = rpPct(cum, pts); }); out.inc_cat = cats;
  const cm = {}, cs = {}; inc.forEach(r => { const a = r.mes + '|' + r.catn; cm[a] = cm[a] || { mes: r.mes, categoria: r.catn, n: 0 }; cm[a].n++; const b = r.inicio + '|' + r.catn; cs[b] = cs[b] || { inicio: r.inicio, categoria: r.catn, n: 0 }; cs[b].n++; });
  out.inc_cat_mes = Object.values(cm); out.inc_cat_sem = Object.values(cs);
  const hm = {}; inc.forEach(r => { const k = r.campo + '|' + r.depto; hm[k] = hm[k] || { campo: r.campo, depto: r.depto, n: 0, puntos: 0, abiertas: 0 }; hm[k].n++; hm[k].puntos += r.peso; if (!r.cerrada) hm[k].abiertas++; });
  out.inc_heat = Object.values(hm).sort((a, b) => b.puntos - a.puntos);
  out.abiertos = inc.filter(r => !r.cerrada);
  // control operativo
  const om = rpGrp(op, r => r.mes);
  out.op_mes_tot = Object.keys(om).sort().map(m => { const a = om[m], S = f => rpS(a, r => r[f]); return { mes: m, capturas: a.length, rond_cumpl: rpPct(S('rondReal'), S('rondProg')), nov_corr: rpPct(S('novCorr'), S('novDet')), acc_cumpl: rpPct(S('real'), S('prog')), puertas: S('puertasAbiertas'), sinRev: S('accesosSinRev'), decomisos: S('dec'), excesoVel: S('excesoVel'), bit_maltr_pct: rpPct(S('bitMaltratadas'), S('bitTotales')) }; });
  // campos
  let maxSem = 0;
  const csum = campos.map(c => {
    const ri = inc.filter(r => r.campo === c), ro = op.filter(r => r.campo === c), S = f => rpS(ro, r => r[f]), n = ri.length, p = rpS(ri, r => r.peso), cl = rpS(ri, r => r.cerrada ? 1 : 0), w = ro.length; if (w > maxSem) maxSem = w;
    const l4 = ro.slice(-4), l4p = rpS(l4, r => r.rondProg), l4r = rpS(l4, r => r.rondReal);
    return { campo: c, incidencias: n, puntos: p, indice: rpIdx(p, n), abiertas: n - cl, pct_cierre: rpPct(cl, n), rond_cumpl: rpPct(S('rondReal'), S('rondProg')), nov_corr: rpPct(S('novCorr'), S('novDet')), acc_cumpl: rpPct(S('real'), S('prog')), saludos: rpPct(S('saludosReal'), S('saludosEsp')),
      puertas_sem: w ? rp1(S('puertasAbiertas') / w) : null, decomisos: S('dec'), decomisos_sem: w ? rp1(S('dec') / w) : null, exceso_sem: w ? rp1(S('excesoVel') / w) : null, bit_maltr_pct: rpPct(S('bitMaltratadas'), S('bitTotales')), semanas_op: w, ultima_sem_op: w ? ro[ro.length - 1].inicio : '—',
      _rond4: rpPct(l4r, l4p), _excT: S('excesoVel'), _sinFicha: S('sinFicha'), _vidrio: S('envasesVidrio'), _robComb: ri.filter(r => r.cat === 'RoboComb' && !r.cerrada).length, _robFruta: ri.filter(r => r.cat === 'RoboFruta').length };
  });
  const decAll = rpS(csum, c => c.decomisos), ref = rpU(incHasta);
  csum.forEach(c => {
    const share = pts ? c.puntos / pts : 0, gap = c.ultima_sem_op === '—' ? 999 : (ref - (rpU(c.ultima_sem_op) + 6 * 864e5)) / 864e5;
    c.prioridad = share >= .4 ? 'Crítica' : (share >= .1 || (c.indice != null && c.indice >= 70 && c.incidencias >= 5)) ? 'Alta' : (c.incidencias > 0 || (c.acc_cumpl != null && c.acc_cumpl < 92) || (c.saludos != null && c.saludos < 80) || (gap > 28 && c.ultima_sem_op !== '—')) ? 'Media' : 'Baja';
    const m = [];
    if (c.incidencias) m.push(rpPct(c.incidencias, tot) + ' % de las incidencias');
    if (c.indice != null && c.indice >= 70) m.push('índice de riesgo en rojo (' + c.indice + ' %)');
    if (c.abiertas) m.push(c.abiertas + ' casos abiertos');
    if (c._robComb) m.push(c._robComb + ' robos de combustible sin cerrar');
    if (c._robFruta) m.push(c._robFruta + ' robos de fruta');
    if (decAll && c.decomisos / decAll >= .25) m.push(rpPct(c.decomisos, decAll) + ' % de los decomisos');
    if (c.rond_cumpl != null && c.rond_cumpl < 88) m.push('rondines en ' + c.rond_cumpl + ' %');
    if (c.acc_cumpl != null && c.acc_cumpl < 92) m.push('control de accesos en ' + c.acc_cumpl + ' %');
    if (c.saludos != null && c.saludos < 80) m.push('saludos en ' + c.saludos + ' %');
    if (c.bit_maltr_pct != null && c.bit_maltr_pct >= 15) m.push(c.bit_maltr_pct + ' % de bitácoras en mal estado');
    if (c.puertas_sem != null && c.puertas_sem >= 5.5) m.push(c.puertas_sem + ' puertas abiertas por semana');
    if (c.semanas_op && c.semanas_op < maxSem) m.push((maxSem - c.semanas_op === 1 ? 'falta 1 semana' : 'faltan ' + (maxSem - c.semanas_op) + ' semanas') + ' de captura operativa');
    if (gap > 28 && c.ultima_sem_op !== '—') m.push('sin captura desde la semana del ' + rpDl(c.ultima_sem_op));
    c.motivo = m.length ? m.join('; ').replace(/^./, x => x.toUpperCase()) + '.' : 'Sin incidencias y con controles en buen nivel; mantener la captura semanal.';
  });
  const ord = { 'Crítica': 0, 'Alta': 1, 'Media': 2, 'Baja': 3 };
  csum.sort((a, b) => ord[a.prioridad] - ord[b.prioridad] || b.puntos - a.puntos); out.campos = csum;
  const ar = resumenApoyo(V.incidencias()); kpi_.apoyo_pct = ar.pct || 0; out.apoyo = ar; out.kpi = kpi_;
  out.op = op; out.inc = inc; out.maxSem = maxSem; out.decAll = decAll; out.ref = ref;
  // metas
  out.metas = [['m01', 'Casos cerrados (% del total)', 'mayor', 85, 70, '%'], ['m02', 'Casos abiertos con más de 30 días', 'menor', 5, 15, 'n'], ['m03', 'Incidencias del último mes completo', 'menor', 35, 50, 'n'], ['m04', 'Índice de riesgo del último mes completo', 'menor', 55, 65, '%'],
    ['m05', 'Casos con malla perimetral (% del total)', 'menor', 30, 40, '%'], ['m06', 'Introducción de alcohol, último mes completo', 'menor', 10, 18, 'n'], ['m07', 'Violencia familiar y acoso sexual, último mes completo', 'menor', 2, 4, 'n'], ['m08', 'Robos de combustible y fruta, último mes completo', 'menor', 0, 2, 'n'],
    ['m09', 'Rondines realizados vs. programados, último mes con capturas', 'mayor', 90, 85, '%'], ['m10', 'Novedades de rondín corregidas, último mes con capturas', 'mayor', 95, 85, '%'], ['m11', 'Control de accesos cumplido, último mes con capturas', 'mayor', 95, 90, '%'], ['m12', 'Llamados por exceso de velocidad, último mes con capturas', 'menor', 15, 30, 'n']]
    .map(a => ({ id: a[0], indicador: a[1], sentido: a[2], meta: a[3], limite: a[4], unidad: a[5] }));
  rpMetasRes(out); rpAlertas(out); rpRecom(out); rpNotas(out); rpEval(out);
  return out;
}

function rpMetasRes(o) {
  const k = o.kpi, cur = k.inc_hasta.slice(0, 7), ms = o.inc_mes_tot.map(r => r.mes).sort().filter(m => m < cur), mc = ms[ms.length - 1];
  const opm = o.op_mes_tot.filter(r => r.capturas >= 15).sort((a, b) => a.mes < b.mes ? -1 : 1), om = opm[opm.length - 1], mt = o.inc_mes_tot.find(r => r.mes === mc);
  const cat = names => rpS(o.inc_cat_mes.filter(r => r.mes === mc && names.includes(r.categoria)), r => r.n);
  const old = o.abiertos.filter(r => (o.ref - rpU(r.fecha)) / 864e5 > 30).length;
  const P1 = 'Todo el periodo', P2 = 'Al ' + k.inc_hasta, P3 = rpMl(mc), P4 = rpMl(om && om.mes);
  const Vv = { m01: [k.pct_cierre, P1], m02: [old, P2], m03: [mt && mt.n, P3], m04: [mt && mt.indice, P3], m05: [k.malla_pct, P1], m06: [mc ? cat(['Introducción de alcohol']) : null, P3], m07: [mc ? cat(['Violencia familiar', 'Acoso sexual']) : null, P3], m08: [mc ? cat(['Robo de combustible', 'Robo de fruta']) : null, P3], m09: [om && om.rond_cumpl, P4], m10: [om && om.nov_corr, P4], m11: [om && om.acc_cumpl, P4], m12: [om && om.excesoVel, P4] };
  o.metas_res = o.metas.map(m => {
    const x = Vv[m.id] || [null, '—'], v = x[0], u = m.unidad === '%' ? ' %' : ''; let e;
    if (v == null) e = 'Sin datos'; else if (m.sentido === 'mayor') e = v >= m.meta ? 'Cumple' : v >= m.limite ? 'Cerca' : 'No cumple'; else e = v <= m.meta ? 'Cumple' : v <= m.limite ? 'Cerca' : 'No cumple';
    return { indicador: m.indicador, periodo: x[1], valor: v == null ? '—' : (m.unidad === '%' ? rp1(v) + ' %' : String(v)), meta: (m.sentido === 'mayor' ? '≥ ' : '≤ ') + m.meta + u, limite: (m.sentido === 'mayor' ? '≥ ' : '≤ ') + m.limite + u, estado: e };
  });
}
function rpAlertas(o) {
  const k = o.kpi, out = [], ref = o.ref, add = (sev, tema, campo, det) => out.push({ severidad: sev, tema, campo, detalle: det });
  const wk = o.inc_sem_tot.map(r => r.inicio).sort().filter(i => rpU(i) + 6 * 864e5 <= ref), l4 = wk.slice(-4), p4 = wk.slice(-8, -4), cs = {};
  o.inc_cat_sem.forEach(r => { const a = l4.includes(r.inicio), b = p4.includes(r.inicio); if (!a && !b) return; const c = cs[r.categoria] = cs[r.categoria] || [0, 0]; if (a) c[0] += r.n; else c[1] += r.n; });
  Object.keys(cs).map(c => [c, cs[c][0], cs[c][1], cs[c][0] - cs[c][1]]).filter(x => x[3] >= 3).sort((a, b) => b[3] - a[3]).slice(0, 3).forEach(x => add(x[3] >= 6 ? 'Crítica' : 'Atención', 'Categoría en aumento', 'Todos', x[0] + ': ' + x[1] + ' casos en las últimas 4 semanas completas contra ' + x[2] + ' en las 4 anteriores'));
  o.campos.filter(c => c.indice != null && c.indice >= 70).forEach(c => add('Crítica', 'Índice de riesgo en rojo', c.campo, 'Índice de ' + c.indice + ' % con ' + c.incidencias + ' incidencias y ' + c.abiertas + ' abiertas'));
  const vie = o.abiertos.filter(r => (ref - rpU(r.fecha)) / 864e5 > 30);
  if (vie.length) { const pc = {}; vie.forEach(r => pc[r.campo] = (pc[r.campo] || 0) + 1); add(vie.length > 10 ? 'Crítica' : 'Atención', 'Casos abiertos de más de 30 días', 'Todos', vie.length + ' casos: ' + Object.keys(pc).sort((a, b) => pc[b] - pc[a]).map(c => c + ' ' + pc[c]).join(', ')); }
  const rob = o.abiertos.filter(r => r.catn === 'Robo de combustible' || r.catn === 'Robo de fruta');
  if (rob.length) add('Crítica', 'Robos sin cerrar', Array.from(new Set(rob.map(r => r.campo))).join(', '), rob.length + ' casos de robo de combustible o fruta siguen abiertos');
  o.campos.forEach(c => { const rs = o.op.filter(r => r.campo === c.campo).sort((a, b) => a.inicio < b.inicio ? 1 : -1).slice(0, 4), p = rpS(rs, r => r.rondProg), q = rpS(rs, r => r.rondReal); if (p > 0 && q / p < .85) add('Atención', 'Rondines bajos', c.campo, 'Realizó ' + rp1(q / p * 100) + ' % de los rondines programados en sus últimas 4 capturas'); });
  o.campos.forEach(c => { if (c.ultima_sem_op === '—') return; const g = (ref - (rpU(c.ultima_sem_op) + 6 * 864e5)) / 864e5; if (g > 14) add(g >= 28 ? 'Crítica' : 'Atención', 'Sin captura operativa reciente', c.campo, 'Última captura: semana del ' + c.ultima_sem_op + ' (' + Math.round(g) + ' días antes del último caso registrado)'); });
  const tw = wk.length ? o.inc_sem_tot.find(r => r.inicio === wk[wk.length - 1]) : null, pr = o.inc_sem_tot.filter(r => p4.length && l4.slice(0, 3).concat(p4.slice(-1)).includes(r.inicio)), av = pr.length ? rpS(pr, r => r.n) / pr.length : 0;
  if (tw && av && tw.n >= av * 1.5 && tw.n - av >= 3) add('Atención', 'Semana por encima del promedio', 'Todos', 'La semana del ' + tw.inicio + ' tuvo ' + tw.n + ' casos contra un promedio de ' + rp1(av) + ' en las 4 semanas previas');
  out.sort((a, b) => (a.severidad === 'Crítica' ? 0 : 1) - (b.severidad === 'Crítica' ? 0 : 1));
  o.alertas = out; o.resumenMA = { criticas: out.filter(a => a.severidad === 'Crítica').length, atencion: out.filter(a => a.severidad === 'Atención').length, cumplen: o.metas_res.filter(m => m.estado === 'Cumple').length, total: o.metas_res.length };
}
function rpRecom(o) {
  const inc = o.inc, op = o.op, csum = o.campos, k = o.kpi, tot = inc.length, mallaN = k.malla_n, ref = o.ref;
  const catN = c => inc.filter(r => r.cat === c).length, catMes = c => { const m = {}; inc.forEach(r => { if (r.cat === c) m[r.mes] = (m[r.mes] || 0) + 1; }); return m; };
  const peak = m => { let b = null; Object.keys(m).forEach(x => { if (b == null || m[x] > m[b]) b = x; }); return b; };
  const ab = o.abiertos, vinc = ab.filter(r => /vinculo/i.test(r.estatus)).length, proc = ab.filter(r => /proceso/i.test(r.estatus)).length, viejas = ab.filter(r => (ref - rpU(r.fecha)) / 864e5 > 30).length;
  const frAb = ab.filter(r => r.cat === 'FaltaRegla').length, combN = catN('RoboComb'), combAb = ab.filter(r => r.cat === 'RoboComb').length, frutaN = catN('RoboFruta');
  const by = (f, g) => csum.slice().sort((a, b) => g(b) - g(a))[0];
  const topFruta = by(0, c => c._robFruta), topComb = by(0, c => c._robComb);
  const vf = catMes('ViolenFam'), vfN = catN('ViolenFam'), vfPk = peak(vf), ac = inc.filter(r => r.cat === 'AcoSex').sort((a, b) => a.fecha < b.fecha ? 1 : -1);
  const al = catMes('IntroAlcohol'), alN = catN('IntroAlcohol'), alPk = peak(al), dr = catMes('ConsumDrogasCuarto'), drN = catN('ConsumDrogasCuarto'), drPk = peak(dr);
  const alPts = rpPct(rpS(inc.filter(r => r.cat === 'IntroAlcohol'), r => r.peso), k.puntos);
  const psC = csum.filter(c => c.incidencias >= 5).map(c => c.campo), galeras = psC.length ? psC.slice(0, 2).join(' y ') : 'los campos con más casos';
  const decS = csum.slice().sort((a, b) => b.decomisos - a.decomisos), d1 = decS[0] || { campo: '—', decomisos: 0 }, d2 = decS[1] || { campo: '—', decomisos: 0 }, decAll = o.decAll, decShare = rpPct(d1.decomisos + d2.decomisos, decAll);
  const sf = by(0, c => c._sinFicha) || { campo: '—', _sinFicha: 0 }, vi = by(0, c => c._vidrio) || { campo: '—', _vidrio: 0 };
  const excAll = rpS(csum, c => c._excT), exS = csum.slice().sort((a, b) => b._excT - a._excT), e1 = exS[0] || { campo: '—', _excT: 0 }, e2 = exS[1] || { campo: '—', _excT: 0 }, excFormal = catN('ExcesoVeloc');
  const rondC = csum.filter(c => c._rond4 != null).sort((a, b) => a._rond4 - b._rond4)[0];
  const weak = csum.filter(c => c.semanas_op).sort((a, b) => ((a.acc_cumpl || 0) + (a.saludos || 0)) - ((b.acc_cumpl || 0) + (b.saludos || 0)))[0];
  const puer = csum.filter(c => c.semanas_op).sort((a, b) => b.puertas_sem - a.puertas_sem)[0], cajas = rpS(op, r => r.cajasSinSello), mallaPS = rpS(inc.filter(r => r.depto === 'Previsión Social'), r => r.m);
  const H = 'Inmediata (0–15 días)', C = 'Corto plazo (30–60 días)', P = 'Preventivo (60–90 días)';
  const R = (i, pl, am, h, a, rs, ind, mt) => ({ orden: i, plazo: pl, ambito: am, hallazgo: h, accion: a, responsable: rs, indicador: ind, meta: mt });
  o.recom = [
    R(1, H, galeras + ' (galeras)', mallaN + ' de ' + tot + ' incidencias (' + k.malla_pct + ' %) implican brincar o dañar la malla perimetral; ' + mallaPS + ' ocurren en Previsión Social. Es la entrada de alcohol, drogas y de muchas faltas al reglamento.', 'Reparar y elevar los tramos de malla donde más se repiten los brincos, instalar iluminación y cámaras en esos puntos y reforzar los recorridos nocturnos.', 'Jefe de Seguridad con Mantenimiento', 'Brincos o daños a la malla por semana', 'Bajar 50 % en 60 días'),
    R(2, H, rondC ? rondC.campo : 'Todos los campos', rondC ? 'En sus últimas 4 capturas ' + rondC.campo + ' realizó ' + rondC._rond4 + ' % de los rondines programados, el nivel más bajo entre los campos. Los incidentes se detectan en recorridos preventivos, por eso una caída de rondines puede subregistrar riesgo.' : 'Sin capturas de rondines.', 'Sostener la programación de rondines con turno nocturno cubierto y verificar cada rondín con QR, GPS y foto desde el panel de supervisión.', 'Jefe de Seguridad', 'Rondines realizados ÷ programados', '90 % o más cada semana'),
    R(3, H, galeras + ' (galeras)', vfN + ' casos de violencia familiar' + (vfPk ? ' (máximo mensual: ' + vf[vfPk] + ' en ' + rpMl(vfPk) + ')' : '') + ' y ' + catN('AcoSex') + ' de acoso sexual' + (ac.length ? ', el último el ' + rpDl(ac[0].fecha) : '') + ': son las categorías de mayor peso.', 'Activar un protocolo con Previsión Social y RH: separación inmediata de las parejas, canalización a trabajo social, seguimiento a los 7 días y sanción al reincidente. Capacitar a coordinadores y guardias de galeras en cómo intervenir y reportar.', 'Previsión Social con RH', 'Casos de violencia familiar y acoso por mes', 'Bajar 40 % en 90 días y cerrar el 100 %'),
    R(4, H, 'Todos los campos', ab.length + ' de ' + tot + ' incidencias (' + rpPct(ab.length, tot) + ' %) siguen abiertas: ' + vinc + ' en “vinculado al área responsable” y ' + proc + ' “en proceso”; ' + viejas + ' tienen más de 30 días. Faltas al reglamento suman ' + frAb + ' abiertas y ' + combAb + ' de ' + combN + ' robos de combustible siguen sin cerrar.', 'Revisar cada caso abierto en una junta semanal con responsable y fecha compromiso, y cerrar o escalar los casos con más de 30 días.', 'Jefe de Seguridad con jefes de área', 'Porcentaje de incidencias cerradas', '85 % o más en 30 días'),
    R(5, C, galeras + ' (galeras)', 'Introducción de alcohol suma ' + alN + ' casos (' + alPts + ' % del riesgo)' + (alPk ? ' y llegó a ' + al[alPk] + ' en ' + rpMl(alPk) : '') + '. Hay además ' + drN + ' casos de consumo de drogas' + (drPk ? ', con máximo de ' + dr[drPk] + ' en ' + rpMl(drPk) : '') + '.', 'Revisión de bolsas en la caseta, convenio escalonado con baja definitiva al reincidente, campañas de trabajo social y coordinación con la autoridad municipal en los casos con amenazas.', 'Previsión Social con Seguridad', 'Casos con alcohol o drogas por mes', 'Bajar 30 % en 60 días'),
    R(6, C, 'Todos los campos', (combN + frutaN) + ' robos: ' + combN + ' de combustible (' + combAb + ' sin cerrar' + (topComb && topComb._robComb ? ', ' + topComb._robComb + ' en ' + topComb.campo : '') + ') y ' + frutaN + ' de fruta' + (topFruta && topFruta._robFruta ? ' (' + topFruta._robFruta + ' en ' + topFruta.campo + ')' : '') + ', casi todos detectados en la revisión de salida.', 'Bitácora de despacho de combustible con candados y cámaras en el almacén y el estacionamiento de maquinaria; pase de salida formal y verificable para la rezaga; revisión del 100 % de las unidades con tinas.', 'Seguridad con Almacén y Empaque', 'Robos de fruta y combustible por mes', 'Cero casos sin investigación cerrada'),
    R(7, C, d1.campo + ' y ' + d2.campo, 'Los dos campos suman ' + rpFn(d1.decomisos + d2.decomisos) + ' de los ' + rpFn(decAll) + ' decomisos (' + decShare + ' %); ' + sf.campo + ' tiene ' + rpFn(sf._sinFicha) + ' personas sin ficha y ' + vi.campo + ' ' + rpFn(vi._vidrio) + ' envases de vidrio decomisados, un riesgo de inocuidad dentro del campo.', 'Reforzar el filtro de acceso en turnos pico, exigir ficha a todo el personal, comunicar la lista de artículos prohibidos y retirar los envases de vidrio en la entrada.', 'Seguridad con Inocuidad', 'Personas sin ficha y envases de vidrio por semana', 'Cero personas sin ficha'),
    R(8, C, weak ? weak.campo : 'Todos los campos', weak ? 'Control de accesos de ' + weak.acc_cumpl + ' % y saludos de ' + weak.saludos + ' %, los más bajos entre los campos; tiene ' + weak.semanas_op + ' de ' + o.maxSem + ' semanas capturadas y su última captura es del ' + rpDl(weak.ultima_sem_op) + '.' : 'Sin capturas.', 'Retomar la captura semanal, revisar con los guardias de caseta la programación de revisiones y saludos, y confirmar si la ausencia de incidencias es real o falta de registro.', 'Jefe de Seguridad', 'Cumplimiento de accesos y semanas con captura', '95 % de accesos y captura semanal completa'),
    R(9, C, puer ? puer.campo : 'Todos los campos', puer ? 'Es el campo con más puertas abiertas por semana (' + puer.puertas_sem + '), ' + puer.bit_maltr_pct + ' % de sus bitácoras de inocuidad están en mal estado y solo ' + puer.nov_corr + ' % de las novedades de rondín se corrigen.' : 'Sin capturas.', 'Cerrar las novedades en un máximo de 48 horas, reponer las bitácoras dañadas y definir con Embarques quién coloca los sellos de las cajas (' + cajas + ' registros de cajas sin sellos).', 'Coordinación del campo con Embarques e Inocuidad', 'Novedades corregidas, puertas abiertas por semana y bitácoras en buen estado', '95 % de novedades corregidas'),
    R(10, P, 'Todos los campos', 'La captura operativa reporta ' + rpFn(excAll) + ' llamados por exceso de velocidad, pero solo ' + excFormal + ' aparecen como incidencia formal; ' + e1.campo + ' (' + rpFn(e1._excT) + ') y ' + e2.campo + ' (' + rpFn(e2._excT) + ') concentran ' + rpPct(e1._excT + e2._excT, excAll) + ' %.', 'Señalización y topes en los accesos y caminos internos, y sanción progresiva a ingenieros y proveedores reincidentes.', 'Seguridad con Producción', 'Llamados por exceso de velocidad por semana', 'Bajar 30 %'),
    R(11, P, 'Capacitación', 'Los riesgos se reparten entre grupos distintos: personal de galeras, ingenieros y coordinadores, y personal de empaque.', 'Tres capacitaciones breves: coordinadores y guardias de galeras (violencia, alcohol, protocolo de intervención), ingenieros y coordinadores de campo (velocidad, acoso, cómo reportar), personal de Empaque y Embarques (sellos, rezaga y revisión de salida).', 'Seguridad y Previsión Social', 'Personal capacitado y casos del tema en los 60 días siguientes', '100 % del personal clave capacitado'),
    R(12, P, 'Datos y panel', 'Hay errores de clasificación y de captura que distorsionan el índice, y la captura operativa llega al ' + rpDl(k.op_hasta) + ' mientras las incidencias llegan al ' + rpDl(k.inc_hasta) + ' (ver notas de datos).', 'Corregir los registros señalados, unificar la numeración de semanas entre los dos paneles, capturar la fecha real de cierre de cada caso y mantener la captura operativa semanal en todos los campos.', 'Seguridad (administrador del panel)', 'Registros con error de captura y semanas sin captura', 'Cero registros con error')
  ];
}
function rpNotas(o) {
  const k = o.kpi, inc = o.inc, op = o.op, N = [], add = (t, ti, d) => N.push({ id: 'n' + String(N.length + 1).padStart(2, '0'), tipo: t, titulo: ti, detalle: d });
  const mx = o.inc_mes_tot.slice().sort((a, b) => b.n - a.n)[0], last = o.inc_mes_tot[o.inc_mes_tot.length - 1], ab = o.abiertos;
  const combN = inc.filter(r => r.cat === 'RoboComb').length, frutaN = inc.filter(r => r.cat === 'RoboFruta').length, combAb = ab.filter(r => r.cat === 'RoboComb').length;
  if (!inc.length) { add('Dato', 'Sin incidencias en el periodo', 'Cambie el filtro de Periodo a Todo para analizar todo el historial.'); }
  else {
    add('Hallazgo', 'La mayor parte del riesgo está en las galeras', 'Previsión Social concentra el ' + k.ps_pct + ' % de las incidencias y el ' + k.ps_pts_pct + ' % de los puntos de riesgo.');
    add('Hallazgo', 'La malla perimetral es la causa raíz más repetida', k.malla_pct + ' % de las incidencias involucran brincar o dañar la malla, con frecuencia con alcohol o drogas de por medio (' + k.alc_pct + ' % mencionan alcohol).');
    if (mx) add('Hallazgo', 'Mes con más incidencias', 'El mes más cargado fue ' + rpMl(mx.mes) + ' con ' + mx.n + ' casos; el último mes registrado es ' + rpMl(last.mes) + ' con ' + last.n + ' casos (hasta el ' + rpDl(k.inc_hasta) + ').');
    add('Hallazgo', 'Los robos aparecen sobre todo en las salidas', (combN + frutaN) + ' robos detectados en revisiones de salida; ' + combAb + ' de ' + combN + ' robos de combustible siguen abiertos.');
    const pocos = o.inc_mes_tot.filter(m => m.n <= 5); if (pocos.length) add('Dato', 'Meses con pocos registros', 'Los meses ' + pocos.map(m => rpMl(m.mes)).join(', ') + ' tienen ' + rpS(pocos, m => m.n) + ' registros en total, por lo que no son comparables con el resto.');
  }
  add('Dato', 'Los paneles numeran distinto las semanas', 'El informe usa la fecha del lunes de cada semana para alinear incidencias y control operativo.');
  add('Dato', 'Cobertura del control operativo', 'La captura operativa llega a la semana del ' + rpDl(op.length ? op[op.length - 1].inicio : null) + ' y las incidencias al ' + rpDl(k.inc_hasta) + '. ' + (o.campos.filter(c => c.semanas_op && c.semanas_op < o.maxSem).map(c => c.campo + ' tiene ' + c.semanas_op + ' de ' + o.maxSem + ' semanas').join('; ') || 'Todos los campos tienen las mismas semanas capturadas') + '.');
  const conD = inc.filter(r => r.dias != null), rap = conD.filter(r => r.dias <= 1).length, neg = inc.filter(r => r.dias != null && r.dias < 0).map(r => '#' + r.num), sinSol = inc.filter(r => !r.fSol).map(r => '#' + r.num);
  if (inc.length) add('Dato', 'El tiempo de resolución no distingue casos', rap + ' de los ' + conD.length + ' casos con fecha de solución tienen 0 o 1 día de resolución, aunque ' + rpPct(ab.length, inc.length) + ' % sigue abierto: la fecha de solución parece capturarse el mismo día del hecho.' + (neg.length ? ' Solución anterior a la detección: ' + neg.join(', ') + '.' : '') + (sinSol.length ? ' Sin fecha de solución: ' + sinSol.slice(0, 20).join(', ') + (sinSol.length > 20 ? ' y ' + (sinSol.length - 20) + ' más' : '') + '.' : ''));
  add('Dato', 'Casos reclasificados', 'El caso #73 (intento de suicidio con sobredosis) se toma como Intento de suicidio (peso 5) y las categorías “Riña” y “Riñas” se unifican como Riña con peso 4. Introducción de alcohol se mantiene como categoría.');
  const bitX = op.filter(r => r.bitBuenEstado > r.bitTotales).length, provX = op.filter(r => r.provReal > r.provProg).length;
  add('Dato', 'Posibles errores de captura', bitX + ' capturas operativas reportan más bitácoras en buen estado que el total y ' + provX + ' reportan más proveedores revisados que programados.');
  add('Dato', 'Datos de personas excluidos', 'El informe usa campo, área, categoría, fechas y estatus; no incluye nombres ni fichas de trabajadores.');
  add('Método', 'Cómo se calcula el índice de riesgo', 'Suma de los pesos del catálogo (2 a 5) dividida entre el máximo posible (incidencias × 5), igual que en el panel de incidencias: menos de 35 % verde, de 35 a 69.9 % amarillo y 70 % o más rojo.');
  add('Método', 'Metas, alertas y recomendaciones automáticas', 'Las metas y sus límites son propuestas iniciales. Las alertas y las recomendaciones se calculan con las cifras del ERP: categorías que suben 3 o más casos en 4 semanas, campos con índice de 70 % o más, casos abiertos de más de 30 días, robos sin cerrar, rondines por debajo de 85 % y campos sin captura operativa reciente.');
  add('Método', 'Qué datos usa esta pantalla', 'Respeta el filtro de Periodo y Campo de la parte superior. Para ver todo el historial elija Periodo: Todo. Los datos de rondines, control operativo, accesos y personal del ERP se resumen además en el índice ponderado por campo (pestaña Campos y áreas).');
  o.notas = N;
}
function rpEval(o) {
  const k = o.kpi, m = o.resumenMA, S = o.inc_sem_tot.slice().sort((a, b) => a.inicio < b.inicio ? 1 : -1);
  const comp = S.filter(r => rpIso(rpU(r.inicio) + 6 * 864e5) <= k.inc_hasta), ult = comp.slice(0, 4), prev = comp.slice(4, 8), su = rpS(ult, r => r.n), sp = rpS(prev, r => r.n);
  const tend = prev.length === 4 && ult.length === 4 ? (su > sp * 1.15 ? 'sube' : su < sp * .85 ? 'baja' : 'estable') : null;
  const viejos = o.abiertos.filter(r => (o.ref - rpU(r.fecha)) / 864e5 > 30).length, idx = k.indice;
  let nivel, cls; if (idx == null) { nivel = 'Sin datos'; cls = ''; } else if (idx >= 70) { nivel = 'Crítica'; cls = 'mal'; } else if (idx >= 55) { nivel = 'Moderada-alta, cerca de la zona roja'; cls = 'warn'; } else if (idx >= 35) { nivel = 'Moderada'; cls = 'warn'; } else { nivel = 'Controlada'; cls = 'ok'; }
  const top = o.inc_cat[0], camp = o.campos.slice().sort((a, b) => b.puntos - a.puntos)[0];
  const s = idx == null ? 'No hay incidencias en el periodo seleccionado. Cambie el filtro de Periodo a Todo.' : 'El índice de riesgo es ' + rp1(idx) + ' % (verde menos de 35 %, rojo desde 70 %) con ' + k.incidencias + ' incidencias registradas. ' + (top ? 'La categoría que más pesa es ' + top.categoria + ' (' + top.n + ' casos) y ' : '') + (camp && camp.puntos ? 'el campo con más riesgo es ' + camp.campo + '. ' : '') + 'Previsión Social concentra ' + rp1(k.ps_pct) + ' % de las incidencias.' + (tend ? ' En las últimas 4 semanas completas las incidencias ' + (tend === 'sube' ? 'subieron' : tend === 'baja' ? 'bajaron' : 'se mantuvieron estables') + ' (' + su + ' contra ' + sp + ' de las 4 anteriores).' : '');
  const ok = [], bad = [];
  if (tend === 'baja') ok.push('Las incidencias bajan frente a las 4 semanas anteriores (' + su + ' contra ' + sp + ').');
  if (k.pct_cierre >= 85) ok.push('Se cierran ' + rp1(k.pct_cierre) + ' % de los casos.');
  if (k.rond_cumpl >= 85) ok.push('Los rondines se cumplen en ' + rp1(k.rond_cumpl) + ' % de lo programado.');
  if (m.cumplen > 0) ok.push(m.cumplen + ' de ' + m.total + ' metas cumplidas.');
  if (idx != null && idx < 70) ok.push('El índice general se mantiene por debajo del límite rojo (70 %).');
  if (!ok.length) ok.push('Por ahora no hay indicadores generales que destaquen como favorables.');
  if (tend === 'sube') bad.push('Las incidencias suben frente a las 4 semanas anteriores (' + su + ' contra ' + sp + ').');
  if (k.pct_cierre != null && k.pct_cierre < 85) bad.push('Solo se cierran ' + rp1(k.pct_cierre) + ' % de los casos; hay ' + k.abiertas + ' abiertos' + (viejos ? ' y ' + viejos + ' con más de 30 días' : '') + '.');
  if (k.malla_pct >= 30) bad.push(rp1(k.malla_pct) + ' % de las incidencias involucran la malla perimetral.');
  if (k.alc_pct >= 30) bad.push(rp1(k.alc_pct) + ' % involucran alcohol.');
  if (k.apoyo_pct >= 10) bad.push(rp1(k.apoyo_pct) + ' % de las incidencias requirieron apoyo de la policía municipal o la guardia civil estatal.');
  if (m.criticas > 0) bad.push(m.criticas + ' alertas críticas y ' + m.atencion + ' de atención (ver Metas y alertas).');
  if (!bad.length) bad.push('No hay focos de atención relevantes con las reglas actuales.');
  o.eval = { nivel, cls, s, ok, bad, rec: o.recom.slice(0, 3) };
}

// ---------- gráficas SVG ----------
const RP_COL = ['#a9ccff', '#ffb45e', '#4cd07a', '#ff8fb8', '#d68cff', '#ff7a70', '#5fe0d6', '#c3d3f5'];
function rpPareto(cats) {
  if (!cats.length) return '<div class="vacio">Sin datos</div>';
  const W = 640, H = 300, L = 40, R = 40, T = 12, B = 96, n = cats.length, mx = Math.max(...cats.map(c => c.puntos)) || 1, bw = (W - L - R) / n;
  const y = v => T + (H - T - B) * (1 - v / mx), y2 = v => T + (H - T - B) * (1 - v / 100);
  let g = ''; for (let i = 0; i <= 4; i++) { const v = mx * i / 4; g += `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" class="gl"/><text x="${L - 4}" y="${y(v) + 3}" text-anchor="end" class="gt">${Math.round(v)}</text><text x="${W - R + 4}" y="${y2(i * 25) + 3}" class="gt">${i * 25}%</text>`; }
  cats.forEach((c, i) => { const x = L + i * bw + bw * .15; g += `<rect x="${x}" y="${y(c.puntos)}" width="${bw * .7}" height="${H - B - y(c.puntos)}" fill="${i < 5 ? '#a9ccff' : '#6f8ccc'}" rx="2"><title>${esc(c.categoria)}: ${c.puntos} puntos, ${c.n} casos</title></rect><text transform="translate(${x + bw * .35},${H - B + 8}) rotate(50)" class="gt">${esc(c.categoria.length > 22 ? c.categoria.slice(0, 21) + '…' : c.categoria)}</text>`; });
  g += `<polyline fill="none" stroke="#ffb45e" stroke-width="2" points="${cats.map((c, i) => (L + i * bw + bw / 2) + ',' + y2(c.acum_pct)).join(' ')}"/>`;
  return `<svg viewBox="0 0 ${W} ${H}" class="linea">${g}</svg><div class="leyenda"><span><i style="background:#a9ccff"></i>Puntos de riesgo (azul claro = 5 principales)</span><span><i style="background:#ffb45e"></i>% acumulado</span></div>`;
}
function rpStack(data, xk, sk, vk, fmtX) {
  const xs = Array.from(new Set(data.map(r => r[xk]))).sort(), names = Array.from(new Set(data.map(r => r[sk])));
  if (!xs.length) return '<div class="vacio">Sin datos</div>';
  const W = 640, H = 240, L = 34, R = 6, T = 8, B = 28, by = {}; data.forEach(r => { (by[r[xk]] = by[r[xk]] || {})[r[sk]] = (by[r[xk]][r[sk]] || 0) + r[vk]; });
  const tot = xs.map(x => names.reduce((t, nm) => t + (by[x][nm] || 0), 0)), mx = Math.max(...tot, 1), bw = (W - L - R) / xs.length, y = v => T + (H - T - B) * (1 - v / mx);
  let g = ''; for (let i = 0; i <= 4; i++) { const v = mx * i / 4; g += `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" class="gl"/><text x="${L - 4}" y="${y(v) + 3}" text-anchor="end" class="gt">${Math.round(v)}</text>`; }
  const paso = Math.ceil(xs.length / 10);
  xs.forEach((x, i) => { let acc = 0; names.forEach((nm, j) => { const v = by[x][nm] || 0; if (!v) return; g += `<rect x="${L + i * bw + bw * .12}" y="${y(acc + v)}" width="${bw * .76}" height="${y(acc) - y(acc + v)}" fill="${RP_COL[j % RP_COL.length]}"><title>${esc(fmtX ? fmtX(x) : x)} · ${esc(nm)}: ${v}</title></rect>`; acc += v; }); if (i % paso === 0) g += `<text x="${L + i * bw + bw / 2}" y="${H - 8}" text-anchor="middle" class="gt">${esc(fmtX ? fmtX(x) : x)}</text>`; });
  return `<svg viewBox="0 0 ${W} ${H}" class="linea">${g}</svg><div class="leyenda">${names.map((nm, j) => `<span><i style="background:${RP_COL[j % RP_COL.length]}"></i>${esc(nm)}</span>`).join('')}</div>`;
}
const rpFd = s => rpDl(s), rpFm = s => rpMl(s + '-01');
function rpLineasCampo(rows, campos, xk, vk, labelF, max) {
  const xs = Array.from(new Set(rows.map(r => r[xk]))).sort(); if (!xs.length) return '<div class="vacio">Sin datos</div>';
  const ser = campos.map((c, i) => ({ nombre: c, color: RP_COL[i % RP_COL.length], valores: xs.map(x => { const r = rows.find(z => z[xk] === x && z.campo === c); return r && r[vk] != null ? r[vk] : 0; }) })).filter(s => s.valores.some(v => v));
  return lineas(ser, xs.map(labelF), { max });
}

// ---------- vista ----------
let RP_TAB = 't1';
const rpTabs = [['t1', 'Resumen'], ['t8', 'Metas y alertas'], ['t2', 'Semanal'], ['t3', 'Mensual'], ['t4', 'Campos y áreas'], ['t5', 'Control operativo'], ['t9', 'Apoyo policial'], ['t6', 'Plan de mejoras'], ['t7', 'Notas de datos']];
const rpTile = (v, l) => `<div class="tile"><span class="v">${v}</span><span class="l">${esc(l)}</span></div>`;
const rpEst = e => pill(e, e === 'Cumple' ? 'ok' : e === 'Cerca' ? 'warn' : e === 'No cumple' ? 'mal' : '');
const rpPri = p => `<b class="${p === 'Crítica' ? 'bad' : p === 'Alta' ? 'warn' : ''}">${p}</b>`;
function rpTabsHTML(o) {
  const k = o.kpi, sec = {};
  sec.t1 = '<div class="grid2">' + card('En qué incidencias enfocarse', '<p class="nota">Puntos de riesgo por categoría (peso × casos) y porcentaje acumulado. Las primeras barras son las prioritarias.</p>' + rpPareto(o.inc_cat)) +
    card('Prioridad por campo', '<p class="nota">Campos ordenados por prioridad de atención.</p>' + tabla([{ t: 'Campo', f: c => c.campo }, { t: 'Prioridad', h: 1, f: c => rpPri(c.prioridad) }, { t: 'Por qué', f: c => c.motivo }], o.campos, { wrap: 1 })) + '</div>' +
    card('Categorías de incidencia', '<p class="nota">Peso 2 a 5 según gravedad; índice = puntos ÷ (casos × 5).</p>' + tabla([{ t: 'Categoría', f: c => c.categoria }, { t: 'Gravedad', f: c => c.gravedad }, { t: 'Casos', f: c => c.n }, { t: 'Puntos', f: c => c.puntos }, { t: '% acumulado', f: c => rpPc(c.acum_pct) }, { t: 'Abiertas', f: c => c.abiertas }, { t: '% cierre', f: c => rpPc(c.pct_cierre) }], o.inc_cat));
  const al = o.alertas.length ? tabla([{ t: 'Severidad', h: 1, f: a => pill(a.severidad, a.severidad === 'Crítica' ? 'mal' : 'warn') }, { t: 'Tema', f: a => a.tema }, { t: 'Campo', f: a => a.campo }, { t: 'Detalle', f: a => a.detalle }], o.alertas) : '<div class="vacio ok">Sin alertas con las reglas actuales</div>';
  sec.t8 = card('Alertas automáticas', '<p class="nota">Se recalculan con los datos del ERP: categorías en aumento, campos en rojo, casos abiertos de más de 30 días, robos sin cerrar, rondines bajos y campos sin captura reciente.</p>' + al) +
    card('Metas y semáforo', '<p class="nota">Verde: cumple la meta. Amarillo: dentro del límite de tolerancia. Rojo: fuera del límite. Las metas son propuestas para ajustar con tu equipo.</p>' + tabla([{ t: 'Indicador', f: m => m.indicador }, { t: 'Periodo', f: m => m.periodo }, { t: 'Resultado', f: m => m.valor }, { t: 'Meta', f: m => m.meta }, { t: 'Límite', f: m => m.limite }, { t: 'Estado', h: 1, f: m => rpEst(m.estado) }], o.metas_res));
  const campos = o.campos.map(c => c.campo), idxLine = (rows, key, lab) => lineas([{ nombre: 'Índice de riesgo', color: '#ff7a70', valores: rows.map(r => r.indice || 0) }], rows.map(r => lab(r[key])), { max: 100 });
  const semAsc = o.inc_sem_tot.slice().reverse(), mesAsc = o.inc_mes_tot;
  sec.t2 = '<div class="grid2">' + card('Incidencias por semana y campo', '<p class="nota">Semana que inicia el lunes indicado.</p>' + rpStack(o.inc_sem, 'inicio', 'campo', 'n', rpFd)) + card('Índice de riesgo semanal', '<p class="nota">Puntos ÷ (casos × 5), en porcentaje.</p>' + (semAsc.length ? idxLine(semAsc, 'inicio', rpFd) : '<div class="vacio">Sin datos</div>')) + '</div>' +
    card('Resultados semanales', '<p class="nota">Semana más reciente primero. Cerrados y abiertos son los casos registrados esa semana.</p>' + tabla([{ t: 'Semana del', f: r => rpDl(r.inicio) + ' ' + r.inicio.slice(0, 4) }, { t: 'Casos', f: r => r.n }, { t: 'Puntos', f: r => r.puntos }, { t: 'Índice', f: r => rpPc(r.indice) }, { t: '% cierre', f: r => rpPc(r.pct_cierre) }, { t: 'Abiertos', f: r => r.abiertas }], o.inc_sem_tot));
  sec.t3 = '<div class="grid2">' + card('Incidencias por mes y campo', rpStack(o.inc_mes, 'mes', 'campo', 'n', rpFm)) + card('Índice de riesgo mensual', '<p class="nota">Puntos ÷ (casos × 5), en porcentaje.</p>' + (mesAsc.length ? idxLine(mesAsc, 'mes', rpFm) : '<div class="vacio">Sin datos</div>')) + '</div>' +
    card('Resultados mensuales de incidencias', tabla([{ t: 'Mes', f: r => rpMl(r.mes) }, { t: 'Casos', f: r => r.n }, { t: 'Puntos', f: r => r.puntos }, { t: 'Índice', f: r => rpPc(r.indice) }, { t: '% cierre', f: r => rpPc(r.pct_cierre) }, { t: 'Abiertos', f: r => r.abiertas }], o.inc_mes_tot.slice().reverse())) +
    card('Resultados mensuales de control operativo', '<p class="nota">Cumplimientos en porcentaje; decomisos, puertas abiertas y exceso de velocidad son conteos del mes.</p>' + tabla([{ t: 'Mes', f: r => rpMl(r.mes) }, { t: 'Capturas', f: r => r.capturas }, { t: 'Rondines', f: r => rpPc(r.rond_cumpl) }, { t: 'Novedades corregidas', f: r => rpPc(r.nov_corr) }, { t: 'Accesos', f: r => rpPc(r.acc_cumpl) }, { t: 'Puertas abiertas', f: r => r.puertas }, { t: 'Sin revisión', f: r => r.sinRev }, { t: 'Decomisos', f: r => rpFn(r.decomisos) }, { t: 'Exceso vel.', f: r => r.excesoVel }, { t: 'Bitácoras mal', f: r => rpPc(r.bit_maltr_pct) }], o.op_mes_tot.slice().reverse()));
  sec.t4 = card('Resultados por campo', '<p class="nota">Incidencias y control operativo del periodo. Cada campo se compara con los demás en las mismas columnas.</p>' + tabla([{ t: 'Campo', f: c => c.campo }, { t: 'Incid.', f: c => c.incidencias }, { t: 'Puntos', f: c => c.puntos }, { t: 'Índice', f: c => rpPc(c.indice) }, { t: 'Abiertas', f: c => c.abiertas }, { t: '% cierre', f: c => rpPc(c.pct_cierre) }, { t: 'Rondines', f: c => rpPc(c.rond_cumpl) }, { t: 'Novedades corr.', f: c => rpPc(c.nov_corr) }, { t: 'Accesos', f: c => rpPc(c.acc_cumpl) }, { t: 'Saludos', f: c => rpPc(c.saludos) }, { t: 'Puertas/sem', f: c => c.puertas_sem == null ? '—' : c.puertas_sem }, { t: 'Decomisos', f: c => rpFn(c.decomisos) }, { t: 'Exceso/sem', f: c => c.exceso_sem == null ? '—' : c.exceso_sem }, { t: 'Bitác. mal', f: c => rpPc(c.bit_maltr_pct) }, { t: 'Sem. captura', f: c => c.semanas_op }], o.campos)) +
    card('Riesgo por campo y área', '<p class="nota">Puntos de riesgo de cada combinación de campo y departamento responsable.</p>' + tabla([{ t: 'Campo', f: r => r.campo }, { t: 'Departamento', f: r => r.depto }, { t: 'Casos', f: r => r.n }, { t: 'Puntos', f: r => r.puntos }, { t: 'Abiertas', f: r => r.abiertas }], o.inc_heat)) + '<div id="rpPond"></div>';
  const opRond = o.op.map(r => ({ inicio: r.inicio, campo: r.campo, cumpl: r.rondProg ? rp1(r.rondReal / r.rondProg * 100) : null }));
  const opAg = {}; o.op.forEach(r => { const kk = r.inicio + '|' + r.campo; opAg[kk] = opAg[kk] || { inicio: r.inicio, campo: r.campo, dec: 0 }; opAg[kk].dec += r.dec; });
  sec.t5 = '<div class="grid2">' + card('Rondines realizados vs. programados', '<p class="nota">Porcentaje semanal por campo.</p>' + rpLineasCampo(opRond, campos, 'inicio', 'cumpl', rpFd, 100)) + card('Decomisos en accesos', '<p class="nota">Artículos decomisados por semana y campo.</p>' + rpStack(Object.values(opAg), 'inicio', 'campo', 'dec', rpFd)) + '</div>' +
    card('Control operativo por semana', '<p class="nota">Capturas semanales de cada campo, la más reciente primero.</p>' + tabla([{ t: 'Semana del', f: r => rpDl(r.inicio) }, { t: 'Campo', f: r => r.campo }, { t: 'Rondines prog.', f: r => r.rondProg }, { t: 'Rondines real.', f: r => r.rondReal }, { t: 'Evidencia', f: r => r.evidencia }, { t: 'Nov. det.', f: r => r.novDet }, { t: 'Nov. corr.', f: r => r.novCorr }, { t: 'Accesos prog.', f: r => r.prog }, { t: 'Accesos real.', f: r => r.real }, { t: 'Puertas ab.', f: r => r.puertasAbiertas }, { t: 'Sin rev.', f: r => r.accesosSinRev }, { t: 'Decomisos', f: r => r.dec }, { t: 'Exceso vel.', f: r => r.excesoVel }, { t: 'Bitác. tot.', f: r => r.bitTotales }, { t: 'Bitác. mal', f: r => r.bitMaltratadas }], o.op.slice().reverse()));
  const ra = o.apoyo;
  sec.t9 = card('Intervenciones con policía municipal y guardia civil estatal', `<p class="nota">${esc(textoApoyo(ra))}</p><div class="barra-acc"><button class="btn sec" id="rpApCsv">Descargar registro (CSV)</button></div>`) +
    '<div class="grid2">' + card('Por mes', tabla([{ t: 'Mes', f: x => x.mes }, { t: 'Incidencias', f: x => x.incidencias }, { t: 'Con apoyo', f: x => x.apoyos }, { t: 'Solo municipal', f: x => x.municipal }, { t: 'Solo guardia civil', f: x => x.guardia }, { t: 'Ambas', f: x => x.ambas }, { t: '% incid.', f: x => x.pct + ' %' }], ra.porMes)) +
    card('Por campo', tabla([{ t: 'Campo', f: x => x.campo }, { t: 'Incidencias', f: x => x.incidencias }, { t: 'Con apoyo', f: x => x.apoyos }, { t: 'Solo municipal', f: x => x.municipal }, { t: 'Solo guardia civil', f: x => x.guardia }, { t: 'Ambas', f: x => x.ambas }, { t: '% incid.', f: x => x.pct + ' %' }], ra.porCampo)) + '</div>' +
    cardApoyoPlegable('Registro de intervenciones (más reciente primero)', ra.lista, 10);
  sec.t6 = card('Plan de mejoras propuesto', '<p class="nota">Ordenado por urgencia. Los responsables y las metas son sugerencias para ajustar con tu equipo.</p>' + tabla([{ t: '#', f: r => r.orden }, { t: 'Plazo', f: r => r.plazo }, { t: 'Dónde', f: r => r.ambito }, { t: 'Hallazgo', f: r => r.hallazgo }, { t: 'Acción propuesta', f: r => r.accion }, { t: 'Responsable', f: r => r.responsable }, { t: 'Indicador', f: r => r.indicador }, { t: 'Meta', f: r => r.meta }], o.recom, { wrap: 1 }));
  sec.t7 = card('Hallazgos, calidad de datos y método', tabla([{ t: 'Ref.', f: r => r.id }, { t: 'Tipo', f: r => r.tipo }, { t: 'Tema', f: r => r.titulo }, { t: 'Detalle', f: r => r.detalle }], o.notas, { wrap: 1 }));
  return sec;
}
