// Paso 1 del rediseño: SOLO el sidebar. Cuatro opciones = {oscuro, claro} x {solo iconos, con nombres}.
// Cada artboard recorta la franja izquierda de la pantalla (760 px de 1440) para que el sidebar ocupe
// buena parte del recuadro, y atenúa la página: es contexto, no lo que se está eligiendo.
// Reutiliza las piezas de ../usuarios (tokens, página real y los cuatro rieles).
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { T, documento } from '../usuarios/_comun.mjs';
import { paginaActual } from '../usuarios/_piezas.mjs';
import { rielActual, rielClaro, rielOscuroNombres, rielClaroNombres } from '../usuarios/_rieles.mjs';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const ANCHO = 760;

// La página se compone a 1440 px, igual que en la app (así no se descoloca), y el recuadro
// muestra solo los primeros 760 px. `izquierda` es el hueco real que deja cada sidebar:
// 80 px cerrado (lg:pl-20), 276 px abierto (lg:pl-[276px]).
const recorte = (riel, izquierda) => `
<div style="position: relative; width: ${ANCHO}px; height: 900px; overflow: hidden; background: ${T.bg}; font-family: ${T.font};">
  <div style="position: absolute; left: 0; top: 0; width: 1440px; height: 900px;">
    <div style="position: absolute; inset: 0; opacity: .42;">${paginaActual({ izquierda })}
    </div>
    ${riel}
  </div>
</div>`;

const ARTBOARDS = {
  'Main.dc.html':          recorte(rielActual('users'), 80),          // oscuro · solo iconos (hoy)
  'ClaroIconos.dc.html':   recorte(rielClaro('users'), 80),           // claro · solo iconos
  'OscuroNombres.dc.html': recorte(rielOscuroNombres('users'), 276),  // oscuro · con nombres
  'ClaroNombres.dc.html':  recorte(rielClaroNombres('users'), 276),   // claro · con nombres (nuevo)
};

for (const [nombre, cuerpo] of Object.entries(ARTBOARDS)) {
  const html = documento(cuerpo);
  fs.writeFileSync(path.join(DIR, nombre), html);
  console.log(`  ${nombre.padEnd(24)} ${String(Buffer.byteLength(html)).padStart(7)} bytes`);
}
