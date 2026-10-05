// Rediseño del sidebar · dirección "Luz Clínica".
// Sereno y luminoso: blanco, integrado al borde izquierdo, a alto completo, con un filete fino.
// La marca va en un bloque arriba (logo del HUV en su azul real + "Evarisbot" + institución);
// la navegación respira; el activo es un tinte navy; los contadores separan urgencia (rojo sólido)
// de aviso (píldora pizarra); la persona va abajo sobre una superficie gris muy clara.
//
// Artboard 960x900: la app se compone a 1440x900 (sidebar + página real sin atenuar) y el
// recuadro enseña solo los primeros 960 px.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { T, TONO, icono, NAV, NO_LEIDOS, VISOR, iniciales, documento } from '../usuarios/_comun.mjs';
import { paginaActual } from '../usuarios/_piezas.mjs';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const NOMBRE = 'LuzClinica.dc.html';
const ACTIVO = 'users';

// ── Geometría ────────────────────────────────────────────────────────────────
// Dos ejes verticales mandan en todo el sidebar:
//   L = 24  borde izquierdo VISIBLE del logo, de los iconos, de las cabeceras y del avatar.
//   R = 234 borde derecho VISIBLE de los contadores, de las reglas, del chevron y de plegar.
const SB = 256;             // ancho del sidebar = hueco que deja a la página
const CARRIL = 12;          // margen lateral de la navegación y de la tarjeta de usuario
const L = 24;
const R = SB - CARRIL - 10; // 234
const ITEM = 40;            // alto de cada ítem
const PASO = 2;             // separación entre ítems (paso de 42 px)
const CABECERA = 32;        // alto de la fila de cabecera de grupo
const ENTRE_GRUPOS = 24;
// Los glifos Lucide no llenan su caja: a 18 px el trazo empieza ~2,25 px dentro (x=3 de 24).
// El ítem se corre esos 2 px para que el trazo, no la caja, caiga en L.
const ITEM_PL = L - CARRIL - 2;                     // 10
// Plegar (panel-left-close, trazo x 3..21 de 24) a 18 px en un botón de 28: su borde derecho
// visible queda a 5 + 15,75 = 20,75 px del borde izquierdo del botón.
const PLEGAR_MR = (SB - CARRIL) - (R - 20.75 + 28); // 2,75 px
// Chevron (trazo x 6..18 de 24) a 16 px: su borde derecho visible queda 4 px antes de la caja.
const CARD_PR = (SB - CARRIL) - (R + 4);            // 6 px

// Logo: el PNG (96x76) trae aire transparente alrededor del dibujo (x 8..87, y 6..67). Con
// márgenes negativos la caja del <img> coincide con el dibujo y éste cae en el eje L.
// A 0,75 (72x57) el trazo aún se lee a 1x y "Hospital Universitario" cabe sin tocar el icono
// de plegar; más grande, el texto se mete debajo del icono.
// El bloque de marca arranca a 24 px: así su centro (y ≈ 50) queda a la altura del título de
// la página ("Gestión de usuarios", centro y ≈ 50).
const s = 0.75;
const LOGO = { w: 96 * s, h: 76 * s, ml: 8 * s, mt: 6 * s, mr: 8 * s, mb: 8 * s };

// ── Color (todo sale de T / TONO) ────────────────────────────────────────────
// Contrastes calculados (WCAG 2.x), texto >= 4,5:1 e iconos >= 3:1:
//   T.slate600 / blanco 7,56 · T.slate500 / blanco 4,77 · T.navy / tinte activo 8,60
//   blanco / rojo 4,83 · slate600 / slate100 6,90 · T.navyDeep / T.bg 9,48 · T.muted / T.bg 5,19
//   T.slate500 / T.bg 4,26 (chevron) · blanco / T.navySoft 6,01 (iniciales, peor punto)
// Una sola familia de gris (pizarra) para iconos, cabeceras y nombres: comparten matiz y se
// leen como un sistema; el navy queda para la marca y para "dónde estoy".
const C = {
  fondo: T.card,                        // blanco → #fcfcfd, la tarjeta base del proyecto
  filete: T.border,                     // 1 px a la derecha
  marca: T.navy,                        // "Evarisbot"
  secundario: T.slate500,               // institución, cabeceras, iconos, plegar
  texto: T.slate600,                    // nombres de sección
  regla: T.slate200,                    // reglas finas de las cabeceras de grupo
  activoFondo: 'rgba(46,63,132,.075)',  // tinte de T.navy → #eff1f6
  activoAro: 'rgba(46,63,132,.07)',     // filete interior del activo, para que el tinte tenga borde
  activo: T.navy,
  superficie: T.bg,                     // tarjeta de usuario: el mismo gris del suelo de la página
  rol: T.muted,                         // T.sub sobre T.bg se queda en 4,12: no llega
};

const truncar = 'white-space: nowrap; overflow: hidden; text-overflow: ellipsis;';

// ── Piezas ───────────────────────────────────────────────────────────────────
function contador(badge, n) {
  if (!n) return '';
  const base = `height: 20px; min-width: 20px; padding: 0 6px; flex-shrink: 0; border-radius: 9999px; font-size: 11px; line-height: 1; font-variant-numeric: tabular-nums; display: inline-flex; align-items: center; justify-content: center;`;
  return badge === 'chat'
    // Un paciente espera: rojo sólido.
    ? `<span style="${base} background: ${TONO.chat.pill}; color: #ffffff; font-weight: 700; box-shadow: 0 1px 2px rgba(220,38,38,.28);">${n}</span>`
    // Un colega espera: píldora pizarra suave, menos urgente.
    : `<span style="${base} background: ${T.slate100}; color: ${T.slate600}; font-weight: 600; box-shadow: inset 0 0 0 1px ${T.slate200};">${n}</span>`;
}

function item(it) {
  const act = it.id === ACTIVO;
  const n = it.badge ? NO_LEIDOS[it.badge] : 0;
  return `
          <div style="height: ${ITEM}px; display: flex; align-items: center; gap: 12px; padding: 0 10px 0 ${ITEM_PL}px; border-radius: 10px;${act ? ` background: ${C.activoFondo};` : ''} color: ${act ? C.activo : C.secundario};">
            ${icono(it.i, 18, act ? 2 : 1.75)}
            <span style="min-width: 0; flex: 1; font-size: ${T.base}; line-height: 20px; font-weight: ${act ? 600 : 500}; color: ${act ? C.activo : C.texto}; ${truncar}">${it.t}</span>
            ${contador(it.badge, n)}
          </div>`;
}

// Cabecera en versalitas (mayúsculas de 11 px con tracking) seguida de una regla fina hasta R.
function grupo(g) {
  return `
        <div style="display: flex; flex-direction: column; gap: ${PASO}px;">
          <div style="height: ${CABECERA}px; display: flex; align-items: center; gap: 12px; padding: 0 ${SB - CARRIL - R}px 0 ${L - CARRIL}px;">
            <span style="flex-shrink: 0; font-size: 11px; line-height: 1; font-weight: 600; letter-spacing: .08em; text-transform: uppercase; color: ${C.secundario};">${g.grupo}</span>
            <div style="flex: 1; height: 1px; background: ${C.regla};"></div>
          </div>${g.items.map(item).join('')}
        </div>`;
}

// Marca: logo + "Evarisbot" + institución partida como en el propio logo
// ("HOSPITAL UNIVERSITARIO / DEL VALLE"). Plegar va en la fila de "Evarisbot".
const marca = `
      <div style="flex-shrink: 0; display: flex; align-items: center; gap: 12px; padding: 24px ${CARRIL}px 28px ${L}px;">
        <img src="logo-huv.png" alt="Hospital Universitario del Valle" style="width: ${LOGO.w}px; height: ${LOGO.h}px; flex-shrink: 0; display: block; margin: -${LOGO.mt}px -${LOGO.mr}px -${LOGO.mb}px -${LOGO.ml}px;">
        <div style="min-width: 0; flex: 1; display: flex; flex-direction: column; gap: 3px;">
          <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">
            <span style="font-size: 17px; line-height: 20px; font-weight: 700; letter-spacing: -.015em; color: ${C.marca}; white-space: nowrap;">Evarisbot</span>
            <div title="Contraer menú" style="width: 28px; height: 28px; margin: -4px ${PLEGAR_MR}px -4px 0; flex-shrink: 0; border-radius: 8px; color: ${C.secundario}; display: flex; align-items: center; justify-content: center;">${icono('panel-left-close', 18, 1.75)}</div>
          </div>
          <span style="font-size: ${T.xs}; line-height: 15px; font-weight: 500; color: ${C.secundario};">Hospital Universitario<br>del Valle</span>
        </div>
      </div>`;

// Tarjeta del usuario: abre el panel "Tu puesto", que en la app sale hacia arriba; por eso el
// chevron apunta arriba (el chevron-down de Lucide girado 180°).
const tarjeta = `
      <div style="flex-shrink: 0; padding: ${CARRIL}px;">
        <div style="display: flex; align-items: center; gap: 10px; padding: 10px ${CARD_PR}px 10px ${L - CARRIL}px; border-radius: 12px; background: ${C.superficie};">
          <div style="width: 34px; height: 34px; flex-shrink: 0; border-radius: 9999px; background: linear-gradient(to bottom right, ${T.navySoft}, ${T.navyDeep}); box-shadow: 0 0 0 2px #ffffff, 0 2px 6px rgba(46,63,132,.22); color: #ffffff; font-size: 12px; font-weight: 700; letter-spacing: .02em; display: flex; align-items: center; justify-content: center;">${iniciales(VISOR.nombre)}</div>
          <div style="min-width: 0; flex: 1; display: flex; flex-direction: column; gap: 1px;">
            <span style="font-size: ${T.sm}; line-height: 18px; font-weight: 600; color: ${T.navyDeep}; ${truncar}">${VISOR.nombre}</span>
            <span style="font-size: ${T.xs}; line-height: 16px; font-weight: 500; color: ${C.rol}; ${truncar}">${VISOR.rol}</span>
          </div>
          <div title="Tu puesto" style="flex-shrink: 0; color: ${C.secundario};">${icono('chevron-down', 16, 2, 'transform: rotate(180deg);')}</div>
        </div>
      </div>`;

const sidebar = `
    <aside style="position: absolute; left: 0; top: 0; bottom: 0; width: ${SB}px; z-index: 5; display: flex; flex-direction: column; background: ${C.fondo}; box-shadow: inset -1px 0 0 ${C.filete}, 6px 0 24px -18px rgba(46,63,132,.18); font-family: ${T.font};">${marca}
      <nav style="flex: 1; min-height: 0; display: flex; flex-direction: column; gap: ${ENTRE_GRUPOS}px; padding: 0 ${CARRIL}px;">${NAV.map(grupo).join('')}
      </nav>${tarjeta}
    </aside>`;

const artboard = `
<div style="position: relative; width: 960px; height: 900px; overflow: hidden; background: ${T.bg}; font-family: ${T.font};">
  <div style="position: absolute; left: 0; top: 0; width: 1440px; height: 900px;">${paginaActual({ izquierda: SB })}
    ${sidebar}
  </div>
</div>`;

const html = documento(artboard);
fs.writeFileSync(path.join(DIR, NOMBRE), html);
console.log(`  ${NOMBRE.padEnd(24)} ${String(Buffer.byteLength(html)).padStart(7)} bytes`);
