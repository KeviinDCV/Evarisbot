/**
 * Interruptor de los diseños nuevos del remake mientras se prueban: `?nuevo=1` lo activa en este
 * navegador y `?nuevo=0` vuelve al de siempre (queda guardado en localStorage con `clave`). Sin
 * preferencia guardada manda el ajuste del servidor (`porDefecto`).
 */
export function usarDisenoNuevo(clave: string, porDefecto: boolean): boolean {
    if (typeof window === 'undefined') return porDefecto;
    try {
        const pedido = new URLSearchParams(window.location.search).get('nuevo');
        if (pedido === '1' || pedido === '0') window.localStorage.setItem(clave, pedido);
        const guardado = window.localStorage.getItem(clave);
        if (guardado === '1') return true;
        if (guardado === '0') return false;
    } catch {
        // Sin acceso a localStorage: se usa el ajuste del servidor.
    }
    return porDefecto;
}
