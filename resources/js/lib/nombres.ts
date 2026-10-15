/**
 * Nombres de personas SOLO para pintar (el dato guardado no cambia). Conviven "ANDREA CAROLINA MUÑOZ
 * PAZ" y "Sofía Quintero Ramos", y la lista en mayúsculas sostenidas se lee gritada.
 */

/** Partículas que van en minúscula (salvo al principio) y que no cuentan para las iniciales. */
export const PARTICULAS = new Set(['de', 'del', 'la', 'las', 'los', 'y']);

/** "ANDREA CAROLINA MUÑOZ PAZ" → "Andrea Carolina Muñoz Paz"; los compuestos con guion se respetan. */
export function nombrePropio(nombre: string) {
    const mayuscula = (parte: string) => parte.charAt(0).toLocaleUpperCase('es') + parte.slice(1);

    return nombre
        .toLocaleLowerCase('es')
        .split(/\s+/)
        .filter(Boolean)
        .map((palabra, i) => (i > 0 && PARTICULAS.has(palabra) ? palabra : palabra.split('-').map(mayuscula).join('-')))
        .join(' ');
}

/** Dos iniciales sin partículas: "MARIA DEL PILAR" → "MP" (no "MD"). */
export function iniciales(nombre: string) {
    return nombre
        .split(/\s+/)
        .filter((parte) => parte && !PARTICULAS.has(parte.toLocaleLowerCase('es')))
        .slice(0, 2)
        .map((parte) => parte.charAt(0).toLocaleUpperCase('es'))
        .join('');
}
