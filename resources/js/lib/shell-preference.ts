import { useSyncExternalStore } from 'react';

/**
 * EL INTERRUPTOR DEL MENÚ: "Marco navy" (el de todos) o el riel anterior.
 *
 * El Marco navy es el menú de toda la app: asesores y administradores lo ven por defecto.
 * El riel anterior queda como salida de emergencia SÓLO para administradores (el envoltorio
 * de admin-layout ignora esta preferencia para los asesores): si una pantalla se viera mal
 * con el menú nuevo, un administrador puede seguir trabajando con el de antes desde su
 * carnet y volver con un clic. La preferencia es por NAVEGADOR (localStorage), no por
 * usuario en BD: es una salida reversible, no un ajuste de cuenta.
 *
 * Store a nivel de módulo + useSyncExternalStore (y no un useState en el layout) porque
 * AdminLayout se re-monta en CADA navegación de Inertia: leer en el render inicial evita
 * pintar un menú y saltar al otro. Además, el evento 'storage' sincroniza las demás
 * pestañas abiertas: si el administrador cambia de menú, todas cambian.
 */
const KEY = 'evaris.shell';
/** Lo único que se guarda es la elección explícita del riel anterior. Sin clave → Marco navy. */
const LEGACY = 'legacy';

type Listener = () => void;
const listeners = new Set<Listener>();

/** Si el navegador bloquea la escritura, la elección vive en memoria hasta recargar. */
let enMemoria: boolean | null = null;

/** Lectura con guarda: SSR (sin window) y navegadores que bloquean el almacenamiento. */
function readMarco(): boolean {
    if (typeof window === 'undefined') return true;
    if (enMemoria !== null) return enMemoria;
    try {
        return window.localStorage.getItem(KEY) !== LEGACY;
    } catch {
        return true;
    }
}

function emit() {
    for (const l of listeners) l();
}

function onStorage(e: StorageEvent) {
    // key === null → localStorage.clear() en otra pestaña.
    if (e.key === KEY || e.key === null) emit();
}

function subscribe(listener: Listener): () => void {
    listeners.add(listener);
    if (listeners.size === 1) window.addEventListener('storage', onStorage);
    return () => {
        listeners.delete(listener);
        if (listeners.size === 0) window.removeEventListener('storage', onStorage);
    };
}

/** El servidor (resources/js/ssr.tsx) no sabe nada del navegador: pinta el menú de todos. */
function getServerSnapshot(): boolean {
    return true;
}

/** true = Marco navy (quita la elección guardada); false = riel anterior en este navegador. */
export function setMarcoShell(on: boolean): void {
    try {
        if (on) window.localStorage.removeItem(KEY);
        else window.localStorage.setItem(KEY, LEGACY);
        enMemoria = null;
    } catch {
        enMemoria = on;
    }
    emit();
}

/** ¿Este navegador usa el menú "Marco navy"? (booleano primitivo: snapshot estable) */
export function useMarcoShell(): boolean {
    return useSyncExternalStore(subscribe, readMarco, getServerSnapshot);
}
