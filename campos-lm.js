/* Catálogo oficial de campos/ubicaciones de Rancho Agrícola La Memoria y reconocimiento de abreviaturas.
   Mismo código en el ERP y en las apps de guardia (RONDINES, CONTROL-ACCESO, INCIDENCIAS, OPERATIVO).
   Alias: cada texto se compara sin acentos ni mayúsculas; "a+b" exige que aparezcan ambas palabras.
   El ORDEN importa: lo más específico va primero (p. ej. Galeras Palomas antes que Campo Palomas). */
(function (g) {
  'use strict';
  // Lista en el orden en que se muestra; "p" es la prioridad al reconocer (menor = se revisa primero).
  const LISTA = [
    { nombre: 'Campo Palomas', p: 90, alias: ['palomas', 'rlm', 'rancho la memoria', 'la memoria', 'campo rlm'] },
    { nombre: 'Galeras Palomas', p: 2, alias: ['galeras+palomas', 'galera+palomas', 'galeras+rlm', 'galera+rlm', 'galeras+rancho'] },
    { nombre: 'Almacén General', p: 4, alias: ['almacen general', 'almacen gral', 'alm general', 'alm gral', 'almacen', 'almacenes', 'ag', 'a g'] },
    { nombre: 'Empaque', p: 80, alias: ['empaque', 'empacadora'] },
    { nombre: 'Galeras Empaque', p: 3, alias: ['galeras+empaque', 'galera+empaque', 'empaque+galeras', 'empaque+galera', 'galeras', 'galera'] },
    { nombre: 'Campo Santa Fe', p: 70, alias: ['santa fe', 'santafe', 'sta fe'] },
    { nombre: 'Campo El Milagro Uno', p: 7, alias: ['milagro uno', 'milagro 1', 'milagro i', 'milagro1', 'milagro'] },
    { nombre: 'Campo El Milagro Dos', p: 6, alias: ['milagro dos', 'milagro 2', 'milagro ii', 'milagro2'] },
    { nombre: 'Campo El Milagro Tres', p: 5, alias: ['milagro tres', 'milagro 3', 'milagro iii', 'milagro3'] },
    { nombre: 'Almacén El Milagro Uno', p: 1, alias: ['almacen+milagro', 'alm+milagro', 'bodega+milagro'] }
  ];

  const norm = t => String(t == null ? '' : t).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  function coincide(n, alias) {
    return String(alias).split('+').every(p => n.includes(' ' + norm(p) + ' '));
  }
  // Devuelve el nombre oficial o '' si no se reconoce. 'lista' permite usar una lista personalizada (misma forma).
  // Rendimiento: la lista se ordena y se normaliza una sola vez por lista, y cada texto ya resuelto se recuerda
  // (antes se rehacía todo por cada registro y la app se congelaba con miles de datos).
  const _prep = new WeakMap();
  function preparar(lista) {
    let p = _prep.get(lista);
    if (!p) {
      const orden = lista.slice().sort((a, b) => (a.p == null ? 50 : a.p) - (b.p == null ? 50 : b.p));
      p = { memo: new Map(), reglas: [] };
      for (const c of orden) {
        p.reglas.push({ nombre: c.nombre, partes: String(c.nombre).split('+').map(x => ' ' + norm(x) + ' ') });
        for (const a of (c.alias || [])) p.reglas.push({ nombre: c.nombre, partes: String(a).split('+').map(x => ' ' + norm(x) + ' ') });
      }
      _prep.set(lista, p);
    }
    return p;
  }
  function oficial(txt, lista) {
    const p = preparar(lista || LISTA);
    const clave = txt == null ? '' : String(txt);
    const hit = p.memo.get(clave); if (hit !== undefined) return hit;
    const n = ' ' + norm(clave) + ' ';
    let r = '';
    if (n.trim() !== '') for (const rg of p.reglas) if (rg.partes.every(x => n.includes(x))) { r = rg.nombre; break; }
    if (p.memo.size > 20000) p.memo.clear();
    p.memo.set(clave, r); return r;
  }
  g.CAMPOS_LM = { lista: LISTA, nombres: LISTA.map(c => c.nombre), oficial, norm };
})(typeof window !== 'undefined' ? window : globalThis);
