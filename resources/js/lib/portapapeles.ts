/**
 * Copiar texto al portapapeles también entrando por la IP (http://192.168.2.172:8000).
 *
 * `navigator.clipboard` solo existe en direcciones seguras (https o localhost): por la IP de la red interna no está y
 * copiar no hacía nada. Si no está o falla, se copia a la antigua con un textarea oculto y execCommand('copy'), que sí
 * funciona por http. Devuelve si se copió, para no decir «copiado» cuando no fue así.
 */
export async function copiarTexto(texto: string): Promise<boolean> {
    try {
        if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(texto);
            return true;
        }
    } catch {
        // se intenta a la antigua
    }
    const area = document.createElement('textarea');
    area.value = texto;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    let ok = false;
    try {
        ok = document.execCommand('copy');
    } catch {
        ok = false;
    }
    area.remove();
    return ok;
}
