// La carcasa "Marco navy" (elegida por el cliente para el menú): el navy es el MARCO de toda la app,
// el menú vive directamente sobre él y el contenido va en una isla clara con esquinas redondeadas.
// Sale de design/sidebar/gen_MarcoNavy.mjs (dirección + pulido del director de arte), convertida en
// pieza para poder meter cualquier pantalla dentro de la isla.
import { T, icono, NAV, NO_LEIDOS, VISOR, iniciales, GRANO_ATTR } from './_comun.mjs';

// ── Geometría ────────────────────────────────────────────────────────────────
export const SB = 240;          // ancho del menú (sin caja: es una franja del marco)
export const MARCO = 10;        // grosor del marco alrededor de la isla (arriba, abajo, derecha)
export const RADIO_ISLA = 22;
const PAD_IZQ = 12;             // del borde de la ventana a las cápsulas
const PAD_DER = 10;             // de las cápsulas a la isla: el mismo grosor que el marco
const EJE = 12;                 // sangría interior de cápsulas y tarjeta: todo arranca en x = 24
// Isla a 1440x900: 1440 - 240 - 10 = 1190 de ancho, 900 - 20 = 880 de alto.
export const ISLA = { ancho: 1440 - SB - MARCO, alto: 900 - 2 * MARCO };

// ── Tintas sobre el marco ────────────────────────────────────────────────────
// Contraste WCAG calculado (alfa compuesto) contra el punto MÁS CLARO donde cae cada tinta:
// la luz navySoft de arriba a la izquierda sobre T.navy = #394a8f.
const TINTA = {
  titulo: '#ffffff',                     // 8,21:1
  institucion: 'rgba(255,255,255,.7)',   // 4,97:1 (y el rol en la tarjeta: 5,21:1)
  grupo: 'rgba(255,255,255,.66)',        // 4,62:1 en el peor punto, 5,25:1 sobre navy
  nombre: 'rgba(255,255,255,.8)',        // 5,94:1 en el peor punto, 6,88:1 sobre navy
  icono: 'rgba(255,255,255,.72)',        // 5,16:1 en el peor punto (mín. 3:1); 4,54:1 dentro del botón de plegar
};
// Activo: T.navy sobre blanco 9,72:1. Contadores: blanco sobre T.red600 4,76:1; slate-200 sobre la
// píldora translúcida 5,34:1. El rojo contra el navy se queda en 2,04:1 y no hay rojo que dé a la vez
// blanco AA encima y 3:1 contra el navy: la información la lleva el número, que sí cumple.

const MARCO_FONDO = [
  `radial-gradient(560px 420px at 0px 0px, rgba(78,95,164,.35), rgba(78,95,164,0) 72%)`, // luz tenue navySoft
  `linear-gradient(180deg, ${T.navy} 0%, ${T.navyDeep} 60%, ${T.navyDark} 100%)`,
].join(', ');

// ── Piezas del menú ──────────────────────────────────────────────────────────
const contador = (badge, n) => {
  const base = 'height: 20px; min-width: 20px; padding: 0 6px; border-radius: 9999px; font-size: 11px; line-height: 1; font-weight: 700; font-variant-numeric: tabular-nums; letter-spacing: .01em; display: flex; align-items: center; justify-content: center; flex-shrink: 0;';
  return badge === 'chat'
    ? `<span style="${base} background: ${T.red600}; color: #ffffff; box-shadow: inset 0 1px 0 rgba(255,255,255,.18), 0 1px 2px rgba(0,0,0,.3);">${n}</span>`
    : `<span style="${base} background: rgba(255,255,255,.14); color: ${T.slate200}; box-shadow: inset 0 0 0 1px rgba(255,255,255,.1);">${n}</span>`;
};

const item = (it, activo) => {
  const act = it.id === activo;
  const n = it.badge ? NO_LEIDOS[it.badge] : 0;
  // ACTIVO: cápsula blanca con texto e icono navy; la sombra la despega del marco sin halo.
  const capsula = act
    ? ' background: #ffffff; box-shadow: 0 1px 2px rgba(0,0,0,.2), 0 8px 18px -10px rgba(0,0,0,.45);'
    : '';
  return `
          <div style="height: 40px; border-radius: 10px; padding: 0 10px 0 ${EJE}px; display: flex; align-items: center; gap: 12px;${capsula}">
            <span style="display: flex; color: ${act ? T.navy : TINTA.icono};">${icono(it.i, 18, act ? 2 : 1.75)}</span>
            <span style="min-width: 0; flex: 1; font-size: ${T.sm}; line-height: 20px; font-weight: ${act ? 600 : 500}; letter-spacing: -.003em; color: ${act ? T.navy : TINTA.nombre}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${it.t}</span>
            ${n > 0 ? contador(it.badge, n) : ''}
          </div>`;
};

const grupo = (g, activo) => `
        <div style="display: flex; flex-direction: column; gap: 2px;">
          <div style="height: 28px; padding: 0 ${EJE}px; display: flex; align-items: center;">
            <span style="font-size: 11px; line-height: 1; font-weight: 600; text-transform: uppercase; letter-spacing: .09em; color: ${TINTA.grupo}; white-space: nowrap;">${g.grupo}</span>
          </div>${g.items.map((it) => item(it, activo)).join('')}
        </div>`;

export function menuMarco(activo = 'users') {
  return `
    <div style="position: relative; width: ${SB}px; flex-shrink: 0; padding: 24px ${PAD_DER}px ${MARCO}px ${PAD_IZQ}px; display: flex; flex-direction: column;">

      <div style="padding: 0 10px 0 ${EJE}px; display: flex; flex-direction: column; gap: 14px;">
        <div style="display: flex; align-items: center; justify-content: space-between;">
          <div style="width: 64px; height: 64px; border-radius: 14px; background: #ffffff; box-shadow: 0 1px 1px rgba(0,0,0,.18), 0 10px 22px -10px rgba(0,0,0,.55), inset 0 -1px 0 rgba(46,63,132,.08); display: flex; align-items: center; justify-content: center;">
            <img src="logo-huv.png" alt="Hospital Universitario del Valle" style="width: 60px; height: 48px; object-fit: contain; display: block; filter: drop-shadow(0 0 0 ${T.navy});">
          </div>
          <div title="Contraer menú" style="width: 30px; height: 30px; border-radius: 10px; background: rgba(255,255,255,.06); box-shadow: inset 0 0 0 1px rgba(255,255,255,.08); color: ${TINTA.icono}; display: flex; align-items: center; justify-content: center;">${icono('panel-left-close', 18, 1.75)}</div>
        </div>
        <div style="display: flex; flex-direction: column; gap: 2px;">
          <span style="font-size: 18px; line-height: 24px; font-weight: 600; letter-spacing: -.018em; color: ${TINTA.titulo};">Evarisbot</span>
          <span style="font-size: ${T.xs}; line-height: 16px; font-weight: 500; color: ${TINTA.institucion}; white-space: nowrap;">Hospital Universitario del Valle</span>
        </div>
      </div>

      <div style="margin-top: 28px; display: flex; flex-direction: column; gap: 20px;">${NAV.map((g) => grupo(g, activo)).join('')}
      </div>

      <div style="margin-top: auto; border-radius: 14px; padding: 10px 10px 10px ${EJE}px; background: rgba(255,255,255,.07); box-shadow: inset 0 0 0 1px rgba(255,255,255,.08), inset 0 1px 0 rgba(255,255,255,.05); display: flex; align-items: center; gap: 12px;">
        <div style="width: 34px; height: 34px; flex-shrink: 0; border-radius: 9999px; background: linear-gradient(to bottom right, ${T.navySoft}, ${T.navyLight}); box-shadow: 0 0 0 1px rgba(255,255,255,.2), 0 1px 2px rgba(0,0,0,.25); color: #ffffff; font-size: ${T.xs}; font-weight: 700; letter-spacing: .02em; display: flex; align-items: center; justify-content: center;">${iniciales(VISOR.nombre)}</div>
        <div style="min-width: 0; flex: 1; display: flex; flex-direction: column; gap: 1px;">
          <span style="font-size: ${T.sm}; line-height: 18px; font-weight: 600; color: #ffffff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${VISOR.nombre}</span>
          <span style="font-size: ${T.xs}; line-height: 16px; font-weight: 500; color: ${TINTA.institucion}; white-space: nowrap;">${VISOR.rol}</span>
        </div>
      </div>
    </div>`;
}

/**
 * Carcasa completa a 1440x900 recortada a `ancho`: marco navy + menú + isla con `contenido` dentro.
 * La isla es position: relative + overflow hidden, así que el contenido se posiciona respecto a ella
 * (1190 x 880 px).
 */
export function carcasaMarco({ activo = 'users', contenido = '', ancho = 1440 } = {}) {
  const isla = `
    <div style="position: relative; flex: 1; min-width: 0; margin: ${MARCO}px ${MARCO}px ${MARCO}px 0; border-radius: ${RADIO_ISLA}px; background: ${T.bg}; overflow: hidden; box-shadow: inset 0 1px 0 rgba(255,255,255,.9), 0 0 0 1px rgba(0,0,0,.14), 0 20px 44px -22px rgba(0,0,0,.6);">${contenido}
    </div>`;
  return `
<div style="position: relative; width: ${ancho}px; height: 900px; overflow: hidden; background: ${T.bg}; font-family: ${T.font};">
  <div style="position: absolute; left: 0; top: 0; width: 1440px; height: 900px; display: flex; background: ${MARCO_FONDO};">
    <div style="position: absolute; inset: 0; background-image: ${GRANO_ATTR}; pointer-events: none;"></div>${menuMarco(activo)}${isla}
  </div>
</div>`;
}
