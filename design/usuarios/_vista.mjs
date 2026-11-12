// Vista previa local de un .dc.html: logo incrustado y envoltorios del lienzo neutralizados.
// Solo para mirarlo en el visor; el lienzo real usa el .dc.html tal cual.
import fs from 'fs';
const [,, entrada, salida] = process.argv;
let h = fs.readFileSync(entrada, 'utf8');
const logo = fs.readFileSync(new URL('./logo-huv.png', import.meta.url)).toString('base64');
h = h.replace(/src="logo-huv\.png"/g, `src="data:image/png;base64,${logo}"`)
     .replace('<script src="./support.js"></script>', '<style>x-dc,helmet{display:block} body{margin:0}</style>');
fs.writeFileSync(salida, h);
console.log('  vista previa: ' + salida);
