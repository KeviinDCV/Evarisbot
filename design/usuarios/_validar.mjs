// Comprueba que cada .dc.html sea HTML canónico: atributos bien formados y entrecomillados,
// etiquetas equilibradas y un único <script> (support.js). Uso: node _validar.mjs A.dc.html B.dc.html ...
import fs from 'fs';

const VACIOS = new Set(['img', 'meta', 'link', 'br', 'input', 'hr']);
let fallosTotales = 0;

for (const fichero of process.argv.slice(2)) {
  const html = fs.readFileSync(fichero, 'utf8');
  const fallos = [];
  const pila = [];
  let scripts = 0;
  const reEtiqueta = /<(\/?)([a-zA-Z][a-zA-Z0-9-]*)([^>]*)>/g;
  let m;
  while ((m = reEtiqueta.exec(html))) {
    const [, cierre, nombreRaw, resto] = m;
    const nombre = nombreRaw.toLowerCase();
    if (nombre === 'script' && !cierre) {
      scripts++;
      if (!/src="\.\/support\.js"/.test(resto)) fallos.push('script distinto de support.js');
    }
    if (cierre) {
      const tope = pila.pop();
      if (tope !== nombre) fallos.push(`cierre </${nombre}> no casa con <${tope}>`);
      continue;
    }
    // Atributos: nombre="valor" sin comillas dobles dentro. Lo que sobre es un atributo roto.
    const atributos = resto.replace(/\/\s*$/, '');
    const reAttr = /\s+([a-zA-Z_:][-a-zA-Z0-9_:.]*)(?:="([^"]*)")?/y;
    let pos = 0;
    while (pos < atributos.length) {
      reAttr.lastIndex = pos;
      const a = reAttr.exec(atributos);
      if (!a) {
        if (atributos.slice(pos).trim()) fallos.push(`<${nombre}> atributo mal formado cerca de: ${atributos.slice(pos, pos + 50)}`);
        break;
      }
      pos = reAttr.lastIndex;
    }
    if (!VACIOS.has(nombre) && !/\/\s*$/.test(resto) && nombre !== '!doctype') pila.push(nombre);
  }
  if (pila.length) fallos.push(`sin cerrar: ${pila.slice(-5).join(', ')}`);
  if (scripts !== 1) fallos.push(`hay ${scripts} <script> (debe haber exactamente 1)`);
  const emoji = html.match(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u);
  if (emoji) fallos.push(`emoji o símbolo: ${emoji[0]}`);

  fallosTotales += fallos.length;
  console.log(`  ${fallos.length ? 'FALLA' : ' ok  '} ${fichero.padEnd(24)} ${fallos.length ? fallos.slice(0, 3).join(' | ') : ''}`);
}
process.exit(fallosTotales ? 1 : 0);
