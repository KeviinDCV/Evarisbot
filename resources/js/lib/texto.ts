/**
 * Texto "plano" para buscar: sin tildes ni diéresis y en minúsculas. Así "munoz" encuentra
 * "MUÑOZ" y "maria" encuentra "MARÍA" (los nombres llegan en mayúsculas con tildes).
 */
export const plano = (texto: string) => texto.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase('es');
