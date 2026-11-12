// "Hoy": la pantalla de Usuarios tal como está en la app (menú actual + página actual), a pantalla
// completa 1440x900. Es la referencia del antes/después, no una opción.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { T, documento, rielActual } from '../usuarios/_comun.mjs';
import { paginaActual } from '../usuarios/_piezas.mjs';

const DIR = path.dirname(fileURLToPath(import.meta.url));

const html = documento(`
<div style="position: relative; width: 1440px; height: 900px; overflow: hidden; background: ${T.bg}; font-family: ${T.font};">
  ${paginaActual({ izquierda: 80 })}
  ${rielActual('users')}
</div>`);

fs.writeFileSync(path.join(DIR, 'Hoy.dc.html'), html);
console.log(`  Hoy.dc.html  ${Buffer.byteLength(html)} bytes`);
