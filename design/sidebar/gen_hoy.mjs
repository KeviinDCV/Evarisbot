// "Hoy": el menú actual con el mismo encuadre que los tres rediseños (960 de 1440 px, página sin
// atenuar), para que la comparación sea justa. Es la referencia, no una opción nueva.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { T, documento, rielActual } from '../usuarios/_comun.mjs';
import { paginaActual } from '../usuarios/_piezas.mjs';

const DIR = path.dirname(fileURLToPath(import.meta.url));

const html = documento(`
<div style="position: relative; width: 960px; height: 900px; overflow: hidden; background: ${T.bg}; font-family: ${T.font};">
  <div style="position: absolute; left: 0; top: 0; width: 1440px; height: 900px;">
    ${paginaActual({ izquierda: 80 })}
    ${rielActual('users')}
  </div>
</div>`);

fs.writeFileSync(path.join(DIR, 'Hoy.dc.html'), html);
console.log(`  Hoy.dc.html  ${Buffer.byteLength(html)} bytes`);
