/* Seguridad La Memoria — Formato mensual de Inocuidad RE-PL-164 (control de entradas y salidas de visitantes)
   Usa el generador oficial de inocuidad/re-pl-164.js (PDF sobre el formato oficial y Excel) con los accesos
   ya importados, y agrega las observaciones del mes (notas de caseta y visitas sin hora de salida). */
'use strict';
const INOC_KEY = 'unificado_inocuidad_entregas_v1';
const MESES_ES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const inocMesDefecto = () => { const h = new Date(); const d = h.getDate() <= 10 ? new Date(h.getFullYear(), h.getMonth() - 1, 1) : h; return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); };
function inocLS(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }
function inocCampos() { return Array.from(new Set(DATA.accesos.map(a => normCampo(a.campo)).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'es')); }
function inocRegistros(campo, mes) {
  const [y, m] = mes.split('-').map(Number), d = new Date(y, m - 1, 1).getTime(), h = new Date(y, m, 1).getTime();
  return DATA.accesos.filter(a => normCampo(a.campo) === campo && +a.horaIngreso >= d && +a.horaIngreso < h).sort((a, b) => a.horaIngreso - b.horaIngreso);
}
function inocGrupos(campo, mes, conObs) {
  const cs = campo === '__TODOS__' ? inocCampos() : [campo];
  return cs.map(c => ({ campo: c, titulo: InocuidadREPL164.nombreFormato(c), registros: inocRegistros(c, mes) })).filter(g => g.registros.length || campo !== '__TODOS__');
}
const inocFH = ts => { const d = new Date(+ts), p = n => String(n).padStart(2, '0'); return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`; };
// observaciones del mes: nota capturada por el guardia + aviso si la visita no tiene hora de salida
function inocObservaciones(grupos) {
  const out = [];
  grupos.forEach(g => g.registros.forEach(a => {
    const t = [String(a.nota || '').replace(/\s+/g, ' ').trim(), a.horaSalida ? '' : 'Sin hora de salida registrada'].filter(Boolean).join(' · ');
    if (t) out.push({ campo: g.campo, titulo: g.titulo, fecha: inocFH(a.horaIngreso), nombre: String(a.nombre || '').replace(/\s+/g, ' ').trim(), obs: t });
  }));
  return out;
}
async function inocAnexoPDF(bytes, obs, mes) {
  const L = window.PDFLib, doc = await L.PDFDocument.load(bytes), f = await doc.embedFont(L.StandardFonts.Helvetica), fb = await doc.embedFont(L.StandardFonts.HelveticaBold);
  const seguro = t => String(t || '').replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/[–—]/g, '-').replace(/[^\x20-\x7E\xA0-\xFF]/g, '');
  const envuelve = (t, max, tam) => { const pal = seguro(t).split(' '), ls = []; let a = ''; pal.forEach(p => { const x = a ? a + ' ' + p : p; if (f.widthOfTextAtSize(x, tam) <= max) a = x; else { if (a) ls.push(a); a = p; } }); if (a) ls.push(a); return ls; };
  const porCampo = {}; obs.forEach(o => (porCampo[o.titulo] = porCampo[o.titulo] || []).push(o));
  for (const titulo of Object.keys(porCampo)) {
    let pag = null, y = 0, n = 0;
    const nueva = () => {
      pag = doc.addPage([792, 612]); n++;
      pag.drawText(seguro('OBSERVACIONES DEL MES · ' + titulo), { x: 30, y: 575, size: 12, font: fb });
      pag.drawText(seguro('RE-PL-164 · Periodo: ' + mes.texto + ' · Anexo al control de entradas y salidas de visitantes'), { x: 30, y: 561, size: 8, font: f, color: L.rgb(.35, .35, .35) });
      ['FECHA / HORA', 'NOMBRE', 'OBSERVACION'].forEach((h, i) => pag.drawText(h, { x: [30, 130, 330][i], y: 540, size: 8.5, font: fb }));
      pag.drawLine({ start: { x: 30, y: 535 }, end: { x: 762, y: 535 }, thickness: .8 }); y = 524;
    };
    nueva();
    porCampo[titulo].forEach(o => {
      const ln = envuelve(o.obs, 420, 8.5).slice(0, 4), nom = envuelve(o.nombre, 190, 8.5).slice(0, 2), alto = Math.max(ln.length, nom.length) * 10.5 + 5;
      if (y - alto < 40) nueva();
      pag.drawText(seguro(o.fecha), { x: 30, y, size: 8.5, font: f });
      nom.forEach((t, i) => pag.drawText(t, { x: 130, y: y - i * 10.5, size: 8.5, font: f }));
      ln.forEach((t, i) => pag.drawText(t, { x: 330, y: y - i * 10.5, size: 8.5, font: f }));
      y -= alto; pag.drawLine({ start: { x: 30, y: y + 10 }, end: { x: 762, y: y + 10 }, thickness: .3, color: L.rgb(.7, .7, .7) });
    });
  }
  return await doc.save();
}
async function inocAnexoXLSX(bytes, obs, mes) {
  const zip = await window.JSZip.loadAsync(bytes), X = t => String(t == null ? '' : t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
  const wb = await zip.file('xl/workbook.xml').async('string'), n = (wb.match(/<sheet /g) || []).length + 1;
  const c = (col, r, v, s) => `<c r="${col}${r}" s="${s}" t="inlineStr"><is><t xml:space="preserve">${X(v)}</t></is></c>`;
  const filas = [`<row r="1">${c('A', 1, 'Campo', 1)}${c('B', 1, 'Fecha / hora', 1)}${c('C', 1, 'Nombre', 1)}${c('D', 1, 'Observación', 1)}</row>`].concat(obs.map((o, i) => `<row r="${i + 2}">${c('A', i + 2, o.titulo, 3)}${c('B', i + 2, o.fecha, 3)}${c('C', i + 2, o.nombre, 3)}${c('D', i + 2, o.obs, 3)}</row>`));
  zip.file(`xl/worksheets/sheet${n}.xml`, '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><cols><col min="1" max="1" width="34" customWidth="1"/><col min="2" max="2" width="18" customWidth="1"/><col min="3" max="3" width="38" customWidth="1"/><col min="4" max="4" width="70" customWidth="1"/></cols><sheetData>' + filas.join('') + '</sheetData></worksheet>');
  let ct = await zip.file('[Content_Types].xml').async('string');
  ct = ct.replace('</Types>', `<Override PartName="/xl/worksheets/sheet${n}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`); zip.file('[Content_Types].xml', ct);
  zip.file('xl/workbook.xml', wb.replace('</sheets>', `<sheet name="Observaciones" sheetId="${n}" r:id="rIdObs"/></sheets>`));
  let rl = await zip.file('xl/_rels/workbook.xml.rels').async('string');
  zip.file('xl/_rels/workbook.xml.rels', rl.replace('</Relationships>', `<Relationship Id="rIdObs" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${n}.xml"/></Relationships>`));
  return await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}
function cardInocuidad() {
  const cs = inocCampos(); if (!cs.length) return '';
  return card('🧾 Formato mensual para Inocuidad · RE-PL-164', `
    <p class="nota">Control de entradas y salidas de visitantes, con los accesos que capturan los guardias en caseta (una hoja por campo, 30 renglones por página), listo para entregar cada mes a Inocuidad.</p>
    <div class="filtros" style="margin:6px 0 10px"><label>Campo <select id="inCampo">${cs.length > 1 ? '<option value="__TODOS__">Todos los campos</option>' : ''}${cs.map(c => `<option>${esc(c)}</option>`).join('')}</select></label>
      <label>Mes <input type="month" id="inMes" value="${inocMesDefecto()}"></label>
      <label style="display:flex;gap:6px;align-items:center"><input type="checkbox" id="inObs" checked> Incluir observaciones</label></div>
    <div id="inInfo" class="nota"></div>
    <div class="barra-acc"><button class="btn" id="inPdf">📄 Descargar PDF (formato oficial)</button><button class="btn sec" id="inXls">📊 Descargar Excel</button></div><div class="msg" id="inMsg"></div>`);
}
function bindInocuidad(el) {
  const $c = $('#inCampo', el), $m = $('#inMes', el); if (!$c) return;
  const info = () => { const gs = inocGrupos($c.value, $m.value), n = sum(gs, g => g.registros.length), ob = inocObservaciones(gs).length; $('#inInfo', el).textContent = $m.value ? `Periodo: ${n} registro(s) en ${gs.length} campo(s) · ${ob} observación(es) · ${gs.filter(g => g.registros.some(a => !a.horaSalida)).length ? 'hay visitas sin hora de salida' : 'todas con hora de salida'}` : ''; $('#inPdf', el).disabled = $('#inXls', el).disabled = !n; };
  const ejecutar = async tipo => {
    const msg = $('#inMsg', el), gs = inocGrupos($c.value, $m.value); if (!gs.length || !sum(gs, g => g.registros.length)) { msg.textContent = 'No hay accesos en ese mes.'; return; }
    const btn = $(tipo === 'pdf' ? '#inPdf' : '#inXls', el), txt = btn.textContent; btn.disabled = true; btn.textContent = '⏳ Generando…'; msg.textContent = '';
    try {
      const [y, m] = $m.value.split('-').map(Number), mes = InocuidadREPL164.rangoMes($m.value), obs = $('#inObs', el).checked ? inocObservaciones(gs) : [];
      let bytes, ext, mime;
      if (tipo === 'pdf') { bytes = await InocuidadREPL164.generarPDF(gs, mes); if (obs.length) bytes = await inocAnexoPDF(bytes, obs, mes); ext = 'pdf'; mime = 'application/pdf'; }
      else { bytes = await InocuidadREPL164.generarXLSX(gs, mes); if (obs.length) bytes = await inocAnexoXLSX(bytes, obs, mes); ext = 'xlsx'; mime = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'; }
      const nom = 'RE-PL-164_Control_Entradas_Salidas_' + (gs.length === 1 ? gs[0].titulo.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '_').toUpperCase() : 'TODOS_LOS_CAMPOS') + '_' + $m.value + '.' + ext;
      descargar(nom, bytes, mime); toast('Formato generado: ' + nom);
      msg.textContent = `Listo: ${ext === 'pdf' ? 'PDF' : 'Excel'} con ${sum(gs, g => g.registros.length)} registro(s)${obs.length ? ' y ' + obs.length + ' observación(es)' : ''}.`;
    } catch (e) { console.error(e); msg.textContent = 'No se pudo generar: ' + (e.message || e); } finally { btn.disabled = false; btn.textContent = txt; info(); }
  };
  $c.onchange = $m.onchange = info; $('#inPdf', el).onclick = () => ejecutar('pdf'); $('#inXls', el).onclick = () => ejecutar('xlsx'); info();
}
