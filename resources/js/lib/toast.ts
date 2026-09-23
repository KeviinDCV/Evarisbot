import { sileo } from 'sileo';
import i18n from '@/i18n';

/**
 * LOS AVISOS DE LA APP (Sileo).
 *
 * Las páginas llaman a toast.success(texto), toast.error(texto) y toast.warning(texto), la misma forma
 * que tenían con sonner, así que cambiar de librería no obliga a tocar cada llamada: basta con importar
 * `toast` de aquí.
 *
 * Sileo está pensado para títulos cortos en una píldora de una sola línea, y nuestros avisos son frases
 * ("Plantilla creada exitosamente."). Si el texto cabe en la píldora va como título; si no, la píldora
 * dice qué pasó en una o dos palabras y la frase completa va en la descripción, que Sileo despliega sola
 * unos segundos (y al pasar el ratón).
 */
type Tipo = 'success' | 'error' | 'warning' | 'info';

/** Caracteres que caben en la píldora (350 px, 13 px de letra) junto al icono sin cortarse. */
const CABE_EN_TITULO = 34;

/** Los errores y advertencias se quedan más tiempo: suelen pedir leer algo. */
const DURACION: Record<Tipo, number> = { success: 4000, info: 4000, warning: 6000, error: 6000 };

const RESUMEN: Record<Tipo, [clave: string, porDefecto: string]> = {
    success: ['toast.success', 'Listo'],
    error: ['toast.error', 'No se pudo completar'],
    warning: ['toast.warning', 'Atención'],
    info: ['toast.info', 'Aviso'],
};

function mostrar(tipo: Tipo, texto: string): string {
    const frase = String(texto ?? '').trim();
    const cabe = frase.length <= CABE_EN_TITULO;
    const [clave, porDefecto] = RESUMEN[tipo];

    return sileo[tipo]({
        title: cabe ? frase : i18n.t(clave, porDefecto),
        description: cabe ? undefined : frase,
        duration: DURACION[tipo],
    });
}

export const toast = {
    success: (texto: string) => mostrar('success', texto),
    error: (texto: string) => mostrar('error', texto),
    warning: (texto: string) => mostrar('warning', texto),
    info: (texto: string) => mostrar('info', texto),
    dismiss: (id: string) => sileo.dismiss(id),
};
