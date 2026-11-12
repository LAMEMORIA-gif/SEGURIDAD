// ============================================================================
// INVITACIONES Y PASES QR (visitas agendadas, proveedores recurrentes y transporte de personal regional)
// Misma lógica que el panel de control de acceso (CONTROL-ACCESO/panel.html), integrada al ERP.
// Comparte la clave, el historial y el catálogo de unidades con ese panel cuando se usa en el mismo navegador
// (mismas llaves de almacenamiento) y los respalda dentro del respaldo completo del ERP.
// ============================================================================
const QR_VISITA_URL = 'https://lamemoria-gif.github.io/CONTROL-ACCESO/visita.html';
const MOTIVO_TRANSPORTE_REGIONAL = 'Transporte de personal regional';
const QR_EMITIDOS_KEY = 'control_acceso_panel_invitaciones_v1';
const QR_UNIDADES_KEY = 'control_acceso_panel_unidades_v1';
const QR_LLAVES_LS = ['control_acceso_qr_clave_v1', QR_EMITIDOS_KEY, QR_UNIDADES_KEY];
let QR_ABIERTO = false, qrUltimo = null; // qrUltimo = {codigo, link, mensaje, telefono, lineas}

function qrEspejar() { // copia en la base del ERP lo guardado en el navegador, para que entre en el respaldo completo
  try { const o = {}; QR_LLAVES_LS.forEach(k => { const v = localStorage.getItem(k); if (v != null) o[k] = v; }); if (!Object.keys(o).length) return;
    if (JSON.stringify(cfgGet('qr_invitaciones', null)) !== JSON.stringify(o)) cfgSet('qr_invitaciones', o); } catch (e) { }
}
function qrRestaurar() { // si el navegador perdió la clave/historial pero el respaldo del ERP los tiene, se recuperan
  try { const o = cfgGet('qr_invitaciones', null); if (o) QR_LLAVES_LS.forEach(k => { if (localStorage.getItem(k) == null && o[k] != null) localStorage.setItem(k, o[k]); }); } catch (e) { }
}

function cardInvitacionesQR() {
  if (!puedeEditar()) return ''; // la clave de las casetas solo la maneja admin/supervisor
  return `<div class="qrp">
<div class="qrp-panel" id="panelQR">
    <div class="qrp-head" id="panelQRHead">
      <h2>📲 Invitaciones y pases QR <span class="qrp-new">NUEVO</span></h2>
      <div style="display:flex;align-items:center;gap:10px;">
        <span class="hint" id="qrHint">0 emitidos</span>
        <span class="chev">▾</span>
      </div>
    </div>
    <div class="qrp-body">
      <div class="qrp-form">
        <div class="qrp-sub">1 · Clave compartida con las casetas</div>
        <div class="f-full" style="color:var(--tx2);font-size:12.5px;">
          La clave firma cada invitación para que nadie pueda inventar un QR. Debe ser la misma aquí y en la app de
          cada caseta. Configure las casetas una sola vez escaneando el "QR de configuración" desde la app del guardia
          (sección "🔑 QR de visitas"). Muéstrelo solo a los guardias. Si cambia la clave, los QR emitidos antes dejan de valer.
        </div>
        <div class="f-half">
          <label class="req">Clave</label>
          <input type="text" id="qrClave" placeholder="Genere una o escriba una de al menos 8 caracteres" autocomplete="off">
        </div>
        <div class="f-half" style="display:flex;gap:8px;align-items:flex-end;flex-wrap:wrap;">
          <button type="button" class="btn" id="btnQRGuardarClave">Guardar clave</button>
          <button type="button" class="btn sec" id="btnQRClaveNueva">Generar clave nueva</button>
          <button type="button" class="btn sec" id="btnQRMostrarClave">Mostrar QR de configuración</button>
        </div>
        <div class="f-full"><div class="fmsg" id="qrClaveMsg"></div></div>
        <div class="f-full qr-box hidden" id="qrClaveBox">
          <canvas id="qrClaveCanvas"></canvas>
          <div class="qr-box-txt"><b>QR de configuración de caseta</b><br>Desde la app del guardia: "🔑 QR de visitas" → "Escanear QR de configuración". No lo comparta con visitantes.</div>
        </div>

        <div class="qrp-sub">2 · Nueva invitación o pase</div>
        <div class="f-half">
          <label class="req">Tipo</label>
          <select id="qrTipo">
            <option value="U">Visita / reunión agendada — un solo uso</option>
            <option value="F">Pase frecuente — proveedor o contratista recurrente</option>
          </select>
        </div>
        <div>
          <label>Campo / caseta</label>
          <select id="qrCampo"><option value="">Cualquier campo</option>${CAMPOS_LM.nombres.map(c=>`<option>${c}</option>`).join('')}</select>
        </div>
        <div>
          <label class="req">Motivo</label>
          <select id="qrMotivo">
            <option value="Reunión">Reunión</option>
            <option value="Entrega de material">Entrega de material</option>
            <option value="Mantenimiento">Mantenimiento</option>
            <option value="Transporte de personal regional">Transporte de personal regional</option>
            <option value="Otro">Otro</option>
          </select>
        </div>
        <div class="qr-solo-TR qr-oculto">
          <label class="req">N° económico de la unidad</label>
          <input type="text" id="qrEconomico" list="dlUnidadesQR" placeholder="Ej. G233" autocapitalize="characters" autocomplete="off">
          <datalist id="dlUnidadesQR"></datalist>
        </div>
        <div class="f-full qr-solo-TR qr-oculto qr-unidad-box">
          <div class="qr-unidad-head">🚌 Características de la unidad <span id="qrUnidadEstado" class="qr-pill off">Unidad nueva — se guardará en el catálogo</span></div>
          <div class="qr-unidad-grid">
            <div>
              <label class="req">Tipo de unidad</label>
              <select id="qrUniTipo">
                <option value="">— Seleccionar —</option>
                <option value="Autobús">Autobús</option>
                <option value="Microbús">Microbús</option>
                <option value="Camioneta / Van">Camioneta / Van</option>
                <option value="Camión de redilas">Camión de redilas</option>
                <option value="Otro">Otro</option>
              </select>
            </div>
            <div><label class="req">Marca</label><input type="text" id="qrUniMarca" placeholder="Ej. Mercedes-Benz"></div>
            <div><label>Modelo / línea</label><input type="text" id="qrUniModelo" placeholder="Ej. Boxer OF-1724"></div>
            <div><label>Año</label><input type="number" id="qrUniAnio" min="1980" max="2100" step="1" placeholder="Ej. 2019"></div>
            <div><label class="req">Color</label><input type="text" id="qrUniColor" placeholder="Ej. Blanco con franja verde"></div>
            <div><label class="req">Placas</label><input type="text" id="qrUniPlacas" placeholder="Ej. VS-1234-A" autocapitalize="characters"></div>
            <div><label>Capacidad (pasajeros)</label><input type="number" id="qrUniCapacidad" min="1" step="1" placeholder="Ej. 45"></div>
            <div><label>N° de serie (VIN)</label><input type="text" id="qrUniSerie" placeholder="Opcional" autocapitalize="characters"></div>
            <div><label>Póliza de seguro vence</label><input type="date" id="qrUniPoliza"></div>
            <div class="qr-unidad-span2"><label>Señas particulares</label><input type="text" id="qrUniSenas" placeholder="Ej. Logotipo de la empresa en costados, rótulo 'Personal'"></div>
          </div>
          <div style="color:var(--tx2);font-size:12px;margin-top:8px;">
            Pase de unidad <b>permanente con fecha de caducidad</b>: vale todos los días hasta la fecha "Vigente hasta". Si la póliza vence antes, el pase caduca ese día.
          </div>
        </div>
        <div class="f-half">
          <label class="req">Área y/o persona a la que visita</label>
          <input type="text" id="qrArea" placeholder="Ej. Oficina RH — Lic. Pérez">
        </div>
        <div>
          <label>Quién autoriza</label>
          <input type="text" id="qrAnfitrion" placeholder="Ej. Ing. Ramírez">
        </div>
        <div>
          <label class="req">Tipo de persona</label>
          <select id="qrTipoPersona">
            <option value="Visitante">Visitante</option>
            <option value="Proveedor">Proveedor</option>
            <option value="Contratista">Contratista</option>
            <option value="Otro">Otro</option>
          </select>
        </div>
        <div class="f-half">
          <label id="qrNombreLbl">Nombre del visitante (si lo sabe)</label>
          <input type="text" id="qrNombre" placeholder="Nombre completo">
        </div>
        <div class="f-half">
          <label>Empresa de procedencia</label>
          <input type="text" id="qrEmpresa" placeholder="Ej. Transportes del Norte S.A.">
        </div>
        <div class="qr-solo-F qr-solo-F-noTR">
          <label>Placas de vehículo</label>
          <input type="text" id="qrPlacas" placeholder="Ej. ABC-123-45">
        </div>
        <div class="qr-solo-F">
          <label>Tipo de identificación</label>
          <select id="qrTipoID">
            <option value="">— Seleccionar —</option>
            <option value="INE">INE</option>
            <option value="Licencia">Licencia de conducir</option>
            <option value="Carnet de empresa">Carnet de empresa</option>
            <option value="Pasaporte">Pasaporte</option>
            <option value="Otro">Otro</option>
          </select>
        </div>
        <div>
          <label>WhatsApp del visitante</label>
          <input type="text" id="qrTelefono" placeholder="10 dígitos (opcional)">
        </div>
        <div>
          <label>N° de acompañantes</label>
          <input type="number" id="qrAcompanantes" min="0" step="1" value="0">
        </div>

        <div class="qr-solo-U">
          <label class="req">Fecha de la visita</label>
          <input type="date" id="qrFecha">
        </div>
        <div class="qr-solo-U">
          <label>Hora de la cita</label>
          <input type="time" id="qrHora">
        </div>
        <div class="qr-solo-U f-half" style="color:var(--tx2);font-size:12px;align-self:end;">
          Con hora de cita, el QR vale desde 1 h antes hasta 3 h después. Se usa una sola vez.
        </div>

        <div class="qr-solo-F">
          <label class="req">Vigente desde</label>
          <input type="date" id="qrDesde">
        </div>
        <div class="qr-solo-F">
          <label class="req">Vigente hasta</label>
          <input type="date" id="qrHasta">
        </div>
        <div class="qr-solo-F">
          <label>Horario desde</label>
          <input type="time" id="qrHoraIni">
        </div>
        <div class="qr-solo-F">
          <label>Horario hasta</label>
          <input type="time" id="qrHoraFin">
        </div>
        <div class="qr-solo-F f-full">
          <label>Días permitidos</label>
          <div class="qr-dias" id="qrDias">
            <label><input type="checkbox" value="1" checked> Lun</label>
            <label><input type="checkbox" value="2" checked> Mar</label>
            <label><input type="checkbox" value="3" checked> Mié</label>
            <label><input type="checkbox" value="4" checked> Jue</label>
            <label><input type="checkbox" value="5" checked> Vie</label>
            <label><input type="checkbox" value="6" checked> Sáb</label>
            <label><input type="checkbox" value="7"> Dom</label>
          </div>
        </div>

        <div class="actions">
          <button type="button" class="btn" id="btnQRCrear">📲 Crear invitación</button>
          <button type="button" class="btn sec" id="btnQRLimpiar">Limpiar</button>
        </div>
        <div class="f-full"><div class="fmsg" id="qrCrearMsg"></div></div>

        <div class="f-full qr-box hidden" id="qrResultado">
          <canvas id="qrResultadoCanvas"></canvas>
          <div class="qr-box-txt">
            <div id="qrResultadoTxt" style="margin-bottom:10px;"></div>
            <input type="text" id="qrResultadoLink" readonly style="width:100%;margin-bottom:10px;font-family:'IBM Plex Mono',monospace;font-size:12px;">
            <div style="display:flex;gap:8px;flex-wrap:wrap;">
              <button type="button" class="btn" id="btnQRWhatsApp">Enviar por WhatsApp</button>
              <button type="button" class="btn sec" id="btnQRCopiar">Copiar enlace</button>
              <button type="button" class="btn sec" id="btnQRDescargar">Descargar imagen del QR</button>
            </div>
          </div>
        </div>

        <div class="qrp-sub">3 · Proveedores recurrentes — últimos 30 días</div>
        <div class="f-full" style="color:var(--tx2);font-size:12.5px;">
          Personas que entraron 3 días o más en el último mes, según los registros importados. "Crear pase" llena el
          formulario de arriba con sus datos para darles un pase frecuente y evitar el registro manual en cada llegada.
        </div>
        <div class="f-full tabla-w sinmax">
          <table class="tabla">
            <thead><tr><th>Nombre</th><th>Empresa</th><th>Días con ingreso</th><th>Campo más visitado</th><th>Último ingreso</th><th></th></tr></thead>
            <tbody id="qrRecurrentes"></tbody>
          </table>
        </div>

        <div class="qrp-sub">4 · Catálogo de unidades de transporte de personal regional</div>
        <div class="f-full" style="color:var(--tx2);font-size:12.5px;">
          Cada unidad capturada se guarda aquí con sus características. Al escribir su N° económico en el formulario se llenan solos todos sus datos.
          También se agregan las unidades que llegan en los registros importados de las casetas.
        </div>
        <div class="f-full tabla-w sinmax">
          <table class="tabla">
            <thead><tr><th>N° económico</th><th>Unidad</th><th>Color</th><th>Placas</th><th>Capacidad</th><th>Empresa / chofer</th><th>Pase vigente hasta</th><th></th></tr></thead>
            <tbody id="qrUnidades"></tbody>
          </table>
        </div>

        <div class="qrp-sub">5 · Invitaciones y pases emitidos desde este navegador</div>
        <div class="f-full tabla-w sinmax">
          <table class="tabla">
            <thead><tr><th>Emitido</th><th>Tipo</th><th>Nombre</th><th>Área / persona</th><th>Campo</th><th>Vigencia</th><th>Uso en caseta</th><th></th></tr></thead>
            <tbody id="qrEmitidos"></tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</div>`;
}

function bindInvitacionesQR(el) {
  if (!document.getElementById('panelQR')) return;
  const QA = window.QRAcceso; if (!QA) return;
  qrRestaurar();
  const dateKeyLocal = ts => { const d = new Date(ts); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  const QR_EMITIDOS_KEY = 'control_acceso_panel_invitaciones_v1';

  function qrLoadEmitidos(){ try{ const d = JSON.parse(localStorage.getItem(QR_EMITIDOS_KEY)||'[]'); return Array.isArray(d)?d:[]; }catch(e){ return []; } }
  function qrSaveEmitidos(arr){ try{ localStorage.setItem(QR_EMITIDOS_KEY, JSON.stringify(arr)); }catch(e){} qrEspejar(); }
  function qrMsg(id, txt, ok){ const el = document.getElementById(id); el.textContent = txt; el.className = 'fmsg '+(ok?'ok':'err'); }
  function qrSumarDias(iso, n){ const [y,m,d] = iso.split('-').map(Number); return QA.hoyISO(new Date(y, m-1, d+n)); }
  function qrHHMM(min){ min = Math.max(0, Math.min(23*60+59, min)); return String(Math.floor(min/60)).padStart(2,'0')+':'+String(min%60).padStart(2,'0'); }
  function qrUrlVisita(hash){ return QR_VISITA_URL+'#'+hash; }

  if(QR_ABIERTO) document.getElementById('panelQR').classList.add('open');
  document.getElementById('panelQRHead').addEventListener('click', ()=>{ QR_ABIERTO = document.getElementById('panelQR').classList.toggle('open'); });

  // --- clave compartida ---
  document.getElementById('qrClave').value = QA.leerClave();
  document.getElementById('btnQRClaveNueva').addEventListener('click', function(){
    if(QA.leerClave() && !confirm('Si cambia la clave, todos los QR emitidos antes dejarán de valer en las casetas que tengan la clave nueva. ¿Continuar?')) return;
    document.getElementById('qrClave').value = QA.claveNueva();
    qrMsg('qrClaveMsg', 'Clave generada. Toque "Guardar clave" y luego configure cada caseta con el QR de configuración.', true);
  });
  document.getElementById('btnQRGuardarClave').addEventListener('click', function(){
    const c = document.getElementById('qrClave').value.trim();
    if(c.length < 8){ qrMsg('qrClaveMsg', 'La clave debe tener al menos 8 caracteres.', false); return; }
    QA.guardarClave(c); qrEspejar();
    qrMsg('qrClaveMsg', 'Clave guardada en este navegador. Recuerde configurarla igual en cada caseta.', true);
  });
  document.getElementById('btnQRMostrarClave').addEventListener('click', function(){
    const c = document.getElementById('qrClave').value.trim() || QA.leerClave();
    if(c.length < 8){ qrMsg('qrClaveMsg', 'Primero genere o escriba una clave y guárdela.', false); return; }
    const box = document.getElementById('qrClaveBox');
    if(!box.classList.contains('hidden')){ box.classList.add('hidden'); return; }
    QA.dibujarQR(document.getElementById('qrClaveCanvas'), QA.codigoClave(c), 440);
    box.classList.remove('hidden');
  });

  // --- formulario ---
  function qrAplicarTipo(){
    const t = document.getElementById('qrTipo').value;
    document.querySelectorAll('.qr-solo-U').forEach(el=>el.classList.toggle('qr-oculto', t!=='U'));
    document.querySelectorAll('.qr-solo-F').forEach(el=>el.classList.toggle('qr-oculto', t!=='F'));
    const lbl = document.getElementById('qrNombreLbl');
    lbl.textContent = t==='F' ? 'Nombre del proveedor / contratista' : 'Nombre del visitante (si lo sabe)';
    lbl.className = t==='F' ? 'req' : '';
    document.getElementById('btnQRCrear').textContent = t==='F' ? '📲 Crear pase frecuente' : '📲 Crear invitación';
    if(t==='F' && !document.getElementById('qrDesde').value){
      document.getElementById('qrDesde').value = QA.hoyISO();
      document.getElementById('qrHasta').value = qrSumarDias(QA.hoyISO(), 90);
    }
    if(t==='U' && !document.getElementById('qrFecha').value) document.getElementById('qrFecha').value = QA.hoyISO();
  }
  document.getElementById('qrTipo').addEventListener('change', ()=>{ qrAplicarTipo(); qrAplicarMotivo(); });
  function qrAplicarMotivo(){
    const esTR = document.getElementById('qrMotivo').value===MOTIVO_TRANSPORTE_REGIONAL;
    document.querySelectorAll('.qr-solo-TR').forEach(el=>el.classList.toggle('qr-oculto', !esTR));
    // la unidad de transporte siempre lleva pase permanente con fecha de caducidad (no visita de un solo uso)
    const selTipo = document.getElementById('qrTipo');
    selTipo.querySelector('option[value="U"]').disabled = esTR;
    if(esTR){
      if(selTipo.value!=='F'){ selTipo.value = 'F'; }
      qrAplicarTipo();
      if(document.getElementById('qrTipoPersona').value==='Visitante') document.getElementById('qrTipoPersona').value = 'Contratista';
      if(!qrAplicarMotivo._diasPuestos){ document.querySelectorAll('#qrDias input').forEach(cb=>cb.checked = true); qrAplicarMotivo._diasPuestos = true; }
      if(document.getElementById('qrHasta').value===qrSumarDias(document.getElementById('qrDesde').value||QA.hoyISO(), 90)) document.getElementById('qrHasta').value = qrSumarDias(document.getElementById('qrDesde').value||QA.hoyISO(), 365);
      document.querySelectorAll('.qr-solo-F-noTR').forEach(el=>el.classList.add('qr-oculto'));
      document.getElementById('btnQRCrear').textContent = '🚌 Crear pase de unidad';
    } else {
      qrAplicarMotivo._diasPuestos = false;
      document.querySelectorAll('.qr-solo-F-noTR').forEach(el=>el.classList.toggle('qr-oculto', selTipo.value!=='F'));
    }
  }
  document.getElementById('qrMotivo').addEventListener('change', qrAplicarMotivo);
  function qrNormEco(t){ return String(t||'').trim().toUpperCase().replace(/\s+/g,''); }

  // ---------- catálogo de unidades de transporte (evita volver a capturar sus datos) ----------
  const QR_UNIDADES_KEY = 'control_acceso_panel_unidades_v1';
  const UNI_CAMPOS = [['tv','qrUniTipo'],['ma','qrUniMarca'],['mo','qrUniModelo'],['an','qrUniAnio'],['co','qrUniColor'],['pl','qrUniPlacas'],['cap','qrUniCapacidad'],['vin','qrUniSerie'],['pol','qrUniPoliza'],['se','qrUniSenas']];
  function qrLoadUnidades(){ try{ const d = JSON.parse(localStorage.getItem(QR_UNIDADES_KEY)||'{}'); return (d && typeof d==='object' && !Array.isArray(d)) ? d : {}; }catch(e){ return {}; } }
  function qrSaveUnidades(o){ try{ localStorage.setItem(QR_UNIDADES_KEY, JSON.stringify(o)); }catch(e){} qrEspejar(); }
  function qrLeerUnidadForm(){
    const u = {};
    UNI_CAMPOS.forEach(([k,id])=>{ let val = document.getElementById(id).value.trim(); if(k==='pl'||k==='vin') val = val.toUpperCase(); if(val) u[k] = val; });
    return u;
  }
  function qrDescUnidad(u){ return [u.tv, u.ma, u.mo, u.an].filter(Boolean).join(' '); }
  function qrLlenarUnidadForm(u, soloVacios){
    UNI_CAMPOS.forEach(([k,id])=>{ const el = document.getElementById(id); if(u[k]!=null && (!soloVacios || !el.value)) el.value = u[k]; });
  }
  function qrLimpiarUnidadForm(){ UNI_CAMPOS.forEach(([k,id])=>document.getElementById(id).value=''); }
  function qrBuscarUnidad(){
    const ne = qrNormEco(document.getElementById('qrEconomico').value);
    const est = document.getElementById('qrUnidadEstado');
    const u = ne ? qrLoadUnidades()[ne] : null;
    if(u){
      qrLlenarUnidadForm(u, false);
      if(u.empresa && !document.getElementById('qrEmpresa').value) document.getElementById('qrEmpresa').value = u.empresa;
      if(u.chofer && !document.getElementById('qrNombre').value) document.getElementById('qrNombre').value = u.chofer;
      est.textContent = '✅ Unidad del catálogo — datos cargados (actualizados el '+fmtFecha(u.act)+')'; est.className = 'qr-pill ok';
    } else {
      est.textContent = ne ? 'Unidad nueva — se guardará en el catálogo' : 'Escriba el N° económico'; est.className = 'qr-pill off';
    }
  }
  document.getElementById('qrEconomico').addEventListener('change', qrBuscarUnidad);
  document.getElementById('qrEconomico').addEventListener('input', function(){ if(qrLoadUnidades()[qrNormEco(this.value)]) qrBuscarUnidad(); else { const est = document.getElementById('qrUnidadEstado'); est.textContent = this.value.trim() ? 'Unidad nueva — se guardará en el catálogo' : 'Escriba el N° económico'; est.className = 'qr-pill off'; } });
  // agrega al catálogo las unidades que llegan en los registros importados de las casetas
  function qrSembrarUnidadesDeRegistros(){
    const cat = qrLoadUnidades(); let cambio = false;
    DATA.accesos.filter(a=>a.numEconomico).sort((x,y)=>x.horaIngreso-y.horaIngreso).forEach(a=>{
      const ne = qrNormEco(a.numEconomico);
      const prev = cat[ne];
      if(prev && prev.act >= a.horaIngreso) return;
      const u = Object.assign({}, prev||{}, a.unidad||{});
      if(!u.pl && a.placas) u.pl = a.placas.toUpperCase();
      if(a.empresaProcedencia) u.empresa = a.empresaProcedencia;
      if(a.nombre) u.chofer = a.nombre;
      u.ne = ne; u.act = a.horaIngreso;
      if(JSON.stringify(u)!==JSON.stringify(prev)){ cat[ne] = u; cambio = true; }
    });
    if(cambio) qrSaveUnidades(cat);
  }
  function qrPaseVigenteUnidad(ne){
    const hoy = QA.hoyISO();
    return qrLoadEmitidos().filter(e=>e.t==='F' && e.ne===ne && e.ff>=hoy).map(e=>e.ff).sort().pop() || '';
  }
  function qrDiasHasta(iso){ const [y,m,d] = iso.split('-').map(Number); const h = new Date(); h.setHours(0,0,0,0); return Math.round((new Date(y,m-1,d)-h)/86400000); }
  function qrRenderUnidades(){
    const cat = qrLoadUnidades();
    const lista = Object.values(cat).sort((a,b)=>a.ne.localeCompare(b.ne, 'es', {numeric:true}));
    document.getElementById('dlUnidadesQR').innerHTML = lista.map(u=>`<option value="${QA.esc(u.ne)}">${QA.esc(qrDescUnidad(u)+(u.co?(' · '+u.co):''))}</option>`).join('');
    const tb = document.getElementById('qrUnidades');
    if(!lista.length){ tb.innerHTML = '<tr><td colspan="8" style="color:var(--tx2);">Aún no hay unidades. Se agregan solas al crear un pase de transporte de personal regional.</td></tr>'; return; }
    tb.innerHTML = lista.map(u=>{
      const vig = qrPaseVigenteUnidad(u.ne);
      let pill = '<span class="qr-pill off">Sin pase vigente</span>';
      if(vig){ const d = qrDiasHasta(vig); pill = `<span class="qr-pill ${d<=15?'warn':'ok'}">${QA.fechaLarga(vig)}${d<=15?(' · vence en '+d+' día'+(d===1?'':'s')):''}</span>`; }
      let pol = '';
      if(u.pol){ const d = qrDiasHasta(u.pol); if(d<=30) pol = `<br><span class="qr-pill ${d<0?'':'warn'}" style="${d<0?'color:var(--mal);border-color:var(--mal);':''}">Póliza ${d<0?'vencida':'vence en '+d+' días'}</span>`; }
      return `<tr>
        <td class="mono"><b>🚌 ${QA.esc(u.ne)}</b></td>
        <td>${QA.esc(qrDescUnidad(u)||'—')}${u.se?('<br><span style="color:var(--tx2);font-size:12px;">'+QA.esc(u.se)+'</span>'):''}</td>
        <td>${QA.esc(u.co||'—')}</td><td class="mono">${QA.esc(u.pl||'—')}</td><td>${u.cap?QA.esc(u.cap)+' pas.':'—'}</td>
        <td>${QA.esc(u.empresa||'—')}${u.chofer?('<br><span style="color:var(--tx2);font-size:12px;">'+QA.esc(u.chofer)+'</span>'):''}</td>
        <td>${pill}${pol}</td>
        <td style="white-space:nowrap;"><button type="button" class="mini btn-uni-pase" data-ne="${QA.esc(u.ne)}">${vig?'Renovar pase':'Crear pase'}</button> <button type="button" class="mini btn-uni-quitar" data-ne="${QA.esc(u.ne)}" title="Quitar del catálogo">✕</button></td>
      </tr>`;
    }).join('');
  }
  document.getElementById('qrUnidades').addEventListener('click', function(e){
    const bq = e.target.closest('.btn-uni-quitar');
    if(bq){ if(!confirm('¿Quitar la unidad '+bq.dataset.ne+' del catálogo? (Los pases ya emitidos siguen valiendo hasta que caduquen.)')) return; const c = qrLoadUnidades(); delete c[bq.dataset.ne]; qrSaveUnidades(c); qrRenderUnidades(); return; }
    const bp = e.target.closest('.btn-uni-pase'); if(!bp) return;
    qrLimpiar();
    document.getElementById('qrMotivo').value = MOTIVO_TRANSPORTE_REGIONAL; qrAplicarMotivo();
    document.getElementById('qrEconomico').value = bp.dataset.ne; qrBuscarUnidad();
    const u = qrLoadUnidades()[bp.dataset.ne] || {};
    if(u.area) document.getElementById('qrArea').value = u.area;
    if(u.campo) document.getElementById('qrCampo').value = CAMPOS_LM.oficial(u.campo) || '';
    if(u.anfitrion) document.getElementById('qrAnfitrion').value = u.anfitrion;
    qrMsg('qrCrearMsg', 'Unidad '+bp.dataset.ne+' cargada del catálogo. Revise el chofer y la vigencia, y toque "Crear pase de unidad".', true);
    document.getElementById('qrTipo').scrollIntoView({behavior:'smooth', block:'center'});
  });
  function qrLimpiar(){
    ['qrCampo','qrArea','qrAnfitrion','qrNombre','qrEmpresa','qrPlacas','qrTelefono','qrHora','qrHoraIni','qrHoraFin','qrFecha','qrDesde','qrHasta','qrEconomico'].forEach(id=>document.getElementById(id).value='');
    document.getElementById('qrMotivo').value = 'Reunión';
    qrLimpiarUnidadForm(); qrBuscarUnidad();
    document.getElementById('qrTipoID').value = '';
    document.getElementById('qrAcompanantes').value = '0';
    document.querySelectorAll('#qrDias input').forEach(cb=>cb.checked = cb.value!=='7');
    document.getElementById('qrResultado').classList.add('hidden');
    document.getElementById('qrCrearMsg').className = 'fmsg';
    qrAplicarTipo(); qrAplicarMotivo();
  }
  document.getElementById('btnQRLimpiar').addEventListener('click', qrLimpiar);

  document.getElementById('btnQRCrear').addEventListener('click', async function(){
    const clave = QA.leerClave();
    if(!clave){ qrMsg('qrCrearMsg', 'Primero guarde la clave compartida (paso 1).', false); return; }
    const v = id => document.getElementById(id).value.trim();
    const t = v('qrTipo');
    const datos = {
      v:1, id:'inv_'+Date.now().toString(36)+Math.random().toString(36).slice(2,6), t,
      c:v('qrCampo'), a:v('qrArea'), h:v('qrAnfitrion'), m:v('qrMotivo'), tp:v('qrTipoPersona'),
      n:v('qrNombre'), e:v('qrEmpresa'), ac: parseInt(v('qrAcompanantes'),10)||0, emi: Date.now()
    };
    if(!datos.ac) delete datos.ac;
    let unidad = null;
    if(datos.m===MOTIVO_TRANSPORTE_REGIONAL){
      datos.ne = qrNormEco(v('qrEconomico'));
      if(!datos.ne){ qrMsg('qrCrearMsg', 'Escriba el N° económico de la unidad de transporte.', false); return; }
      unidad = qrLeerUnidadForm();
      const faltan = [['tv','tipo de unidad'],['ma','marca'],['co','color'],['pl','placas']].filter(([k])=>!unidad[k]).map(x=>x[1]);
      if(faltan.length){ qrMsg('qrCrearMsg', 'Complete las características de la unidad: '+faltan.join(', ')+'.', false); return; }
      if(unidad.pol && unidad.pol < QA.hoyISO()){ qrMsg('qrCrearMsg', 'La póliza de seguro de la unidad ya venció ('+QA.fechaLarga(unidad.pol)+'). Actualícela antes de emitir el pase.', false); return; }
      if(t!=='F'){ qrMsg('qrCrearMsg', 'El transporte de personal regional usa pase permanente con fecha de caducidad.', false); return; }
      // en el QR viaja la ficha de la unidad (sin N° de serie para que el código no crezca)
      datos.u = {tv:unidad.tv, ma:unidad.ma, mo:unidad.mo, an:unidad.an, co:unidad.co, cap:unidad.cap, se:unidad.se, pol:unidad.pol};
      Object.keys(datos.u).forEach(k=>{ if(!datos.u[k]) delete datos.u[k]; });
    }
    if(!datos.a){ qrMsg('qrCrearMsg', 'Escriba el área y/o persona a la que visita.', false); return; }
    if(t==='U'){
      datos.f = v('qrFecha');
      if(!datos.f){ qrMsg('qrCrearMsg', 'Elija la fecha de la visita.', false); return; }
      if(datos.f < QA.hoyISO()){ qrMsg('qrCrearMsg', 'La fecha de la visita ya pasó.', false); return; }
      const hc = v('qrHora');
      if(hc){ const m = QA.minutosDe(hc); datos.hc = hc; datos.hi = qrHHMM(m-60); datos.hf = qrHHMM(m+180); }
    } else {
      datos.p = unidad ? unidad.pl : v('qrPlacas'); datos.ti = v('qrTipoID');
      datos.fi = v('qrDesde'); datos.ff = v('qrHasta');
      if(unidad && unidad.pol && datos.ff && unidad.pol < datos.ff){ datos.ff = unidad.pol; document.getElementById('qrHasta').value = unidad.pol; }
      datos.hi = v('qrHoraIni'); datos.hf = v('qrHoraFin');
      datos.dw = Array.from(document.querySelectorAll('#qrDias input:checked')).map(cb=>cb.value).join('');
      if(!datos.n){ qrMsg('qrCrearMsg', 'Escriba el nombre del proveedor o contratista.', false); return; }
      if(!datos.fi || !datos.ff || datos.ff < datos.fi){ qrMsg('qrCrearMsg', 'Revise las fechas de vigencia del pase.', false); return; }
      if(!datos.dw){ qrMsg('qrCrearMsg', 'Marque al menos un día permitido.', false); return; }
    }
    let firmado;
    try{ firmado = await QA.crearInvitacion(clave, datos); }
    catch(e){ qrMsg('qrCrearMsg', 'No se pudo firmar la invitación: '+e.message, false); return; }

    const lugar = 'Rancho Agrícola La Memoria'+(datos.c?(' — '+datos.c):'');
    const saludo = 'Hola'+(datos.n?(' '+datos.n):'')+'. ';
    const unidadTxt = datos.ne ? (' de la unidad N° económico '+datos.ne+' ('+[qrDescUnidad(datos.u||{}), (datos.u||{}).co, 'placas '+datos.p].filter(Boolean).join(', ')+')') : '';
    let codigo = null, link, mensaje, lineas;
    if(t==='U'){
      link = qrUrlVisita('i='+firmado.base);
      mensaje = saludo+'Tiene una visita agendada'+unidadTxt+' en '+lugar+' el '+QA.fechaLarga(datos.f)+(datos.hc?(' a las '+datos.hc):'')+
        ' con '+datos.a+'. Antes de llegar, llene sus datos en este enlace y genere su código QR: '+link+
        ' — Muéstrelo en caseta junto con su identificación oficial.';
      lineas = ['Invitación — '+lugar, (datos.n||'Visitante')+' · '+QA.fechaLarga(datos.f)];
      if(datos.ne) lineas.push('Transporte de personal regional · Unidad '+datos.ne);
    } else {
      codigo = QA.codigoCompleto(firmado.base, null);
      link = qrUrlVisita('q='+codigo);
      mensaje = saludo+'Este es su pase de acceso frecuente'+unidadTxt+' a '+lugar+', vigente del '+QA.fechaLarga(datos.fi)+' al '+QA.fechaLarga(datos.ff)+
        ' ('+QA.textoDias(datos.dw)+(datos.hi||datos.hf?(', '+(datos.hi||'')+'–'+(datos.hf||'')):'')+'). Abra el enlace y guarde el código QR: '+link+
        ' — Muéstrelo en caseta junto con su identificación oficial.';
      lineas = ['Pase frecuente — '+lugar, datos.n+(datos.e?(' · '+datos.e):''), 'Vigente al '+QA.fechaLarga(datos.ff)];
      if(datos.ne) lineas.splice(2, 0, 'Unidad '+datos.ne+' · '+[qrDescUnidad(datos.u||{}), (datos.u||{}).co, datos.p].filter(Boolean).join(' · '));
    }
    qrUltimo = {codigo: codigo || null, link, mensaje, telefono: v('qrTelefono'), lineas, qrTexto: codigo || link};
    // QR: el pase frecuente muestra el código de acceso; la invitación muestra el enlace al formato de prellenado
    QA.dibujarQR(document.getElementById('qrResultadoCanvas'), qrUltimo.qrTexto, 440);
    document.getElementById('qrResultadoTxt').innerHTML = t==='U'
      ? '<b>Invitación creada.</b> Envíe el enlace al visitante: ahí llena sus datos y genera su QR de acceso. Este QR de aquí abre el mismo enlace (útil si la invitación se entrega impresa).'
      : '<b>Pase frecuente creado.</b> Este QR ya es el de acceso: envíelo por WhatsApp o descárguelo e imprímalo para el proveedor.';
    document.getElementById('qrResultadoLink').value = link;
    document.getElementById('qrResultado').classList.remove('hidden');

    const emitidos = qrLoadEmitidos();
    emitidos.unshift({id:datos.id, t, nombre:datos.n||'', empresa:datos.e||'', ne:datos.ne||'', area:datos.a, campo:datos.c||'', f:datos.f||'', fi:datos.fi||'', ff:datos.ff||'', hc:datos.hc||'', link, codigo, emi:datos.emi});
    qrSaveEmitidos(emitidos.slice(0,500));
    if(unidad){
      const cat = qrLoadUnidades();
      cat[datos.ne] = Object.assign({}, cat[datos.ne]||{}, unidad, {ne:datos.ne, empresa:datos.e||'', chofer:datos.n||'', area:datos.a, campo:datos.c||'', anfitrion:datos.h||'', act:Date.now()});
      qrSaveUnidades(cat);
      qrBuscarUnidad();
    }
    qrMsg('qrCrearMsg', t==='U' ? 'Invitación lista para enviar.' : (datos.ne ? ('Pase de la unidad '+datos.ne+' listo para enviar — vigente hasta el '+QA.fechaLarga(datos.ff)+'. La unidad quedó guardada en el catálogo.') : 'Pase frecuente listo para enviar.'), true);
    qrRenderEmitidos(); qrRenderRecurrentes();
  });

  function qrNumeroWhats(tel){
    let d = String(tel||'').replace(/\D/g,'');
    if(d.length===10) d = '52'+d;
    return d;
  }
  document.getElementById('btnQRWhatsApp').addEventListener('click', function(){
    if(!qrUltimo) return;
    const num = qrNumeroWhats(qrUltimo.telefono);
    window.open('https://wa.me/'+(num||'')+'?text='+encodeURIComponent(qrUltimo.mensaje), '_blank');
  });
  document.getElementById('btnQRCopiar').addEventListener('click', async function(){
    if(!qrUltimo) return;
    try{ await navigator.clipboard.writeText(qrUltimo.mensaje); qrMsg('qrCrearMsg','Mensaje con enlace copiado — péguelo en WhatsApp o correo.', true); }
    catch(e){ const inp = document.getElementById('qrResultadoLink'); inp.select(); document.execCommand('copy'); qrMsg('qrCrearMsg','Enlace copiado.', true); }
  });
  function qrDescargarPNG(texto, lineas, nombreArchivo){
    const a = document.createElement('a');
    a.href = QA.imagenQRConTexto(texto, lineas);
    a.download = nombreArchivo;
    document.body.appendChild(a); a.click(); a.remove();
  }
  document.getElementById('btnQRDescargar').addEventListener('click', function(){
    if(!qrUltimo) return;
    const base = (qrUltimo.lineas[1]||'qr').normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^A-Za-z0-9]+/g,'_').slice(0,40);
    qrDescargarPNG(qrUltimo.qrTexto, qrUltimo.lineas, 'QR_'+base+'.png');
  });

  // --- proveedores recurrentes (últimos 30 días) ---
  function qrRecurrentes(){
    const desde = Date.now() - 30*86400000;
    const grupos = {};
    DATA.accesos.filter(a=>a.horaIngreso>=desde && a.nombre).forEach(a=>{
      const k = QA.normaliza(a.nombre)+'|'+qrNormEco(a.numEconomico);
      (grupos[k] = grupos[k] || []).push(a);
    });
    const moda = (arr, f) => { const m = {}; arr.forEach(x=>{ const v=f(x); if(v) m[v]=(m[v]||0)+1; }); return (Object.entries(m).sort((x,y)=>y[1]-x[1])[0]||[''])[0]; };
    return Object.values(grupos).map(regs=>{
      regs.sort((x,y)=>y.horaIngreso-x.horaIngreso);
      const dias = new Set(regs.map(a=>dateKeyLocal(a.horaIngreso)));
      const diasSemana = new Set(regs.map(a=>{ const d=new Date(a.horaIngreso).getDay(); return d===0?7:d; }));
      return {
        nombre: regs[0].nombre, ne: qrNormEco(regs[0].numEconomico), empresa: moda(regs, a=>a.empresaProcedencia), placas: moda(regs, a=>a.placas), tipoID: moda(regs, a=>a.tipoID),
        tipoPersona: moda(regs, a=>a.tipoPersona), motivo: moda(regs, a=>a.motivoVisita), area: moda(regs, a=>a.areaVisita), campo: moda(regs, a=>a.campo),
        dias: dias.size, ultimo: regs[0].horaIngreso, diasSemana: Array.from(diasSemana).sort().join('')
      };
    }).filter(r=>r.dias>=3).sort((x,y)=>y.dias-x.dias).slice(0,25);
  }
  let QR_RECURRENTES = [];
  function qrTienePaseVigente(nombre){
    const hoy = QA.hoyISO(); const k = QA.normaliza(nombre);
    return qrLoadEmitidos().some(e=>e.t==='F' && QA.normaliza(e.nombre)===k && e.ff>=hoy);
  }
  function qrRenderRecurrentes(){
    QR_RECURRENTES = qrRecurrentes();
    const tb = document.getElementById('qrRecurrentes');
    if(!QR_RECURRENTES.length){ tb.innerHTML = '<tr><td colspan="6" style="color:var(--tx2);">Aún no hay personas con 3 o más días de ingreso en los últimos 30 días (importe los registros de las casetas).</td></tr>'; return; }
    tb.innerHTML = QR_RECURRENTES.map((r,i)=>`<tr>
      <td>${QA.esc(r.nombre)}${r.ne?(' <span class="qr-pill">🚌 '+QA.esc(r.ne)+'</span>'):''}</td><td>${QA.esc(r.empresa||'—')}</td><td class="mono">${r.dias}</td><td>${QA.esc(r.campo||'—')}</td><td class="mono">${fmtFecha(r.ultimo)}</td>
      <td>${qrTienePaseVigente(r.nombre)?'<span class="qr-pill ok">Pase vigente</span> ':''}<button type="button" class="mini btn-qr-crear-pase" data-i="${i}">Crear pase</button></td>
    </tr>`).join('');
  }
  document.getElementById('qrRecurrentes').addEventListener('click', function(e){
    const b = e.target.closest('.btn-qr-crear-pase'); if(!b) return;
    const r = QR_RECURRENTES[+b.dataset.i]; if(!r) return;
    qrLimpiar();
    document.getElementById('qrTipo').value = 'F'; qrAplicarTipo();
    const set = (id,val)=>{ if(val) document.getElementById(id).value = val; };
    set('qrNombre', r.nombre); set('qrEmpresa', r.empresa); set('qrPlacas', r.placas); set('qrTipoID', r.tipoID);
    set('qrTipoPersona', r.tipoPersona); set('qrArea', r.area); set('qrCampo', CAMPOS_LM.oficial(r.campo) || r.campo);
    if(r.motivo && Array.from(document.getElementById('qrMotivo').options).some(o=>o.value===r.motivo)) document.getElementById('qrMotivo').value = r.motivo;
    qrAplicarMotivo(); set('qrEconomico', r.ne); if(r.ne) qrBuscarUnidad();
    document.querySelectorAll('#qrDias input').forEach(cb=>{ cb.checked = r.diasSemana.indexOf(cb.value)!==-1; });
    qrMsg('qrCrearMsg', 'Datos de '+r.nombre+' cargados. Revise vigencia, días y horario, y toque "Crear pase frecuente".', true);
    document.getElementById('qrTipo').scrollIntoView({behavior:'smooth', block:'center'});
  });

  // --- historial de emitidos ---
  function qrRenderEmitidos(){
    const lista = qrLoadEmitidos();
    document.getElementById('qrHint').textContent = lista.length+' emitido'+(lista.length===1?'':'s');
    const tb = document.getElementById('qrEmitidos');
    if(!lista.length){ tb.innerHTML = '<tr><td colspan="8" style="color:var(--tx2);">Aún no ha emitido invitaciones ni pases.</td></tr>'; return; }
    const hoy = QA.hoyISO();
    tb.innerHTML = lista.slice(0,100).map((e,i)=>{
      const usos = DATA.accesos.filter(a=>a.qrInvitacion===e.id);
      const vig = e.t==='U' ? (QA.fechaLarga(e.f)+(e.hc?(' '+e.hc):'')) : ('al '+QA.fechaLarga(e.ff));
      const vencido = e.t==='U' ? (e.f<hoy) : (e.ff<hoy);
      const uso = usos.length
        ? `<span class="qr-pill ok">${usos.length} ingreso${usos.length===1?'':'s'} · último ${fmtFecha(Math.max(...usos.map(a=>a.horaIngreso)))}</span>`
        : (vencido ? '<span class="qr-pill off">Vencido sin uso</span>' : '<span class="qr-pill">Pendiente</span>');
      return `<tr>
        <td class="mono">${fmtFecha(e.emi)}</td><td>${e.t==='U'?'Visita agendada':'Pase frecuente'}</td>
        <td>${QA.esc(e.nombre||'—')}${e.ne?(' <span class="qr-pill">🚌 '+QA.esc(e.ne)+'</span>'):''}${e.empresa?('<br><span style="color:var(--tx2);font-size:12px;">'+QA.esc(e.empresa)+'</span>'):''}</td>
        <td>${QA.esc(e.area)}</td><td>${QA.esc(e.campo||'Cualquiera')}</td><td>${vig}${(e.t==='F' && !vencido && qrDiasHasta(e.ff)<=15)?(' <span class="qr-pill warn">vence en '+qrDiasHasta(e.ff)+' d</span>'):''}</td><td>${uso}</td>
        <td style="white-space:nowrap;"><button type="button" class="mini btn-qr-ver" data-i="${i}">Ver QR</button> <button type="button" class="mini btn-qr-quitar" data-i="${i}" title="Quitar del historial">✕</button></td>
      </tr>`;
    }).join('');
  }
  document.getElementById('qrEmitidos').addEventListener('click', function(e){
    const lista = qrLoadEmitidos();
    const bq = e.target.closest('.btn-qr-quitar');
    if(bq){
      if(!confirm('¿Quitar del historial? (El QR sigue valiendo en caseta hasta que venza; para bloquearlo, agregue el nombre a la lista restringida de la caseta.)')) return;
      lista.splice(+bq.dataset.i,1); qrSaveEmitidos(lista); qrRenderEmitidos(); return;
    }
    const bv = e.target.closest('.btn-qr-ver'); if(!bv) return;
    const it = lista[+bv.dataset.i]; if(!it) return;
    const lugar = 'Rancho Agrícola La Memoria'+(it.campo?(' — '+it.campo):'');
    qrUltimo = {codigo: it.codigo, link: it.link, telefono:'', qrTexto: it.codigo || it.link,
      lineas: (it.t==='U' ? ['Invitación — '+lugar, (it.nombre||'Visitante')+' · '+QA.fechaLarga(it.f)] : ['Pase frecuente — '+lugar, it.nombre+(it.empresa?(' · '+it.empresa):''), 'Vigente al '+QA.fechaLarga(it.ff)]).concat(it.ne?['Unidad N° económico '+it.ne]:[]),
      mensaje: (it.t==='U'?'Su invitación a ':'Su pase de acceso frecuente a ')+lugar+': '+it.link+' — Muéstrelo en caseta junto con su identificación oficial.'};
    QA.dibujarQR(document.getElementById('qrResultadoCanvas'), qrUltimo.qrTexto, 440);
    document.getElementById('qrResultadoTxt').innerHTML = '<b>'+(it.t==='U'?'Invitación':'Pase frecuente')+' de '+QA.esc(it.nombre||it.area)+'</b> — emitido el '+fmtFecha(it.emi)+'.';
    document.getElementById('qrResultadoLink').value = it.link;
    document.getElementById('qrResultado').classList.remove('hidden');
    document.getElementById('qrResultado').scrollIntoView({behavior:'smooth', block:'center'});
  });

  function qrRefrescarCampos(){
  }
  function qrRenderTodo(){ qrRefrescarCampos(); qrSembrarUnidadesDeRegistros(); qrRenderUnidades(); qrRenderRecurrentes(); qrRenderEmitidos(); }
  qrAplicarTipo(); qrAplicarMotivo(); qrRenderTodo(); qrEspejar();

}
