// Dirección "Marco navy" (la elegida para el menú). La carcasa vive en ../usuarios/_marco.mjs;
// aquí solo se compone con la página real de hoy dentro de la isla, recortado a 960 px.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { documento } from '../usuarios/_comun.mjs';
import { paginaActual } from '../usuarios/_piezas.mjs';
import { carcasaMarco } from '../usuarios/_marco.mjs';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const html = documento(carcasaMarco({ activo: 'users', contenido: paginaActual({ izquierda: 0 }), ancho: 960 }));
fs.writeFileSync(path.join(DIR, 'MarcoNavy.dc.html'), html);
console.log('  MarcoNavy.dc.html  ' + Buffer.byteLength(html) + ' bytes');
