// Dirección "Navy flotante": la evolución premium del riel de hoy.
// Una tarjeta navy que flota a 12 px de los bordes, abierta y con nombres.
// Artboard 960x900: se compone la pantalla real a 1440x900 y el recuadro muestra los primeros 960 px.
//
// Lo que cambia frente al riel abierto de hoy:
//  - El logo del HUV en una placa blanca, en su azul (hoy es line-art blanco casi invisible).
//  - Marca en dos líneas: "Evarisbot" + "HUV · Cali", en vez de EVARISBOT espaciado.
//  - Un eje vertical único (x = 36) para placa, iconos y avatar; cabeceras de grupo alineadas
//    con el borde de los iconos y 20 px de aire entre grupos.
//  - Iconos de 18 px pegados al nombre (gap 12) en lugar de una columna de 64 px.
//  - Contadores dentro de la fila, alineados a la derecha, sin anillo navy ni barra de presión.
//  - El carnet sobre una superficie translúcida, con chevron (el popover real abre hacia arriba).
// Ritmo: ítems de 40 px cada 44 px (el mismo paso de hoy: 30 asesores, 8 horas al día).
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { T, icono, NAV, NO_LEIDOS, VISOR, iniciales, documento, GRANO_ATTR, TONO } from '../usuarios/_comun.mjs';
import { paginaActual } from '../usuarios/_piezas.mjs';

const DIR = path.dirname(fileURLToPath(import.meta.url));

// ── Geometría ────────────────────────────────────────────────────────────────
// La tarjeta: 12 px de aire arriba, abajo y a la izquierda; 252 px de ancho.
// 12 + 252 + 12 = 276: el mismo hueco que hoy deja el menú fijado (lg:pl-[276px]).
const MARGEN = 12;
const ANCHO = 252;
const RADIO = 22;
const HUECO = MARGEN + ANCHO + MARGEN;

// Un solo eje vertical en x = 36 (medido desde el borde de la tarjeta): el centro de la placa
// del logo, de cada icono y del avatar caen en la misma línea.
const EJE = 36;
const INSET = 10;            // margen lateral de las cápsulas y del carnet
const ICONO = 18;
const PAD_ITEM = EJE - ICONO / 2 - INSET;   // 17: relleno izquierdo dentro de la cápsula
const ALTO_ITEM = 40;

// ── Tinta sobre navy ─────────────────────────────────────────────────────────
// Contraste medido contra el punto MÁS CLARO bajo cada elemento (degradado + luz de arriba):
const tinta = {
  producto: '#ffffff',                // "Evarisbot"        8,08:1
  sub: 'rgba(255,255,255,.72)',       // "HUV · Cali"       5,25:1
  grupo: 'rgba(255,255,255,.66)',     // TRABAJO / GESTIÓN  4,99:1 y 5,51:1
  item: 'rgba(255,255,255,.80)',      // nombres            6,70:1
  iconoItem: 'rgba(255,255,255,.72)', // iconos             5,77:1 (mín. 3)
  control: 'rgba(255,255,255,.64)',   // plegar             4,56:1 (mín. 3)
  rol: 'rgba(255,255,255,.72)',       // "Administrador"    5,73:1 sobre el carnet
  chevron: 'rgba(255,255,255,.60)',   // chevron del carnet 4,52:1 (mín. 3)
};

const truncar = 'white-space: nowrap; overflow: hidden; text-overflow: ellipsis;';

// El PNG es line-art de 1 px casi todo semitransparente (solo 21 píxeles opacos): reducido a 36 px
// se deshace en gris. Tres sombras sin desenfoque de 0,3 px engrosan el trazo en SU PROPIO azul
// (#5c82bf = media de los píxeles opacos del PNG), como un hinting: no recolorea ni recorta el logo.
const AZUL_LOGO = '#5c82bf';
const LOGO_TRAZO = `filter: drop-shadow(.3px 0 0 ${AZUL_LOGO}) drop-shadow(-.3px 0 0 ${AZUL_LOGO}) drop-shadow(0 .3px 0 ${AZUL_LOGO});`;

// ── Contadores ───────────────────────────────────────────────────────────────
function contador(tipo, n) {
  const base = `height: 20px; min-width: 22px; padding: 0 7px; border-radius: 9999px; font-size: 11px; line-height: 1; font-weight: 700; font-variant-numeric: tabular-nums; letter-spacing: .01em; display: flex; align-items: center; justify-content: center; flex-shrink: 0;`;
  // Rojo y pizarra sobre navy se parecen en luminancia (1,98:1 y 1,42:1): el color distingue, pero
  // la forma no llegaría al 3:1 de un elemento gráfico. Un filete blanco al 50 % la recorta
  // contra la tarjeta (3,70:1) sin tocar el relleno.
  const filete = '0 0 0 1px rgba(255,255,255,.5)';
  if (tipo === 'chat') {
    // Rojo sólido: un paciente espera. Dígitos blancos 4,83:1 sobre #dc2626.
    return `<span style="${base} background: ${TONO.chat.pill}; color: #ffffff; box-shadow: ${filete}, 0 1px 3px rgba(0,0,0,.3);">${n}</span>`;
  }
  // Pizarra translúcida: un colega espera. Dígitos blancos 7,1:1 sobre la mezcla.
  return `<span style="${base} background: rgba(148,163,184,.24); color: #ffffff; box-shadow: inset ${filete};">${n}</span>`;
}

// ── Ítem de navegación ───────────────────────────────────────────────────────
function item(it, activo) {
  const act = it.id === activo;
  const n = it.badge ? NO_LEIDOS[it.badge] : 0;
  const capsula = act
    ? `background: ${T.card}; box-shadow: 0 1px 2px rgba(0,0,0,.20), 0 8px 18px -6px rgba(0,0,0,.34), 0 0 22px rgba(255,255,255,.07), inset 0 -1px 0 rgba(46,63,132,.10);`
    : '';
  return `
          <div style="position: relative; height: ${ALTO_ITEM}px; border-radius: 12px; padding: 0 10px 0 ${PAD_ITEM}px; display: flex; align-items: center; gap: 12px; ${capsula}">
            <span style="display: flex; color: ${act ? T.navy : tinta.iconoItem};">${icono(it.i, ICONO, act ? 2 : 1.75)}</span>
            <span style="min-width: 0; flex: 1; font-size: ${T.sm}; line-height: ${T.lhSm}; font-weight: ${act ? 600 : 500}; letter-spacing: -.005em; color: ${act ? T.navy : tinta.item}; ${truncar}">${it.t}</span>
            ${n > 0 ? contador(it.badge, n) : ''}
          </div>`;
}

function grupo(g, activo, primero) {
  return `
        <div style="display: flex; flex-direction: column; gap: 4px;${primero ? '' : ' margin-top: 20px;'}">
          <div style="height: 26px; padding: 0 0 6px ${PAD_ITEM}px; display: flex; align-items: flex-end;">
            <span style="font-size: 11px; line-height: 1; font-weight: 600; text-transform: uppercase; letter-spacing: .1em; color: ${tinta.grupo}; white-space: nowrap;">${g.grupo}</span>
          </div>${g.items.map((it) => item(it, activo)).join('')}
        </div>`;
}

// ── La tarjeta ───────────────────────────────────────────────────────────────
function navyFlotante(activo = 'users') {
  const placa = EJE - 20; // placa de 40 px centrada en el eje
  // Revisión: los dos bloques de identidad (marca arriba, carnet abajo) comparten columna de texto.
  // Placa 40 centrada en el eje + 12 de hueco = texto en x 68 de la tarjeta; avatar 36 centrado en
  // el eje + 14 de hueco = el nombre cae en la misma x 68. Antes el nombre quedaba 5 px más a la izquierda.
  const avatar = 36;
  const padCarnet = EJE - avatar / 2 - INSET; // 8
  // Columna derecha común en x 232 de la tarjeta: borde del icono de plegar, de los contadores y,
  // ahora, del trazo del chevron (el glifo deja 4 px de aire dentro de su caja de 16: 10 - 4 = 6).
  const padDerCarnet = 6;

  return `
  <div role="navigation" aria-label="Navegación principal" style="position: absolute; left: ${MARGEN}px; top: ${MARGEN}px; bottom: ${MARGEN}px; width: ${ANCHO}px; border-radius: ${RADIO}px; background: radial-gradient(130% 160px at 50% 0%, rgba(255,255,255,.075), rgba(255,255,255,0)), linear-gradient(180deg, ${T.navy} 0%, ${T.navyDark} 100%); box-shadow: 0 1px 2px rgba(38,53,111,.18), 0 12px 28px -10px rgba(38,53,111,.42), 0 32px 64px -32px rgba(46,63,132,.45), inset 0 1px 0 rgba(255,255,255,.14), inset 0 0 0 1px rgba(255,255,255,.06); display: flex; flex-direction: column; z-index: 5; font-family: ${T.font};">
    <div style="position: absolute; inset: 0; border-radius: ${RADIO}px; background-image: ${GRANO_ATTR}; pointer-events: none;"></div>

    <div style="position: relative; height: 72px; flex-shrink: 0; padding: 0 12px 0 ${placa}px; display: flex; align-items: center; gap: 12px;">
      <div style="width: 40px; height: 40px; flex-shrink: 0; border-radius: 12px; background: #ffffff; box-shadow: 0 1px 2px rgba(0,0,0,.22), 0 4px 10px -2px rgba(0,0,0,.22), inset 0 0 0 1px rgba(46,63,132,.06), inset 0 -1px 0 rgba(46,63,132,.08); display: flex; align-items: center; justify-content: center;">
        <img src="logo-huv.png" alt="Hospital Universitario del Valle" style="width: 36px; height: 28.5px; display: block; ${LOGO_TRAZO}">
      </div>
      <div style="min-width: 0; flex: 1; display: flex; flex-direction: column; gap: 2px;">
        <span style="font-size: ${T.lg}; line-height: 1.2; font-weight: 600; letter-spacing: -.01em; color: ${tinta.producto}; ${truncar}">Evarisbot</span>
        <span style="font-size: ${T.xs}; line-height: 1.2; font-weight: 500; color: ${tinta.sub}; ${truncar}">HUV<span style="padding: 0 5px; opacity: .8;">·</span>Cali</span>
      </div>
      <div title="Contraer menú" style="width: 30px; height: 30px; flex-shrink: 0; border-radius: 9px; color: ${tinta.control}; display: flex; align-items: center; justify-content: center;">${icono('panel-left-close', 18, 1.75)}</div>
    </div>

    <div style="position: relative; height: 1px; margin: 0 16px; flex-shrink: 0; background: linear-gradient(90deg, rgba(255,255,255,0), rgba(255,255,255,.12) 18%, rgba(255,255,255,.12) 82%, rgba(255,255,255,0));"></div>

    <div style="position: relative; flex: 1; min-height: 0; padding: 12px ${INSET}px 0; display: flex; flex-direction: column;">${NAV.map((g, i) => grupo(g, activo, i === 0)).join('')}
    </div>

    <div style="position: relative; flex-shrink: 0; padding: ${INSET}px;">
      <div style="border-radius: ${RADIO - INSET}px; padding: ${padCarnet}px ${padDerCarnet}px ${padCarnet}px ${padCarnet}px; background: linear-gradient(180deg, rgba(255,255,255,.085), rgba(255,255,255,.06)); box-shadow: inset 0 0 0 1px rgba(255,255,255,.08), inset 0 1px 0 rgba(255,255,255,.07), 0 1px 2px rgba(0,0,0,.12); display: flex; align-items: center; gap: 14px;">
        <div style="width: ${avatar}px; height: ${avatar}px; flex-shrink: 0; border-radius: 9999px; background: linear-gradient(to bottom right, ${T.navySoft}, ${T.navyDeep}); box-shadow: 0 0 0 1.5px rgba(255,255,255,.22), 0 2px 6px rgba(0,0,0,.25); color: #ffffff; font-size: ${T.xs}; font-weight: 700; letter-spacing: .02em; display: flex; align-items: center; justify-content: center;">${iniciales(VISOR.nombre)}</div>
        <div style="min-width: 0; flex: 1; display: flex; flex-direction: column; gap: 1px;">
          <span style="font-size: 13px; line-height: 1.35; font-weight: 600; color: #ffffff; ${truncar}">${VISOR.nombre}</span>
          <span style="font-size: ${T.xs}; line-height: 1.3; font-weight: 500; color: ${tinta.rol}; ${truncar}">${VISOR.rol}</span>
        </div>
        <span style="display: flex; color: ${tinta.chevron};">${icono('chevron-down', 16, 2, 'transform: rotate(180deg);')}</span>
      </div>
    </div>
  </div>`;
}

// ── Artboard ─────────────────────────────────────────────────────────────────
const cuerpo = `
<div style="position: relative; width: 960px; height: 900px; overflow: hidden; background: ${T.bg}; font-family: ${T.font};">
  <div style="position: absolute; left: 0; top: 0; width: 1440px; height: 900px;">${paginaActual({ izquierda: HUECO })}
    ${navyFlotante('users')}
  </div>
</div>`;

const nombre = 'NavyFlotante.dc.html';
const html = documento(cuerpo);
fs.writeFileSync(path.join(DIR, nombre), html);
console.log(`  ${nombre.padEnd(24)} ${String(Buffer.byteLength(html)).padStart(7)} bytes`);
