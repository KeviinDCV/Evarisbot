// Vista de Usuarios rediseñada dentro de la carcasa "Marco navy" (1440x900, administrador).
//
// Idea: la cabecera resume al equipo en una franja de cifras (con quién está en línea ahora),
// y debajo una sola hoja con la lista agrupada por conexión: primero los que están, luego el resto.
// Cada fila se lee de izquierda a derecha: quién es, qué rol tiene, si está, si puede hacer envío
// masivo, desde cuándo está y qué se le puede hacer.
//
// Datos de MUESTRA de ../usuarios/_comun.mjs; cifras de METRICAS. Colores solo de T (o T.navy con alfa).
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { T, icono, USUARIOS, METRICAS, iniciales, rolTexto, documento } from '../usuarios/_comun.mjs';
import { carcasaMarco, ISLA } from '../usuarios/_marco.mjs';

const DIR = path.dirname(fileURLToPath(import.meta.url));

// ── Tintas derivadas (todas son T.navy con alfa, blanco o tokens de T) ────────
const navyA = (a) => `rgba(46,63,132,${a})`;
const C = {
  hoja: '#ffffff',
  filete: navyA(0.08),        // separadores dentro de la hoja
  fileteFondo: navyA(0.12),   // separadores sobre el fondo de la isla
  banda: navyA(0.028),        // cabecera de grupo
  realce: navyA(0.035),       // fila con el menú abierto
  // Aro del punto en la fila resaltada: realce sobre blanco apilado en dos sombras (sin hex nuevo).
  aroRealce: `${navyA(0.035)}, 0 0 0 2px #ffffff`,
  campo: navyA(0.035),        // relleno del buscador
};
const truncar = 'white-space: nowrap; overflow: hidden; text-overflow: ellipsis;';
const num = 'font-variant-numeric: tabular-nums;';

// ── Geometría ────────────────────────────────────────────────────────────────
const PAD = 28;                 // margen de la isla
const PAD_HOJA = 20;            // sangría interior de la hoja: todo arranca en x = PAD + 20
const ALTO_FILA = 54;           // dos líneas de texto (18 + 2 + 16) con 9 px arriba y abajo
const COLS = 'minmax(0, 1fr) 160px 180px 124px 116px 68px';
const HUECO_COL = 24;

// ── Piezas pequeñas ──────────────────────────────────────────────────────────
const esAdmin = (u) => u.r === 'admin';

/**
 * Nombre propio para MOSTRAR (el dato guardado no cambia): hoy conviven "ANDREA CAROLINA MUÑOZ PAZ"
 * y "Sofía Quintero Ramos", y la lista en mayúsculas sostenidas se lee gritada. Partículas en minúscula.
 */
const PARTICULAS = new Set(['de', 'del', 'la', 'las', 'los', 'y']);
const nombrePropio = (n) => n.toLocaleLowerCase('es').split(' ').filter(Boolean)
  .map((p, i) => (i > 0 && PARTICULAS.has(p) ? p : p.charAt(0).toLocaleUpperCase('es') + p.slice(1))).join(' ');

/** Avatar de iniciales: navy sólido para administradores, tinta navy para asesores. */
const avatar = (u, size = 32, anillo = '') => {
  const fs_ = size >= 32 ? 12 : 11;
  const tono = esAdmin(u)
    ? `background: ${T.navy}; color: #ffffff; box-shadow: ${anillo ? anillo + ', ' : ''}inset 0 0 0 1px rgba(255,255,255,.12);`
    : `background: ${navyA(0.1)}; color: ${T.navy}; box-shadow: ${anillo ? anillo + ', ' : ''}inset 0 0 0 1px ${navyA(0.06)};`;
  return `<div style="width: ${size}px; height: ${size}px; flex-shrink: 0; border-radius: 9999px; ${tono} font-size: ${fs_}px; line-height: 1; font-weight: 600; letter-spacing: .02em; display: flex; align-items: center; justify-content: center;">${iniciales(u.n)}</div>`;
};

/**
 * Punto de presencia sobre el avatar (esmeralda 600: 3,67:1 contra el blanco). El aro que lo recorta
 * lleva el color del fondo de SU fila, para que en la fila resaltada no aparezca un anillo blanco.
 */
const avatarConPresencia = (u, fondoFila = C.hoja) => `
                <div style="position: relative; flex-shrink: 0;">
                  ${avatar(u, 32)}${u.on ? `
                  <span style="position: absolute; right: -3px; bottom: -3px; width: 11px; height: 11px; border-radius: 9999px; background: ${T.emerald600}; box-shadow: 0 0 0 2px ${fondoFila};"></span>` : ''}
                </div>`;

// Sin halo: un halo verde claro pegado al punto lo deja en 2,7:1; el punto solo da 3,26:1 sobre la
// isla, 3,49:1 sobre la banda y 3,65:1 sobre la hoja.
const puntoEnLinea = (d = 8) =>
  `<span style="width: ${d}px; height: ${d}px; flex-shrink: 0; border-radius: 9999px; background: ${T.emerald600};"></span>`;
const puntoDesconectado = (d = 8) =>
  `<span style="width: ${d}px; height: ${d}px; flex-shrink: 0; border-radius: 9999px; background: ${T.slate500};"></span>`;

/** Rol: etiqueta tintada, sin borde duro. */
const rol = (u) => {
  const [fondo, color, aro, ico] = esAdmin(u)
    ? [navyA(0.07), T.navy, navyA(0.14), 'shield-check']
    : [T.sky50, T.sky700, T.sky200, 'headphones'];
  return `<span style="height: 24px; display: inline-flex; align-items: center; gap: 6px; padding: 0 9px 0 7px; border-radius: 7px; background: ${fondo}; box-shadow: inset 0 0 0 1px ${aro}; color: ${color}; font-size: 12px; line-height: 16px; font-weight: 600; white-space: nowrap;">${icono(ico, 14, 2)}${rolTexto(u.r)}</span>`;
};

/** Estado en dos líneas, con el mismo ritmo que nombre / correo. */
const estado = (u) => `
                <div style="min-width: 0; display: flex; flex-direction: column; gap: 2px;">
                  <span style="font-size: 13px; line-height: 18px; font-weight: 500; color: ${u.on ? T.emerald700 : T.slate600}; white-space: nowrap;">${u.on ? 'En línea' : 'Desconectado'}</span>
                  <span title="Última actividad" style="font-size: 12px; line-height: 16px; color: ${T.muted}; ${truncar}">${u.act}</span>
                </div>`;

/**
 * Interruptor de envío masivo. Encendido: pista navy, bolita blanca (9,72:1).
 * Apagado: pista con contorno pizarra 500 y bolita pizarra 500 (4,76:1): se distingue sin color.
 */
const interruptor = (on) => on
  ? `<div title="Quitar envío masivo" style="position: relative; width: 36px; height: 20px; flex-shrink: 0; border-radius: 9999px; background: ${T.navy}; box-shadow: inset 0 1px 1px rgba(0,0,0,.2);"><span style="position: absolute; top: 2px; left: 18px; width: 16px; height: 16px; border-radius: 9999px; background: #ffffff; box-shadow: 0 1px 2px rgba(0,0,0,.28); display: flex; align-items: center; justify-content: center; color: ${T.navy};">${icono('check', 10, 3.5)}</span></div>`
  : `<div title="Dar envío masivo" style="position: relative; width: 36px; height: 20px; flex-shrink: 0; border-radius: 9999px; background: #ffffff; box-shadow: inset 0 0 0 1.5px ${T.slate500};"><span style="position: absolute; top: 5px; left: 5px; width: 10px; height: 10px; border-radius: 9999px; background: ${T.slate500};"></span></div>`;

const botonFantasma = (ico, titulo, activo = false) =>
  `<div title="${titulo}" style="width: 30px; height: 30px; flex-shrink: 0; border-radius: 8px; background: ${activo ? navyA(0.08) : 'transparent'}; box-shadow: ${activo ? `inset 0 0 0 1px ${navyA(0.1)}` : 'none'}; color: ${activo ? T.navy : T.muted}; display: flex; align-items: center; justify-content: center;">${icono(ico, 16, 1.75)}</div>`;

// ── Menú de acciones (abierto en una fila) ───────────────────────────────────
const opcionMenu = (ico, texto, color, colorIco) =>
  `<div style="height: 30px; display: flex; align-items: center; gap: 10px; padding: 0 10px; border-radius: 8px; font-size: 13px; line-height: 18px; font-weight: 500; color: ${color}; white-space: nowrap;"><span style="display: flex; color: ${colorIco};">${icono(ico, 16, 1.75)}</span>${texto}</div>`;

// 216 px de ancho: tapa entera la fecha de la fila de abajo en vez de dejar asomar un trozo.
// Opciones de 30 px y huecos de 2: el menú mide 73 px y deja 13 px de aire sobre la fecha de la
// tercera fila (con 79 px la rozaba a 6 px y la sombra la ensuciaba).
const menuAcciones = `
              <div style="position: absolute; right: ${PAD_HOJA}px; top: 44px; z-index: 10; width: 216px; padding: 4px; border-radius: 12px; background: #ffffff; box-shadow: 0 0 0 1px ${navyA(0.1)}, 0 2px 4px ${navyA(0.06)}, 0 12px 28px -12px ${navyA(0.3)}; display: flex; flex-direction: column; gap: 2px;">
                ${opcionMenu('edit-3', 'Editar', T.navy, T.muted)}
                <div style="height: 1px; margin: 0 6px; background: ${C.filete};"></div>
                ${opcionMenu('trash-2', 'Eliminar', T.red600, T.red600)}
              </div>`;

// ── Fila de persona ──────────────────────────────────────────────────────────
const fila = (u, { abierto = false } = {}) => `
            <div style="position: relative; height: ${ALTO_FILA}px; flex-shrink: 0; padding: 0 ${PAD_HOJA}px; display: grid; grid-template-columns: ${COLS}; column-gap: ${HUECO_COL}px; align-items: center; border-bottom: 1px solid ${C.filete};${abierto ? ` background: ${C.realce};` : ''}">
              <div style="min-width: 0; display: flex; align-items: center; gap: 12px;">
                ${avatarConPresencia(u, abierto ? C.aroRealce : C.hoja)}
                <div style="min-width: 0; display: flex; flex-direction: column; gap: 2px;">
                  <span style="font-size: 13.5px; line-height: 18px; font-weight: 600; letter-spacing: -.003em; color: ${T.navy}; ${truncar}">${nombrePropio(u.n)}</span>
                  <span style="font-size: 12px; line-height: 16px; color: ${T.muted}; ${truncar}">${u.e}</span>
                </div>
              </div>
              <div style="display: flex;">${rol(u)}</div>
              ${estado(u)}
              <div style="display: flex; align-items: center;">${u.r === 'advisor' ? interruptor(u.bulk) : `<span title="Solo asesores" style="font-size: 13px; line-height: 18px; color: ${T.muted};">&mdash;</span>`}</div>
              <span style="font-size: 12.5px; line-height: 18px; color: ${T.muted}; ${num} white-space: nowrap;">${u.reg}</span>
              <div style="display: flex; align-items: center; justify-content: flex-end; gap: 4px;">${botonFantasma('edit-3', 'Editar')}${botonFantasma('ellipsis', 'Más acciones', abierto)}</div>${abierto ? menuAcciones : ''}
            </div>`;

// ── Banda de grupo: el grupo ocupa la columna Usuario y el resto lleva los nombres de columna ──
// Así no hay una cabecera de tabla aparte, y los nombres de columna vuelven a aparecer en cada
// grupo (al desplazarse, la banda se queda pegada arriba).
const th = (t, extra = '') =>
  `<span style="font-size: 11px; line-height: 16px; font-weight: 600; text-transform: uppercase; letter-spacing: .07em; color: ${T.muted}; white-space: nowrap; ${extra}">${t}</span>`;

const grupo = (enLinea, n) => `
            <div style="height: 36px; flex-shrink: 0; padding: 0 ${PAD_HOJA}px; display: grid; grid-template-columns: ${COLS}; column-gap: ${HUECO_COL}px; align-items: center; background: ${C.banda}; border-bottom: 1px solid ${C.filete};">
              <div style="display: flex; align-items: center; gap: 12px;">
                <span style="width: 32px; flex-shrink: 0; display: flex; justify-content: center;">${enLinea ? puntoEnLinea() : puntoDesconectado()}</span>
                <span style="display: flex; align-items: baseline; gap: 8px;"><span style="font-size: 13px; line-height: 16px; font-weight: 600; color: ${enLinea ? T.emerald700 : T.slate600};">${enLinea ? 'En línea' : 'Desconectados'}</span><span style="font-size: 12.5px; line-height: 16px; font-weight: 500; color: ${T.muted}; ${num}">${n}</span></span>
              </div>
              ${th('Rol')}${th('Estado')}${th('Envío masivo')}${th('Registro')}${th('Acciones', 'text-align: right;')}
            </div>`;

// ── Barra de la hoja: buscar, rol, recuento ──────────────────────────────────
const buscador = `
              <div style="position: relative; width: 300px; flex-shrink: 0;">
                <span style="position: absolute; left: 12px; top: 10px; color: ${T.muted};">${icono('search', 16, 1.75)}</span>
                <div style="height: 36px; border-radius: 10px; padding: 0 12px 0 38px; background: ${C.campo}; box-shadow: inset 0 0 0 1px ${navyA(0.1)}; font-size: 13px; line-height: 18px; color: ${T.muted}; display: flex; align-items: center; ${truncar}">Buscar por nombre o email...</div>
              </div>`;

// Las cifras de cada rol ya están en la franja de arriba: el filtro solo filtra.
const opcionRol = (texto, activa) => activa
  ? `<div style="height: 30px; display: flex; align-items: center; padding: 0 14px; border-radius: 8px; background: #ffffff; box-shadow: 0 0 0 1px ${navyA(0.08)}, 0 1px 2px ${navyA(0.12)}, 0 2px 6px -2px ${navyA(0.12)}; font-size: 12.5px; line-height: 16px; font-weight: 600; color: ${T.navy}; white-space: nowrap;">${texto}</div>`
  : `<div style="height: 30px; display: flex; align-items: center; padding: 0 14px; border-radius: 8px; font-size: 12.5px; line-height: 16px; font-weight: 600; color: ${T.muted}; white-space: nowrap;">${texto}</div>`;

const filtroRol = `
              <div style="display: flex; align-items: center; gap: 2px; padding: 3px; border-radius: 11px; background: ${navyA(0.055)};">
                ${opcionRol('Todos', true)}${opcionRol('Administradores', false)}${opcionRol('Asesores', false)}
              </div>`;

const barra = `
            <div style="height: 60px; flex-shrink: 0; padding: 0 ${PAD_HOJA}px; display: flex; align-items: center; gap: 12px; border-bottom: 1px solid ${C.filete};">
              ${buscador}
              ${filtroRol}
              <span style="margin-left: auto; font-size: 12.5px; line-height: 16px; color: ${T.muted}; ${num} white-space: nowrap;"><span style="font-weight: 600; color: ${T.navy};">${METRICAS.total}</span> de ${METRICAS.total} usuarios</span>
            </div>`;

// ── Cabecera de la página ────────────────────────────────────────────────────
const botonNuevo = `
          <div style="height: 38px; flex-shrink: 0; display: flex; align-items: center; gap: 8px; padding: 0 16px 0 14px; border-radius: 10px; background: ${T.btnPrimary}; box-shadow: 0 1px 2px ${navyA(0.3)}, 0 6px 16px -6px ${navyA(0.55)}, inset 0 1px 0 rgba(255,255,255,.14); color: #ffffff; font-size: 13px; line-height: 18px; font-weight: 600; white-space: nowrap;">${icono('user-plus', 16, 2)}Nuevo usuario</div>`;

const cabecera = `
        <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 24px;">
          <div style="display: flex; flex-direction: column; gap: 4px;">
            <h1 style="font-size: 28px; line-height: 34px; font-weight: 600; letter-spacing: -.025em; color: ${T.navy};">Gestión de usuarios</h1>
            <p style="font-size: 14px; line-height: 20px; color: ${T.muted};">Administra los usuarios del sistema</p>
          </div>${botonNuevo}
        </div>`;

// ── Franja de cifras ─────────────────────────────────────────────────────────
const enLinea = USUARIOS.filter((u) => u.on);
if (enLinea.length !== METRICAS.online) throw new Error('la muestra no tiene ' + METRICAS.online + ' en línea');

// Quién está: avatares en fila, tocándose; el aro del color del fondo los separa sin morder iniciales.
const pila = `<div style="display: flex; align-items: center; flex-shrink: 0;">${enLinea.map((u) =>
  `<div title="${nombrePropio(u.n)}" style="flex-shrink: 0; border-radius: 9999px;">${avatar(u, 28, `0 0 0 2px ${T.bg}`)}</div>`).join('')}</div>`;

const cifra = (marca, etiqueta, valor, extra = '', linea = 'center') => `
          <div style="min-width: 0; display: flex; flex-direction: column; gap: 6px;">
            <div style="display: flex; align-items: center; gap: 8px; height: 16px;">${marca}<span style="font-size: 12px; line-height: 16px; font-weight: 500; color: ${T.muted}; ${truncar}">${etiqueta}</span></div>
            <div style="display: flex; align-items: ${linea}; gap: ${linea === 'baseline' ? 8 : 14}px; height: 34px;">
              <span style="font-size: 30px; line-height: 34px; font-weight: 500; letter-spacing: -.03em; color: ${T.navy}; ${num}">${valor}</span>${extra}
            </div>
          </div>`;

const marcaIco = (ico, color) => `<span style="display: flex; color: ${color};">${icono(ico, 14, 2)}</span>`;

// Filete vertical neutro entre cifras (elemento propio, no un borde de tarjeta).
const divisor = `<div style="width: 1px; align-self: stretch; background: ${C.fileteFondo};"></div>`;

const resumen = `
        <div style="display: grid; grid-template-columns: minmax(0, 1fr) 1px minmax(0, 1.55fr) 1px minmax(0, 1fr) 1px minmax(0, 1fr) 1px minmax(0, 1.3fr); column-gap: 24px;">
          ${cifra(marcaIco('users', T.navy), 'Usuarios', METRICAS.total)}${divisor}
          ${cifra(`<span style="width: 14px; display: flex; justify-content: center;">${puntoEnLinea()}</span>`, 'En línea ahora', METRICAS.online, pila)}${divisor}
          ${cifra(marcaIco('shield-check', T.navy), 'Administradores', METRICAS.admins)}${divisor}
          ${cifra(marcaIco('headphones', T.sky700), 'Asesores', METRICAS.advisors)}${divisor}
          ${cifra(marcaIco('send', T.navy), 'Con envío masivo', METRICAS.bulk, `<span style="font-size: 13px; line-height: 16px; color: ${T.muted}; white-space: nowrap;">de ${METRICAS.advisors} asesores</span>`, 'baseline')}
        </div>`;

// ── La hoja ──────────────────────────────────────────────────────────────────
const MENU_EN = 'diegosanchez.r@gmail.com';   // la fila que enseña el menú (…) abierto
const desconectados = USUARIOS.filter((u) => !u.on);
// La undécima fila asoma 18 px bajo el borde de la isla: un velo blanco la funde para que se lea como
// "la lista sigue" y no como letras cortadas a cuchillo. Solo cubre esa fila asomada y el aire vacío
// bajo el correo de la décima (no toca texto legible). Es el enmascarado de desplazamiento de la hoja,
// no un adorno.
const VELO = 24;

const hoja = `
        <div style="position: relative; flex: 1; min-height: 0; display: flex; flex-direction: column; border-radius: 16px 16px 0 0; background: ${C.hoja}; box-shadow: 0 0 0 1px ${navyA(0.07)}, 0 1px 2px ${navyA(0.05)}, 0 14px 32px -18px ${navyA(0.22)}; overflow: hidden;">
          ${barra}
          <div style="position: relative; flex: 1; min-height: 0; display: flex; flex-direction: column;">
            ${grupo(true, METRICAS.online)}${enLinea.map((u) => fila(u, { abierto: u.e === MENU_EN })).join('')}
            ${grupo(false, METRICAS.total - METRICAS.online)}${desconectados.map((u) => fila(u)).join('')}
            <div style="position: absolute; left: 0; right: 0; bottom: 0; height: ${VELO}px; z-index: 5; background: linear-gradient(180deg, rgba(255,255,255,0), #ffffff 88%); pointer-events: none;"></div>
          </div>
        </div>`;

// ── Composición en la isla (1190 x 880) ──────────────────────────────────────
const pantalla = `
      <div style="position: absolute; inset: 0; padding: ${PAD}px ${PAD}px 0; display: flex; flex-direction: column; gap: 24px;">
        ${cabecera}
        ${resumen}
        ${hoja}
      </div>`;

const html = documento(carcasaMarco({ activo: 'users', contenido: pantalla, ancho: 1440 }));
fs.writeFileSync(path.join(DIR, 'Main.dc.html'), html);
console.log(`  Main.dc.html  ${Buffer.byteLength(html)} bytes  (isla ${ISLA.ancho}x${ISLA.alto})`);
