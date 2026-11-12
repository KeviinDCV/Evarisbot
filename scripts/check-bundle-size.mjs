#!/usr/bin/env node
/**
 * Guard de tamaño del chunk de entrada.
 *
 * Nadie vigilaba este número y así se colaron ~110KB sin que nadie lo notara (los dos
 * locales importados estáticamente). Este guard es la mitad durable del arreglo: falla el
 * build si el entry se pasa del límite.
 *
 * Uso: node scripts/check-bundle-size.mjs   (corre después de `npm run build`)
 */
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ASSETS = 'public/build/assets';
// Límite del chunk de entrada (app-*.js), sin comprimir.
// Con sólo el español dentro ronda los ~470KB. 520KB deja aire para crecer sin
// dejar pasar otra regresión del tamaño del inglés (~78KB).
const LIMIT_KB = 520;

let files;
try {
    files = readdirSync(ASSETS).filter((f) => /^app-.*\.js$/.test(f));
} catch {
    console.error(`✗ No existe ${ASSETS}. Corre "npm run build" primero.`);
    process.exit(1);
}

if (files.length !== 1) {
    console.error(`✗ Se esperaba exactamente un app-*.js en ${ASSETS}, se encontraron ${files.length}.`);
    process.exit(1);
}

const bytes = statSync(join(ASSETS, files[0])).size;
const kb = bytes / 1024;

if (kb > LIMIT_KB) {
    console.error(
        `✗ ${files[0]} pesa ${kb.toFixed(1)}KB y supera el límite de ${LIMIT_KB}KB.\n` +
            `  Algo grande entró al chunk de entrada. Sospechosos habituales: un import estático\n` +
            `  de algo que debería ir con import() dinámico (p. ej. un locale completo).`,
    );
    process.exit(1);
}

console.log(`✓ ${files[0]}: ${kb.toFixed(1)}KB (límite ${LIMIT_KB}KB)`);
